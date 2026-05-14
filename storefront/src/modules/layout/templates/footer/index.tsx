import { listCategories } from "@/lib/data/categories"
import { Text, clx } from "@medusajs/ui"

import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import Image from "next/image"

export default async function Footer() {
  const product_categories = await listCategories({
    offset: 0,
    limit: 8,
  })

  return (
    <footer className="border-t border-reno-navy/10 w-full bg-reno-cream/40">
      <div className="content-container flex flex-col w-full">
        <div className="flex flex-col gap-y-10 xsmall:flex-row items-start justify-between py-24">
          <div className="flex flex-col gap-3 max-w-sm">
            <LocalizedClientLink href="/" className="block">
              <Image
                src="/reno-stars-logo.png"
                alt="Reno Stars"
                width={200}
                height={36}
                className="h-9 w-auto object-contain"
              />
            </LocalizedClientLink>
            <p className="text-sm text-reno-navy/70 leading-relaxed">
              Renovation materials curated by Vancouver&apos;s 5★-rated reno
              team — vanities, faucets, fixtures, and finishes used on our
              own projects.
            </p>
            <div className="text-sm text-reno-navy/80 flex flex-col gap-0.5 pt-2">
              <a
                href="tel:778-960-7999"
                className="font-medium hover:text-reno-orange"
              >
                778-960-7999
              </a>
              <a
                href="https://www.reno-stars.com/en/"
                target="_blank"
                rel="noreferrer"
                className="hover:text-reno-orange"
              >
                www.reno-stars.com
              </a>
            </div>
          </div>
          <div className="text-small-regular gap-10 md:gap-x-16 grid grid-cols-2 sm:grid-cols-3">
            {product_categories && product_categories?.length > 0 && (
              <div className="flex flex-col gap-y-2">
                <span className="text-sm font-semibold text-reno-navy">
                  Shop by material
                </span>
                <ul
                  className="grid grid-cols-1 gap-2"
                  data-testid="footer-categories"
                >
                  {product_categories?.slice(0, 8).map((c) => {
                    if (c.parent_category) {
                      return
                    }

                    return (
                      <li
                        className="flex flex-col gap-2 text-reno-navy/70 text-sm"
                        key={c.id}
                      >
                        <LocalizedClientLink
                          className={clx("hover:text-reno-orange")}
                          href={`/categories/${c.handle}`}
                          data-testid="category-link"
                        >
                          {c.name}
                        </LocalizedClientLink>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
            <div className="flex flex-col gap-y-2">
              <span className="text-sm font-semibold text-reno-navy">
                For trade & retail
              </span>
              <ul className="grid grid-cols-1 gap-y-2 text-reno-navy/70 text-sm">
                <li>
                  <LocalizedClientLink href="/store" className="hover:text-reno-orange">
                    Browse catalog
                  </LocalizedClientLink>
                </li>
                <li>
                  <LocalizedClientLink href="/account" className="hover:text-reno-orange">
                    Account & quotes
                  </LocalizedClientLink>
                </li>
                <li>
                  <a
                    href="https://www.reno-stars.com/en/contact/"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-reno-orange"
                  >
                    Open a B2B account
                  </a>
                </li>
              </ul>
            </div>
            <div className="flex flex-col gap-y-2">
              <span className="text-sm font-semibold text-reno-navy">
                Reno Stars
              </span>
              <ul className="grid grid-cols-1 gap-y-2 text-reno-navy/70 text-sm">
                <li>
                  <a
                    href="https://www.reno-stars.com/en/"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-reno-orange"
                  >
                    Renovation services
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.reno-stars.com/en/projects/"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-reno-orange"
                  >
                    Project portfolio
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.reno-stars.com/en/about-us/"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-reno-orange"
                  >
                    About us
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="flex w-full mb-12 pt-6 border-t border-reno-navy/10 justify-between items-center text-reno-navy/60">
          <Text className="text-sm">
            © {new Date().getFullYear()} Reno Stars Construction Inc. — Vancouver, BC
          </Text>
          <span className="text-xs uppercase tracking-wider">
            Where Renovation Starts
          </span>
        </div>
      </div>
    </footer>
  )
}
