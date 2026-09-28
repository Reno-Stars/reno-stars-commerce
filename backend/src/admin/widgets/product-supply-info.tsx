import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, AdminProduct, AdminProductVariant } from "@medusajs/framework/types"
import { Container, Heading, Text, Badge, clx } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { sdk } from "../lib/client"

type SupplyInfo = {
  id: string
  our_sku: string | null
  importer_sku: string | null
  supplier_name: string | null
  import_price_amount: number | string | null
  import_price_currency: string
  spec: Record<string, any> | null
  notes: string | null
  // raw_import_price_amount is not on the type but exists in DB; the JSON
  // expansion above includes it because we pass *variants.supply_info.
  raw_import_price_amount?: Record<string, any> | null
}

type VariantWithSupply = AdminProductVariant & {
  supply_info?: SupplyInfo | null
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

const ProductSupplyInfoWidget = ({ data }: DetailWidgetProps<AdminProduct>) => {
  const { data: expanded } = useQuery<{ product: ExpandedProduct }>({
    queryFn: () =>
      sdk.client.fetch(`/admin/products/${data.id}`, {
        query: { fields: "*variants.supply_info" },
      }) as Promise<{ product: ExpandedProduct }>,
    queryKey: ["product-supply-info", data.id],
  })

  const variants = expanded?.product?.variants ?? []
  const hasAnySupply = variants.some((v) => v.supply_info)

  if (!hasAnySupply) {
    return (
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading level="h2">Supply & cost</Heading>
        </div>
        <div className="px-6 py-4 text-ui-fg-subtle text-sm">
          No supply_info linked to any variant of this product yet.
        </div>
      </Container>
    )
  }

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
            <div key={variant.id} className="px-6 py-4 text-sm">
              <div className="text-ui-fg-subtle font-mono">{variant.sku}</div>
              <div className="text-ui-fg-muted text-xs mt-1">
                No supply_info link
              </div>
            </div>
          )
        }
        const raw = si.raw_import_price_amount ?? {}
        const buyAmount = si.import_price_amount
        const unit = raw.unit as string | undefined
        const sellPrice =
          raw.retail_per_sf ?? raw.sell_per_sf ?? raw.derived_sell_per_unit
        const markup = raw.markup_applied as number | undefined
        const source = raw.source as string | undefined
        const effective = raw.effective as string | undefined
        const estimated = raw.estimated === true
        const sizeFromSpec = (si.spec ?? {})["size"] as string | undefined
        const sizeSource = (si.spec ?? {})["size_source"] as string | undefined

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
              {si.supplier_name && (
                <Badge size="2xsmall" color="blue">
                  {si.supplier_name}
                </Badge>
              )}
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
                  {markup ? (
                    <span className="text-ui-fg-subtle text-xs ml-1">
                      ({markup}× markup)
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
