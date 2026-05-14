import {
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createTaxRegionsWorkflow,
  updateStoresWorkflow,
} from "@medusajs/core-flows";
import {
  ExecArgs,
  IProductModuleService,
  IRegionModuleService,
  ISalesChannelModuleService,
  IStoreModuleService,
} from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
  ProductStatus,
} from "@medusajs/framework/utils";

const SHOPIFY_DOMAIN = "https://www.neonovadecor.ca";
const SOURCE_TAG = "neonovadecor.ca";
const CURRENCY = "cad";
const COUNTRY = "ca";
const BATCH_SIZE = 5;

type ShopifyVariant = {
  id: number;
  title: string;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  sku: string | null;
  price: string;
  compare_at_price?: string | null;
  grams?: number;
  available?: boolean;
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
  variants: ShopifyVariant[];
  images: ShopifyImage[];
  options: Array<{ name: string; position: number; values: string[] }>;
};

async function fetchAllProducts(): Promise<ShopifyProduct[]> {
  const all: ShopifyProduct[] = [];
  for (let page = 1; page <= 50; page++) {
    const url = `${SHOPIFY_DOMAIN}/products.json?limit=250&page=${page}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Fetch failed page ${page}: ${resp.status}`);
    const data = (await resp.json()) as { products: ShopifyProduct[] };
    if (data.products.length === 0) break;
    all.push(...data.products);
    if (data.products.length < 250) break;
  }
  return all;
}

function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parsePrice(priceStr: string): number {
  // Medusa 2.0 stores prices as the decimal value in the major currency unit
  // (NOT cents). Shopify gives "899.00" — pass through as 899, not 89900.
  const n = parseFloat(priceStr || "0");
  if (!isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

function isDefaultOption(name: string): boolean {
  return /^(title|default title)$/i.test((name || "").trim());
}

export default async function importNeonova({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const salesChannelModule: ISalesChannelModuleService = container.resolve(
    ModuleRegistrationName.SALES_CHANNEL
  );
  const productModule: IProductModuleService = container.resolve(
    ModuleRegistrationName.PRODUCT
  );
  const storeModule: IStoreModuleService = container.resolve(
    ModuleRegistrationName.STORE
  );
  const regionModule: IRegionModuleService = container.resolve(
    ModuleRegistrationName.REGION
  );

  // ──────────────────────────────────────────────────────────────────────
  // STEP 1 — Make sure CAD currency + Canada region exist
  // ──────────────────────────────────────────────────────────────────────
  logger.info("[1/5] Ensuring CAD currency + Canada region...");

  const [store] = await storeModule.listStores(
    {},
    { relations: ["supported_currencies"] }
  );
  const currentCurrencies = store.supported_currencies || [];
  const hasCAD = currentCurrencies.some((c) => c.currency_code === CURRENCY);
  if (!hasCAD) {
    // Preserve existing currencies + their is_default flag; if none was marked
    // default, mark the first one (EUR from seed) explicitly so the validator passes.
    const hasAnyDefault = currentCurrencies.some((c) => !!c.is_default);
    const preserved = currentCurrencies.map((c, idx) => ({
      currency_code: c.currency_code,
      is_default: !!c.is_default || (!hasAnyDefault && idx === 0),
    }));
    await updateStoresWorkflow(container).run({
      input: {
        selector: { id: store.id },
        update: {
          supported_currencies: [
            ...preserved,
            { currency_code: CURRENCY, is_default: false },
          ],
        },
      },
    });
    logger.info(`  ✓ Added ${CURRENCY.toUpperCase()} to store currencies`);
  } else {
    logger.info(`  ✓ ${CURRENCY.toUpperCase()} already in store currencies`);
  }

  const existingRegions = await regionModule.listRegions({
    currency_code: CURRENCY,
  });
  if (existingRegions.length === 0) {
    await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: "Canada",
            currency_code: CURRENCY,
            countries: [COUNTRY],
            payment_providers: ["pp_system_default"],
          },
        ],
      },
    });
    await createTaxRegionsWorkflow(container).run({
      input: [{ country_code: COUNTRY }],
    });
    logger.info("  ✓ Created Canada region + tax region");
  } else {
    logger.info("  ✓ Canada region already exists");
  }

  // ──────────────────────────────────────────────────────────────────────
  // STEP 2 — Default sales channel
  // ──────────────────────────────────────────────────────────────────────
  const [defaultSalesChannel] = await salesChannelModule.listSalesChannels({
    name: "Default Sales Channel",
  });
  if (!defaultSalesChannel) {
    throw new Error("Default Sales Channel not found — run `yarn run seed` first");
  }

  // ──────────────────────────────────────────────────────────────────────
  // STEP 3 — Fetch all Shopify products
  // ──────────────────────────────────────────────────────────────────────
  logger.info("[2/5] Fetching products from neonovadecor.ca/products.json ...");
  const shopifyProducts = await fetchAllProducts();
  logger.info(`  ✓ Fetched ${shopifyProducts.length} products`);

  // ──────────────────────────────────────────────────────────────────────
  // STEP 4 — Create categories from product_type (idempotent)
  // ──────────────────────────────────────────────────────────────────────
  logger.info("[3/5] Building category map from product_type ...");
  const types = Array.from(
    new Set(shopifyProducts.map((p) => p.product_type).filter(Boolean))
  );
  logger.info(`  ${types.length} unique product types`);

  // List ALL categories then filter
  const allCategories = await productModule.listProductCategories(
    {},
    { take: 5000 }
  );
  logger.info(`  ${allCategories.length} categories in DB`);
  const existingCatByName = new Map<string, string>(
    allCategories.map((c) => [c.name, c.id])
  );

  const typesToCreate = types.filter((t) => !existingCatByName.has(t));
  if (typesToCreate.length > 0) {
    logger.info(`  Creating ${typesToCreate.length} new categories: ${typesToCreate.join(", ")}`);
    // Create one-by-one and swallow duplicate-handle errors (handle is derived
    // from name and may collide with existing categories regardless of casing).
    for (const name of typesToCreate) {
      try {
        const { result } = await createProductCategoriesWorkflow(
          container
        ).run({
          input: {
            product_categories: [{ name, is_active: true }],
          },
        });
        existingCatByName.set(result[0].name, result[0].id);
      } catch (e: any) {
        if (/already exists/i.test(e.message)) {
          logger.warn(`    ⚠ category "${name}" handle collision, skipping`);
        } else {
          throw e;
        }
      }
    }
  } else {
    logger.info("  ✓ All categories already exist");
  }

  // ──────────────────────────────────────────────────────────────────────
  // STEP 5 — Import products in batches (idempotent — skip existing handle)
  // ──────────────────────────────────────────────────────────────────────
  logger.info(
    "[4/5] Loading existing product handles for idempotent skip ..."
  );
  const existingProducts = await productModule.listProducts(
    {},
    { take: 10000, select: ["id", "handle"] as any }
  );
  const existingHandles = new Set(existingProducts.map((p) => p.handle));
  logger.info(`  ${existingHandles.size} products already in DB`);

  logger.info("[5/5] Importing products in batches of " + BATCH_SIZE + " ...");

  let imported = 0;
  let skipped = 0;
  let failed = 0;
  const failures: Array<{ handle: string; error: string }> = [];

  const toImportAll = shopifyProducts.filter(
    (p) => !existingHandles.has(p.handle)
  );
  skipped += shopifyProducts.length - toImportAll.length;
  logger.info(
    `  ${toImportAll.length} new products to import (${skipped} already exist)`
  );

  for (let i = 0; i < toImportAll.length; i += BATCH_SIZE) {
    const batch = toImportAll.slice(i, i + BATCH_SIZE);

    const medusaProducts = batch.map((sp) => {
      // Filter out default "Title" options
      const realOptions = (sp.options || []).filter(
        (o) => !isDefaultOption(o.name)
      );
      const optionNames = realOptions.map((o) => o.name);

      const options =
        realOptions.length > 0
          ? realOptions.map((o) => ({
              title: o.name,
              values: o.values,
            }))
          : [{ title: "Default", values: ["Default"] }];

      const variants = sp.variants.map((v) => {
        const variantOptions: Record<string, string> = {};
        if (optionNames.length > 0) {
          if (v.option1 && optionNames[0])
            variantOptions[optionNames[0]] = v.option1;
          if (v.option2 && optionNames[1])
            variantOptions[optionNames[1]] = v.option2;
          if (v.option3 && optionNames[2])
            variantOptions[optionNames[2]] = v.option3;
        } else {
          variantOptions["Default"] = "Default";
        }

        // SKU strategy: prefix with shopify variant id to guarantee uniqueness
        // across listings (NeoNova has duplicate Shopify products sharing SKUs)
        const baseSku = v.sku && v.sku.trim() ? v.sku.trim() : "neonova";
        const variantData: any = {
          title: v.title || "Default",
          sku: `${baseSku}-${v.id}`,
          options: variantOptions,
          manage_inventory: false,
          prices: [
            { amount: parsePrice(v.price), currency_code: CURRENCY },
          ],
        };
        if (v.grams && v.grams > 0) variantData.weight = v.grams;
        return variantData;
      });

      return {
        title: sp.title,
        handle: sp.handle,
        description: stripHtml(sp.body_html),
        status: ProductStatus.PUBLISHED,
        category_ids:
          sp.product_type && existingCatByName.has(sp.product_type)
            ? [existingCatByName.get(sp.product_type)!]
            : [],
        images: (sp.images || []).map((img) => ({ url: img.src })),
        options,
        variants,
        sales_channels: [{ id: defaultSalesChannel.id }],
        metadata: {
          shopify_id: sp.id.toString(),
          source: SOURCE_TAG,
          vendor: sp.vendor || "",
          imported_at: new Date().toISOString(),
          // Stash Shopify tags in metadata for now — full tag entities can be
          // pre-created and linked in a follow-up pass.
          shopify_tags: sp.tags?.join(",") || "",
        },
      };
    });

    try {
      await createProductsWorkflow(container).run({
        input: { products: medusaProducts as any },
      });
      imported += medusaProducts.length;
    } catch (e: any) {
      // Retry one-by-one so a single bad product doesn't kill the batch
      logger.warn(
        `  Batch ${Math.floor(i / BATCH_SIZE) + 1} bulk insert failed: ${e.message}. Retrying individually...`
      );
      for (const single of medusaProducts) {
        try {
          await createProductsWorkflow(container).run({
            input: { products: [single as any] },
          });
          imported += 1;
        } catch (singleErr: any) {
          failed += 1;
          failures.push({
            handle: single.handle,
            error: singleErr.message?.slice(0, 200) || "unknown",
          });
        }
      }
    }

    if ((i + BATCH_SIZE) % 25 === 0 || i + BATCH_SIZE >= toImportAll.length) {
      logger.info(
        `  progress: ${Math.min(i + BATCH_SIZE, toImportAll.length)}/${
          toImportAll.length
        } | imported=${imported} failed=${failed}`
      );
    }
  }

  logger.info("─────────────────────────────────────────────");
  logger.info(`✅ Import complete`);
  logger.info(`   Imported: ${imported}`);
  logger.info(`   Skipped (already existed): ${skipped}`);
  logger.info(`   Failed: ${failed}`);
  if (failures.length > 0) {
    logger.info("   Failed handles (first 10):");
    failures.slice(0, 10).forEach((f) => {
      logger.info(`     - ${f.handle}: ${f.error}`);
    });
  }
  logger.info("─────────────────────────────────────────────");
}
