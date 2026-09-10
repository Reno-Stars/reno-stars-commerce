"use client"

import { useEffect, useRef, useState } from "react"
import { HttpTypes } from "@medusajs/types"

export default function ProductModelViewer({ product }: { product: HttpTypes.StoreProduct }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(950)
  useEffect(() => {
    const resize = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return
      if (event.data?.type !== "cabinet-viewer-height" || !Number.isFinite(event.data.height)) return
      setHeight(Math.max(600, Math.min(2000, event.data.height + 8)))
    }
    window.addEventListener("message", resize)
    return () => window.removeEventListener("message", resize)
  }, [])
  const sku = product.metadata?.cabinet_library_sku
  if (typeof sku !== "string" || !/^PLY-WSS-[A-Z0-9]+$/.test(sku)) return null
  return (
    <section className="content-container my-8" aria-label="Interactive cabinet model">
      <h2 className="text-xl font-semibold mb-3">Explore this cabinet in 3D</h2>
      <iframe
        ref={frame}
        title={`Interactive 3D model — ${sku}`}
        src={`/cabinet-library/index.html?embed=1&sku=${encodeURIComponent(sku)}`}
        className="w-full rounded-xl border border-neutral-200"
        style={{ height }}
        loading="lazy"
      />
      <div className="flex flex-wrap gap-5 mt-3">
        <a className="underline" href="/cabinet-library/index.html">Browse all OPPEIN cabinet sizes</a>
      </div>
    </section>
  )
}
