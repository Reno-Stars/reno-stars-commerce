import { MedusaService } from "@medusajs/framework/utils";
import { SupplyInfo } from "./models";

class SupplyInfoModuleService extends MedusaService({
  SupplyInfo,
}) {}

export default SupplyInfoModuleService;
