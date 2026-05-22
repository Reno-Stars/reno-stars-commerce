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

// Triforest Flooring's retail brand is Toucan Flooring (toucanflooring.com),
// which runs on Shopify and exposes /products.json publicly. We import as
// brand="Triforest Flooring" since that's the supplier name Reno Stars uses.
// Pre-fetched to /tmp/triforest-products.json by:
//   python3 /tmp/fetch-toucan.py
// (script paginates /products.json?limit=250&page=N until empty)
const PRODUCTS_FILE = "/tmp/triforest-products.json";
const SOURCE_TAG = "toucanflooring.com";
const BRAND = "Triforest Flooring";
const BATCH_SIZE = 5;

type ShopifyVariant = {
  id: number;
  sku: string | null;
  title: string;
  price: string;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  barcode: string | null;
  inventory_quantity?: number;
  weight?: number;
  weight_unit?: string;
};

type ShopifyImage = {
  id: number;
  src: string;
  alt: string | null;
  position?: number;
};

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
  // Toucan handles are already URL-safe; just suffix with id to dedupe
  const base = (h || `triforest-${id}`)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `triforest-${base || id}`;
}

export default async function importTriforest({ container }: ExecArgs) {
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
      `Missing ${PRODUCTS_FILE} — run python3 /tmp/fetch-toucan.py first`
    );
  }
  const raw: ShopifyProduct[] = JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf8"));
  logger.info(`Loaded ${raw.length} triforest/toucan products from disk`);

  // Categories — Shopify product_type values become Medusa categories,
  // prefixed "Flooring — " so they don't collide with existing tile/etc cats
  const CAT_PREFIX = "Flooring — ";
  const existingCategories = await productModule.listProductCategories(
    {},
    { take: 5000 }
  );
  const catByName = new Map<string, string>(
    existingCategories.map((c) => [c.name, c.id])
  );

  const catNames = new Set<string>();
  for (const p of raw) catNames.add(CAT_PREFIX + (p.product_type || "Other"));
  const toCreate = Array.from(catNames).filter((n) => !catByName.has(n));
  logger.info(`  ${catNames.size} product_type categories, ${toCreate.length} new`);
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

  // Idempotent: skip handles that already exist
  const existingProducts = await productModule.listProducts(
    {},
    { take: 50000, select: ["handle"] as any }
  );
  const existingHandles = new Set(existingProducts.map((p) => p.handle));
  logger.info(`  ${existingHandles.size} existing handles loaded`);

  const toImport = raw.filter(
    (p) => !existingHandles.has(safeHandle(p.handle, p.id))
  );
  const skipped = raw.length - toImport.length;
  logger.info(`  ${toImport.length} new products to import (${skipped} already exist)`);

  let imported = 0;
  let failed = 0;
  const failures: Array<{ handle: string; error: string }> = [];

  for (let i = 0; i < toImport.length; i += BATCH_SIZE) {
    const batch = toImport.slice(i, i + BATCH_SIZE);

    const medusaProducts = batch.map((sp) => {
      const handle = safeHandle(sp.handle, sp.id);
      const cat = catByName.get(CAT_PREFIX + (sp.product_type || "Other"));

      // Deduplicate images (Shopify sometimes lists same src multiple times)
      const seenImg = new Set<string>();
      const images: { url: string }[] = [];
      for (const img of sp.images || []) {
        if (!img.src || seenImg.has(img.src)) continue;
        seenImg.add(img.src);
        images.push({ url: img.src });
      }

      // Build Medusa options from Shopify options. Toucan uses "Default Title"
      // for most products (single SKU); preserve real options when present
      // (e.g., colour, size variants).
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
        return {
          title: v.title === "Default Title" ? "Default" : v.title,
          sku: v.sku || `triforest-${sp.id}-${v.id}`,
          barcode: v.barcode || undefined,
          options: optionMap,
          manage_inventory: false,
          // Prices intentionally omitted — Toucan public JSON shows $0.00
          // for all variants (B2B retail prices are not public). User can
          // fill these in via the admin UI later.
        };
      });

      // If no variants in Shopify (unlikely), create a default one
      if (medusaVariants.length === 0) {
        medusaVariants.push({
          title: "Default",
          sku: `triforest-${sp.id}`,
          options: { Default: "Default" },
          manage_inventory: false,
        } as any);
      }

      const description = sp.body_html
        ? stripHtml(sp.body_html)
        : `${BRAND} ${sp.product_type}: ${sp.title}`;

      return {
        title: sp.title,
        handle,
        description,
        status: ProductStatus.PUBLISHED,
        category_ids: cat ? [cat] : [],
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
          shopify_product_type: sp.product_type,
          shopify_tags: (sp.tags || []).join(", "),
          source_url: `https://www.toucanflooring.com/products/${sp.handle}`,
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

  logger.info(
    `✅ toucanflooring.com (as ${BRAND}): imported ${imported}, skipped ${skipped}, failed ${failed}`
  );
  if (failures.length > 0) {
    logger.info(`  first 10 failures:`);
    failures.slice(0, 10).forEach((f) => logger.info(`    - ${f.handle}: ${f.error}`));
  }
}
