import { InformationCircleSolid } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"

// Stock display removed — catalog-only mode. Availability is confirmed by
// our team when a customer calls or requests a quote.
const ProductFacts = ({ product }: { product: HttpTypes.StoreProduct }) => {
  return (
    <div className="flex flex-col gap-y-2 w-full">
      {product.mid_code && (
        <span className="flex items-center gap-x-2 text-reno-navy/70 text-sm">
          <InformationCircleSolid />
          MID: {product.mid_code}
        </span>
      )}
    </div>
  )
}

export default ProductFacts
