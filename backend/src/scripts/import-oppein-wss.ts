import { createProductsWorkflow } from "@medusajs/core-flows"
import { ExecArgs, IProductModuleService, ISalesChannelModuleService } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules, ProductStatus } from "@medusajs/framework/utils"
import catalog from "./data/oppein-wss.json"

/** Run with medusa exec. Default is read-only; OPPEIN_APPLY=1 imports quote-only products. */
export default async function importOppein({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const products: IProductModuleService = container.resolve(Modules.PRODUCT)
  const channels: ISalesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
  const apply = process.env.OPPEIN_APPLY === "1"
  const assetBase = (process.env.OPPEIN_ASSET_BASE_URL || "https://supply.reno-stars.com/cabinet-library").replace(/\/$/, "")
  const source = catalog.products
  const skus = new Set<string>()
  for (const p of source) {
    if (p.status !== "model_ready" || !p.model_url || !p.dimensions_mm || p.supplier_sku !== p.sku || skus.has(p.sku)) throw Error(`Invalid cabinet record: ${p.sku}`)
    for (const value of Object.values(p.dimensions_mm)) if (!(value > 0)) throw Error(`Invalid dimensions: ${p.sku}`)
    skus.add(p.sku)
  }
  const [channel] = await channels.listSalesChannels({ name: "Default Sales Channel" })
  if (!channel) throw Error("Default Sales Channel missing")
  const handle = "oppein-white-single-shaker-plywood"
  let [category] = await products.listProductCategories({ handle })
  if (!category && apply) category = await products.createProductCategories({ name: "OPPEIN White Single Shaker — Plywood", handle, is_active: true, is_internal: false })
  let created = 0, skipped = 0
  for (const p of source) {
    const productHandle = `oppein-${p.sku.toLowerCase()}`
    const existing = await products.listProducts({ handle: productHandle })
    if (existing.length) { skipped++; continue }
    const conflicting = await products.listProductVariants({ sku: p.sku })
    if (conflicting.length) throw Error(`SKU already belongs to another product: ${p.sku}`)
    if (!apply) { logger.info(`[dry-run] ${p.sku}: ${p.source_dimension_text}`); continue }
    // Verify deployed model assets before creating a product that links to them.
    for (const asset of [p.model_url, `posters/${p.sku}.png`]) {
      const response = await fetch(`${assetBase}/${asset}`, { method: "HEAD" })
      const type = response.headers.get("content-type") || ""
      if (!response.ok || type.includes("text/html")) throw Error(`Model asset unavailable: ${asset}`)
    }
    const d = p.dimensions_mm
    await createProductsWorkflow(container).run({ input: { products: [{
      title: `${p.title} — ${p.sku}`,
      handle: productHandle,
      description: `OPPEIN White Single Shaker plywood cabinet. ${p.source_dimension_text}. Dimensions refer to the cabinet body; adjustable legs and installation height are shown separately in the 3D viewer. Contact Reno Stars for pricing and availability.`,
      status: ProductStatus.PUBLISHED,
      category_ids: [category!.id],
      sales_channels: [{ id: channel.id }],
      thumbnail: `${assetBase}/posters/${p.sku}.png`,
      images: [{ url: `${assetBase}/posters/${p.sku}.png` }],
      options: [{ title: "Size", values: [p.source_dimension_text] }],
      variants: [{ title: p.source_dimension_text, sku: p.sku, options: { Size: p.source_dimension_text }, manage_inventory: false, prices: [] }],
      metadata: { brand: "OPPEIN", series: "White Single Shaker", construction: "Plywood", source_url: p.source_url, cabinet_library_sku: p.sku, model_url: `${assetBase}/${p.model_url}`, width_mm: d.w, height_mm: d.h, depth_mm: d.d, pricing_mode: "quote_only", dimension_basis: "manufacturer_published_body", model_version: 1 },
    }] } })
    created++; logger.info(`Created ${p.sku}`)
  }
  logger.info(`${apply ? "Import" : "Dry run"}: eligible=${source.length}, created=${created}, existing=${skipped}`)
}
