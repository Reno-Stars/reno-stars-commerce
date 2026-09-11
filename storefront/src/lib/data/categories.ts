"use server"

import { sdk } from "@/lib/config"
import { HttpTypes } from "@medusajs/types"
import { getCacheOptions } from "./cookies"

export const listCategories = async (
  query?: Record<string, any>
): Promise<HttpTypes.StoreProductCategory[]> => {
  const next = {
    ...(await getCacheOptions("categories")),
  }

  const limit = query?.limit || 100

  return sdk.client
    .fetch<{ product_categories: HttpTypes.StoreProductCategory[] }>(
      "/store/product-categories",
      {
        query: {
          // `products.id`, NOT `*products`. Every consumer of this relation
          // reads only `category.products?.length` (a count) — see
          // collections-grid and refinement-list/category-list — so embedding
          // the full product objects fetched ~4 MB to compute an integer.
          //
          // That size was not merely wasteful, it was the build breaker: at
          // 4 MB the response is over Next's 2 MB data-cache ceiling, so it is
          // silently NOT cached and re-fetched for every prerendered page.
          // 637 pages x 4 MB is ~2.5 GB aimed at the live Medusa backend, which
          // 502'd partway through and failed the build.
          //
          // Measured against production: 4,264,657 -> 141,782 bytes, with an
          // identical 1,483 product refs across the same 27 categories. The
          // counts are byte-for-byte the same; only the unread payload is gone.
          fields:
            "*category_children, products.id, *parent_category, *parent_category.parent_category",
          limit,
          ...query,
        },
        next,
        cache: "no-store",
      }
    )
    .then(({ product_categories }) => product_categories)
}

export const getCategoryByHandle = async (
  categoryHandle: string[]
): Promise<HttpTypes.StoreProductCategory> => {
  const handle = `${categoryHandle.join("/")}`

  const next = {
    ...(await getCacheOptions("categories")),
  }

  return sdk.client
    .fetch<HttpTypes.StoreProductCategoryListResponse>(
      `/store/product-categories`,
      {
        query: {
          // Same reasoning as listCategories above: only the count is read.
          fields: "*category_children, products.id",
          handle,
        },
        next,
        cache: "no-store",
      }
    )
    .then(({ product_categories }) => product_categories[0])
}
