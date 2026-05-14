"use client"

import { getProductPrice } from "@/lib/util/get-product-price"
import { HttpTypes } from "@medusajs/types"
import { clx, Table } from "@medusajs/ui"
import ProductPrice from "../product-price"

type ProductActionsProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
}

/**
 * Catalog-only product actions panel.
 * - Shows pricing
 * - Lists every variant (SKU, options, price) as a read-only reference
 * - No Add-to-Cart, no inventory counts — quote and ordering go through the
 *   contact channels listed below
 */
export default function ProductActions({
  product,
  region,
}: ProductActionsProps) {
  const hasRealOptions =
    product.options && product.options.some((o) => o.title !== "Default option")

  return (
    <div className="flex flex-col gap-y-4 w-full">
      <ProductPrice product={product} />

      {product.variants && product.variants.length > 0 && (
        <div className="overflow-x-auto p-px">
          <Table className="w-full rounded-xl overflow-hidden border border-reno-navy/10">
            <Table.Header className="border-t-0">
              <Table.Row className="bg-reno-cream/40 border-none hover:!bg-reno-cream/40">
                <Table.HeaderCell className="px-4 text-reno-navy">
                  SKU
                </Table.HeaderCell>
                {hasRealOptions &&
                  product.options?.map((option) => {
                    if (option.title === "Default option") return null
                    return (
                      <Table.HeaderCell
                        key={option.id}
                        className="px-4 border-x border-reno-navy/10 text-reno-navy"
                      >
                        {option.title}
                      </Table.HeaderCell>
                    )
                  })}
                <Table.HeaderCell className="px-4 text-reno-navy">
                  Price
                </Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body className="border-none">
              {product.variants?.map((variant, index) => {
                const { variantPrice } = getProductPrice({
                  product,
                  variantId: variant.id,
                })
                return (
                  <Table.Row
                    key={variant.id}
                    className={clx("hover:bg-reno-cream/20", {
                      "border-b-0": index === product.variants?.length! - 1,
                    })}
                  >
                    <Table.Cell className="px-4 text-reno-navy/80 text-xs">
                      {variant.sku}
                    </Table.Cell>
                    {hasRealOptions &&
                      variant.options?.map((option) => {
                        if (option.value === "Default option value") return null
                        return (
                          <Table.Cell
                            key={option.id}
                            className="px-4 border-x border-reno-navy/10 text-reno-navy"
                          >
                            {option.value}
                          </Table.Cell>
                        )
                      })}
                    <Table.Cell className="px-4 font-medium text-reno-navy">
                      {variantPrice?.calculated_price}
                    </Table.Cell>
                  </Table.Row>
                )
              })}
            </Table.Body>
          </Table>
        </div>
      )}

      <div className="rounded-xl border border-reno-navy/10 bg-reno-cream/30 p-5 flex flex-col gap-3">
        <div>
          <p className="text-reno-navy font-semibold text-base">
            Like this product? Get in touch.
          </p>
          <p className="text-reno-navy/70 text-sm mt-1">
            We&apos;ll quote trade pricing, confirm availability, and arrange
            delivery or pickup in Metro Vancouver.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 pt-1">
          <a
            href="tel:778-960-7999"
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition hover:brightness-110"
            style={{
              backgroundColor: "#C8922A",
              boxShadow: "0 4px 16px #C8922A40",
            }}
          >
            Call 778-960-7999
          </a>
          <a
            href="https://www.reno-stars.com/en/contact/"
            target="_blank"
            rel="noreferrer"
            className="px-5 py-2.5 rounded-lg text-sm font-semibold border border-reno-navy/30 text-reno-navy hover:bg-reno-navy hover:text-white transition"
          >
            Request a quote
          </a>
        </div>
        <p className="text-reno-navy/50 text-xs pt-1">
          Mention the SKU above when you contact us.
        </p>
      </div>
    </div>
  )
}
