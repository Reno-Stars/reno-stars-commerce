const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p))),catalog=read('tools/cabinet-inventory/inventory.json'),data=read('backend/src/scripts/data/cabinet-inventory.json');
test('complete source coverage and conservative eligibility',()=>{
 assert.equal(catalog.products.length,3171);assert.equal(new Set(catalog.products.map(p=>p.id)).size,3171);assert.equal(data.products.length,1734);
 assert.equal(catalog.products.filter(p=>p.brand==='OPPEIN').length,2030);assert.equal(catalog.products.filter(p=>p.brand==='Blue Valley').length,1036);
 for(const p of catalog.products){assert.equal(p.inventory_quantity,null);assert.equal(p.pricing_mode,'quote_only');if(p.status!=='model_ready'){assert.equal(p.model_url,null);assert(p.review_reasons.length)}}
 assert(catalog.products.filter(p=>p.brand==='Macan').every(p=>p.record_type==='collection_reference'&&p.status==='specification_review'));
 assert(catalog.products.filter(p=>[1372,1348,1236,2105,2035,2588,2994].includes(p.source_parent_id)).every(p=>p.status==='specification_review'));
});
test('every exported model is valid, with checked dimensions and portable materials',()=>{
 for(const p of data.products){assert(Object.values(p.dimensions_mm).every(n=>n>0));const bytes=fs.readFileSync(path.join(root,'storefront/public',p.model_url));assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(8),bytes.length);const g=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));assert(g.meshes.length);assert((g.images||[]).every(i=>i.bufferView!==undefined||i.uri?.startsWith('data:')));
 if(p.model_url.startsWith('/cabinet-inventory/')){const row=catalog.products.find(r=>r.id===p.id);assert(row.geometry_validation.max_error_m<.0001);const m=g.materials.find(m=>m.name.startsWith('Supplier finish'));assert(m);if(p.finish.includes('Walnut'))assert(m.pbrMetallicRoughness.baseColorFactor[0]<.5)}
 }
});
function importer(service,workflow,fixture=data){const module={exports:{}};const ts=require('../../storefront/node_modules/typescript');const code=ts.transpileModule(fs.readFileSync(path.join(root,'backend/src/scripts/import-cabinet-inventory.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;const mocks={'./data/cabinet-inventory.json':fixture,'@medusajs/core-flows':{createProductsWorkflow:workflow},'@medusajs/framework/utils':{ContainerRegistrationKeys:{LOGGER:'logger'},Modules:{PRODUCT:'product',SALES_CHANNEL:'sales'},ProductStatus:{PUBLISHED:'published',DRAFT:'draft'}}};vm.runInNewContext(code,{module,exports:module.exports,require:id=>mocks[id],process,fetch:async()=>({ok:true,headers:{get:()=> 'model/gltf-binary'}}),AbortSignal});return ()=>module.exports.default({container:{resolve:k=>({logger:{info(){}},product:service,sales:{listSalesChannels:async()=>[{id:'sc'}]}}[k])}})}
test('dry run never writes; existing handles are skipped; apply preserves dimensions and quote-only pricing',async()=>{
 const old=process.env.CABINET_APPLY;let writes=0;const service={listProducts:async()=>[],listProductVariants:async()=>[],listProductCategories:async()=>[],createProductCategories:async()=>{writes++;return {id:'cat'}}};
 try{delete process.env.CABINET_APPLY;await importer(service,()=>{writes++})();assert.equal(writes,0);
 process.env.CABINET_APPLY='1';const fixture={products:data.products.slice(-1)};let payload;await importer(service,()=>({run:async x=>{writes++;payload=x.input.products[0]}}),fixture)();assert.equal(writes,2);assert.equal(payload.status,'draft');assert.equal(payload.metadata.publication_approved,false);assert.equal(payload.metadata.width_mm,fixture.products[0].dimensions_mm.w);assert.equal(payload.metadata.pricing_mode,'quote_only');assert.equal(payload.variants[0].prices.length,0);assert.equal(payload.variants[0].manage_inventory,false);
 service.listProducts=async()=>[{id:'existing'}];await importer(service,()=>{throw Error('duplicate write')},fixture)();assert.equal(writes,2);
 }finally{if(old===undefined)delete process.env.CABINET_APPLY;else process.env.CABINET_APPLY=old}
});

test('review dispositions cover every record and cannot imply publication approval',()=>{
 const audit=read('tools/cabinet-inventory/review/audit.json'),decisions=read('tools/cabinet-inventory/review/visual-decisions.json');assert.equal(audit.products.length,catalog.products.length);assert.equal(decisions.length,210);assert(audit.products.every(p=>p.publication_approved===false));assert.equal(audit.products.filter(p=>p.findings.some(f=>f.code==='SOURCE_SIZE_CONFLICT')).length,24);assert.equal(audit.products.filter(p=>p.individual_visual_inspection).length,210);
 for(const p of data.products){assert(p.review_status);assert.equal(p.publication_approved,false)}
});
test('import refuses records without review metadata before writing',async()=>{
 const old=process.env.CABINET_APPLY;delete process.env.CABINET_APPLY;
 try{const fixture={products:[{...data.products[0],review_status:null}]};await assert.rejects(importer({listProducts:async()=>[],listProductVariants:async()=>[]},()=>{throw Error('unexpected write')},fixture),/Review disposition missing/)}finally{if(old!==undefined)process.env.CABINET_APPLY=old}
});

test('resolved model defects have serialized evidence and preserve source conflicts',()=>{
 const audit=read('tools/cabinet-inventory/review/audit.json');
 assert.equal(audit.summary.models_with_fixes,980);
 for(const p of audit.products.filter(p=>p.model_url)){
  assert.equal(p.checks.generator_revision,3);assert(p.checks.serialized_envelope_error_m<.0001);
  const codes=p.resolved_findings.map(f=>f.code),n=p.checks.mesh_nodes;
  if(codes.includes('CARCASS_FINISH_MISMATCH'))assert.deepEqual(p.checks.material_assignments['Cabinet side'],['White cabinet carcass']);
  if(codes.includes('SINK_SHELF_INTERFERENCE'))assert.equal(n['Adjustable shelf']||0,0);
  if(codes.includes('SPECIALTY_INTERIOR_MISMATCH')){assert.equal(n['Adjustable shelf']||0,0);assert(n['Spice basket floor']===3||n['Trash bin bottom']===2)}
  if(codes.includes('PANTRY_SPLIT_UNVERIFIED')){assert.equal(n['Fixed pantry divider'],1);assert(p.findings.some(f=>f.code==='PANTRY_LAYOUT_APPROXIMATION'))}
  assert(!codes.some(c=>c.startsWith('SOURCE_')||c==='VARIANT_DEPTH_AMBIGUITY'));
 }
});

test('production import skips source-conflicted models without writes',async()=>{
 const old=process.env.CABINET_APPLY;process.env.CABINET_APPLY='1';
 try{const held=data.products.filter(p=>p.review_status==='correction_required');assert.equal(held.length,125);await importer({listSalesChannels:async()=>[],listProducts:async()=>{throw Error('held record queried')},listProductVariants:async()=>{throw Error('held record queried')}},()=>{throw Error('held record written')},{products:held})()}finally{if(old===undefined)delete process.env.CABINET_APPLY;else process.env.CABINET_APPLY=old}
});
