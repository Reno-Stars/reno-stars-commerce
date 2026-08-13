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
