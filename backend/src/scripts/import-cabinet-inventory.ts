import { createProductsWorkflow } from "@medusajs/core-flows"
import { ExecArgs, IProductModuleService, ISalesChannelModuleService } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules, ProductStatus } from "@medusajs/framework/utils"
import inventory from "./data/cabinet-inventory.json"

/** Read-only by default. Set CABINET_APPLY=1 after deploying the model assets. */
export default async function importCabinetInventory({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const products: IProductModuleService = container.resolve(Modules.PRODUCT)
  const channels: ISalesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
  const apply = process.env.CABINET_APPLY === "1"
  const origin = (process.env.CABINET_ASSET_ORIGIN || "https://supply.reno-stars.com").replace(/\/$/, "")
  if (!origin.startsWith("https://")) throw Error("Asset origin must use HTTPS")
  const [channel] = await channels.listSalesChannels({ name: "Default Sales Channel" })
  if (!channel) throw Error("Default Sales Channel missing")
  const seen = new Set<string>()
  const pending: typeof inventory.products = []
  // Complete duplicate and asset preflight before the first catalog write.
  for (const p of inventory.products) {
    if (!p.review_status || p.publication_approved !== false) throw Error(`Review disposition missing or unsupported: ${p.id}`)
    const sku = p.legacy_variant_sku || (p.brand === "OPPEIN" ? p.supplier_sku : p.id.toUpperCase())
    if (!sku || seen.has(sku) || !p.model_url?.startsWith("/cabinet-")) throw Error(`Invalid identity/model: ${p.id}`)
    seen.add(sku)
    if (![p.dimensions_mm?.w, p.dimensions_mm?.h, p.dimensions_mm?.d].every(n => typeof n === "number" && n > 0)) throw Error(`Invalid dimensions: ${p.id}`)
    const existing = await products.listProducts({ handle: p.id })
    if (existing.length) continue
    if ((await products.listProductVariants({ sku })).length) throw Error(`SKU belongs to another product: ${sku}`)
    if (apply) {
      const response = await fetch(`${origin}${p.model_url}`, { method: "HEAD", signal: AbortSignal.timeout(15000) })
      if (!response.ok || (response.headers.get("content-type") || "").includes("text/html")) throw Error(`Deploy model first: ${p.model_url}`)
    }
    pending.push(p)
  }
  logger.info(`${apply ? "Import" : "Dry run"}: ${inventory.products.length} eligible, ${pending.length} new, ${inventory.products.length-pending.length} existing`)
  if (!apply) return
  const categories = new Map<string, string>()
  for (const p of pending) {
    const categoryName = [p.brand, p.finish, p.construction].filter(Boolean).join(" — ")
    const handle = categoryName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "")
    if (!categories.has(handle)) {
      let [category] = await products.listProductCategories({ handle })
      if (!category) category = await products.createProductCategories({ name: categoryName, handle, is_active: true, is_internal: false })
      categories.set(handle, category.id)
    }
    const d = p.dimensions_mm!
    const size = `${d.w} W × ${d.h} H × ${d.d} D mm`
    if (!p.review_status || p.publication_approved !== false) throw Error(`Review disposition missing or unsupported: ${p.id}`)
    const sku = p.legacy_variant_sku || (p.brand === "OPPEIN" ? p.supplier_sku! : p.id.toUpperCase())
    const image = typeof p.supplier_image_url === "string" && p.supplier_image_url.startsWith("https://") ? p.supplier_image_url : undefined
    await createProductsWorkflow(container).run({ input: { products: [{
      title: `${p.title} — ${p.finish} — ${p.supplier_sku || p.id}`,
      handle: p.id,
      description: `${p.brand} ${p.finish}. ${size}. Manufacturer-published external dimensions; internal construction and finish appearance in the 3D model are visual approximations. ${p.model_spec?.legs_mm ? `Model includes ${p.model_spec.legs_mm} mm adjustable feet below the published body height. ` : ""}Contact Reno Stars for pricing and availability.`,
      status: ProductStatus.DRAFT,
      category_ids: [categories.get(handle)!], sales_channels: [{ id: channel.id }],
      thumbnail: image, images: image ? [{ url: image }] : [],
      options: [{ title: "Size", values: [size] }],
      variants: [{ title: size, sku, options: { Size: size }, manage_inventory: false, prices: [] }],
      metadata: { brand: p.brand, supplier_sku: p.supplier_sku, source_url: p.source_url, source_checked: p.source_checked, finish: p.finish, construction: p.construction, model_url: `${origin}${p.model_url}`, model_family: p.family, width_mm: d.w, height_mm: d.h, depth_mm: d.d, legs_mm: p.model_spec?.legs_mm || 0, pricing_mode: "quote_only", dimension_basis: "manufacturer_published_external", model_version: 2, review_status: p.review_status, publication_approved: false, review_findings: p.review_findings, model_finish_basis: "visual_approximation" },
    }] } })
    logger.info(`Created ${p.id}`)
  }
}
