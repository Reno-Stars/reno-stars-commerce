import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

function disposeTree(root){const geometry=new Set(),materials=new Set();root.traverse(o=>{if(o.geometry)geometry.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));});geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}
export class CabinetStage {
 constructor(host,onState){
  this.host=host;this.onState=onState;this.mount=0;this.ticket=0;this.loaded=false;this.settings={scene:'oak',light:'daylight',brightness:100,direction:-35};
  this.renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.VSMShadowMap;host.append(this.renderer.domElement);this.renderer.domElement.setAttribute('aria-label','Interactive selected cabinet; drag to rotate and scroll to zoom');this.renderer.domElement.tabIndex=0;
  this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(38,1,.02,60);this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.enablePan=false;this.controls.minPolarAngle=.18;this.controls.maxPolarAngle=Math.PI/2-.02;
  this.room=new THREE.Group();this.scene.add(this.room);this.scene.add(new THREE.AmbientLight(0xffffff,.12));this.hemi=new THREE.HemisphereLight(0xddeaff,0x67605a,.45);this.scene.add(this.hemi);
  this.key=new THREE.DirectionalLight(0xfff8ed,2);this.key.castShadow=true;this.key.shadow.mapSize.set(2048,2048);Object.assign(this.key.shadow.camera,{left:-2.5,right:2.5,top:3.5,bottom:-2.5,near:.1,far:15});this.key.shadow.bias=-.00003;this.key.shadow.normalBias=.0015;this.key.shadow.radius=4;this.key.shadow.blurSamples=8;this.scene.add(this.key,this.key.target);
  this.fill=new THREE.DirectionalLight(0xdfebff,.45);this.fill.position.set(3,3,4);this.scene.add(this.fill);
  this.rim=new THREE.DirectionalLight(0xffffff,.7);this.rim.position.set(0,4,-2);this.scene.add(this.rim);
  this.pmrem=new THREE.PMREMGenerator(this.renderer);new HDRLoader().load('scenes/daylight-studio.hdr',texture=>{this.environment=this.pmrem.fromEquirectangular(texture);this.scene.environment=this.environment.texture;texture.dispose();this.applyLighting();},undefined,()=>{});
  this.oak=new THREE.TextureLoader().load('textures/oak.jpg',()=>this.render());this.oak.colorSpace=THREE.SRGBColorSpace;this.oak.wrapS=this.oak.wrapT=THREE.RepeatWrapping;this.oak.repeat.set(4,4);this.oak.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);this.resize();this.visible=true;this.intersection=new IntersectionObserver(entries=>{this.visible=entries[0].isIntersecting});this.intersection.observe(host);
  this.needsRender=true;this.controls.addEventListener("change",()=>{this.needsRender=true});this.animate=()=>{this.frame=requestAnimationFrame(this.animate);if(this.visible&&!document.hidden){const changed=this.controls.update();if(changed||this.needsRender)this.render();}};this.animate();
  this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();this.onState('The 3D view paused. Refresh to reload it.');});
 }
 resize(){const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h);this.needsRender=true;}
 render(){this.renderer.render(this.scene,this.camera);this.needsRender=false}
 async load(product){
  const ticket=++this.ticket;this.loaded=false;this.host.dataset.loaded='false';this.onState('Loading cabinet…');
  try{const gltf=await new GLTFLoader().loadAsync(product.model_url);if(ticket!==this.ticket){disposeTree(gltf.scene);return;}
   if(this.cabinet){this.scene.remove(this.cabinet);disposeTree(this.cabinet)}this.product=product;this.cabinet=gltf.scene;
   const bounds=new THREE.Box3().setFromObject(this.cabinet);this.size=bounds.getSize(new THREE.Vector3());this.mount=product.family==='wall'?1.45:0;
   this.cabinet.position.set(-(bounds.min.x+bounds.max.x)/2,-bounds.min.y+this.mount,-(bounds.min.z+bounds.max.z)/2);
   this.cabinet.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=false;}});this.scene.add(this.cabinet);this.buildRoom();this.resetView();this.applyLighting();this.loaded=true;this.host.dataset.loaded='true';this.host.dataset.sku=product.sku;this.onState('Drag to rotate · Scroll or pinch to zoom');
  }catch(error){if(ticket===this.ticket){this.host.dataset.loaded='error';this.onState('Could not load this cabinet. Select it again to retry.');console.error(error);}}
 }
 material(color,roughness=.65,extra={}){return new THREE.MeshStandardMaterial({color,roughness,...extra})}
 box(name,x,y,z,w,h,d,material){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);o.name=name;o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;this.room.add(o);return o}
 buildRoom(){
  disposeTree(this.room);this.room.clear();if(!this.size)return;const kind=this.settings.scene;const back=-this.size.z/2-.035;const roomHeight=Math.max(3.15,this.size.y+this.mount+.35);
  const bg=kind==='studio'?0x727985:kind==='oak'?0xc3b8a8:0x888d90;this.scene.background=new THREE.Color(bg);this.scene.fog=new THREE.Fog(bg,9,22);
  const floorMat=this.material(kind==='studio'?0x646b75:kind==='oak'?0xffffff:0xa8a69f,.62,kind==='oak'?{map:this.oak}:{});
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(30,30),floorMat);floor.name='Presentation floor';floor.rotation.x=-Math.PI/2;floor.position.y=-.001;floor.receiveShadow=true;this.room.add(floor);
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
  const foliage=this.material(0x344a2a,.75);const stem=this.material(0x5b5140,.8);
  for(let i=0;i<9;i++){const angle=i*2.4;const y=.40+i*.024;const leaf=new THREE.Mesh(new THREE.SphereGeometry(1,16,10),foliage);leaf.scale.set(.105,.027,.045);leaf.position.set(px+Math.cos(angle)*.16,y,pz+Math.sin(angle)*.13);leaf.rotation.set(.3,angle,.45);leaf.castShadow=true;this.room.add(leaf);const twig=new THREE.Mesh(new THREE.CylinderGeometry(.003,.004,y-.2,8),stem);twig.position.set(px,(y+.20)/2,pz);this.room.add(twig);}
 }
 setSettings(settings){const old=this.settings.scene;this.settings={...this.settings,...settings};if(old!==this.settings.scene){this.buildRoom();if(this.settings.scene!=='studio'&&Math.abs(this.controls.getAzimuthalAngle())>Math.PI*.46)this.resetView();}this.applyLighting();}
 applyLighting(){
  const presets={daylight:{key:2.6,fill:.40,hemi:.40,rim:.45,color:0xfff8ef,env:.70},studio:{key:1.8,fill:.85,hemi:.55,rim:.65,color:0xffffff,env:.85},evening:{key:1.65,fill:.22,hemi:.22,rim:.35,color:0xffddb5,env:.45}};
  const p=presets[this.settings.light]||presets.daylight;const t=this.settings.direction*Math.PI/180;const targetY=this.mount+(this.size?.y||1)*.5;
  this.key.position.set(Math.sin(t)*4,targetY+3.5,Math.cos(t)*4);this.key.target.position.set(0,targetY,0);this.key.color.setHex(p.color);this.key.intensity=p.key;this.fill.intensity=p.fill;this.hemi.intensity=p.hemi;this.rim.intensity=p.rim;this.scene.environmentIntensity=p.env;this.scene.environmentRotation.y=t;this.renderer.toneMappingExposure=this.settings.brightness/100;this.needsRender=true;
 }
 resetView(){if(!this.size)return;const target=new THREE.Vector3(0,this.mount+this.size.y*.48,0);const span=Math.max(this.size.y,this.size.x/Math.max(.7,this.camera.aspect),this.size.z, .65);this.controls.target.copy(target);this.camera.position.copy(target).add(new THREE.Vector3(span*1.15,span*.65,span*1.95));this.controls.minDistance=span*.7;this.controls.maxDistance=span*4.5;this.controls.update();}
 screenshot(){this.render();return this.renderer.domElement.toDataURL('image/png')}
 dispose(){cancelAnimationFrame(this.frame);this.resizeObserver.disconnect();this.intersection.disconnect();this.controls.dispose();disposeTree(this.room);if(this.cabinet)disposeTree(this.cabinet);this.oak.dispose();this.environment?.dispose();this.pmrem.dispose();this.renderer.dispose();}
}
