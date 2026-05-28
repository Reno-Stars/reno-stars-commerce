import { Module } from "@medusajs/framework/utils";
import SupplyInfoModuleService from "./service";

export const SUPPLY_INFO_MODULE = "supply_info";

export default Module(SUPPLY_INFO_MODULE, {
  service: SupplyInfoModuleService,
});
