import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import Image from "next/image"

const Hero = () => {
  return (
    <div className="h-[75vh] w-full relative bg-reno-navy">
      <Image
        src="/reno-stars-hero.webp"
        alt="Reno Stars renovation materials"
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/65 to-black/45" />
      <div className="absolute inset-0 z-10 flex flex-col justify-center max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl space-y-5">
          <p className="text-reno-orange uppercase tracking-widest text-xs sm:text-sm font-semibold">
            Reno Stars · Trade Materials
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-white">
            Vancouver&apos;s Renovation Supply Catalog
          </h1>
          <p className="text-base lg:text-lg leading-relaxed text-white/80">
            Vanities, faucets, LED mirrors, fixtures, and finishes — sourced
            for Vancouver contractors and homeowners. Net-30 trade pricing on
            approved accounts. Same selection we use on our own projects.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <LocalizedClientLink
              href="/store"
              className="px-7 py-3.5 rounded-xl text-base font-semibold text-white transition hover:brightness-110"
              style={{
                backgroundColor: "#C8922A",
                boxShadow: "0 4px 20px #C8922A55",
              }}
            >
              Browse the catalog
            </LocalizedClientLink>
            <a
              href="https://www.reno-stars.com/en/contact/"
              target="_blank"
              rel="noreferrer"
              className="px-7 py-3.5 rounded-xl text-base font-semibold cursor-pointer border border-white/30 text-white/90 hover:text-white hover:border-white/60 transition backdrop-blur-sm"
            >
              Request trade pricing
            </a>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 pt-4 text-sm font-medium text-white/70">
            <span className="flex items-center gap-1.5">
              <span className="text-reno-orange">●</span> 20+ years renovating
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-reno-orange">●</span> $5M CGL insured
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-reno-orange">★</span> 5.0 Google rated
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Hero
