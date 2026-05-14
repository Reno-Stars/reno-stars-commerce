import { sdk } from "@/lib/config"
import { getRegion } from "@/lib/data/regions"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import ProductPreview from "@/modules/products/components/product-preview"
import { HttpTypes } from "@medusajs/types"

// Small, hand-curated row to show on the homepage. Pulls the 4 most recent
// products from the Vanity category (NeoNova photography — the highest
// quality images we have). Easy to swap to a different category later.
const FEATURED_CATEGORY_HANDLE = "vanity"
const LIMIT = 4

const FeaturedPicks = async ({ countryCode }: { countryCode: string }) => {
  const region = await getRegion(countryCode)
  if (!region) return null

  // Look up the Vanity category id
  const { product_categories: vanityMatches } = await sdk.client.fetch<{
    product_categories: HttpTypes.StoreProductCategory[]
  }>(`/store/product-categories`, {
    query: { handle: FEATURED_CATEGORY_HANDLE, fields: "id" },
    cache: "force-cache",
  })
  const vanityId = vanityMatches?.[0]?.id
  if (!vanityId) return null

  const { products } = await sdk.client.fetch<{
    products: HttpTypes.StoreProduct[]
  }>(`/store/products`, {
    query: {
      category_id: [vanityId],
      region_id: region.id,
      limit: LIMIT,
      order: "-created_at",
      fields:
        "*variants,*variants.calculated_price,*images,thumbnail,handle,title",
    },
    cache: "force-cache",
  })

  if (!products || products.length === 0) return null

  return (
    <section className="content-container py-12 sm:py-16 border-t border-reno-navy/10">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-8">
        <div className="flex flex-col gap-2 max-w-2xl">
          <span className="text-reno-orange uppercase tracking-widest text-xs font-semibold">
            Featured
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-reno-navy leading-tight">
            New arrivals from the showroom
          </h2>
        </div>
        <LocalizedClientLink
          href="/store"
          className="text-reno-orange font-semibold text-sm hover:text-reno-orange-600 self-start sm:self-end"
        >
          See all products →
        </LocalizedClientLink>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {products.map((product) => (
          <ProductPreview
            key={product.id}
            product={product}
            region={region}
          />
        ))}
      </div>
    </section>
  )
}

export default FeaturedPicks
