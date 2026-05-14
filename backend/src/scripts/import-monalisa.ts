import {
  createProductCategoriesWorkflow,
  createProductsWorkflow,
} from "@medusajs/core-flows";
import {
  ExecArgs,
  IProductModuleService,
  ISalesChannelModuleService,
} from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
  ProductStatus,
} from "@medusajs/framework/utils";
import * as fs from "fs";

// monalisatile.ca is a Chinese PHPCMS site — no API. The product catalog was
// pre-scraped to /tmp/monalisa-products.json by the shell prep step (see
// commit message). This importer reads that file and inserts into Medusa.
const PRODUCTS_FILE = "/tmp/monalisa-products.json";
const SOURCE_TAG = "monalisatile.ca";
const BRAND = "Monalisa Tiles";
const BATCH_SIZE = 5;

// Filter out site-chrome images that appear on every product page.
const BANNER_HASHES = new Set([
  "20190128034440579", // logo
  "20190310061114288", // top banner
]);

type MonalisaProduct = {
  id: number;
  catid: number;
  category: string;
  name: string;
  full_title: string;
  url: string;
  images: string[];
};

function safeHandle(name: string, id: number): string {
  const base = (name || `monalisa-${id}`)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "product"}-${id}`;
}

function normImgUrl(url: string): string {
  // www.monalisatile.ca supports HTTPS; rewrite http to https
  return url.replace(/^http:\/\//, "https://");
}

export default async function importMonalisa({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const salesChannelModule: ISalesChannelModuleService = container.resolve(
    ModuleRegistrationName.SALES_CHANNEL
  );
  const productModule: IProductModuleService = container.resolve(
    ModuleRegistrationName.PRODUCT
  );

  const [defaultSalesChannel] = await salesChannelModule.listSalesChannels({
    name: "Default Sales Channel",
  });
  if (!defaultSalesChannel) throw new Error("Default Sales Channel not found");

  if (!fs.existsSync(PRODUCTS_FILE)) {
    throw new Error(
      `Missing ${PRODUCTS_FILE} — run the scraper first (see comments)`
    );
  }
  const raw: MonalisaProduct[] = JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf8"));
  logger.info(`Loaded ${raw.length} monalisa products from disk`);

  // Categories — prefix with "Tile — " to match dptile and avoid collisions
  const CAT_PREFIX = "Tile — ";
  const existingCategories = await productModule.listProductCategories(
    {},
    { take: 5000 }
  );
  const catByName = new Map<string, string>(
    existingCategories.map((c) => [c.name, c.id])
  );

  const catNames = new Set<string>();
  for (const p of raw) catNames.add(CAT_PREFIX + p.category);
  const toCreate = Array.from(catNames).filter((n) => !catByName.has(n));
  logger.info(`  ${catNames.size} size categories, ${toCreate.length} new`);
  for (const name of toCreate) {
    try {
      const { result } = await createProductCategoriesWorkflow(container).run({
        input: { product_categories: [{ name, is_active: true }] },
      });
      catByName.set(result[0].name, result[0].id);
    } catch (e: any) {
      if (!/already exists/i.test(e.message)) {
        logger.warn(`  ⚠ category "${name}": ${e.message}`);
      }
    }
  }

  const existingProducts = await productModule.listProducts(
    {},
    { take: 50000, select: ["handle"] as any }
  );
  const existingHandles = new Set(existingProducts.map((p) => p.handle));
  logger.info(`  ${existingHandles.size} existing handles loaded`);

  const toImport = raw.filter(
    (p) => !existingHandles.has(safeHandle(p.name, p.id))
  );
  const skipped = raw.length - toImport.length;
  logger.info(`  ${toImport.length} new products to import (${skipped} already exist)`);

  let imported = 0;
  let failed = 0;
  const failures: Array<{ handle: string; error: string }> = [];

  for (let i = 0; i < toImport.length; i += BATCH_SIZE) {
    const batch = toImport.slice(i, i + BATCH_SIZE);

    const medusaProducts = batch.map((sp) => {
      const handle = safeHandle(sp.name, sp.id);

      // Filter site-chrome banners from images
      const cleanImages: { url: string }[] = [];
      const seen = new Set<string>();
      for (const u of sp.images || []) {
        const isBanner = Array.from(BANNER_HASHES).some((h) => u.includes(h));
        if (isBanner) continue;
        const https = normImgUrl(u);
        if (seen.has(https)) continue;
        seen.add(https);
        cleanImages.push({ url: https });
      }

      const description = `Porcelain tile, ${sp.category}. Product code ${sp.name}. From Monalisa Tiles, Richmond BC.`;

      const cat = catByName.get(CAT_PREFIX + sp.category);

      return {
        title: sp.name,
        handle,
        description,
        status: ProductStatus.PUBLISHED,
        category_ids: cat ? [cat] : [],
        images: cleanImages,
        options: [{ title: "Default", values: ["Default"] }],
        variants: [
          {
            title: "Default",
            sku: `monalisa-${sp.id}`,
            options: { Default: "Default" },
            manage_inventory: false,
          },
        ],
        sales_channels: [{ id: defaultSalesChannel.id }],
        metadata: {
          source: SOURCE_TAG,
          brand: BRAND,
          product_code: sp.name,
          size: sp.category,
          source_url: sp.url,
          imported_at: new Date().toISOString(),
        },
      };
    });

    try {
      await createProductsWorkflow(container).run({
        input: { products: medusaProducts as any },
      });
      imported += medusaProducts.length;
      medusaProducts.forEach((p: any) => existingHandles.add(p.handle));
    } catch (e: any) {
      logger.warn(`  Batch failed: ${e.message}. Retrying individually...`);
      for (const single of medusaProducts) {
        try {
          await createProductsWorkflow(container).run({
            input: { products: [single as any] },
          });
          imported += 1;
        } catch (singleErr: any) {
          failed += 1;
          failures.push({
            handle: (single as any).handle,
            error: singleErr.message?.slice(0, 200) || "unknown",
          });
        }
      }
    }

    if ((i + BATCH_SIZE) % 50 === 0 || i + BATCH_SIZE >= toImport.length) {
      logger.info(
        `  progress: ${Math.min(i + BATCH_SIZE, toImport.length)}/${toImport.length} | imported=${imported} failed=${failed}`
      );
    }
  }

  logger.info(`✅ monalisatile.ca: imported ${imported}, skipped ${skipped}, failed ${failed}`);
  if (failures.length > 0) {
    logger.info(`  first 5 failures:`);
    failures.slice(0, 5).forEach((f) => logger.info(`    - ${f.handle}: ${f.error}`));
  }
}
