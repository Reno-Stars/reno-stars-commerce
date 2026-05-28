import { HttpTypes } from "@medusajs/types"
import { getPercentageDiff } from "./get-precentage-diff"
import { convertToLocale } from "./money"

// TODO: Remove this util and use the AdminPrice type directly
export type VariantPrice = {
  calculated_price_number: string
  calculated_price: string
  original_price_number: string
  original_price: string
  currency_code: string
  price_type: string
  percentage_diff: string
  is_contact_for_price?: boolean
}

export const CONTACT_FOR_PRICE_LABEL = "Contact for price"

export const getPricesForVariant = (variant: any): VariantPrice | null => {
  if (variant?.calculated_price == null) {
    return null
  }

  const amount = variant.calculated_price.calculated_amount
  // Treat amount of 0 (or null) as "contact for price" — vendor pricing
  // not yet set up. Some products (e.g. oakelcity.com imports awaiting a
  // vendor account) also carry product.metadata.contact_for_price = true.
  const isContactForPrice =
    amount == null ||
    Number(amount) === 0 ||
    variant.product?.metadata?.contact_for_price === true

  return {
    calculated_price_number: amount,
    calculated_price: isContactForPrice
      ? CONTACT_FOR_PRICE_LABEL
      : convertToLocale({
          amount,
          currency_code: variant.calculated_price.currency_code,
        }),
    original_price_number: variant.calculated_price.original_amount,
    original_price: convertToLocale({
      amount: variant.calculated_price.original_amount,
      currency_code: variant.calculated_price.currency_code,
    }),
    currency_code: variant.calculated_price.currency_code,
    price_type: variant.calculated_price.calculated_price?.price_list_type,
    percentage_diff: getPercentageDiff(
      variant.calculated_price.original_amount,
      amount
    ),
    is_contact_for_price: isContactForPrice,
  }
}

export function getProductPrice({
  product,
  variantId,
}: {
  product: HttpTypes.StoreProduct
  variantId?: string
}) {
  if (!product || !product.id) {
    throw new Error("No product provided")
  }

  const cheapestPrice = () => {
    if (!product || !product.variants?.length) {
      return null
    }

    const cheapestVariant: any = product.variants
      .filter((v: any) => !!v.calculated_price)
      .sort((a: any, b: any) => {
        return (
          a.calculated_price.calculated_amount -
          b.calculated_price.calculated_amount
        )
      })[0]

    if (!cheapestVariant) return null
    // Inject product so getPricesForVariant can read metadata.contact_for_price
    return getPricesForVariant({ ...cheapestVariant, product })
  }

  const variantPrice = () => {
    if (!product || !variantId) {
      return null
    }

    const variant: any = product.variants?.find(
      (v) => v.id === variantId || v.sku === variantId
    )

    if (!variant) {
      return null
    }

    return getPricesForVariant({ ...variant, product })
  }

  return {
    product,
    cheapestPrice: cheapestPrice(),
    variantPrice: variantPrice(),
  }
}
