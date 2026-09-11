import { createProductsWorkflow } from "@medusajs/core-flows"
import { ExecArgs, IProductModuleService, ISalesChannelModuleService } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules, ProductStatus } from "@medusajs/framework/utils"
import { createHash } from "node:crypto"
import inventory from "./data/eurofit-hardware.json"

/** Default is read-only. Apply only after assets are deployed and preflight passes. */
export default async function importEurofitHardware({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const products: IProductModuleService = container.resolve(Modules.PRODUCT)
  const channels: ISalesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
  const apply = process.env.EUROFIT_APPLY === "1"
  const origin = "https://supply.reno-stars.com"
  const [channel] = await channels.listSalesChannels({ name: "Default Sales Channel" })
  if (!channel) throw Error("Default Sales Channel missing")
  const seen = new Set<string>()
  const pending: typeof inventory.products = []
  let existing = 0
  for (const p of inventory.products) {
    const d = p.dimensions_mm
    if (p.review_status !== "dimensions_published" || !p.supplier_sku || seen.has(p.supplier_sku) || ![d.length,d.width,d.projection].every(n=>Number.isFinite(n)&&n>0)) throw Error(`Invalid record ${p.id}`)
    if (!/^\/eurofit-hardware\/models\/[a-z0-9-]+\.glb$/.test(p.model_url)) throw Error(`Invalid model URL ${p.id}`)
    if (p.type !== "Knobs" && !(p.mounting_centres_mm && p.mounting_centres_mm < d.length)) throw Error(`Invalid mounting centres ${p.id}`)
    seen.add(p.supplier_sku)
    const [prior] = await products.listProducts({ handle: p.id })
    if (prior) {
      if (prior.metadata?.supplier_sku !== p.supplier_sku || prior.metadata?.brand !== "Eurofit Canada" || prior.metadata?.model_sha256 !== p.sha256 || prior.status !== ProductStatus.PUBLISHED) throw Error(`Existing product differs: ${p.id}; review before updating`)
      existing++; continue
    }
    if ((await products.listProductVariants({ sku: p.supplier_sku })).length) throw Error(`SKU already used: ${p.supplier_sku}`)
    pending.push(p)
  }
  // Check exact deployed bytes, including the glTF magic; do not accept an HTML fallback.
  // Bounded concurrency, complete before any catalog mutation.
  for (let start=0;start<pending.length;start+=8) {
    await Promise.all(pending.slice(start,start+8).map(async p=>{
      const response=await fetch(origin+p.model_url,{signal:AbortSignal.timeout(30000)})
      if(!response.ok) throw Error(`Missing deployed model ${p.id}: ${response.status}`)
      const bytes=Buffer.from(await response.arrayBuffer())
      if(bytes.length!==p.bytes || bytes.toString("ascii",0,4)!=="glTF" || createHash("sha256").update(bytes).digest("hex")!==p.sha256) throw Error(`Deployed model mismatch ${p.id}`)
    }))
  }
  logger.info(JSON.stringify({supplier:"Eurofit Canada",apply,eligible:inventory.products.length,pending:pending.length,existing,held:inventory.held_count,asset_preflight:"passed"}))
  if (!apply) return
  async function category(name:string,handle:string,parent?:string) {
    let [c]=await products.listProductCategories({handle})
    if(c && (c.parent_category_id||undefined)!==parent)throw Error(`Unexpected category parent ${handle}`)
    if(!c)c=await products.createProductCategories({name,handle,parent_category_id:parent,is_active:true,is_internal:false})
    else if(!c.is_active||c.is_internal)c=await products.updateProductCategories(c.id,{is_active:true,is_internal:false})
    return c.id
  }
  const root=await category("Cabinet Hardware","cabinet-hardware")
  const brand=await category("Eurofit","cabinet-hardware-eurofit",root)
  const categories=new Map<string,string>()
  for(const type of new Set(pending.map(p=>p.type)))categories.set(type,await category(type,"eurofit-"+type.toLowerCase().replace(/ /g,"-"),brand))
  for(const p of pending){
    const d=p.dimensions_mm,size=`${d.length} × ${d.width} × ${d.projection} mm`
    const name=`Eurofit ${p.supplier_sku} ${p.type === "Knobs" ? "Cabinet Knob" : "Cabinet Handle"}`
    const image=p.supplier_image_url.startsWith("https://")?p.supplier_image_url:undefined
    await createProductsWorkflow(container).run({input:{products:[{
      title:`${name} — ${p.finish}`,handle:p.id,status:ProductStatus.PUBLISHED,
      description:`Eurofit Canada ${p.type.toLowerCase()}. ${p.finish}. Overall length ${d.length} mm, width ${d.width} mm, projection ${d.projection} mm.${p.mounting_centres_mm?` Mounting centres: ${p.mounting_centres_mm} mm.`:" Single mounting point."} ${p.model_limitations} Contact Reno Stars for pricing and availability.`,
      category_ids:[categories.get(p.type)!],sales_channels:[{id:channel.id}],thumbnail:image,images:image?[{url:image}]:[],
      options:[{title:"Size",values:[size]}],variants:[{title:size,sku:p.supplier_sku,options:{Size:size},manage_inventory:false,prices:[]}],
      metadata:{brand:"Eurofit Canada",supplier_sku:p.supplier_sku,source_url:p.source_url,source_checked:p.source_checked,finish:p.finish,hardware_type:p.type,model_url:origin+p.model_url,model_family:"hardware",width_mm:d.length,height_mm:d.width,depth_mm:d.projection,mounting_centres_mm:p.mounting_centres_mm||0,pricing_mode:"quote_only",dimension_basis:"supplier_published",model_version:1,model_sha256:p.sha256,model_profile:p.model_profile,model_limitations:p.model_limitations,review_status:"published_dimensions_visual_approximation"}
    }]}})
    logger.info(`Created ${p.id}`)
  }
  logger.info(`Eurofit complete: ${pending.length} created; ${existing} already present; ${inventory.held_count} held.`)
}
