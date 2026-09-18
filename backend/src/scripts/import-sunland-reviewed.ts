import { createProductsWorkflow } from "@medusajs/core-flows"
import { ExecArgs, IProductModuleService, ISalesChannelModuleService } from "@medusajs/framework/types"
import { Modules, ProductStatus, ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createHash } from "node:crypto"
import inventory from "./data/sunland-reviewed.json"

/** All assets and identities are preflighted before the first write. Apply sequentially; reruns skip matching products. */
export default async function importSunland({ container }: ExecArgs) {
  const service: IProductModuleService = container.resolve(Modules.PRODUCT)
  const channels: ISalesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
  const query=container.resolve(ContainerRegistrationKeys.QUERY)
  async function inChannel(id:string,channelId:string) {
    const {data}=await query.graph({entity:"product",fields:["id","sales_channels.id"],filters:{id}})
    return Boolean(data[0]?.sales_channels?.some((c:any)=>c.id===channelId))
  }
  const apply = process.env.SUNLAND_APPLY === "1"
  const origin = "https://supply.reno-stars.com"
  const [channel] = await channels.listSalesChannels({ name: "Default Sales Channel" })
  if (!channel) throw Error("Default Sales Channel missing")
  const seen = new Set<string>()
  const configurations = new Set<string>()
  const configuration = (sku: unknown, width: unknown, depth: unknown, height: unknown, glass: unknown, finish: unknown, variant: unknown) => JSON.stringify([sku,width,depth ?? null,height,glass ?? null,finish,variant ?? null])
  const pending: typeof inventory.products = []
  for (const p of inventory.products) {
    if (p.review_status !== "dimensions_and_render_reviewed" || seen.has(p.id) || seen.has(p.variant_sku) || !p.supplier_sku || ![p.dimensions_mm.width,p.dimensions_mm.height].every(v => Number.isFinite(v) && v > 0)) throw Error(`Invalid reviewed product ${p.id}`)
    seen.add(p.id);seen.add(p.variant_sku)
    const fingerprint=configuration(p.supplier_sku,p.dimensions_mm.width,p.dimensions_mm.depth,p.dimensions_mm.height,p.glass_mm,p.finish,p.configuration_variant)
    if(configurations.has(fingerprint)) throw Error(`Duplicate configuration in manifest: ${p.id}`)
    configurations.add(fingerprint)
    for (const [name, evidence] of Object.entries(p.files)) {
      const url = origin + p.model_url.replace(/model\.glb$/, name)
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) })
      if (!response.ok) throw Error(`Asset unavailable ${url}: ${response.status}`)
      const bytes = Buffer.from(await response.arrayBuffer())
      if (bytes.length !== evidence.bytes || createHash("sha256").update(bytes).digest("hex") !== evidence.sha256 || (name.endsWith(".glb") && bytes.toString("ascii", 0, 4) !== "glTF")) throw Error(`Asset mismatch ${url}`)
    }
    const prior = await service.listProducts({ handle: p.id }, { relations: ["variants", "categories"] })
    if (prior.length > 1) throw Error(`Duplicate handle ${p.id}`)
    if (prior.length) {
      const x=prior[0],m=x.metadata
      if (m?.brand !== "Sunland" || m?.supplier_sku !== p.supplier_sku || m?.model_sha256 !== p.files["model.glb"].sha256 || x.status !== ProductStatus.PUBLISHED || !x.variants?.some(v=>v.sku===p.variant_sku) || !x.categories?.some(c=>c.handle===`bathroom-${p.category_key}-sunland`) || !await inChannel(x.id,channel.id)) throw Error(`Existing product differs: ${p.id}`)
      continue
    }
    if ((await service.listProductVariants({ sku: p.variant_sku })).length) throw Error(`Existing variant SKU: ${p.variant_sku}`)
    const similar=await service.listProducts({q:p.supplier_sku}, {take:1000})
    if(similar.some(x=> {
      const m=x.metadata
      return m?.brand==='Sunland' && x.handle!==p.id && configuration(m.supplier_sku,m.width_mm,m.depth_mm,m.height_mm,m.glass_thickness_mm,m.finish,m.configuration_variant)===fingerprint
    })) throw Error(`Configuration already listed under another handle: ${p.id}`)
    pending.push(p)
  }
  console.log(JSON.stringify({ phase: "preflight", apply, reviewed: inventory.products.length, pending: pending.length }))
  if (!apply || !pending.length) return
  async function category(name: string, handle: string, parent?: string) {
    let [c] = await service.listProductCategories({ handle })
    if (c && (c.parent_category_id || undefined) !== parent) throw Error(`Category parent mismatch ${handle}`)
    if (!c) c = await service.createProductCategories({ name, handle, parent_category_id: parent, is_active: true, is_internal: false })
    else if (!c.is_active || c.is_internal) c = await service.updateProductCategories(c.id, { is_active: true, is_internal: false })
    return c.id
  }
  const root=await category("Bathroom","bathroom"),leaves=new Map<string,string>()
  for(const p of pending) if(!leaves.has(p.category_key)) {
    const mid=await category(p.category,`bathroom-${p.category_key}`,root)
    leaves.set(p.category_key,await category('Sunland',`bathroom-${p.category_key}-sunland`,mid))
  }
  for (const p of pending) {
    const d = p.dimensions_mm,categoryId=leaves.get(p.category_key)!
    await createProductsWorkflow(container).run({ input: { products: [{
      title:p.title,handle:p.id,status:ProductStatus.PUBLISHED,description:p.description,
      category_ids:[categoryId],sales_channels:[{id:channel.id}],thumbnail:origin+p.image_url,images:[{url:origin+p.image_url},{url:origin+p.drawing_url}],
      options:[{title:"Configuration",values:[p.variant_title]}],variants:[{title:p.variant_title,sku:p.variant_sku,options:{Configuration:p.variant_title},manage_inventory:false,prices:[]}],
      metadata:{brand:"Sunland",supplier_sku:p.supplier_sku,source_url:p.source_url,source_checked:p.source_checked,model_url:origin+p.model_url,blender_model_url:origin+p.blend_url,design_catalog_url:origin+"/sunland-library/design-catalog.json",model_family:"bathroom",model_sha256:p.files["model.glb"].sha256,model_limitations:p.model_limitations,model_version:1,model_units:"metres",model_up_axis:"Y",model_envelope_mm:p.model_envelope_mm,review_status:p.review_status,dimension_basis:"manufacturer_published",dimension_scope:p.dimension_scope,specification_url:origin+p.drawing_url,width_mm:d.width,height_mm:d.height,depth_mm:d.depth,glass_thickness_mm:p.glass_mm,pricing_mode:"quote_only",finish:p.finish,configuration_variant:p.configuration_variant}
    }] } })
    const [x]=await service.listProducts({handle:p.id},{relations:["categories","variants"]})
    if(x?.status!==ProductStatus.PUBLISHED || x.metadata?.model_sha256!==p.files['model.glb'].sha256 || !x.categories?.some(c=>c.id===categoryId) || !x.variants?.some(v=>v.sku===p.variant_sku) || !await inChannel(x.id,channel.id)) throw Error(`Post-import verification failed ${p.id}`)
    console.log(JSON.stringify({phase:'imported',handle:p.id,sku:p.variant_sku}))
  }
}
