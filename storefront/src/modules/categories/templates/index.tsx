import CategoryBreadcrumb from "@/modules/categories/category-breadcrumb"
import SkeletonProductGrid from "@/modules/skeletons/templates/skeleton-product-grid"
import RefinementList from "@/modules/store/components/refinement-list"
import { SortOptions } from "@/modules/store/components/refinement-list/sort-products"
import PaginatedProducts from "@/modules/store/templates/paginated-products"
import { HttpTypes } from "@medusajs/types"
import { notFound } from "next/navigation"
import { Suspense } from "react"

// Walk down the category tree from `root` and collect every descendant id
// (plus the root itself). Used for parent-category pages so the product
// query returns products from leaf children, not just direct matches.
function collectCategoryAndDescendantIds(
  root: HttpTypes.StoreProductCategory,
  all: HttpTypes.StoreProductCategory[]
): string[] {
  const result: string[] = [root.id]
  const stack = [...(root.category_children || [])]
  while (stack.length) {
    const ref = stack.pop()!
    const full = all.find((c) => c.id === ref.id)
    if (!full) continue
    result.push(full.id)
    if (full.category_children?.length) stack.push(...full.category_children)
  }
  return result
}

export default function CategoryTemplate({
  categories,
  currentCategory,
  sortBy,
  page,
  countryCode,
}: {
  categories: HttpTypes.StoreProductCategory[]
  currentCategory: HttpTypes.StoreProductCategory
  sortBy?: SortOptions
  page?: string
  countryCode: string
}) {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"

  if (!currentCategory || !countryCode) notFound()

  const categoryIds = collectCategoryAndDescendantIds(currentCategory, categories)

  return (
    <div className="bg-neutral-100">
      <div
        className="flex flex-col py-6 content-container gap-4"
        data-testid="category-container"
      >
        <CategoryBreadcrumb
          categories={categories}
          category={currentCategory}
        />
        <div className="flex flex-col small:flex-row small:items-start gap-3">
          <RefinementList
            sortBy={sort}
            categories={categories}
            currentCategory={currentCategory}
            listName={currentCategory.name}
            data-testid="sort-by-container"
          />
          <div className="w-full">
            <Suspense fallback={<SkeletonProductGrid count={12} />}>
              <PaginatedProducts
                sortBy={sort}
                page={pageNumber}
                categoryIds={categoryIds}
                countryCode={countryCode}
              />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  )
}
