import { retrieveCustomer } from "@/lib/data/customer"
import AccountButton from "@/modules/account/components/account-button"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import FilePlus from "@/modules/common/icons/file-plus"
import { MegaMenuWrapper } from "@/modules/layout/components/mega-menu"
import MobileMenu from "@/modules/layout/components/mobile-menu"
import SkeletonAccountButton from "@/modules/skeletons/components/skeleton-account-button"
import SkeletonMegaMenu from "@/modules/skeletons/components/skeleton-mega-menu"
import Image from "next/image"
import { Suspense } from "react"

export async function NavigationHeader() {
  const customer = await retrieveCustomer().catch(() => null)

  return (
    <div className="sticky top-0 inset-x-0 group bg-reno-cream/95 backdrop-blur text-reno-navy small:p-4 p-2 text-sm border-b duration-200 border-reno-navy/10 z-50">
      <header className="flex w-full content-container relative small:mx-auto justify-between">
        <div className="small:mx-auto flex justify-between items-center min-w-full">
          <div className="flex items-center small:space-x-6">
            <LocalizedClientLink
              className="flex items-center w-fit"
              href="/"
            >
              <Image
                src="/reno-stars-logo.png"
                alt="Reno Stars"
                width={180}
                height={32}
                priority
                className="h-8 w-auto object-contain"
              />
            </LocalizedClientLink>

            <a
              href="https://www.reno-stars.com/en/"
              target="_blank"
              rel="noreferrer"
              className="hidden small:inline-flex text-sm text-reno-navy/70 hover:text-reno-navy font-medium"
            >
              Renovate with us ↗
            </a>

            <nav>
              <ul className="space-x-4 hidden small:flex">
                <li>
                  <Suspense fallback={<SkeletonMegaMenu />}>
                    <MegaMenuWrapper />
                  </Suspense>
                </li>
              </ul>
            </nav>
          </div>
          <div className="flex justify-end items-center gap-2">
            <div className="relative mr-2 hidden small:inline-flex">
              <input
                disabled
                type="text"
                placeholder="Search materials, faucets, vanities…"
                className="bg-white/60 text-reno-navy placeholder:text-reno-navy/40 px-4 py-2 rounded-full pr-10 border border-reno-navy/10 hidden small:inline-block hover:cursor-not-allowed"
                title="Install a search provider to enable product search"
              />
            </div>

            <div className="hidden small:block h-4 w-px bg-reno-navy/20" />

            <a
              href="tel:778-960-7999"
              className="hidden small:inline-flex gap-1.5 items-center rounded-full px-3 py-1.5 text-reno-navy hover:bg-reno-navy/10 font-medium"
              title="Call Reno Stars"
            >
              <FilePlus />
              <span>778-960-7999</span>
            </a>

            <Suspense fallback={<SkeletonAccountButton />}>
              <AccountButton customer={customer} />
            </Suspense>

            <MobileMenu />
          </div>
        </div>
      </header>
    </div>
  )
}
