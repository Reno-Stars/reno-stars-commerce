import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, AdminProduct, AdminProductVariant } from "@medusajs/framework/types"
import { Container, Heading, Text, Badge, Button, clx } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { sdk } from "../lib/client"
import {
  PriceMeta,
  SupplyInfoDrawer,
  SupplyInfoFormInitial,
} from "../components/supply-info/supply-info-drawer"

type SupplyInfo = {
  id: string
  our_sku: string | null
  importer_sku: string | null
  supplier_name: string | null
  import_price_amount: number | string | null
  import_price_currency: string
  spec: Record<string, any> | null
  notes: string | null
  // Medusa's raw store for the bigNumber. Importers wrote price provenance
  // here; edits move it to spec.price_meta (see readMeta).
  raw_import_price_amount?: Record<string, any> | null
}

type VariantWithSupply = AdminProductVariant & {
  supply_info?: SupplyInfo | null
  prices?: { amount: number; currency_code: string }[] | null
}

type ExpandedProduct = Omit<AdminProduct, "variants"> & {
  variants: VariantWithSupply[]
}

const formatPrice = (amount: number | string | null | undefined, currency = "CAD") => {
  if (amount === null || amount === undefined || amount === "") return "—"
  const num = typeof amount === "string" ? parseFloat(amount) : amount
  if (Number.isNaN(num)) return "—"
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(num)
}

const unitLabel = (unit?: string) => {
  if (!unit) return ""
  if (unit === "per_sf") return "/sf"
  if (unit === "per_pc" || unit === "per_piece") return "/pc"
  if (unit === "per_box") return "/box"
  if (unit === "per_roll") return "/roll"
  if (unit === "per_set") return "/set"
  return ` ${unit}`
}

const SourceBadge = ({ source }: { source?: string | null }) => {
  if (!source) return null
  const label = source.split("/").pop()?.split(" ").slice(0, 3).join(" ")
  return (
    <Badge size="2xsmall" color="grey" className="font-mono">
      {label}
    </Badge>
  )
}

// spec.price_meta wins once a record has been edited in the admin; before
// that the importer's provenance is still in raw_import_price_amount.
const readMeta = (si: SupplyInfo): PriceMeta & Record<string, any> => {
  const fromSpec = (si.spec ?? {})["price_meta"]
  if (fromSpec) return fromSpec
  const { value: _v, precision: _p, ...legacy } = si.raw_import_price_amount ?? {}
  return legacy
}

const sellCad = (v: VariantWithSupply) =>
  v.prices?.find((p) => p.currency_code === "cad")?.amount ?? null

const toInitial = (v: VariantWithSupply): SupplyInfoFormInitial => {
  const si = v.supply_info
  const num = (x: unknown) =>
    x === null || x === undefined || x === "" ? null : Number(x)
  return {
    our_sku: si?.our_sku ?? null,
    importer_sku: si?.importer_sku ?? v.sku ?? null,
    supplier_name: si?.supplier_name ?? null,
    notes: si?.notes ?? null,
    import_price_amount: num(si?.import_price_amount),
    size: ((si?.spec ?? {})["size"] as string | undefined) ?? null,
    meta: si ? readMeta(si) : {},
    sell_cad: sellCad(v),
  }
}

const ProductSupplyInfoWidget = ({ data }: DetailWidgetProps<AdminProduct>) => {
  const { data: expanded } = useQuery<{ product: ExpandedProduct }>({
    queryFn: () =>
      sdk.client.fetch(`/admin/products/${data.id}`, {
        query: { fields: "*variants.supply_info,*variants.prices" },
      }) as Promise<{ product: ExpandedProduct }>,
    queryKey: ["product-supply-info", data.id],
  })

  const variants = expanded?.product?.variants ?? []

  const editButton = (variant: VariantWithSupply, label: string) => (
    <SupplyInfoDrawer
      productId={data.id}
      variantId={variant.id}
      variantLabel={`${variant.title ?? ""} · ${variant.sku ?? variant.id}`}
      initial={toInitial(variant)}
      trigger={
        <Button size="small" variant="secondary">
          {label}
        </Button>
      }
    />
  )

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Supply & cost</Heading>
        <Text size="xsmall" className="text-ui-fg-subtle">
          buy price · markup · source
        </Text>
      </div>
      {variants.map((variant) => {
        const si = variant.supply_info
        if (!si) {
          return (
            <div
              key={variant.id}
              className="flex items-center justify-between gap-3 px-6 py-4 text-sm"
            >
              <div className="min-w-0">
                <div className="text-ui-fg-subtle font-mono truncate">
                  {variant.sku}
                </div>
                <div className="text-ui-fg-muted text-xs mt-1">
                  No buy price yet
                </div>
              </div>
              {editButton(variant, "Add")}
            </div>
          )
        }
        const meta = readMeta(si)
        const buyAmount = si.import_price_amount
        const unit = meta.unit as string | undefined
        const sellPrice = sellCad(variant)
        const markup = meta.markup_applied as number | undefined
        const source = meta.source as string | undefined
        const effective = meta.effective as string | undefined
        const estimated = meta.estimated === true
        const sizeFromSpec = (si.spec ?? {})["size"] as string | undefined
        const sizeSource = (si.spec ?? {})["size_source"] as string | undefined
        const buyNum = buyAmount === null ? null : Number(buyAmount)
        const actualMarkup =
          buyNum && sellPrice ? Math.round((sellPrice / buyNum) * 100) / 100 : null

        return (
          <div key={variant.id} className="px-6 py-4 text-sm space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col min-w-0">
                <div className="font-mono text-ui-fg-base font-semibold truncate">
                  {si.our_sku || "—"}
                  <span className="text-ui-fg-muted text-xs font-normal ml-2">
                    Reno SKU
                  </span>
                </div>
                <div className="font-mono text-ui-fg-subtle text-xs truncate">
                  {si.importer_sku || variant.sku}
                  <span className="text-ui-fg-muted ml-2">supplier SKU</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {si.supplier_name && (
                  <Badge size="2xsmall" color="blue">
                    {si.supplier_name}
                  </Badge>
                )}
                {editButton(variant, "Edit")}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <div>
                <div className="text-ui-fg-muted text-xs">Buy (cost)</div>
                <div
                  className={clx("font-semibold", {
                    "text-ui-fg-error": buyAmount === null,
                  })}
                >
                  {formatPrice(buyAmount, si.import_price_currency)}
                  {unitLabel(unit)}
                </div>
              </div>
              <div>
                <div className="text-ui-fg-muted text-xs">
                  Sell (storefront)
                </div>
                <div className="font-semibold">
                  {formatPrice(sellPrice, "cad")}
                  {unitLabel(unit)}
                  {actualMarkup ? (
                    <span className="text-ui-fg-subtle text-xs ml-1">
                      ({actualMarkup}×{markup && markup !== actualMarkup ? `, target ${markup}×` : ""})
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {sizeFromSpec && (
                <Badge size="2xsmall" color="green">
                  {sizeFromSpec}
                </Badge>
              )}
              {sizeSource && (
                <Text size="xsmall" className="text-ui-fg-subtle font-mono">
                  size: {sizeSource}
                </Text>
              )}
              {meta.sf_per_box ? (
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {meta.sf_per_box} sf/box
                </Text>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {source && <SourceBadge source={source} />}
              {effective && (
                <Text size="xsmall" className="text-ui-fg-subtle">
                  effective {effective}
                </Text>
              )}
              {estimated && (
                <Badge size="2xsmall" color="orange">
                  estimated
                </Badge>
              )}
            </div>

            {si.notes && (
              <div className="text-ui-fg-subtle text-xs italic">{si.notes}</div>
            )}
          </div>
        )
      })}
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.side.before",
})

export default ProductSupplyInfoWidget
