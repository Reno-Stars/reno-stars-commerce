import { getProductPrice } from "@/lib/util/get-product-price"
import { HttpTypes } from "@medusajs/types"
import { Text } from "@medusajs/ui"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import Thumbnail from "../thumbnail"
import PreviewPrice from "./price"

export default async function ProductPreview({
  product,
  isFeatured,
  region,
}: {
  product: HttpTypes.StoreProduct
  isFeatured?: boolean
  region: HttpTypes.StoreRegion
}) {
  if (!product) {
    return null
  }

  const { cheapestPrice } = getProductPrice({ product })

  return (
    <LocalizedClientLink href={`/products/${product.handle}`} className="group">
      <div
        data-testid="product-wrapper"
        className="flex flex-col w-full p-4 bg-white border border-reno-navy/10 rounded-lg group-hover:border-reno-orange/40 group-hover:shadow-[0_8px_24px_-12px_rgba(27,42,78,0.15)] transition-all ease-in-out duration-150"
      >
        <div className="w-full aspect-square p-3 bg-reno-cream/30 rounded-md overflow-hidden">
          <Thumbnail
            thumbnail={product.thumbnail}
            images={product.images}
            size="full"
            isFeatured={isFeatured}
            className="!aspect-square"
          />
        </div>

        <div className="flex flex-col gap-1 mt-4">
          <span className="text-reno-navy/50 text-[0.65rem] tracking-widest uppercase font-medium">
            Reno Stars
          </span>
          <h3
            className="text-reno-navy text-sm font-medium leading-snug line-clamp-2 min-h-[2.5rem]"
            data-testid="product-title"
            title={product.title}
          >
            {product.title}
          </h3>
        </div>

        <div className="flex flex-col gap-0 mt-3">
          {cheapestPrice && <PreviewPrice price={cheapestPrice} />}
          <Text className="text-reno-navy/50 text-[0.6rem]">
            Contact us for trade pricing
          </Text>
        </div>

        <div className="flex justify-between items-center mt-3 pt-3 border-t border-reno-navy/5">
          <span className="text-xs text-reno-navy/60">View details</span>
          <span className="text-reno-orange text-sm font-medium group-hover:translate-x-0.5 transition-transform">
            →
          </span>
        </div>
      </div>
    </LocalizedClientLink>
  )
}
