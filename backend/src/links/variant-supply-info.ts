import { defineLink } from "@medusajs/framework/utils";
import ProductModule from "@medusajs/medusa/product";
import SupplyInfoModule from "../modules/supply-info";

export default defineLink(
  ProductModule.linkable.productVariant,
  {
    linkable: SupplyInfoModule.linkable.supplyInfo,
    isList: false,
  }
);
