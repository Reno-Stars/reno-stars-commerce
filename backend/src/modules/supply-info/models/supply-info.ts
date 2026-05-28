import { model } from "@medusajs/framework/utils";

export const SupplyInfo = model.define("supply_info", {
  id: model.id({ prefix: "spi" }).primaryKey(),
  our_sku: model.text().nullable(),
  importer_sku: model.text().nullable(),
  import_price_amount: model.bigNumber().nullable(),
  import_price_currency: model.text().default("cad"),
  supplier_name: model.text().nullable(),
  spec: model.json().nullable(),
  notes: model.text().nullable(),
});
