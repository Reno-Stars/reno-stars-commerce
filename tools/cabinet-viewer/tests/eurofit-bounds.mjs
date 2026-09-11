import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
globalThis.ProgressEvent=class ProgressEvent { constructor(type, data){Object.assign(this,{type},data)} };
const root=new URL('../../',import.meta.url);const inventory=JSON.parse(fs.readFileSync(new URL('eurofit-hardware/inventory.json',root)));const results=[];
for(const p of inventory.products.filter(p=>p.model_status==='built')){
 const file=new URL('../storefront/public'+p.model_url,root);const b=fs.readFileSync(file);const g=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 g.scene.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(g.scene),s=bounds.getSize(new THREE.Vector3());const measured=s.toArray().map(v=>v*1000),expected=Object.values(p.dimensions_mm),anchors=[];
 g.scene.traverse(o=>{if(o.userData.purpose==='mounting_anchor')anchors.push(o.getWorldPosition(new THREE.Vector3()).toArray().map(v=>v*1000))});
 const err=Math.max(...measured.map((v,i)=>Math.abs(v-expected[i])));const c=p.mounting_centres_mm;
 const spacing=c?Math.abs(anchors[1][0]-anchors[0][0]):0;
 if(err>.12 || Math.abs(bounds.min.z*1000)>.12 || (c&&Math.abs(spacing-c)>.01))throw Error(JSON.stringify({id:p.id,measured,expected,anchors,err,min:bounds.min.toArray()}));
 results.push({id:p.id,measured_mm:measured,max_error_mm:err,mounting_centres_mm:spacing,bytes:b.length});
}
fs.writeFileSync(new URL('eurofit-hardware/glb-validation.json',root),JSON.stringify(results,null,2)+'\n');console.log(`Validated ${results.length} GLB mesh envelopes and mounting anchors.`);
