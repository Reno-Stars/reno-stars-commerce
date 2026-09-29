import { z } from "zod";

const optionalText = z.string().trim().max(500).nullable().optional();

// Provenance of the buy price. Lives in spec.price_meta, NOT in
// raw_import_price_amount: that column is Medusa's own raw store for the
// bigNumber import_price_amount, and any write to the amount replaces it with
// {value, precision} — which would silently erase where the price came from.
export const PriceMeta = z
  .object({
    unit: optionalText,
    source: optionalText,
    effective: optionalText,
    pdf_name: optionalText,
    pdf_sku: optionalText,
    sf_per_box: z.number().positive().nullable().optional(),
    markup_applied: z.number().positive().nullable().optional(),
  })
  .strict();

export type AdminUpsertSupplyInfoType = z.infer<typeof AdminUpsertSupplyInfo>;
export const AdminUpsertSupplyInfo = z
  .object({
    our_sku: optionalText,
    importer_sku: optionalText,
    supplier_name: optionalText,
    notes: optionalText,
    import_price_amount: z.number().nonnegative().nullable().optional(),
    import_price_currency: z.string().trim().length(3).optional(),
    size: optionalText,
    price_meta: PriceMeta.optional(),
    // When present, ALSO set the variant's storefront (sell) price in CAD.
    sell_price_cad: z.number().positive().optional(),
  })
  .strict();
