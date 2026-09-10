/** Public product metadata controls whether the product has a 3D presentation. */
export function getProductModel(metadata?: Record<string, unknown> | null) {
  const sku =
    typeof metadata?.cabinet_library_sku === "string" &&
    /^PLY-WSS-[A-Z0-9]+$/.test(metadata.cabinet_library_sku)
      ? metadata.cabinet_library_sku
      : undefined
  const candidate =
    typeof metadata?.model_url === "string" ? metadata.model_url.trim() : ""
  // Only web assets: reject script/data URLs, protocol-relative URLs and credentials.
  let url: string | undefined
  if (candidate) {
    try {
      const parsed = new URL(candidate, "https://supply.reno-stars.com")
      if (
        ((candidate.startsWith("/") && !candidate.startsWith("//")) ||
          candidate.startsWith("https://")) &&
        parsed.protocol === "https:" &&
        !parsed.username &&
        !parsed.password &&
        /\.glb$/i.test(parsed.pathname)
      )
        url = candidate
    } catch {}
  }
  if (!url && sku) url = `/cabinet-library/models/${sku}.glb`
  if (!url) return null
  const code = sku?.replace("PLY-WSS-", "") || ""
  const family =
    metadata?.model_family === "wall" ||
    metadata?.model_family === "base" ||
    metadata?.model_family === "pantry"
      ? metadata.model_family
      : /^W/.test(code)
      ? "wall"
      : /^PC/.test(code)
      ? "pantry"
      : "base"
  const dimensions = [
    metadata?.width_mm,
    metadata?.height_mm,
    metadata?.depth_mm,
  ]
  return {
    url,
    sku,
    family,
    dimensions: dimensions.every(
      (v) => typeof v === "number" && Number.isFinite(v) && v > 0
    )
      ? (dimensions as number[])
      : null,
  }
}
