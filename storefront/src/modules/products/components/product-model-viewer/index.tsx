"use client"

import { useEffect, useId, useRef, useState } from "react"
import { HttpTypes } from "@medusajs/types"
import { getProductModel } from "@/lib/util/product-model"

type Settings = {
  scene: string
  light: string
  brightness: number
  direction: number
}
type Stage = {
  loaded: boolean
  load: (product: {
    sku: string
    title: string
    model_url: string
    family: string
  }) => Promise<void>
  setSettings: (settings: Settings) => void
  resetView: () => void
  screenshot: () => string
  dispose: () => void
}
const defaults: Settings = {
  scene: "oak",
  light: "daylight",
  brightness: 100,
  direction: -35,
}

export default function ProductModelViewer({
  product,
}: {
  product: HttpTypes.StoreProduct
}) {
  const model = getProductModel(product.metadata)
  if (!model) return null
  return (
    <Viewer
      key={`${product.id}:${model.url}`}
      title={product.title || "Product"}
      model={model}
    />
  )
}

function Viewer({
  title,
  model,
}: {
  title: string
  model: NonNullable<ReturnType<typeof getProductModel>>
}) {
  const id = useId()
  const host = useRef<HTMLDivElement>(null)
  const stage = useRef<Stage | null>(null)
  const [settings, setSettings] = useState<Settings>(defaults)
  const settingsRef = useRef(settings)
  const [status, setStatus] = useState(
    "3D preview loads as you scroll into view."
  )
  const [ready, setReady] = useState(false)
  const [retry, setRetry] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("cabinet-presentation") || "{}"
      )
      const restored = {
        scene: ["oak", "stone", "studio"].includes(saved.scene)
          ? saved.scene
          : defaults.scene,
        light: ["daylight", "studio", "evening"].includes(saved.light)
          ? saved.light
          : defaults.light,
        brightness:
          typeof saved.brightness === "number" &&
          Number.isFinite(saved.brightness)
            ? Math.max(65, Math.min(140, saved.brightness))
            : defaults.brightness,
        direction:
          typeof saved.direction === "number" &&
          Number.isFinite(saved.direction)
            ? Math.max(-180, Math.min(180, saved.direction))
            : defaults.direction,
      }
      settingsRef.current = restored
      setSettings(restored)
    } catch {}
  }, [])

  useEffect(() => {
    const element = host.current
    if (!element) return
    let cancelled = false
    let instance: Stage | null = null
    let started = false
    setReady(false)
    setFailed(false)
    const start = async () => {
      if (started || cancelled) return
      started = true
      setStatus("Loading 3D preview…")
      try {
        // The committed ESM engine is shared with asset-authoring tools. No HTML iframe.
        const moduleUrl = "/cabinet-library/vendor/cabinet-stage.js"
        const { CabinetStage } = await import(
          /* webpackIgnore: true */ moduleUrl
        )
        if (cancelled) return
        instance = new CabinetStage(
          element,
          (message: string) => {
            if (cancelled) return
            setStatus(message)
            setReady(Boolean(instance?.loaded))
            setFailed(element.dataset.loaded === "error")
          },
          "/cabinet-library/"
        ) as Stage
        stage.current = instance
        instance.setSettings(settingsRef.current)
        await instance.load({
          sku: model.sku || "product",
          title,
          model_url: model.url,
          family: model.family,
        })
      } catch {
        if (!cancelled) {
          setStatus(
            "The 3D preview could not load. You can retry or download the model."
          )
          setFailed(true)
        }
      }
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect()
          void start()
        }
      },
      { rootMargin: "400px" }
    )
    observer.observe(element)
    return () => {
      cancelled = true
      observer.disconnect()
      instance?.dispose()
      stage.current = null
      element.replaceChildren()
    }
  }, [model.url, model.sku, model.family, title, retry])

  function update(patch: Partial<Settings>) {
    const next = { ...settingsRef.current, ...patch }
    settingsRef.current = next
    setSettings(next)
    stage.current?.setSettings(next)
    try {
      localStorage.setItem("cabinet-presentation", JSON.stringify(next))
    } catch {}
  }
  function saveImage() {
    if (!stage.current?.loaded) return
    const a = document.createElement("a")
    a.href = stage.current.screenshot()
    a.download = `${model.sku || "product"}-${settings.scene}-${
      settings.light
    }.png`
    a.click()
  }
  const inputClass =
    "mt-2 w-full min-w-0 rounded-md border border-neutral-300 bg-white p-2 text-sm"
  const buttonClass =
    "rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm disabled:opacity-40"
  return (
    <section
      className="content-container my-8"
      aria-labelledby={`${id}-heading`}
      data-testid="product-model-viewer"
    >
      <h2 id={`${id}-heading`} className="text-xl font-semibold">
        Explore this product in 3D
      </h2>
      <p className="mt-2 text-sm text-neutral-600">
        Rotate and zoom to inspect {title}. Try different surroundings and
        lighting.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-4 rounded-xl bg-neutral-100 p-4 small:grid-cols-2 medium:grid-cols-4">
        <label className="min-w-0 text-sm" htmlFor={`${id}-scene`}>
          Background scene
          <select
            id={`${id}-scene`}
            className={inputClass}
            value={settings.scene}
            onChange={(e) => update({ scene: e.target.value })}
          >
            <option value="oak">{model.family === "hardware" ? "Oak cabinet door" : "Warm oak room"}</option>
            <option value="stone">{model.family === "hardware" ? "White shaker door" : "Modern stone room"}</option>
            <option value="studio">Slate studio</option>
          </select>
        </label>
        <label className="min-w-0 text-sm" htmlFor={`${id}-light`}>
          Lighting
          <select
            id={`${id}-light`}
            className={inputClass}
            value={settings.light}
            onChange={(e) => update({ light: e.target.value })}
          >
            <option value="daylight">Window daylight</option>
            <option value="studio">Soft studio</option>
            <option value="evening">Warm evening</option>
          </select>
        </label>
        <label className="min-w-0 text-sm" htmlFor={`${id}-brightness`}>
          Brightness · {settings.brightness}%
          <input
            id={`${id}-brightness`}
            className="mt-5 w-full"
            type="range"
            min="65"
            max="140"
            step="5"
            value={settings.brightness}
            onChange={(e) => update({ brightness: Number(e.target.value) })}
          />
        </label>
        <label className="min-w-0 text-sm" htmlFor={`${id}-direction`}>
          Light direction · {settings.direction}°
          <input
            id={`${id}-direction`}
            className="mt-5 w-full"
            type="range"
            min="-180"
            max="180"
            step="5"
            value={settings.direction}
            onChange={(e) => update({ direction: Number(e.target.value) })}
          />
        </label>
      </div>
      <div
        ref={host}
        className="mt-4 h-[430px] w-full min-w-0 overflow-hidden rounded-xl bg-neutral-100 small:h-[560px]"
        role="img"
        aria-label={`Interactive 3D model of ${title}`}
      />
      <p className="mt-2 text-sm text-neutral-600" role="status">
        {status}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          className={buttonClass}
          disabled={!ready}
          onClick={() => stage.current?.resetView()}
        >
          Reset view
        </button>
        <button
          type="button"
          className={buttonClass}
          onClick={() =>
            update({
              light: defaults.light,
              brightness: defaults.brightness,
              direction: defaults.direction,
            })
          }
        >
          Reset lighting
        </button>
        <button
          type="button"
          className={buttonClass}
          disabled={!ready}
          onClick={saveImage}
        >
          Save image
        </button>
        <a className={buttonClass} href={model.url} download>
          Download 3D model
        </a>
        {failed && (
          <button
            type="button"
            className={buttonClass}
            onClick={() => setRetry((value) => value + 1)}
          >
            Retry preview
          </button>
        )}
      </div>
      {model.dimensions && (
        <p className="mt-3 text-sm text-neutral-600">
          {model.family === "hardware" ? <>Overall length {model.dimensions[0]} mm × width {model.dimensions[1]} mm × projection {model.dimensions[2]} mm.{model.mountingCentres ? ` Mounting centres: ${model.mountingCentres} mm.` : " Single mounting point."}</> : <>{model.sku ? "Cabinet body" : "Dimensions"}: {model.dimensions[0]} mm wide × {model.dimensions[1]} mm high × {model.dimensions[2]} mm deep.</>}
        </p>
      )}
      <p className="mt-2 text-xs text-neutral-500">
        Room backgrounds are for visualization and are not included with the
        product.
        {model.family === "wall"
          ? " Wall cabinets are shown mounted 1.45 m above the floor."
          : ""}
      </p>
    </section>
  )
}
