"""Run with Blender --background --python. Envelope dimensions come only from inventory.json."""
import bpy,json,re,hashlib,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent;REPO=ROOT.parent.parent
OUT=REPO/'storefront/public/cabinet-inventory/models';OUT.mkdir(parents=True,exist_ok=True)
SOURCE=Path.home()/'Documents/Cabinet-Inventory/representative-blend';SOURCE.mkdir(parents=True,exist_ok=True)
catalog=json.loads((ROOT/'inventory.json').read_text());report=[];saved=set()
wood_path=REPO/'storefront/public/cabinet-library/textures/oak.jpg'
def mat(name,color,rough=.35,metal=0,wood=False,coat=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;p.inputs['Coat Weight'].default_value=coat;p.inputs['Coat Roughness'].default_value=.28
 if wood:
  tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(wood_path),check_existing=True);tex.image.pack();m.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color'])
  # Baked glTF-compatible colour multiplication is not used: walnut/oak colour is an explicit separate factor after export.
 return m
def box(name,pos,size,material,bevel=.0006):
 bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=bpy.context.object;o.name=name;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material)
 if bevel:b=o.modifiers.new('Manufactured edge','BEVEL');b.width=min(bevel,min(size)/5);b.segments=2;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 return o
def front(name,x,z,w,h):
 if style=='slab':return box(name,(x,-D+.01,z),(w,.02,h),finish)
 rim=min(.022 if style=='slim_shaker' else .058,w*.20,h*.28);face=-D;recess=.005
 def ring(a,b,y):return [(x-a,y,z-b),(x+a,y,z-b),(x+a,y,z+b),(x-a,y,z+b)]
 v=ring(w/2,h/2,face)+ring(w/2-rim,h/2-rim,face)+ring(w/2-rim-.002,h/2-rim-.002,face+recess)+ring(w/2,h/2,face+.02);f=[]
 for i in range(4):j=(i+1)%4;f.extend([(i,j,4+j,4+i),(4+i,4+j,8+j,8+i),(i,12+i,12+j,j)])
 f.extend([(8,9,10,11),(15,14,13,12)]);me=bpy.data.meshes.new(name);me.from_pydata(v,[],f);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);me.materials.append(finish);b=o.modifiers.new('Painted edge bevel','BEVEL');b.width=.00045;b.segments=2;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');return o
def doors(z,h,count):
 gap=.003
 for i in range(count):w=(W-gap*(count+1))/count;front('Door',gap+w/2+i*(w+gap),z+h/2,w,h)
def drawer(z,h,dummy=False):
 front('False drawer front' if dummy else 'Drawer front',W/2,z+h/2,W-.006,h)
 if not dummy:
  box('Drawer floor',(W/2,-D/2,z+.025),(W-.065,D-.10,.012),inside)
  for x in [.031,W-.031]:box('Drawer side',(x,-D/2,z+max(.06,h-.05)/2+.016),(.012,D-.10,max(.06,h-.05)),steel)
for row in catalog['products']:
 if row['status']!='ready_for_model':continue
 spec=row['model_spec'];key=row['id'];path=OUT/(key+'.glb');signature=hashlib.sha256(json.dumps(spec,sort_keys=True).encode()).hexdigest()
 bpy.ops.wm.read_factory_settings(use_empty=True)
 d=spec['dimensions_mm'];W=d['w']/1000;H=d['h']/1000;D=d['d']/1000;leg=spec['legs_mm']/1000;toe=spec['toe_mm']/1000;style=spec['front_style'];kind=spec['kind'];family=spec['family'];f=spec['finish'].lower()
 color=(.82,.83,.835);rough=.32;coat=.12
 if 'blue' in f:color=(.018,.037,.078)
 elif 'gray' in f or 'grey' in f:color=(.24,.255,.27)
 wood=any(s in f for s in ['wood','oak','walnut'])
 if wood:color=(.32,.22,.14) if 'walnut' in f else (.30,.26,.22) if 'smoked' in f else (.69,.53,.36);rough=.48;coat=.05
 if 'gloss' in f:rough=.14;coat=.45
 finish=mat('Supplier finish | '+spec['finish'],color,rough,wood=wood,coat=coat)
 inside=mat('Cabinet interior — visual interpretation',(.70,.62,.47) if spec['construction']=='Plywood' else (.78,.79,.77),.48)
 steel=mat('Drawer hardware',(.43,.45,.47),.27,.8);black=mat('Adjustable polymer feet',(.024,.026,.027),.42)
 if kind=='panel':box('Dimensioned finishing panel',(W/2,-D/2,H/2),(W,D,H),finish)
 else:
  t=.018;zbase=leg+toe;usable=H-toe-.006
  for x in [t/2,W-t/2]:
   box('Cabinet side',(x,-(D-.020)/2,leg+toe+(H-toe)/2),(t,D-.020,H-toe),finish)
   if toe:box('Recessed side plinth',(x,-(D-.095)/2,leg+toe/2),(t,D-.095,toe),finish)
  box('Cabinet back',(W/2,-.006,leg+H/2),(W-2*t,.012,H),inside)
  box('Cabinet bottom',(W/2,-(D-.020)/2,zbase+t/2),(W-2*t,D-.020,t),inside)
  if toe:box('Recessed toe board',(W/2,-D+.092,leg+toe/2),(W-2*t,.018,toe),finish)
  if family=='base':
   for y in [-.04,-D+.055]:box('Top support rail',(W/2,y,leg+H-t/2),(W-2*t,.07,t),inside)
  else:box('Cabinet top',(W/2,-(D-.020)/2,leg+H-t/2),(W-2*t,D-.020,t),inside)
  if leg:
   for x in [.055,W-.055]:
    for y in [-.065,-D+.075]:
     bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=.020,depth=leg,location=(x,y,leg/2));bpy.context.object.name='Adjustable foot';bpy.context.object.data.materials.append(black)
  z0=zbase+.003;gap=.003
  if kind.startswith('drawers'):
   n=int(kind[-1]);heights=([.1524]+[(usable-.1524-gap*2)/2]*2) if n==3 else [(usable-gap)/2]*2;z=z0
   for h in reversed(heights):drawer(z,h);z+=h+gap
  elif kind in ['base','sink']:
   h=.1524;drawer(leg+H-.003-h,h,kind=='sink');doors(z0,usable-h-gap,2 if W>=.6 or kind=='sink' else 1)
  elif kind=='pantry':
   low=min(1.45,usable*.65);doors(z0,low,2 if W>=.6 else 1);doors(z0+low+gap,usable-low-gap,2 if W>=.6 else 1)
  elif kind=='bifold':doors(z0,usable/2-gap/2,1);doors(z0+usable/2+gap/2,usable/2-gap/2,1)
  else:doors(z0,usable,1 if kind=='lift' or W<.6 else 2)
  if kind not in ['sink','drawers2','drawers3']:
   count=max(1,round((H-toe)/.45)-1)
   for i in range(count):box('Adjustable shelf',(W/2,-(D-.04)/2,zbase+(H-toe)*(i+1)/(count+1)),(W-2*t-.003,D-.06,.018),inside)
 # Deterministic metre-scaled wood UV projection, including custom shaker mesh faces.
 if wood:
  for o in bpy.context.scene.objects:
   if o.type!='MESH' or finish not in list(o.data.materials):continue
   uv=o.data.uv_layers.active or o.data.uv_layers.new(name='Wood grain')
   for poly in o.data.polygons:
    axis=max(range(3),key=lambda a:abs(poly.normal[a]));axes=(1,2) if axis==0 else (0,2) if axis==1 else (0,1)
    for li in poly.loop_indices:
     v=o.matrix_world@o.data.vertices[o.data.loops[li].vertex_index].co;uv.data[li].uv=(v[axes[0]]/1.2,v[axes[1]]/1.2)
 bpy.ops.object.empty_add();root=bpy.context.object;root.name=key;root['supplier']=row['brand'];root['supplier_sku']=row['supplier_sku'] or '';root['source_url']=row['source_url'];root['dimensions_mm']=json.dumps(d);root['spec_hash']=signature;root['geometry_note']='Published outer envelope. Internal joinery, front profile and finish are visual interpretations.'
 for o in list(bpy.context.scene.objects):
  if o!=root:o.parent=root
 bpy.context.scene.unit_settings.system='METRIC';bpy.context.scene.unit_settings.scale_length=1
 sample=(row['brand'],spec['finish'],family)
 if sample not in saved:bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/(key+'.blend')),compress=True);saved.add(sample)
 bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',export_apply=True,export_extras=True)
 # Verify actual evaluated mesh envelope, not just the requested input parameters.
 coords=[];dg=bpy.context.evaluated_depsgraph_get()
 for o in bpy.context.scene.objects:
  if o.type=='MESH':coords.extend(o.matrix_world@Vector(v) for v in o.evaluated_get(dg).bound_box)
 lo=[min(v[i] for v in coords) for i in range(3)];hi=[max(v[i] for v in coords) for i in range(3)];actual=[hi[i]-lo[i] for i in range(3)];expected=[W,D,H+leg];error=max(abs(a-b) for a,b in zip(actual,expected));assert error<.0001,(key,actual,expected)
 report.append({'id':key,'model_url':'/cabinet-inventory/models/'+path.name,'spec_hash':signature,'actual_envelope_m':actual,'expected_envelope_m':expected,'max_error_m':error,'glb_bytes':path.stat().st_size})
 if len(report)%25==0:(ROOT/'model-results.json').write_text(json.dumps(report,indent=2));print('INVENTORY_MODEL',len(report),key,flush=True)
(ROOT/'model-results.json').write_text(json.dumps(report,indent=2));print('INVENTORY_MODELS_COMPLETE',len(report),flush=True)
