import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
const source=fs.readFileSync(new URL('../src/cabinet-stage.js',import.meta.url),'utf8');
const method=source.slice(source.indexOf(' resetView(){'),source.indexOf('\n screenshot()',source.indexOf(' resetView(){')));
const reset=new Function('THREE',`return ({${method}}).resetView`)(THREE);
const inventory=JSON.parse(fs.readFileSync(new URL('../../eurofit-hardware/inventory.json',import.meta.url)));
let cases=0;
for(const item of inventory.products.filter(p=>p.model_status==='built'))for(const aspect of [2.5,1,.65]){
 const d=item.dimensions_mm,size=new THREE.Vector3(d.length,d.width,d.projection).multiplyScalar(.001),camera=new THREE.PerspectiveCamera(40,aspect,.001,100);
 const context={size,hardware:true,mount:1,camera,controls:{target:new THREE.Vector3(),update(){camera.lookAt(this.target);camera.updateMatrixWorld(true)}}};reset.call(context);
 for(let angle=0;angle<360;angle+=30)for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){
  const point=new THREE.Vector3(x*size.x/2,y*size.y/2,z*size.z/2).applyAxisAngle(new THREE.Vector3(0,0,1),angle*Math.PI/180).add(context.controls.target).project(camera);
  assert(Math.abs(point.x)<1&&Math.abs(point.y)<1&&point.z>-1&&point.z<1,`${item.id} clips at aspect ${aspect}, angle ${angle}`);
 }
 cases++;
}
console.log(`PASS ${cases} hardware framing cases, 12 orientations each`);
