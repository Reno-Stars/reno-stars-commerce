const checkEnvVariables = require("./check-env-variables")

checkEnvVariables()

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  // Container builds set NEXT_BUILD_STANDALONE=1 so `next build` also emits
  // .next/standalone (a self-contained server.js with only the traced runtime
  // deps) — the difference between a ~200 MB image and shipping the whole
  // 600 MB node_modules. Left OFF by default so the launchd `next start` path
  // on the Mac keeps building exactly as it does today.
  output: process.env.NEXT_BUILD_STANDALONE === "1" ? "standalone" : undefined,
  // Container builds prerender 637 pages, and every one of them refetches
  // /store/product-categories — a 5.69 MB response that exceeds Next's 2 MB data
  // cache ceiling, so it is never cached and is paid per page. On a CI builder
  // (no warm page cache, slower CPU than this Mac) that overruns the default
  // 60 s staticPageGenerationTimeout and fails the build. Raised for container
  // builds only; the Mac's launchd build keeps Next's default.
  ...(process.env.NEXT_BUILD_STANDALONE === "1"
    ? { staticPageGenerationTimeout: 300 }
    : {}),
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "www.oppeincabinetry.ca" },
      { protocol: "https", hostname: "bluevalleycabinets.ca" },
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        // self-hosted product images (e.g. /sunland-images/...) served from the storefront domain
        protocol: "https",
        hostname: "supply.reno-stars.com",
      },
      {
        protocol: "https",
        hostname: "medusa-public-images.s3.eu-west-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "medusa-server-testing.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "medusa-server-testing.s3.us-east-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "github.com",
      },
      {
        protocol: "https",
        hostname: "cdn.shopify.com",
      },
      {
        protocol: "https",
        hostname: "flooringliquidators.ca",
      },
      {
        protocol: "https",
        hostname: "htbcflooring.com",
      },
      {
        protocol: "https",
        hostname: "dptile.ca",
      },
      {
        // dptile.ca product photos are hosted on Contentful's CDN
        protocol: "https",
        hostname: "images.ctfassets.net",
      },
      {
        protocol: "https",
        hostname: "monalisatile.ca",
      },
      {
        protocol: "https",
        hostname: "www.monalisatile.ca",
      },
    ],
  },
}

module.exports = nextConfig
