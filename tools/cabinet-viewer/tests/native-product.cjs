const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-angle=metal']});
 try {
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[],requests=[];
 page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message)});page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text())});page.on('request',r=>requests.push(r.url()));
 await page.goto(process.env.NATIVE_VIEWER_TEST_URL||'http://localhost:8769/api/cabinet-viewer-test',{timeout:120000,waitUntil:'domcontentloaded'});
 const viewer=page.getByTestId('product-model-viewer');await viewer.scrollIntoViewIfNeeded();try{await viewer.locator('[data-loaded=true]').waitFor({timeout:60000})}catch(error){console.log('Status:',await viewer.getByRole('status').textContent());await page.screenshot({path:'tools/cabinet-viewer/out/native-failure.png'});throw error}
 if((await viewer.locator('canvas').boundingBox()).height<400)throw Error('Viewer layout styles missing');
 if(await viewer.locator('iframe').count())throw Error('Native viewer must not embed HTML');
 if(requests.some(url=>url.includes('cabinet-library/index.html')))throw Error('Standalone HTML requested');
 await viewer.getByLabel('Background scene').selectOption('stone');await viewer.getByLabel('Lighting').selectOption('evening');
 await viewer.getByLabel('Brightness').fill('115');await viewer.getByLabel('Light direction').fill('45');
 await viewer.screenshot({path:'tools/cabinet-viewer/out/native-product.png'});
 const download=page.waitForEvent('download');await viewer.getByRole('button',{name:'Save image',exact:true}).click();await download;
 await page.getByRole('button',{name:'Generic fixture'}).click();await viewer.locator('[data-loaded=true]').waitFor();
 if(await viewer.getByLabel('Lighting').inputValue()!=='evening')throw Error('Settings lost across products');
 if(await viewer.locator('canvas').count()!==1)throw Error('Leaked renderer after changing products');
 for(const p of require('./fixtures/inventory-samples.json')){await page.getByRole('button',{name:p.id,exact:true}).click();await viewer.locator('[data-loaded=true]').waitFor();await viewer.getByLabel('Lighting').selectOption('studio');await page.waitForTimeout(350);await viewer.screenshot({path:'tools/cabinet-viewer/out/'+p.id+'.png'});}
 for(const name of ['eurofit-h-022-128bss','eurofit-k-179ai']){const button=page.getByRole('button',{name,exact:true});if(await button.count()!==1)throw Error('Hardware fixture missing');{await button.click();await viewer.locator('[data-loaded=true]').waitFor();await viewer.getByLabel('Background scene').selectOption('stone');await viewer.screenshot({path:'tools/cabinet-viewer/out/'+name+'.png'});}}
 await page.getByRole('button',{name:'No model fixture'}).click();if(await viewer.count())throw Error('Viewer shown for product without model');
 await page.getByRole('button',{name:'Cabinet fixture'}).click();await viewer.locator('[data-loaded=true]').waitFor();
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile overflow');
 await viewer.screenshot({path:'tools/cabinet-viewer/out/native-product-mobile.png'});
 console.log(JSON.stringify({errors,native:true,metadataModels:true,missingModelHidden:true,preferences:true,mobile:true,download:true}));if(errors.length)throw Error(errors.join('\n'));
 } finally { await browser.close() }
})().catch(error=>{console.error(error);process.exitCode=1});
