import { HttpTypes } from "@medusajs/types"

export default function ProductModelViewer({ product }: { product: HttpTypes.StoreProduct }) {
  const sku = product.metadata?.cabinet_library_sku
  if (typeof sku !== "string" || !/^PLY-WSS-[A-Z0-9]+$/.test(sku)) return null
  return (
    <section className="content-container my-8" aria-label="Interactive cabinet model">
      <h2 className="text-xl font-semibold mb-3">Explore this cabinet in 3D</h2>
      <iframe
        title={`Interactive 3D model — ${sku}`}
        src={`/cabinet-library/index.html?embed=1&sku=${encodeURIComponent(sku)}`}
        className="w-full rounded-xl border border-neutral-200"
        style={{ height: 760 }}
        loading="lazy"
      />
      <a className="inline-block mt-3 underline" href="/cabinet-library/index.html">Browse all OPPEIN cabinet sizes</a>
    </section>
  )
}
