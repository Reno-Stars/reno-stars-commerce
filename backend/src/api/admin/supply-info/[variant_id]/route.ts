import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils";
import { updateProductVariantsWorkflow } from "@medusajs/medusa/core-flows";
import { SUPPLY_INFO_MODULE } from "../../../../modules/supply-info";
import { AdminUpsertSupplyInfoType } from "../validators";

type Json = Record<string, unknown>;

// MedusaService's TYPES pluralise "SupplyInfo" as "SupplyInfoes", but the
// RUNTIME methods are createSupplyInfos/updateSupplyInfos (the importers use
// these). Typing the runtime names keeps tsc honest about what actually exists.
type SupplyInfoRow = { id: string } & Json;
type SupplyInfoService = {
  createSupplyInfos(data: Json): Promise<SupplyInfoRow>;
  updateSupplyInfos(data: Json & { id: string }): Promise<SupplyInfoRow>;
  retrieveSupplyInfo(id: string): Promise<SupplyInfoRow>;
};

type VariantRow = {
  id: string;
  prices?: { id: string; amount: number; currency_code: string }[];
  supply_info?: {
    id: string;
    spec: Json | null;
    raw_import_price_amount: Json | null;
  } | null;
};

// Importers wrote provenance (source/unit/effective/...) into
// raw_import_price_amount. Medusa owns that column and overwrites it on any
// amount update, so the first edit copies the provenance into spec.price_meta.
const legacyPriceMeta = (raw: Json | null | undefined): Json => {
  if (!raw) return {};
  const { value: _v, precision: _p, ...meta } = raw;
  return meta;
};

const stripUndefined = (obj: Json): Json =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

const buildSpec = (
  existing: VariantRow["supply_info"],
  body: AdminUpsertSupplyInfoType
): Json => {
  const spec: Json = { ...(existing?.spec ?? {}) };
  const priorMeta =
    (spec.price_meta as Json | undefined) ??
    legacyPriceMeta(existing?.raw_import_price_amount);
  spec.price_meta = { ...priorMeta, ...stripUndefined(body.price_meta ?? {}) };
  if (body.size !== undefined && body.size !== spec.size) {
    spec.size = body.size;
    spec.size_source = "manual";
  }
  return spec;
};

const setSellPrice = async (
  req: AuthenticatedMedusaRequest,
  variant: VariantRow,
  amount: number
) => {
  // Pass EVERY existing price back: the workflow replaces the variant's price
  // set with exactly this list, so omitting usd/eur rows would delete them.
  const prices = (variant.prices ?? []).map((p) => ({
    id: p.id,
    currency_code: p.currency_code,
    amount: p.currency_code === "cad" ? amount : p.amount,
  }));
  if (!prices.some((p) => p.currency_code === "cad")) {
    prices.push({ currency_code: "cad", amount } as (typeof prices)[number]);
  }
  await updateProductVariantsWorkflow(req.scope).run({
    input: { product_variants: [{ id: variant.id, prices }] },
  });
};

export const POST = async (
  req: AuthenticatedMedusaRequest<AdminUpsertSupplyInfoType>,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const link = req.scope.resolve(ContainerRegistrationKeys.LINK);
  const service = req.scope.resolve<SupplyInfoService>(SUPPLY_INFO_MODULE);
  const { variant_id } = req.params;
  const body = req.validatedBody;

  const {
    data: [variant],
  } = (await query.graph({
    entity: "product_variant",
    fields: ["id", "prices.*", "supply_info.*"],
    filters: { id: variant_id },
  })) as { data: VariantRow[] };
  if (!variant) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Variant ${variant_id} not found`
    );
  }

  const existing = variant.supply_info ?? null;
  const fields = stripUndefined({
    our_sku: body.our_sku,
    importer_sku: body.importer_sku,
    supplier_name: body.supplier_name,
    notes: body.notes,
    import_price_amount: body.import_price_amount,
    import_price_currency: body.import_price_currency,
    spec: buildSpec(existing, body),
  });

  let supplyInfoId: string;
  if (existing) {
    await service.updateSupplyInfos({ id: existing.id, ...fields });
    supplyInfoId = existing.id;
  } else {
    const created = await service.createSupplyInfos(fields);
    supplyInfoId = created.id;
    await link.create({
      [Modules.PRODUCT]: { product_variant_id: variant_id },
      [SUPPLY_INFO_MODULE]: { supply_info_id: supplyInfoId },
    });
  }

  if (body.sell_price_cad !== undefined) {
    await setSellPrice(req, variant, body.sell_price_cad);
  }

  const supply_info = await service.retrieveSupplyInfo(supplyInfoId);
  res.json({ supply_info });
};
