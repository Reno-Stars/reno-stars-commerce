import { ExecArgs, IProductModuleService } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
} from "@medusajs/framework/utils";

const SHOPIFY_DOMAIN = "https://www.neonovadecor.ca";

/**
 * One-off fixup: any NeoNova product currently missing a category gets
 * linked to the category derived from its Shopify product_type. Needed
 * because the first run of import-neonova.ts had a bug where the
 * existingCatByName map wasn't repopulated after handle-collision skips.
 *
 * Idempotent: re-running is safe — already-linked products are untouched.
 */
export default async function fixNeonovaCategories({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const productModule: IProductModuleService = container.resolve(
    ModuleRegistrationName.PRODUCT
  );

  // 1. Fetch Shopify product_type for every NeoNova product (by handle)
  logger.info("Fetching Shopify product → type map ...");
  const handleToType: Record<string, string> = {};
  for (let page = 1; page <= 50; page++) {
    const resp = await fetch(
      `${SHOPIFY_DOMAIN}/products.json?limit=250&page=${page}`
    );
    const data = (await resp.json()) as { products: any[] };
    if (!data.products.length) break;
    for (const p of data.products) {
      if (p.handle && p.product_type) {
        handleToType[p.handle] = p.product_type;
      }
    }
    if (data.products.length < 250) break;
  }
  logger.info(`  ✓ Mapped ${Object.keys(handleToType).length} handles`);

  // 2. Get all categories
  const allCategories = await productModule.listProductCategories(
    {},
    { take: 5000 }
  );
  const catByName = new Map(allCategories.map((c) => [c.name, c.id]));

  // 3. Find all NeoNova products + their current categories
  const products = await productModule.listProducts(
    // `metadata` is a real runtime filter but is absent from
    // FilterableProductProps, so the cast has to sit on the whole filter object
    // — `{ metadata: ... as any }` still trips TS2353 on the KEY and fails
    // `medusa build`. Runtime payload is unchanged.
    {
      metadata: { source: "neonovadecor.ca" },
    } as any,
    {
      take: 10000,
      relations: ["categories"],
      select: ["id", "handle"] as any,
    }
  );
  logger.info(`  ✓ Loaded ${products.length} NeoNova products`);

  const toFix = products.filter(
    (p) => !p.categories || p.categories.length === 0
  );
  logger.info(`  ${toFix.length} products missing a category`);

  let fixed = 0;
  let skipped = 0;
  for (const p of toFix) {
    const type = handleToType[p.handle];
    if (!type) {
      skipped++;
      continue;
    }
    const catId = catByName.get(type);
    if (!catId) {
      skipped++;
      continue;
    }
    try {
      // updateProducts accepts category_ids replacement
      await productModule.updateProducts(p.id, { category_ids: [catId] });
      fixed++;
    } catch (e: any) {
      logger.warn(`  ⚠ failed to link ${p.handle} → ${type}: ${e.message}`);
      skipped++;
    }
  }
  logger.info(`✅ Fixed ${fixed} products, skipped ${skipped}`);
}
