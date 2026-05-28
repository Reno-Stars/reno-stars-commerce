import {
  ExecArgs,
  IProductModuleService,
  Logger,
} from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
  ModuleRegistrationName,
} from "@medusajs/framework/utils";
import { SUPPLY_INFO_MODULE } from "../modules/supply-info";

const BATCH = 250;

export default async function backfillSupplyInfo({ container }: ExecArgs) {
  const logger: Logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const productModule: IProductModuleService = container.resolve(
    ModuleRegistrationName.PRODUCT
  );
  const supplyInfoService: any = container.resolve(SUPPLY_INFO_MODULE);
  const link = container.resolve(ContainerRegistrationKeys.LINK);

  const [variants, total] = await productModule.listAndCountProductVariants(
    {},
    {
      take: 100000,
      select: ["id", "sku", "product.id", "product.metadata"] as any,
      relations: ["product"] as any,
    }
  );
  logger.info(`Loaded ${total} variants`);

  // Idempotency check via raw query on the link table
  const pgConnection = container.resolve("__pg_connection__") as any;
  const linkedRows = await pgConnection
    .raw(
      `SELECT product_variant_id FROM product_product_variant_supply_info_supply_info WHERE deleted_at IS NULL`
    );
  const linked = new Set<string>(
    (linkedRows.rows || []).map((r: any) => r.product_variant_id)
  );
  logger.info(`  ${linked.size} variants already have supply_info`);

  const toBackfill = variants.filter((v) => !linked.has(v.id));
  logger.info(`  ${toBackfill.length} variants to backfill`);

  let created = 0;
  for (let i = 0; i < toBackfill.length; i += BATCH) {
    const batch = toBackfill.slice(i, i + BATCH);

    // Step 1: create supply_info rows
    const supplyInfoInputs = batch.map((v) => {
      const product = (v as any).product;
      const brand =
        product?.metadata?.brand ||
        product?.metadata?.shopify_vendor ||
        null;
      return {
        importer_sku: v.sku || null,
        supplier_name: brand,
        import_price_currency: "cad",
      };
    });

    const created_rows = await supplyInfoService.createSupplyInfos(
      supplyInfoInputs
    );

    // Step 2: link each created supply_info to its variant
    const links = batch.map((v, idx) => ({
      [Modules.PRODUCT]: { product_variant_id: v.id },
      [SUPPLY_INFO_MODULE]: { supply_info_id: created_rows[idx].id },
    }));
    await link.create(links);

    created += batch.length;
    if ((i + BATCH) % 1000 === 0 || i + BATCH >= toBackfill.length) {
      logger.info(
        `  progress: ${Math.min(i + BATCH, toBackfill.length)}/${toBackfill.length}`
      );
    }
  }

  logger.info(`✅ backfilled ${created} variants`);
}
