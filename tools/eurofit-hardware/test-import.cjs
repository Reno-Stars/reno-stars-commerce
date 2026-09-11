const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../..'),ts=require(path.join(repo,'backend/node_modules/typescript'));
const inventory=require(path.join(repo,'backend/src/scripts/data/eurofit-hardware.json'));
const source=fs.readFileSync(path.join(repo,'backend/src/scripts/import-eurofit-hardware.ts'),'utf8');
async function runTest(corrupt=false){
 const stored=[],categories=[],logs=[];let apply=true,fetches=0;
 const svc={listProducts:async q=>stored.filter(p=>p.handle===q.handle),listProductVariants:async()=>[],listProductCategories:async q=>categories.filter(c=>c.handle===q.handle),createProductCategories:async c=>{const row={...c,id:'cat_'+categories.length};categories.push(row);return row}};
 const sandbox={exports:{},Buffer,Set,Map,Number,Error,AbortSignal,process:{env:{EUROFIT_APPLY:'1'}},fetch:async url=>{fetches++;const bytes=fs.readFileSync(path.join(repo,'storefront/public',new URL(url).pathname));if(corrupt)bytes[bytes.length-1]^=1;return {ok:true,arrayBuffer:async()=>bytes};},require:id=>{
  if(id==='@medusajs/core-flows')return {createProductsWorkflow:()=>({run:async({input})=>stored.push(...input.products)})};
  if(id==='@medusajs/framework/utils')return {ContainerRegistrationKeys:{LOGGER:'logger'},Modules:{PRODUCT:'product',SALES_CHANNEL:'channel'},ProductStatus:{PUBLISHED:'published'}};
  if(id==='./data/eurofit-hardware.json')return inventory;
  return require(id);
 }};
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,sandbox);
 const container={resolve:key=>key==='logger'?{info:s=>logs.push(s)}:key==='product'?svc:{listSalesChannels:async()=>[{id:'sales_default'}]}};
 if(corrupt){await assert.rejects(()=>sandbox.exports.default({container}),/Deployed model mismatch/);assert.equal(stored.length,0);assert.equal(categories.length,0);return;}
 await sandbox.exports.default({container});assert.equal(stored.length,407);assert.equal(categories.length,4);assert(stored.every(p=>p.status==='published'&&p.variants[0].prices.length===0&&p.sales_channels[0].id==='sales_default'));
 const first=fetches;await sandbox.exports.default({container});assert.equal(stored.length,407);assert.equal(fetches,first);assert.equal(categories.length,4);
 console.log('PASS: 407 published quote-only products; category hierarchy; exact rerun; corrupted GLB aborts before catalog writes.');
}
(async()=>{await runTest(true);await runTest();})().catch(e=>{console.error(e);process.exitCode=1});
