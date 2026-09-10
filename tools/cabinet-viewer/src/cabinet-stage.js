import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

function disposeTree(root){const geometry=new Set(),materials=new Set();root.traverse(o=>{if(o.geometry)geometry.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));});geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}
export class CabinetStage {
 constructor(host,onState){
  this.host=host;this.onState=onState;this.mount=0;this.ticket=0;this.loaded=false;this.settings={scene:'oak',light:'daylight',brightness:100,direction:-35};
  this.renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.VSMShadowMap;host.append(this.renderer.domElement);this.renderer.domElement.setAttribute('aria-label','Interactive selected cabinet; drag to rotate and scroll to zoom');this.renderer.domElement.tabIndex=0;
  this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(38,1,.02,60);this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.enablePan=false;this.controls.minPolarAngle=.18;this.controls.maxPolarAngle=Math.PI/2-.02;
  // Render in linear HDR; apply contact occlusion before the final display transform.
  const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:4});
  this.composer=new EffectComposer(this.renderer,target);this.composer.addPass(new RenderPass(this.scene,this.camera));
  this.ao=new GTAOPass(this.scene,this.camera,1,1,undefined,{radius:.12,thickness:.06,distanceExponent:1.5,distanceFallOff:1,scale:1,samples:16},{radius:4,depthPhi:4,normalPhi:4});this.ao.blendIntensity=.65;this.composer.addPass(this.ao);this.output=new OutputPass();this.composer.addPass(this.output);this.fxaa=new ShaderPass(FXAAShader);this.composer.addPass(this.fxaa);
  RectAreaLightUniformsLib.init();this.softbox=new THREE.RectAreaLight(0xfff7ef,3,2,2.5);this.scene.add(this.softbox);
  this.room=new THREE.Group();this.scene.add(this.room);this.scene.add(new THREE.AmbientLight(0xffffff,.12));this.hemi=new THREE.HemisphereLight(0xddeaff,0x67605a,.45);this.scene.add(this.hemi);
  this.key=new THREE.DirectionalLight(0xfff8ed,2);this.key.castShadow=true;this.key.shadow.mapSize.set(2048,2048);Object.assign(this.key.shadow.camera,{left:-2.5,right:2.5,top:3.5,bottom:-2.5,near:.1,far:15});this.key.shadow.bias=-.00003;this.key.shadow.normalBias=.0015;this.key.shadow.radius=12;this.key.shadow.blurSamples=16;this.scene.add(this.key,this.key.target);
  this.fill=new THREE.DirectionalLight(0xdfebff,.45);this.fill.position.set(3,3,4);this.scene.add(this.fill);
  this.rim=new THREE.DirectionalLight(0xffffff,.7);this.rim.position.set(0,4,-2);this.scene.add(this.rim);
  this.pmrem=new THREE.PMREMGenerator(this.renderer);new HDRLoader().load('scenes/daylight-studio.hdr',texture=>{this.environment=this.pmrem.fromEquirectangular(texture);this.scene.environment=this.environment.texture;texture.dispose();this.applyLighting();},undefined,()=>{});
  this.oak=new THREE.TextureLoader().load('textures/oak.jpg',()=>this.render());this.oak.colorSpace=THREE.SRGBColorSpace;this.oak.wrapS=this.oak.wrapT=THREE.RepeatWrapping;this.oak.repeat.set(1,1);this.oak.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());
  this.oakRoughness=new THREE.TextureLoader().load('textures/oak-roughness.jpg',()=>this.render());this.oakRoughness.wrapS=this.oakRoughness.wrapT=THREE.RepeatWrapping;this.oakRoughness.repeat.copy(this.oak.repeat);
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);this.resize();this.visible=true;this.intersection=new IntersectionObserver(entries=>{this.visible=entries[0].isIntersecting});this.intersection.observe(host);
  this.needsRender=true;this.controls.addEventListener("change",()=>{this.needsRender=true});this.animate=()=>{this.frame=requestAnimationFrame(this.animate);if(this.visible&&!document.hidden){const changed=this.controls.update();if(changed||this.needsRender)this.render();}};this.animate();
  this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();this.onState('The 3D view paused. Refresh to reload it.');});
 }
 resize(){const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h);this.composer.setSize(w,h);const dpr=this.renderer.getPixelRatio();this.fxaa.uniforms.resolution.value.set(1/(w*dpr),1/(h*dpr));this.needsRender=true;}
 render(){this.composer.render();this.needsRender=false}
 async load(product){
  const ticket=++this.ticket;this.loaded=false;this.host.dataset.loaded='false';this.onState('Loading cabinet…');
  try{const gltf=await new GLTFLoader().loadAsync(product.model_url);if(ticket!==this.ticket){disposeTree(gltf.scene);return;}
   if(this.cabinet){this.scene.remove(this.cabinet);disposeTree(this.cabinet)}this.product=product;this.cabinet=gltf.scene;
   const bounds=new THREE.Box3().setFromObject(this.cabinet);this.size=bounds.getSize(new THREE.Vector3());this.mount=product.family==='wall'?1.45:0;
   this.cabinet.position.set(-(bounds.min.x+bounds.max.x)/2,-bounds.min.y+this.mount,-(bounds.min.z+bounds.max.z)/2);
   const replacements=new Map();this.cabinet.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=false;
    const upgrade=original=>{if(!replacements.has(original))replacements.set(original,this.finishMaterial(original));return replacements.get(original)};
    o.material=Array.isArray(o.material)?o.material.map(upgrade):upgrade(o.material);
   }});for(const material of replacements.keys())material.dispose();this.scene.add(this.cabinet);this.buildRoom();this.resetView();this.applyLighting();this.loaded=true;this.host.dataset.loaded='true';this.host.dataset.sku=product.sku;this.onState('Drag to rotate · Scroll or pinch to zoom');
  }catch(error){if(ticket===this.ticket){this.host.dataset.loaded='error';this.onState('Could not load this cabinet. Select it again to retry.');console.error(error);}}
 }
 finishMaterial(original){
  const m=new THREE.MeshPhysicalMaterial();THREE.MeshStandardMaterial.prototype.copy.call(m,original);
  if(/satin white/i.test(m.name)){m.color.setRGB(.78,.785,.78);m.roughness=.30;m.ior=1.46;m.clearcoat=.16;m.clearcoatRoughness=.38;this.surfaceDetail(m,1800,.055);}
  else if(/plywood/i.test(m.name)){m.roughness=.48;this.surfaceDetail(m,110,.09);}
  else if(/hardware/i.test(m.name)){m.metalness=.9;m.roughness=.26;}
  return m;
 }
 surfaceDetail(material,frequency,variation){
  // Surface variation is in model metres, so it stays the same scale on every SKU.
  material.onBeforeCompile=shader=>{
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vFinishPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nvFinishPosition=position;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
    varying vec3 vFinishPosition;
    float finishNoise(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,39.425)))*43758.5453);}`)
    .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
     float finishVariation=finishNoise(floor(vFinishPosition*${frequency.toFixed(1)}));
     roughnessFactor=clamp(roughnessFactor+(finishVariation-.5)*${variation.toFixed(3)},.08,1.);`);
  };material.customProgramCacheKey=()=>`finish-${frequency}-${variation}`;
 }
 material(color,roughness=.65,extra={}){return new THREE.MeshStandardMaterial({color,roughness,...extra})}
 box(name,x,y,z,w,h,d,material){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);o.name=name;o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;this.room.add(o);return o}
 oakFloor(){
  const positions=[],uvs=[],colors=[],indices=[];
  for(let row=-18;row<=18;row++)for(let col=-4;col<=5;col++){
   const x=row*.18,z=col*1.2+(Math.abs(row)%3)*.4;const i=positions.length/3;
   const half=.0895,len=.5995;positions.push(x-half,.0001,z-len,x-half,.0001,z+len,x+half,.0001,z+len,x+half,.0001,z-len);
   const offset=((row*17+col*13)%19+19)%19/19;uvs.push(offset,0,offset,1,offset+.15,1,offset+.15,0);indices.push(i,i+1,i+2,i,i+2,i+3);
   const shade=.88+(((row*7+col*3)%9+9)%9)*.015;for(let v=0;v<4;v++)colors.push(shade,shade,shade);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const material=this.material(0xffffff,.64,{map:this.oak,roughnessMap:this.oakRoughness,bumpMap:this.oakRoughness,bumpScale:.00035,vertexColors:true});
  const planks=new THREE.Mesh(geometry,material);planks.name='Oak planks — 180 × 1200 mm';planks.receiveShadow=true;this.room.add(planks);
 }
 buildRoom(){
  disposeTree(this.room);this.room.clear();if(!this.size)return;const kind=this.settings.scene;const back=-this.size.z/2-.035;const roomHeight=Math.max(3.15,this.size.y+this.mount+.35);
  const bg=kind==='studio'?0x727985:kind==='oak'?0xc3b8a8:0x888d90;this.scene.background=new THREE.Color(bg);this.scene.fog=new THREE.Fog(bg,9,22);
  const floorMat=this.material(kind==='studio'?0x646b75:kind==='oak'?0x665241:0xa8a69f,.62,{});
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(30,30),floorMat);floor.name='Presentation floor';floor.rotation.x=-Math.PI/2;floor.position.y=-.005;floor.receiveShadow=true;this.room.add(floor);if(kind==='oak')this.oakFloor();else if(kind==='stone')this.surfaceDetail(floorMat,140,.18);
  if(kind==='studio'){this.controls.minAzimuthAngle=-Infinity;this.controls.maxAzimuthAngle=Infinity;return;}
  this.controls.minAzimuthAngle=-Math.PI*.46;this.controls.maxAzimuthAngle=Math.PI*.46;
  const wall=this.material(kind==='oak'?0x9c9080:0x41494f,.86);this.box('Room backdrop wall',0,roomHeight/2,back-.05,12,roomHeight,.10,wall);
  const trim=this.material(kind==='oak'?0xc9c1b4:0x777c80,.55);this.box('Skirting',0,.065,back+.017,12,.13,.025,trim);
  if(kind==='stone'){
   const grout=this.material(0x777872,.9);
   for(let i=-8;i<=8;i++){this.box('Stone tile joint X',i*.6,.0002,2,.0015,.0004,8,grout);this.box('Stone tile joint Z',0,.0002,i*.6,10,.0004,.0015,grout);}
   this.box('Framed art',1.55,1.9,back+.03,.65,.85,.03,this.material(0x1c2226));this.box('Art canvas',1.55,1.9,back+.05,.59,.79,.01,this.material(0xd4cabb));this.box('Art accent',1.55,1.83,back+.058,.32,.12,.006,this.material(0x8b6b4d));
  }else{
   const win=this.material(0xe8e2d7,.35);const sky=new THREE.MeshBasicMaterial({color:0xb4c8d2});this.box('Window daylight',-1.65,1.9,back+.013,.95,1.3,.018,sky);
   for(const x of [-2.15,-1.65,-1.15])this.box('Window vertical frame',x,1.9,back+.055,.033,1.40,.065,win);
   for(const y of [1.20,1.90,2.60])this.box('Window crossbar',-1.65,y,back+.055,1.04,.035,.065,win);
   this.box('Oak window sill',-1.65,1.19,back+.10,1.11,.035,.22,this.material(0xb8966d,.45));
  }
  const px=Math.max(1.10,this.size.x/2+.50),pz=back+.36;const ceramic=this.material(kind==='oak'?0xb09b82:0x918a7d,.5);const pot=new THREE.Mesh(new THREE.CylinderGeometry(.14,.105,.26,40),ceramic);pot.position.set(px,.13,pz);pot.castShadow=pot.receiveShadow=true;this.room.add(pot);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.135,.009,8,48),ceramic);rim.rotation.x=Math.PI/2;rim.position.set(px,.26,pz);this.room.add(rim);const soil=new THREE.Mesh(new THREE.CircleGeometry(.124,40),this.material(0x292018,.95));soil.rotation.x=-Math.PI/2;soil.position.set(px,.253,pz);this.room.add(soil);
  const foliage=this.material(0x344a2a,.44,{side:THREE.DoubleSide});const stem=this.material(0x5b5140,.8);
  for(let i=0;i<9;i++){const angle=i*2.4;const y=.40+i*.024;const leafGeometry=new THREE.PlaneGeometry(.20,.085,16,8);const points=leafGeometry.attributes.position;for(let v=0;v<points.count;v++){const x=points.getX(v),y=points.getY(v);const taper=Math.sqrt(Math.max(0,1-(x/.1)**2));points.setXYZ(v,x,y*taper,.018*(x/.1)**2-.009*Math.abs(y/.0425));}leafGeometry.computeVertexNormals();const leaf=new THREE.Mesh(leafGeometry,foliage);leaf.rotation.x=-Math.PI/2;leaf.position.set(px+Math.cos(angle)*.16,y,pz+Math.sin(angle)*.13);leaf.rotation.set(.3,angle,.45);leaf.castShadow=true;this.room.add(leaf);const twig=new THREE.Mesh(new THREE.CylinderGeometry(.003,.004,y-.2,8),stem);twig.position.set(px,(y+.20)/2,pz);this.room.add(twig);}
 }
 setSettings(settings){const old=this.settings.scene;this.settings={...this.settings,...settings};if(old!==this.settings.scene){this.buildRoom();if(this.settings.scene!=='studio'&&Math.abs(this.controls.getAzimuthalAngle())>Math.PI*.46)this.resetView();}this.applyLighting();}
 applyLighting(){
  const presets={daylight:{key:2.2,fill:.12,hemi:.22,rim:.3,color:0xfff8ef,env:.38},studio:{key:1.9,fill:.30,hemi:.25,rim:.5,color:0xffffff,env:.48},evening:{key:1.65,fill:.22,hemi:.22,rim:.35,color:0xffddb5,env:.45}};
  const p=presets[this.settings.light]||presets.daylight;const t=this.settings.direction*Math.PI/180;const targetY=this.mount+(this.size?.y||1)*.5;
  this.key.position.set(Math.sin(t)*4,targetY+3.5,Math.cos(t)*4);this.key.target.position.set(0,targetY,0);this.key.color.setHex(p.color);this.key.intensity=p.key*.78;this.softbox.position.set(Math.sin(t)*3,targetY+1.5,Math.cos(t)*3);this.softbox.lookAt(0,targetY,0);this.softbox.color.setHex(p.color);this.softbox.intensity=this.settings.light==='studio'?3:1.5;this.fill.intensity=p.fill;this.hemi.intensity=p.hemi;this.rim.intensity=p.rim;this.scene.environmentIntensity=p.env;this.scene.environmentRotation.y=t;this.renderer.toneMappingExposure=this.settings.brightness/100;this.needsRender=true;
 }
 resetView(){if(!this.size)return;const target=new THREE.Vector3(0,this.mount+this.size.y*.48,0);const span=Math.max(this.size.y,this.size.x/Math.max(.7,this.camera.aspect),this.size.z, .65);this.controls.target.copy(target);this.camera.position.copy(target).add(new THREE.Vector3(span*1.15,span*.65,span*1.95));this.controls.minDistance=span*.7;this.controls.maxDistance=span*4.5;this.controls.update();}
 screenshot(){this.render();return this.renderer.domElement.toDataURL('image/png')}
 dispose(){cancelAnimationFrame(this.frame);this.resizeObserver.disconnect();this.intersection.disconnect();this.controls.dispose();disposeTree(this.room);if(this.cabinet)disposeTree(this.cabinet);this.oak.dispose();this.oakRoughness.dispose();this.ao.dispose();this.output.dispose();this.fxaa.dispose();this.composer.dispose();this.environment?.dispose();this.pmrem.dispose();this.renderer.dispose();}
}
