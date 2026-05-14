import { listRegions } from "@/lib/data/regions"
import CollectionsGrid from "@/modules/home/components/collections-grid"
import FeaturedPicks from "@/modules/home/components/featured-picks"
import Hero from "@/modules/home/components/hero"
import SkeletonFeaturedProducts from "@/modules/skeletons/templates/skeleton-featured-products"
import { Metadata } from "next"
import { Suspense } from "react"

export const dynamicParams = true

export const metadata: Metadata = {
  title: "Reno Stars Supply — Vancouver Renovation Materials Catalog",
  description:
    "Trade pricing on vanities, faucets, tile, flooring, and finishes for Vancouver contractors and homeowners. Net-30 available on approved accounts.",
}

export async function generateStaticParams() {
  const countryCodes = await listRegions().then(
    (regions) =>
      regions
        ?.map((r) => r.countries?.map((c) => c.iso_2))
        .flat()
        .filter(Boolean) as string[]
  )
  return countryCodes.map((countryCode) => ({ countryCode }))
}

export default async function Home(props: {
  params: Promise<{ countryCode: string }>
}) {
  const params = await props.params
  const { countryCode } = params

  return (
    <div className="flex flex-col">
      <Hero />
      <Suspense fallback={<div className="content-container py-16" />}>
        <CollectionsGrid />
      </Suspense>
      <Suspense fallback={<SkeletonFeaturedProducts />}>
        <FeaturedPicks countryCode={countryCode} />
      </Suspense>
    </div>
  )
}
