import { ExecArgs, IStoreModuleService } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
} from "@medusajs/framework/utils";

export default async function probeStore({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const storeModule: IStoreModuleService = container.resolve(
    ModuleRegistrationName.STORE
  );
  const [store] = await storeModule.listStores({}, {
    relations: ["supported_currencies"],
  });
  logger.info("store dump:");
  console.log(JSON.stringify(store, null, 2));
}
