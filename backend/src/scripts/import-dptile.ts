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

// dptile.ca is a Gatsby static site backed by Contentful. All products are
// in a single GraphQL static query JSON at:
//   https://dptile.ca/page-data/sq/d/1975842911.json
// → data.allContentfulProducts.nodes[]
const DATA_URL = "https://dptile.ca/page-data/sq/d/1975842911.json";
const SOURCE_TAG = "dptile.ca";
const BRAND = "DP Tile & Stone";
const BATCH_SIZE = 5;

type DPColor = {
  id: string;
  fluid?: { src: string };
};
type DPProduct = {
  slug: string;
  name: string;
  lookTags?: string[];
  typeTags?: string[];
  modelNumber?: string;
  seriesSlug?: string;
  coverImage?: { fluid?: { src: string } };
  colors?: DPColor[];
};

function normUrl(src: string): string {
  if (!src) return "";
  if (src.startsWith("//")) return "https:" + src;
  return src;
}

function safeHandle(s: string, fallback: string): string {
  const cleaned = (s || fallback)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || fallback;
}

export default async function importDPTile({ container }: ExecArgs) {
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

  logger.info("Fetching dptile.ca products from Contentful via Gatsby...");
  const resp = await fetch(DATA_URL);
  if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);
  const data = (await resp.json()) as any;
  const products: DPProduct[] = data?.data?.allContentfulProducts?.nodes || [];
  logger.info(`  ✓ Fetched ${products.length} products`);

  // dptile uses lookTags (Concrete, Marble, etc.) as the main category axis.
  // Prefix with "Tile — " so they don't collide with NeoNova categories.
  const CAT_PREFIX = "Tile — ";

  const existingCategories = await productModule.listProductCategories(
    {},
    { take: 5000 }
  );
  const catByName = new Map<string, string>(
    existingCategories.map((c) => [c.name, c.id])
  );

  const catNames = new Set<string>();
  for (const p of products) {
    for (const tag of p.lookTags || []) {
      if (tag?.trim()) catNames.add(CAT_PREFIX + tag);
    }
  }
  const toCreate = Array.from(catNames).filter((n) => !catByName.has(n));
  logger.info(`  ${catNames.size} look-tag categories, ${toCreate.length} new`);
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

  const toImport = products.filter(
    (p) => p.slug && !existingHandles.has(safeHandle(p.slug, `dptile-${p.modelNumber}`))
  );
  const skipped = products.length - toImport.length;
  logger.info(`  ${toImport.length} new products to import (${skipped} already exist)`);

  let imported = 0;
  let failed = 0;
  const failures: Array<{ handle: string; error: string }> = [];

  for (let i = 0; i < toImport.length; i += BATCH_SIZE) {
    const batch = toImport.slice(i, i + BATCH_SIZE);

    const medusaProducts = batch.map((sp) => {
      const handle = safeHandle(sp.slug, `dptile-${sp.modelNumber || i}`);

      // Synthesize a description from tags + series
      const descParts: string[] = [];
      if (sp.seriesSlug) descParts.push(`Part of the ${sp.seriesSlug} series.`);
      if (sp.lookTags?.length)
        descParts.push(`Style: ${sp.lookTags.join(", ")}.`);
      if (sp.typeTags?.length)
        descParts.push(`Recommended for: ${sp.typeTags.join(", ")}.`);
      const description = descParts.join(" ");

      const images: { url: string }[] = [];
      const seen = new Set<string>();
      if (sp.coverImage?.fluid?.src) {
        const u = normUrl(sp.coverImage.fluid.src);
        if (!seen.has(u)) { images.push({ url: u }); seen.add(u); }
      }
      for (const c of sp.colors || []) {
        if (c.fluid?.src) {
          const u = normUrl(c.fluid.src);
          if (!seen.has(u)) { images.push({ url: u }); seen.add(u); }
        }
      }

      const category_ids = (sp.lookTags || [])
        .map((t) => catByName.get(CAT_PREFIX + t))
        .filter(Boolean) as string[];

      return {
        title: sp.name,
        handle,
        description,
        status: ProductStatus.PUBLISHED,
        category_ids,
        images,
        options: [{ title: "Default", values: ["Default"] }],
        variants: [
          {
            title: "Default",
            sku: `dptile-${sp.modelNumber || sp.slug}`,
            options: { Default: "Default" },
            manage_inventory: false,
          },
        ],
        sales_channels: [{ id: defaultSalesChannel.id }],
        metadata: {
          source: SOURCE_TAG,
          brand: BRAND,
          model_number: sp.modelNumber || "",
          series: sp.seriesSlug || "",
          look_tags: (sp.lookTags || []).join(","),
          type_tags: (sp.typeTags || []).join(","),
          source_url: `https://dptile.ca/products/${sp.slug}`,
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

  logger.info(`✅ dptile.ca: imported ${imported}, skipped ${skipped}, failed ${failed}`);
  if (failures.length > 0) {
    logger.info(`  first 5 failures:`);
    failures.slice(0, 5).forEach((f) => logger.info(`    - ${f.handle}: ${f.error}`));
  }
}
