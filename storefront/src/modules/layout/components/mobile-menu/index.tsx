"use client"

import { Popover, Transition } from "@headlessui/react"
import { Fragment } from "react"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"

// Hamburger menu for screens below the `small` breakpoint. Mirrors the desktop
// nav (Products, Renovate-with-us, phone CTA) plus surfaces the main browse
// paths so mobile visitors don't get stranded.
const MobileMenu = () => {
  return (
    <Popover className="small:hidden">
      {({ open, close }) => (
        <>
          <Popover.Button
            aria-label="Open menu"
            className="flex items-center justify-center w-10 h-10 rounded-full text-reno-navy hover:bg-reno-navy/10 focus:outline-none focus:ring-2 focus:ring-reno-orange/40"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 22 22"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              {open ? (
                <>
                  <line x1="5" y1="5" x2="17" y2="17" />
                  <line x1="17" y1="5" x2="5" y2="17" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="19" y2="6" />
                  <line x1="3" y1="11" x2="19" y2="11" />
                  <line x1="3" y1="16" x2="19" y2="16" />
                </>
              )}
            </svg>
          </Popover.Button>

          <Transition
            as={Fragment}
            enter="transition ease-out duration-150"
            enterFrom="opacity-0 -translate-y-1"
            enterTo="opacity-100 translate-y-0"
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 -translate-y-1"
          >
            <Popover.Panel className="fixed inset-x-0 top-[var(--mobile-nav-h,60px)] mt-2 z-40 mx-2 rounded-2xl border border-reno-navy/10 bg-reno-cream shadow-[0_20px_60px_-20px_rgba(27,42,78,0.25)] overflow-hidden">
              <nav className="flex flex-col py-2">
                <LocalizedClientLink
                  href="/"
                  onClick={() => close()}
                  className="px-5 py-3 text-reno-navy font-medium hover:bg-white/60"
                >
                  Home
                </LocalizedClientLink>
                <LocalizedClientLink
                  href="/store"
                  onClick={() => close()}
                  className="px-5 py-3 text-reno-navy font-medium hover:bg-white/60"
                >
                  Browse all products
                </LocalizedClientLink>
                <LocalizedClientLink
                  href="/categories/vanity"
                  onClick={() => close()}
                  className="px-5 py-2.5 text-reno-navy/80 hover:bg-white/60 text-sm"
                >
                  Vanity
                </LocalizedClientLink>
                <LocalizedClientLink
                  href="/categories/faucet"
                  onClick={() => close()}
                  className="px-5 py-2.5 text-reno-navy/80 hover:bg-white/60 text-sm"
                >
                  Faucet
                </LocalizedClientLink>
                <LocalizedClientLink
                  href="/categories/led-mirror"
                  onClick={() => close()}
                  className="px-5 py-2.5 text-reno-navy/80 hover:bg-white/60 text-sm"
                >
                  LED Mirror
                </LocalizedClientLink>
                <LocalizedClientLink
                  href="/categories/medicine-cabinet"
                  onClick={() => close()}
                  className="px-5 py-2.5 text-reno-navy/80 hover:bg-white/60 text-sm"
                >
                  Medicine Cabinet
                </LocalizedClientLink>
                <LocalizedClientLink
                  href="/categories/shower"
                  onClick={() => close()}
                  className="px-5 py-2.5 text-reno-navy/80 hover:bg-white/60 text-sm"
                >
                  Shower
                </LocalizedClientLink>

                <div className="border-t border-reno-navy/10 my-2" />

                <a
                  href="tel:778-960-7999"
                  className="px-5 py-3 text-reno-orange font-semibold hover:bg-white/60"
                >
                  Call 778-960-7999
                </a>
                <a
                  href="https://www.reno-stars.com/en/contact/"
                  target="_blank"
                  rel="noreferrer"
                  className="px-5 py-3 text-reno-navy font-medium hover:bg-white/60"
                >
                  Request a quote ↗
                </a>
                <a
                  href="https://www.reno-stars.com/en/"
                  target="_blank"
                  rel="noreferrer"
                  className="px-5 py-3 text-reno-navy/70 text-sm hover:bg-white/60"
                >
                  Renovate with us ↗
                </a>
              </nav>
            </Popover.Panel>
          </Transition>
        </>
      )}
    </Popover>
  )
}

export default MobileMenu
