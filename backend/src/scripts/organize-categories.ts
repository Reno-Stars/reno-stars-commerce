import {
  createProductCategoriesWorkflow,
  updateProductCategoriesWorkflow,
} from "@medusajs/core-flows";
import { ExecArgs, IProductModuleService } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
} from "@medusajs/framework/utils";

// ── Category hierarchy ────────────────────────────────────────────────────
// Maps an existing flat category name → its desired top-level parent.
// (Two-level tree. We can deepen this later if Bathroom / Flooring get more
// children than fit comfortably.)
//
// Children that should be RENAMED (e.g. "Tile — Stone" → "Stone" once under
// the Tile parent) are listed as { from, to }. Others use the name as-is.

const HIERARCHY: Record<string, Array<string | { from: string; to: string }>> = {
  Bathroom: [
    "Vanity",
    "Faucet",
    "Shower",
    "LED MIrror",      // note: original DB has this typo casing
    "Medicine Cabinet",
    "Smart Toilet",
    "toilet",           // lowercase from NeoNova source
    "Fixtures",
  ],
  Tile: [
    { from: "Tile — Concrete", to: "Concrete" },
    { from: "Tile — Stone", to: "Stone" },
    { from: "Tile — Marble", to: "Marble" },
    { from: "Tile — Wood", to: "Wood-look" },
    { from: "Tile — Metal", to: "Metal" },
    { from: "Tile — Fabric", to: "Fabric" },
    { from: "Tile — Mosaic", to: "Mosaic Look" },
    { from: "Tile — 24\" X 24\"", to: "24\" × 24\"" },
    { from: "Tile — 24\" X 36\"", to: "24\" × 36\"" },
    { from: "Tile — 24\" X 48\"", to: "24\" × 48\"" },
    { from: "Tile — 32\" X 32\"", to: "32\" × 32\"" },
    { from: "Tile — 36\" X 36\"", to: "36\" × 36\"" },
    { from: "Tile — 36\" X 72\"", to: "36\" × 72\"" },
    { from: "Tile — Over Sizes", to: "Oversize" },
    { from: "Tile — Mosaics", to: "Mosaic Tiles" },
    { from: "Tile — Hardwood Tiles", to: "Hardwood-look Tiles" },
    "Porcelain Tiles",
    "Ceramic Tiles",
    "Natural Tiles",
    "Glass Tiles",
    "Mosaic Tiles",
    "Feature Wall Tiles",
    "Wall Tiles",
    "Tiles",
  ],
  Flooring: [
    "Hardwood Flooring",
    "Solid Hardwood Flooring",
    "Engineered Hardwood Flooring",
    "Vinyl Flooring",
    "Vinyl Click Flooring",
    "Glue Down/Loose Lay Vinyl Flooring",
    "Laminate Flooring",
    "Laminate",
    "SPC",
    "Hardwood",
    "Vinyl",
    "Carpet Flooring",
    "Residential Carpet Flooring",
    "Commercial Carpet Flooring",
    "Looped",
    "Flooring Accessories",
    "Underpad",
  ],
  "Flooring Collections": [
    "Legacy Collection",
    "Nordic Elegance Herringbone Collection",
    "Nordic Elegance Collection",
    "Coastal Collection",
    "Coastal Collection Premium",
    "Maple Essence",
    "Oceanus",
    "Eco Floor",
    "Supreme Wood",
    "Resilience Plus",
    "Resilience",
    "Atlantis",
    "Durax",
    "Craftsman",
    "Nautilus",
    "Nautilus herringbone",
    "Prime Guard",
    "Valor Collection",
    "Zen Tile",
    "All",
  ],
  "Countertops & Surfaces": [
    "Countertops",
  ],
  "Outdoor & Decking": [
    "Outdoor",
    "Composite Decking",
    "Bamboo Decking",
    "Decorative Pebbles",
  ],
  "Building Materials": [
    "Setting Material",
    "Grout",
    "Moldings & Trim",
    "Stairs & Railings",
    "Heated Floors",
    "Building Supplies and Tools",
    "Tools and Nails",
    "Blinds",
    "Specials",
    "Special",
  ],
};

export default async function organizeCategories({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const productModule: IProductModuleService = container.resolve(
    ModuleRegistrationName.PRODUCT
  );

  // 1) Load every existing category once
  const existing = await productModule.listProductCategories({}, { take: 5000 });
  const byName = new Map(existing.map((c) => [c.name, c]));
  logger.info(`Loaded ${existing.length} existing categories`);

  // 2) Create parent categories (idempotent — skip if exists)
  const parentIds = new Map<string, string>();
  for (const parentName of Object.keys(HIERARCHY)) {
    const existing = byName.get(parentName);
    if (existing) {
      parentIds.set(parentName, existing.id);
      logger.info(`  ✓ parent "${parentName}" already exists`);
      continue;
    }
    try {
      const { result } = await createProductCategoriesWorkflow(container).run({
        input: {
          product_categories: [{ name: parentName, is_active: true }],
        },
      });
      parentIds.set(parentName, result[0].id);
      byName.set(parentName, result[0]);
      logger.info(`  + created parent "${parentName}"`);
    } catch (e: any) {
      logger.warn(`  ⚠ create parent "${parentName}": ${e.message}`);
    }
  }

  // 3) For each child, locate the existing flat category and update its
  //    parent_category_id (+ optionally rename)
  let linked = 0;
  let renamed = 0;
  let missing = 0;
  const missingList: string[] = [];

  for (const [parentName, children] of Object.entries(HIERARCHY)) {
    const parentId = parentIds.get(parentName);
    if (!parentId) continue;

    for (const child of children) {
      const fromName = typeof child === "string" ? child : child.from;
      const toName = typeof child === "string" ? child : child.to;
      const existing = byName.get(fromName);
      if (!existing) {
        missingList.push(fromName);
        missing += 1;
        continue;
      }

      // Skip the update if it's already wired correctly
      if (
        (existing as any).parent_category_id === parentId &&
        existing.name === toName
      ) {
        continue;
      }

      try {
        await updateProductCategoriesWorkflow(container).run({
          input: {
            selector: { id: existing.id },
            update: {
              parent_category_id: parentId,
              ...(toName !== fromName ? { name: toName } : {}),
            },
          },
        });
        linked += 1;
        if (toName !== fromName) renamed += 1;
      } catch (e: any) {
        logger.warn(`  ⚠ link "${fromName}" → "${parentName}": ${e.message}`);
      }
    }
  }

  logger.info("");
  logger.info(`✅ Done. Linked ${linked} children to parents, renamed ${renamed}, missing ${missing}.`);
  if (missingList.length) {
    logger.info(`Missing (not found in DB — safe to ignore if you didn't import them):`);
    missingList.forEach((n) => logger.info(`    - ${n}`));
  }

  // 4) Sanity check: list anything still parentless
  const fresh = await productModule.listProductCategories({}, { take: 5000 });
  const topLevel = fresh.filter((c) => !(c as any).parent_category_id);
  logger.info("");
  logger.info(`After organization, ${topLevel.length} top-level categories remain:`);
  topLevel
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((c) => logger.info(`    • ${c.name}`));
}
