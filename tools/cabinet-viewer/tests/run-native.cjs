// Exercise the production React component in Next.js; fixture is never shipped.
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const repo=path.resolve(__dirname,'../../..'),storefront=path.join(repo,'storefront');
const route=path.join(storefront,'src/app/api/cabinet-viewer-test'),page=path.join(route,'page.tsx');
if(fs.existsSync(page))throw Error('Temporary test route already exists; refusing to overwrite it');
fs.mkdirSync(route,{recursive:true});fs.copyFileSync(path.join(__dirname,'fixtures/native-product-page.tsx'),page);
const out=path.resolve(__dirname,'../out');fs.mkdirSync(out,{recursive:true});
const log=fs.openSync(path.join(out,'native-next.log'),'w');
const port='8770';const server=spawn(process.execPath,[path.join(storefront,'node_modules/next/dist/bin/next'),'dev','-p',port],{cwd:storefront,stdio:['ignore',log,log],env:{...process.env,NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY:'pk_local_test',NEXT_PUBLIC_MEDUSA_BACKEND_URL:'https://supply-admin.reno-stars.com'}});
async function main(){
 try{
  let ready=false;for(let i=0;i<120;i++){try{const r=await fetch(`http://localhost:${port}/cabinet-library/catalog.json`);if(r.ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,1000));}
  if(!ready)throw Error('Next test server did not become ready');
  const test=spawn(process.execPath,[path.join(__dirname,'native-product.cjs')],{cwd:repo,stdio:'inherit',env:{...process.env,NATIVE_VIEWER_TEST_URL:`http://localhost:${port}/api/cabinet-viewer-test`}});
  const code=await new Promise(resolve=>test.on('exit',resolve));if(code!==0)process.exitCode=1;
 }finally{server.kill('SIGTERM');fs.unlinkSync(page);fs.rmdirSync(route);fs.closeSync(log)}
}
main().catch(error=>{console.error(error);process.exitCode=1});
