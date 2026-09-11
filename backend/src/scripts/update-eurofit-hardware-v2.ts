import { ExecArgs, IProductModuleService } from '@medusajs/framework/types'
import { ContainerRegistrationKeys, Modules, ProductStatus } from '@medusajs/framework/utils'
import { createHash } from 'node:crypto'
import inventory from './data/eurofit-hardware.json'
import previous from './data/eurofit-hardware-v1-hashes.json'

/** Explicit, idempotent revision of this supplier only. Preflight completes before writes. */
export default async function updateEurofit({container}: ExecArgs) {
 const logger=container.resolve(ContainerRegistrationKeys.LOGGER)
 const service:IProductModuleService=container.resolve(Modules.PRODUCT)
 const apply=process.env.EUROFIT_APPLY==='1'
 const [category]=await service.listProductCategories({handle:'cabinet-hardware'},{select:['id','name','handle']})
 if(!category || !['Cabinet Hardware','Hardware'].includes(category.name))throw Error('Unexpected hardware category')
 const updates: Array<{id:string;title:string;metadata:Record<string,unknown>}> = []
 for(const p of inventory.products){
  const [prior]=await service.listProducts({handle:p.id})
  const oldHash=(previous as Record<string,string>)[p.id]
  if(!prior||prior.status!==ProductStatus.PUBLISHED||prior.metadata?.brand!=='Eurofit Canada'||prior.metadata?.supplier_sku!==p.supplier_sku||![oldHash,p.sha256].includes(String(prior.metadata?.model_sha256)))throw Error(`Unexpected existing product ${p.id}`)
  const title=`Eurofit ${p.supplier_sku} ${p.type==='Knobs'?'Knob':'Handle'} — ${p.finish}`
  const revised=p.type==='Knobs'
  const metadata={...prior.metadata,...(revised?{model_url:'https://supply.reno-stars.com'+p.model_url,model_sha256:p.sha256,model_version:2,model_profile:p.model_profile,model_limitations:p.model_limitations}: {})}
  if(prior.title!==title || (revised && (prior.metadata?.model_sha256!==p.sha256||prior.metadata?.model_url!==metadata.model_url)))updates.push({id:prior.id,title,metadata})
 }
 const knobs=inventory.products.filter(p=>p.type==='Knobs')
 for(let i=0;i<knobs.length;i+=6)await Promise.all(knobs.slice(i,i+6).map(async p=>{
  const response=await fetch('https://supply.reno-stars.com'+p.model_url,{signal:AbortSignal.timeout(30000)})
  if(!response.ok)throw Error(`Missing asset ${p.id}`)
  const bytes=Buffer.from(await response.arrayBuffer())
  if(bytes.length!==p.bytes||bytes.toString('ascii',0,4)!=='glTF'||createHash('sha256').update(bytes).digest('hex')!==p.sha256)throw Error(`Wrong asset ${p.id}`)
 }))
 logger.info(JSON.stringify({apply,products:inventory.products.length,knobs:knobs.length,pending:updates.length,category:category.name,preflight:'passed'}))
 if(!apply)return
 if(category.name!=='Hardware')await service.updateProductCategories(category.id,{name:'Hardware'})
 for(const update of updates)await service.updateProducts(update.id,{title:update.title,metadata:update.metadata})
 logger.info(`Eurofit revision complete: ${updates.length} updated; category Hardware.`)
}
