"use client"

import { HttpTypes } from "@medusajs/types"
import { clx } from "@medusajs/ui"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

const MegaMenu = ({
  categories,
}: {
  categories: HttpTypes.StoreProductCategory[]
}) => {
  const [isHovered, setIsHovered] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<
    HttpTypes.StoreProductCategory["id"] | null
  >(null)

  const pathname = usePathname()

  const mainCategories = categories.filter(
    (category) => !category.parent_category_id
  )

  const getSubCategories = (categoryId: string) => {
    return categories.filter(
      (category) => category.parent_category_id === categoryId
    )
  }

  let menuTimeout: NodeJS.Timeout | null = null

  const handleMenuHover = () => {
    if (menuTimeout) {
      clearTimeout(menuTimeout)
    }
    setIsHovered(true)
  }

  const handleMenuLeave = () => {
    menuTimeout = setTimeout(() => {
      setIsHovered(false)
    }, 300)

    return () => {
      if (menuTimeout) {
        clearTimeout(menuTimeout)
      }
    }
  }

  let categoryTimeout: NodeJS.Timeout | null = null

  const handleCategoryHover = (categoryId: string) => {
    categoryTimeout = setTimeout(() => {
      setSelectedCategory(categoryId)
    }, 200)

    return () => {
      if (categoryTimeout) {
        clearTimeout(categoryTimeout)
      }
    }
  }

  const handleCategoryLeave = () => {
    if (categoryTimeout) {
      clearTimeout(categoryTimeout)
    }
  }

  useEffect(() => {
    setIsHovered(false)
  }, [pathname])

  return (
    <>
      <div
        onMouseEnter={handleMenuHover}
        onMouseLeave={handleMenuLeave}
        className="z-50"
      >
        <LocalizedClientLink
          className="hover:text-ui-fg-base hover:bg-neutral-100 rounded-full px-3 py-2"
          href="/store"
        >
          Products
        </LocalizedClientLink>
        {isHovered && (
          // 2026-05-22: was `fixed left-0 right-0` (full-width) — covered the
          // whole screen once Flooring grew to 18 children + Collections 19
          // grandchildren. Now constrained to a centered max-w-6xl card with
          // max-h-[70vh] overflow + grandchild preview cap (5 per group +
          // "View all" link).
          <div className="fixed left-1/2 -translate-x-1/2 top-[60px] w-[min(100vw-2rem,72rem)] max-h-[70vh] overflow-y-auto flex gap-10 py-6 px-8 bg-white border border-neutral-200 rounded-xl shadow-xl">
            <div className="flex flex-col gap-1 shrink-0 min-w-[160px]">
              {mainCategories.map((category) => (
                <LocalizedClientLink
                  key={category.id}
                  href={`/categories/${category.handle}`}
                  className={clx(
                    "hover:bg-neutral-100 hover:cursor-pointer rounded-md px-3 py-2 font-medium",
                    selectedCategory === category.id && "bg-neutral-100"
                  )}
                  onMouseEnter={() => handleCategoryHover(category.id)}
                  onMouseLeave={handleCategoryLeave}
                >
                  {category.name}
                </LocalizedClientLink>
              ))}
            </div>
            {selectedCategory && (() => {
              const subs = getSubCategories(selectedCategory)
              const SUB_CHILD_PREVIEW = 5
              return (
                <div className="grid grid-cols-3 gap-x-8 gap-y-5 flex-1 auto-rows-min">
                  {subs.map((category) => {
                    const grandkids = getSubCategories(category.id)
                    const preview = grandkids.slice(0, SUB_CHILD_PREVIEW)
                    const remaining = grandkids.length - preview.length
                    return (
                      <div key={category.id} className="flex flex-col gap-1">
                        <LocalizedClientLink
                          className="font-medium text-zinc-700 hover:underline"
                          href={`/categories/${category.handle}`}
                        >
                          {category.name}
                        </LocalizedClientLink>
                        {preview.length > 0 && (
                          <div className="flex flex-col gap-0.5 text-sm text-zinc-500">
                            {preview.map((subCategory) => (
                              <LocalizedClientLink
                                key={subCategory.id}
                                className="hover:underline"
                                href={`/categories/${subCategory.handle}`}
                              >
                                {subCategory.name}
                              </LocalizedClientLink>
                            ))}
                            {remaining > 0 && (
                              <LocalizedClientLink
                                className="text-xs text-reno-orange hover:underline mt-0.5"
                                href={`/categories/${category.handle}`}
                              >
                                View all ({grandkids.length}) →
                              </LocalizedClientLink>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        )}
      </div>
      {isHovered && (
        <div className="fixed inset-0 mt-[60px] bg-black/30 z-[-1]" />
      )}
    </>
  )
}

export default MegaMenu
