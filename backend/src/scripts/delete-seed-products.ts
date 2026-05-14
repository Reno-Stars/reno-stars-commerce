import { deleteProductsWorkflow } from "@medusajs/core-flows";
import { ExecArgs, IProductModuleService } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
} from "@medusajs/framework/utils";

/**
 * Delete the 8 sample products that came from `yarn run seed` (laptops,
 * webcams, monitors etc.) so the store only contains real NeoNova products.
 * Anything tagged in metadata.source = 'neonovadecor.ca' is kept.
 *
 * Idempotent — re-running is a no-op once the seed products are gone.
 */
export default async function deleteSeedProducts({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const productModule: IProductModuleService = container.resolve(
    ModuleRegistrationName.PRODUCT
  );

  const all = await productModule.listProducts(
    {},
    { take: 10000, select: ["id", "title", "metadata"] as any }
  );
  const toDelete = all.filter(
    (p) => !p.metadata || (p.metadata as any).source !== "neonovadecor.ca"
  );

  logger.info(
    `Found ${toDelete.length} non-NeoNova products to delete (of ${all.length} total)`
  );
  if (toDelete.length === 0) {
    logger.info("Nothing to do.");
    return;
  }

  for (const p of toDelete) {
    logger.info(`  - ${p.title}`);
  }

  await deleteProductsWorkflow(container).run({
    input: { ids: toDelete.map((p) => p.id) },
  });

  // Also delete the seed categories that are now empty
  const seedCategoryNames = ["Laptops", "Accessories", "Phones", "Monitors"];
  const cats = await productModule.listProductCategories(
    {},
    { take: 5000 }
  );
  const toDeleteCats = cats.filter((c) =>
    seedCategoryNames.includes(c.name)
  );
  if (toDeleteCats.length > 0) {
    logger.info(`Deleting ${toDeleteCats.length} now-empty seed categories...`);
    await productModule.deleteProductCategories(
      toDeleteCats.map((c) => c.id)
    );
  }

  logger.info("✅ Seed products + categories removed");
}
