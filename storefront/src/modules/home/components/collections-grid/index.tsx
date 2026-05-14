import { listCategories } from "@/lib/data/categories"
import { sdk } from "@/lib/config"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"
import Image from "next/image"

// Fetch one product's thumbnail from anywhere inside a top-level category
// (walks 1 level of children since our hierarchy is 2-deep).
async function getCoverImage(
  category: HttpTypes.StoreProductCategory
): Promise<string | null> {
  const childIds = (category.category_children || []).map((c) => c.id)
  const idsToQuery = childIds.length > 0 ? childIds : [category.id]
  try {
    const { products } = await sdk.client.fetch<{
      products: HttpTypes.StoreProduct[]
    }>(`/store/products`, {
      query: {
        category_id: idsToQuery,
        limit: 1,
        fields: "thumbnail",
      },
      cache: "force-cache",
    })
    return products?.[0]?.thumbnail ?? null
  } catch {
    return null
  }
}

const CollectionsGrid = async () => {
  const categories = await listCategories({ limit: 200 })
  const topLevel = categories
    .filter((c) => !c.parent_category_id)
    .sort((a, b) => a.name.localeCompare(b.name))

  // Sum descendant product counts for each parent (mirrors the sidebar logic)
  const productCountFor = (cat: HttpTypes.StoreProductCategory): number => {
    if (!cat.category_children?.length) return cat.products?.length || 0
    let total = cat.products?.length || 0
    for (const childRef of cat.category_children) {
      const child = categories.find((c) => c.id === childRef.id)
      if (child) total += productCountFor(child)
    }
    return total
  }

  const cards = await Promise.all(
    topLevel.map(async (cat) => ({
      cat,
      cover: await getCoverImage(cat),
      count: productCountFor(cat),
    }))
  )

  return (
    <section className="content-container py-12 sm:py-16">
      <div className="flex flex-col gap-2 mb-8 max-w-2xl">
        <span className="text-reno-orange uppercase tracking-widest text-xs font-semibold">
          Browse the catalog
        </span>
        <h2 className="text-3xl sm:text-4xl font-bold text-reno-navy leading-tight">
          Shop by collection
        </h2>
        <p className="text-reno-navy/70 text-base">
          {cards.length} categories sourced from Vancouver&apos;s trusted
          renovation suppliers. Trade pricing available on approved accounts.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {cards.map(({ cat, cover, count }) => (
          <LocalizedClientLink
            key={cat.id}
            href={`/categories/${cat.handle}`}
            className="group relative overflow-hidden rounded-xl bg-reno-cream/40 aspect-[4/3] flex items-end transition-shadow hover:shadow-[0_12px_32px_-12px_rgba(27,42,78,0.25)]"
          >
            {cover ? (
              <Image
                src={cover}
                alt={cat.name}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-reno-cream to-reno-cream-50" />
            )}
            {/* Gradient overlay for legibility */}
            <div className="absolute inset-0 bg-gradient-to-t from-reno-navy/85 via-reno-navy/30 to-transparent" />
            <div className="relative z-10 p-5 flex flex-col gap-1 text-white w-full">
              <h3 className="text-xl font-bold leading-tight">{cat.name}</h3>
              <span className="text-sm text-white/80">
                {count} {count === 1 ? "product" : "products"}
                <span className="text-reno-orange font-medium ml-2 group-hover:translate-x-0.5 inline-block transition-transform">
                  Browse →
                </span>
              </span>
            </div>
          </LocalizedClientLink>
        ))}
      </div>
    </section>
  )
}

export default CollectionsGrid
