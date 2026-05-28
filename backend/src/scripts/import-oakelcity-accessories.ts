import { createProductsWorkflow } from "@medusajs/core-flows";
import {
  ExecArgs,
  IProductModuleService,
  ISalesChannelModuleService,
} from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
  ModuleRegistrationName,
  ProductStatus,
} from "@medusajs/framework/utils";
import { SUPPLY_INFO_MODULE } from "../modules/supply-info";

const BRAND = "Oakel City Floor";
const SOURCE = "oakelcity.com";
const SKU_PREFIX = "OAKEL-ACC-";

type Acc = {
  handle: string;
  title: string;
  description: string;
  category_handle: string;
  buy: number | null;
  sell: number | null;
  spec: Record<string, any>;
};

// From the Buy-vs-Sell CSV "Accessories" + per-series accessory rows
const ACCESSORIES: Acc[] = [
  // Master Step Laminate AC5 accessories
  {
    handle: "oakelcity-master-step-flush-square-nosing-27x115",
    title: "Master Step Laminate AC5 — Flush Square Nosing (27×115×2400mm)",
    description: "Flush square nosing for Master Step Laminate AC5 flooring. 27 × 115 × 2400 mm, sold per piece.",
    category_handle: "flooring-flush-nosing",
    buy: 25.00, sell: 29.00,
    spec: { series: "Master Step Laminate AC5", profile: "Flush Square Nosing", dims_mm: "27x115x2400", unit: "per piece" },
  },
  {
    handle: "oakelcity-master-step-reducer-15x45",
    title: "Master Step Laminate AC5 — Reducer (15×45×2400mm)",
    description: "Reducer trim for Master Step Laminate AC5. 15 × 45 × 2400 mm, sold per piece.",
    category_handle: "flooring-reducer",
    buy: 12.00, sell: 17.00,
    spec: { series: "Master Step Laminate AC5", profile: "Reducer", dims_mm: "15x45x2400", unit: "per piece" },
  },
  {
    handle: "oakelcity-master-step-t-moulding-12x45",
    title: "Master Step Laminate AC5 — T-Moulding (12×45×2400mm)",
    description: "T-moulding for Master Step Laminate AC5. 12 × 45 × 2400 mm, sold per piece.",
    category_handle: "flooring-t-moulding",
    buy: 12.00, sell: 17.00,
    spec: { series: "Master Step Laminate AC5", profile: "T-Moulding", dims_mm: "12x45x2400", unit: "per piece" },
  },
  // DESTINY Aqua Expert Laminate AC4 accessories
  {
    handle: "oakelcity-destiny-ae-flush-round-nosing-24x115",
    title: "DESTINY Aqua Expert AC4 — Flush Round Nosing (24×115×2400mm)",
    description: "Flush round nosing for DESTINY Aqua Expert AC4 laminate. 24 × 115 × 2400 mm, per piece.",
    category_handle: "flooring-flush-nosing",
    buy: 18.00, sell: 27.00,
    spec: { series: "DESTINY Aqua Expert AC4", profile: "Flush Round Nosing", dims_mm: "24x115x2400", unit: "per piece" },
  },
  {
    handle: "oakelcity-destiny-ae-flush-square-nosing-24x115",
    title: "DESTINY Aqua Expert AC4 — Flush Square Nosing (24×115×2400mm)",
    description: "Flush square nosing for DESTINY Aqua Expert AC4 laminate. 24 × 115 × 2400 mm, per piece.",
    category_handle: "flooring-flush-nosing",
    buy: 22.00, sell: 29.00,
    spec: { series: "DESTINY Aqua Expert AC4", profile: "Flush Square Nosing", dims_mm: "24x115x2400", unit: "per piece" },
  },
  {
    handle: "oakelcity-destiny-ae-flush-overlap-nosing",
    title: "DESTINY Aqua Expert AC4 — Flush Overlap Nosing",
    description: "Flush overlap nosing for DESTINY Aqua Expert AC4 laminate. Sold per piece.",
    category_handle: "flooring-flush-nosing",
    buy: 25.00, sell: 31.00,
    spec: { series: "DESTINY Aqua Expert AC4", profile: "Flush Overlap Nosing", unit: "per piece" },
  },
  {
    handle: "oakelcity-destiny-ae-reducer-15x45",
    title: "DESTINY Aqua Expert AC4 — Reducer (15×45×2400mm)",
    description: "Reducer trim for DESTINY Aqua Expert AC4. 15 × 45 × 2400 mm, per piece.",
    category_handle: "flooring-reducer",
    buy: 12.00, sell: 17.00,
    spec: { series: "DESTINY Aqua Expert AC4", profile: "Reducer", dims_mm: "15x45x2400", unit: "per piece" },
  },
  {
    handle: "oakelcity-destiny-ae-t-moulding-12x45",
    title: "DESTINY Aqua Expert AC4 — T-Moulding (12×45×2400mm)",
    description: "T-moulding for DESTINY Aqua Expert AC4. 12 × 45 × 2400 mm, per piece.",
    category_handle: "flooring-t-moulding",
    buy: 12.00, sell: 17.00,
    spec: { series: "DESTINY Aqua Expert AC4", profile: "T-Moulding", dims_mm: "12x45x2400", unit: "per piece" },
  },
  // DESTINY Aqua Pro Luxury Vinyl 65 accessories
  {
    handle: "oakelcity-destiny-ap-flush-square-nosing-24x115",
    title: "DESTINY Aqua Pro LV65 — Flush Square Nosing (24×115×2400mm)",
    description: "Flush square nosing for DESTINY Aqua Pro Luxury Vinyl 65. 24 × 115 × 2400 mm, per piece.",
    category_handle: "flooring-flush-nosing",
    buy: 25.00, sell: 31.00,
    spec: { series: "DESTINY Aqua Pro LV65", profile: "Flush Square Nosing", dims_mm: "24x115x2400", unit: "per piece" },
  },
  {
    handle: "oakelcity-destiny-ap-t-moulding-reducer-6-5x45",
    title: "DESTINY Aqua Pro LV65 — T-Moulding & Reducer (6.5×45×2400mm)",
    description: "Combination T-moulding and reducer for DESTINY Aqua Pro LV65. 6.5 × 45 × 2400 mm, per piece.",
    category_handle: "flooring-t-moulding",
    buy: 18.00, sell: 24.00,
    spec: { series: "DESTINY Aqua Pro LV65", profile: "T-Moulding & Reducer", dims_mm: "6.5x45x2400", unit: "per piece" },
  },
  // Generic accessories
  {
    handle: "oakelcity-underpad-3mm-ixpe",
    title: "Underpad — 3mm IXPE IIC77 STC78 (200 sqft/roll)",
    description: "3mm IXPE underpad. Acoustic ratings IIC 77 / STC 78. Coverage 200 sq ft per roll.",
    category_handle: "flooring-underlay",
    buy: 23.00, sell: 36.00,
    spec: { type: "IXPE underpad", thickness_mm: 3, iic: 77, stc: 78, coverage_sqft: 200, unit: "per roll" },
  },
  {
    handle: "oakelcity-floor-protection-super-board-0-7mm",
    title: "Floor Protection — Super Board 0.7mm (316 sqft/roll)",
    description: "0.7mm Super Board floor protection roll. 316 sq ft per roll.",
    category_handle: "flooring-underlay",
    buy: 38.00, sell: 50.00,
    spec: { type: "Floor protection board", thickness_mm: 0.7, coverage_sqft: 316, unit: "per roll" },
  },
  {
    handle: "oakelcity-floor-protection-super-board-red-tape",
    title: "Floor Protection — Super Board Red Tape (24 rolls/box)",
    description: "Red tape for sealing Super Board floor protection seams. 24 rolls per box.",
    category_handle: "flooring-underlay",
    buy: 156.00, sell: 170.00,
    spec: { type: "Seam tape", colour: "Red", qty: "24 rolls", unit: "per box" },
  },
  {
    handle: "oakelcity-glue-pallmann-p4-nl-16kg",
    title: "Engineered Hardwood Glue — Pallmann P4 NL (16kg, covers ~170 sqft)",
    description: "Pallmann P4 NL engineered hardwood adhesive. 16kg pail covers approximately 170 sq ft.",
    category_handle: "flooring-underlay",
    buy: 130.00, sell: 145.00,
    spec: { type: "Hardwood adhesive", brand: "Pallmann", product: "P4 NL", weight_kg: 16, coverage_sqft: 170, unit: "per pail" },
  },
  {
    handle: "oakelcity-floor-protection-felt-150sqft",
    title: "Floor Protection — Felt Surface (150 sqft/roll)",
    description: "Felt surface floor protection. 150 sq ft per roll.",
    category_handle: "flooring-underlay",
    buy: null, sell: 49.00,
    spec: { type: "Felt floor protection", coverage_sqft: 150, unit: "per roll" },
  },
];

export default async function importAccessories({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const productModule: IProductModuleService = container.resolve(
    ModuleRegistrationName.PRODUCT
  );
  const salesChannelModule: ISalesChannelModuleService = container.resolve(
    ModuleRegistrationName.SALES_CHANNEL
  );
  const supplyInfoService: any = container.resolve(SUPPLY_INFO_MODULE);
  const link = container.resolve(ContainerRegistrationKeys.LINK);

  const [defaultSalesChannel] = await salesChannelModule.listSalesChannels({
    name: "Default Sales Channel",
  });
  if (!defaultSalesChannel) throw new Error("Default Sales Channel not found");

  const cats = await productModule.listProductCategories(
    {},
    { take: 5000, select: ["id", "name", "handle"] as any }
  );
  const catByHandle = new Map<string, string>(
    cats.map((c: any) => [c.handle, c.id])
  );

  // Idempotency
  const existing = await productModule.listProducts(
    {},
    { take: 50000, select: ["handle"] as any }
  );
  const existingHandles = new Set(existing.map((p) => p.handle));

  let created = 0;
  let skipped = 0;

  for (const acc of ACCESSORIES) {
    if (existingHandles.has(acc.handle)) {
      skipped += 1;
      continue;
    }

    const catId = catByHandle.get(acc.category_handle);
    if (!catId) {
      logger.warn(`  ⚠ no category for handle "${acc.category_handle}", skipping ${acc.handle}`);
      continue;
    }

    const product = {
      title: acc.title,
      handle: acc.handle,
      description: acc.description,
      status: ProductStatus.PUBLISHED,
      category_ids: [catId],
      sales_channels: [{ id: defaultSalesChannel.id }],
      options: [{ title: "Default", values: ["Default"] }],
      variants: [
        {
          title: "Default",
          sku: `${SKU_PREFIX}${acc.handle.replace(/^oakelcity-/, "").toUpperCase().slice(0, 40)}`,
          options: { Default: "Default" },
          manage_inventory: false,
          prices: acc.sell != null ? [{ amount: acc.sell, currency_code: "cad" }] : [],
        },
      ],
      metadata: {
        source: SOURCE,
        brand: BRAND,
        product_kind: "accessory",
        spec_series: acc.spec.series || null,
        imported_at: new Date().toISOString(),
      },
    };

    const { result } = await createProductsWorkflow(container).run({
      input: { products: [product as any] },
    });
    const createdProduct: any = result[0];
    const variantId = createdProduct.variants[0].id;

    // create supply_info + link
    const [si] = await supplyInfoService.createSupplyInfos([
      {
        importer_sku: createdProduct.variants[0].sku,
        supplier_name: BRAND,
        import_price_amount: acc.buy,
        import_price_currency: "cad",
        spec: acc.spec,
      },
    ]);
    await link.create([
      {
        [Modules.PRODUCT]: { product_variant_id: variantId },
        [SUPPLY_INFO_MODULE]: { supply_info_id: si.id },
      },
    ]);

    created += 1;
    logger.info(`  + ${acc.handle}`);
  }

  logger.info(`✅ accessories: created ${created}, skipped ${skipped}`);
}
