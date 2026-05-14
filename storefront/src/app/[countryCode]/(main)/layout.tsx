import { getBaseURL } from "@/lib/util/env"
import Footer from "@/modules/layout/templates/footer"
import { NavigationHeader } from "@/modules/layout/templates/nav"
import { ArrowUpRightMini } from "@medusajs/icons"
import { Metadata } from "next"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

export default async function PageLayout(props: { children: React.ReactNode }) {
  return (
    <>
      <NavigationHeader />
      <div className="flex items-center text-white justify-center small:p-3 p-2 text-center bg-reno-navy small:gap-2 gap-1 text-sm">
        <div className="flex flex-col small:flex-row small:gap-2 gap-1 items-center">
          <span className="flex items-center gap-1.5">
            Trade pricing for Vancouver contractors — net-30 available on
            approved accounts.
          </span>

          <a
            className="group hover:text-reno-orange text-reno-orange/90 self-end small:self-auto font-medium"
            href="https://www.reno-stars.com/en/contact/"
            target="_blank"
          >
            Open a B2B account
            <ArrowUpRightMini className="group-hover:text-reno-orange inline" />
          </a>
        </div>
      </div>

      {props.children}

      <Footer />
    </>
  )
}
