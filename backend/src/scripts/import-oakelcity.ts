import {
  createProductsWorkflow,
} from "@medusajs/core-flows";
import {
  ExecArgs,
  IProductModuleService,
  IRegionModuleService,
  ISalesChannelModuleService,
} from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
  ProductStatus,
} from "@medusajs/framework/utils";
import * as fs from "fs";

// Oakel City Floor — Shopify storefront at oakelcity.com.
// Pre-fetched via curl: ~/exports/oakelcity-import/oakelcity-raw.json
const PRODUCTS_FILE = "/Users/renostars/exports/oakelcity-import/oakelcity-raw.json";
const SOURCE_TAG = "oakelcity.com";
const BRAND = "Oakel City Floor";
const BATCH_SIZE = 5;
const HANDLE_PREFIX = "oakelcity-";
const SKU_PREFIX = "OAKEL-";

// product_type → existing-category handle in our DB
const CATEGORY_MAP: Record<string, string> = {
  "Engineered Hardwood": "flooring-engineered-hardwood",
  "Waterproof Laminate": "flooring-laminate",
  "Luxury Vinyl": "flooring-vinyl",
  "Loose Lay & Dry Back": "flooring-vinyl",
};

type ShopifyVariant = {
  id: number;
  sku: string | null;
  title: string;
  price: string;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  barcode: string | null;
};

type ShopifyImage = { id: number; src: string; position?: number };

type ShopifyProduct = {
  id: number;
  title: string;
  handle: string;
  body_html: string;
  vendor: string;
  product_type: string;
  tags: string[];
  options: Array<{ name: string; position: number; values: string[] }>;
  variants: ShopifyVariant[];
  images: ShopifyImage[];
  published_at: string | null;
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function safeHandle(h: string, id: number): string {
  const base = (h || String(id))
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${HANDLE_PREFIX}${base || id}`;
}

export default async function importOakelcity({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const productModule: IProductModuleService = container.resolve(
    ModuleRegistrationName.PRODUCT
  );
  const salesChannelModule: ISalesChannelModuleService = container.resolve(
    ModuleRegistrationName.SALES_CHANNEL
  );
  const regionModule: IRegionModuleService = container.resolve(
    ModuleRegistrationName.REGION
  );

  const [defaultSalesChannel] = await salesChannelModule.listSalesChannels({
    name: "Default Sales Channel",
  });
  if (!defaultSalesChannel) throw new Error("Default Sales Channel not found");

  const regions = await regionModule.listRegions({});
  const cadRegion = regions.find((r) => r.currency_code === "cad");
  if (!cadRegion) throw new Error("CAD region not found");

  // Resolve category handles → IDs
  const wantedHandles = Array.from(new Set(Object.values(CATEGORY_MAP)));
  const allCategories = await productModule.listProductCategories(
    {},
    { take: 5000, select: ["id", "name", "handle"] as any }
  );
  const catByHandle = new Map<string, string>(
    allCategories
      .filter((c) => wantedHandles.includes(c.handle))
      .map((c) => [c.handle, c.id])
  );
  for (const handle of new Set(Object.values(CATEGORY_MAP))) {
    if (!catByHandle.has(handle)) {
      throw new Error(`Expected category handle "${handle}" not found`);
    }
  }

  if (!fs.existsSync(PRODUCTS_FILE)) {
    throw new Error(`Missing ${PRODUCTS_FILE}`);
  }
  const rawJson = JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf8"));
  const raw: ShopifyProduct[] = rawJson.products || rawJson;
  logger.info(`Loaded ${raw.length} oakelcity products from disk`);

  // Idempotency — skip handles already imported
  const existingProducts = await productModule.listProducts(
    {},
    { take: 50000, select: ["handle"] as any }
  );
  const existingHandles = new Set(existingProducts.map((p) => p.handle));
  const toImport = raw.filter(
    (p) => !existingHandles.has(safeHandle(p.handle, p.id))
  );
  const skipped = raw.length - toImport.length;
  logger.info(
    `  ${toImport.length} new products to import (${skipped} already exist)`
  );

  let imported = 0;
  let failed = 0;
  const failures: Array<{ handle: string; error: string }> = [];

  for (let i = 0; i < toImport.length; i += BATCH_SIZE) {
    const batch = toImport.slice(i, i + BATCH_SIZE);

    const medusaProducts = batch.map((sp) => {
      const handle = safeHandle(sp.handle, sp.id);

      const productType = sp.product_type || "";
      const catHandle = CATEGORY_MAP[productType];
      const catId = catHandle ? catByHandle.get(catHandle) : undefined;
      if (!catId) {
        logger.warn(
          `  ⚠ no category mapping for product_type="${productType}" (${sp.handle})`
        );
      }

      // Deduplicate images
      const seenImg = new Set<string>();
      const images: { url: string }[] = [];
      for (const img of sp.images || []) {
        if (!img.src || seenImg.has(img.src)) continue;
        seenImg.add(img.src);
        images.push({ url: img.src });
      }

      // Real options vs Shopify's "Default Title" stub
      const realOptions = (sp.options || []).filter(
        (o) => !(o.values.length === 1 && o.values[0] === "Default Title")
      );
      const medusaOptions =
        realOptions.length > 0
          ? realOptions.map((o) => ({ title: o.name, values: o.values }))
          : [{ title: "Default", values: ["Default"] }];

      const medusaVariants = (sp.variants || []).map((v) => {
        const optionMap: Record<string, string> = {};
        if (realOptions.length > 0) {
          realOptions.forEach((o, idx) => {
            const value = (v as any)[`option${idx + 1}`];
            if (value) optionMap[o.name] = value;
          });
        } else {
          optionMap["Default"] = "Default";
        }

        const priceCad = parseFloat(v.price);
        const prices =
          isFinite(priceCad) && priceCad > 0
            ? [{ amount: priceCad, currency_code: "cad" }]
            : [];

        return {
          title: v.title === "Default Title" ? "Default" : v.title,
          sku: v.sku || `${SKU_PREFIX}${sp.id}-${v.id}`,
          barcode: v.barcode || undefined,
          options: optionMap,
          manage_inventory: false,
          prices,
        };
      });

      if (medusaVariants.length === 0) {
        medusaVariants.push({
          title: "Default",
          sku: `${SKU_PREFIX}${sp.id}`,
          options: { Default: "Default" },
          manage_inventory: false,
          prices: [],
        } as any);
      }

      const description = sp.body_html
        ? stripHtml(sp.body_html)
        : `${BRAND} ${productType}: ${sp.title}`;

      return {
        title: sp.title,
        handle,
        description,
        status: ProductStatus.PUBLISHED,
        category_ids: catId ? [catId] : [],
        images,
        options: medusaOptions,
        variants: medusaVariants,
        sales_channels: [{ id: defaultSalesChannel.id }],
        metadata: {
          source: SOURCE_TAG,
          brand: BRAND,
          shopify_product_id: String(sp.id),
          shopify_handle: sp.handle,
          shopify_vendor: sp.vendor,
          shopify_product_type: productType,
          shopify_tags: (sp.tags || []).join(", "),
          source_url: `https://oakelcity.com/products/${sp.handle}`,
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
      logger.warn(`  Batch failed: ${e.message?.slice(0, 200)}. Retrying individually...`);
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

    logger.info(
      `  progress: ${Math.min(i + BATCH_SIZE, toImport.length)}/${toImport.length} | imported=${imported} failed=${failed}`
    );
  }

  logger.info(
    `✅ ${SOURCE_TAG} (as ${BRAND}): imported ${imported}, skipped ${skipped}, failed ${failed}`
  );
  if (failures.length > 0) {
    logger.info(`  first 10 failures:`);
    failures.slice(0, 10).forEach((f) => logger.info(`    - ${f.handle}: ${f.error}`));
  }
}
