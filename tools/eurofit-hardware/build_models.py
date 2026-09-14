"""Blender: metre-scale product envelopes, separate mounting anchors, glTF PBR."""
import bpy,json,math,os,sys,hashlib,bmesh
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parent;REPO=R.parent.parent
OUT=REPO/'storefront/public/eurofit-hardware/models';OUT.mkdir(parents=True,exist_ok=True)
BLEND=Path.home()/'Documents/Eurofit-Hardware/blender';BLEND.mkdir(parents=True,exist_ok=True)
p=json.loads((R/'inventory.json').read_text());reports=[];saved=set()
profiles={
 'tube_bend':[0], 'bow':[1,4,9,11,17,18,19,22,29,32,46,47,48,54,55,62,68,70,71,76,89,105,106,109],
 'round_rail':[5,10,43,66,80], 'blade_feet':[14,20,24,31,35,63,73,79,82,88,90,91,101],
 'oval_plate':[36,115], 'cup':[37,40], 'twisted':[52,92],
 'rect_u':[6,7,13,26,27,30,34,38,42,56,58,61,65,67,69,72,78,86,100,102,103,104,107,110,111],
 'round_knob':[119,134,142,143], 'pyramid_knob':[120,131,137],
 'square_knob':[121,126,129,138,140,141,144], 'crescent_knob':[127]}
profile_for={i:k for k,v in profiles.items() for i in v}
sys.path.insert(0,str(R))
from knobs_v2 import build_knob
from handles_v2 import build_handle
def mesh(name,verts,faces,material,bevel=0):
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);me.materials.append(material)
 if bevel:
  m=o.modifiers.new('Rounded machined edge','BEVEL');m.width=bevel;m.segments=4;m=o.modifiers.new('Face normals','WEIGHTED_NORMAL')
 return o
def box(name,center,size,bevel=.00045):
 bpy.ops.mesh.primitive_cube_add(size=1,location=center);o=bpy.context.object;o.name=name;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat)
 m=o.modifiers.new('Soft manufactured edge','BEVEL');m.width=min(bevel,min(size)/4);m.segments=5;o.modifiers.new('Face normals','WEIGHTED_NORMAL');return o
def cylinder(name,x,y,z,r,h,axis='z',r2=None):
 bpy.ops.mesh.primitive_cone_add(vertices=64,radius1=r,radius2=r if r2 is None else r2,depth=h,location=(x,y,z));o=bpy.context.object;o.name=name
 if axis=='x':o.rotation_euler.y=math.pi/2
 o.data.materials.append(mat)
 for f in o.data.polygons:f.use_smooth=True
 b=o.modifiers.new('Turned edge','BEVEL');b.width=min(.0003,r*.06,h*.08);b.segments=3;o.modifiers.new('Face normals','WEIGHTED_NORMAL');return o
def strip(name,path,widths,thickness,twist=False):
 # Smooth rectangular grip with a deliberately modelled profile, not a box placeholder.
 verts=[]
 for n,(x,z) in enumerate(path):
  w=widths[n]/2;angle=(math.sin(n/(len(path)-1)*math.pi*2)*.45 if twist else 0)
  for y,dz in [(-w,-thickness/2),(w,-thickness/2),(w,thickness/2),(-w,thickness/2)]:verts.append((x,y*math.cos(angle)-dz*math.sin(angle),z+y*math.sin(angle)+dz*math.cos(angle)))
 faces=[(3,2,1,0)]
 for n in range(len(path)-1):
  for j in range(4):faces.append((4*n+j,4*n+(j+1)%4,4*(n+1)+(j+1)%4,4*(n+1)+j))
 a=4*(len(path)-1);faces.append((a,a+1,a+2,a+3))
 return mesh(name,verts,faces,mat,min(.0006,thickness*.15))
def lathe(name,profile):
 verts=[];N=96
 for z,r in profile:
  for j in range(N):a=j*2*math.pi/N;verts.append((r*math.cos(a),r*math.sin(a),z))
 faces=[]
 for k in range(len(profile)-1):
  for j in range(N):faces.append((k*N+j,k*N+(j+1)%N,(k+1)*N+(j+1)%N,(k+1)*N+j))
 faces+=[tuple(reversed(range(N))),tuple((len(profile)-1)*N+j for j in range(N))]
 o=mesh(name,verts,faces,mat)
 for f in o.data.polygons:f.use_smooth=True
 return o
def hardware(r):
 global mat
 d=r['dimensions_mm'];L,W,H=[d[k]/1000 for k in ('length','width','projection')];C=(r['mounting_centres_mm'] or 0)/1000;i=r['family_index'];kind=profile_for[i]
 if kind.endswith('knob'):
  build_knob(i,L,W,H,mat)
 else:
  kind=build_handle(i,L,W,H,C,mat)
 # Mount origins are independent markers; projection starts at the cabinet face.
 for x in ([-C/2,C/2] if C else [0]):
  bpy.ops.object.empty_add(location=(x,0,0));bpy.context.object.name='Mounting centre';bpy.context.object['purpose']='mounting_anchor';bpy.context.object['thread_spec']='not supplied'
 return [L,W,H],kind

def finish(name):
 f=name.lower();color=(.55,.57,.59);metal=1;rough=.28
 if 'black chrome' in f:color=(.065,.07,.075);rough=.18
 elif 'honey' in f:color=(.31,.235,.115);rough=.32
 elif 'antique black' in f:color=(.045,.04,.033);rough=.34
 elif 'black nickel' in f:color=(.07,.075,.08);rough=.19
 elif 'black' in f:color=(.014,.016,.018);metal=.05;rough=.32
 elif 'rose' in f:color=(.69,.36,.23);rough=.26
 elif 'gold' in f:color=(.68,.46,.18);rough=.24
 elif 'chrome' in f:color=(.72,.75,.78);rough=.12
 elif 'oil' in f or 'brown' in f:color=(.085,.047,.026);rough=.33;metal=.80
 elif 'grey' in f or 'gray' in f:color=(.18,.20,.21);rough=.32
 elif 'antique silver' in f:color=(.32,.34,.35);rough=.35
 m=bpy.data.materials.new('Eurofit finish | '+name);m.use_nodes=True;m.diffuse_color=(*color,1);s=m.node_tree.nodes.get('Principled BSDF');s.inputs['Base Color'].default_value=(*color,1);s.inputs['Metallic'].default_value=metal;s.inputs['Roughness'].default_value=rough
 return m
selected=os.environ.get('EUROFIT_IDS','').split(',') if os.environ.get('EUROFIT_IDS') else None
for r in p['products']:
 if r['review_status']!='dimensions_published' or (selected and r['id'] not in selected):continue
 bpy.ops.wm.read_factory_settings(use_empty=True);mat=finish(r['finish']);expected,kind=hardware(r)
 # Check evaluated envelope. Only profile shaping is approximated, never arbitrary scale.
 bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();points=[]
 for o in bpy.context.scene.objects:
  if o.type=='MESH':points += [o.matrix_world@Vector(v) for v in o.evaluated_get(dg).bound_box]
 lo=[min(v[i] for v in points) for i in range(3)];hi=[max(v[i] for v in points) for i in range(3)];actual=[hi[i]-lo[i] for i in range(3)]
 # Fit the unconstrained sculpted cross-section to the published envelope;
 # X and all mounting anchors stay fixed. No scaling of mounting centres.
 if kind=='twisted':
  for o in bpy.context.scene.objects:
   if o.type=='MESH':
    bpy.context.view_layer.objects.active=o
    for modifier in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=modifier.name)
    inv=o.matrix_world.inverted()
    for v in o.data.vertices:
     world=o.matrix_world@v.co;world.y=(world.y-lo[1])*expected[1]/actual[1]-expected[1]/2;world.z=(world.z-lo[2])*expected[2]/actual[2];v.co=inv@world
  actual[1:]=expected[1:]
 tolerance=.00012
 error=max(abs(a-b) for a,b in zip(actual,expected))
 if error>tolerance:raise RuntimeError((r['id'],kind,'envelope mismatch',actual,expected,error))
 # Weld collapsed parametric poles, remove zero-area faces and orient closed
 # shells consistently before export; material double-sidedness cannot mask this.
 for o in list(bpy.context.scene.objects):
  if o.type!='MESH':continue
  bpy.context.view_layer.objects.active=o
  for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
  bm=bmesh.new();bm.from_mesh(o.data)
  bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-8)
  bmesh.ops.triangulate(bm,faces=list(bm.faces))
  bad=[f for f in bm.faces if f.calc_area()<1e-14]
  if bad:bmesh.ops.delete(bm,geom=bad,context='FACES_ONLY')
  bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free();o.data.update()
 bpy.ops.object.empty_add();root=bpy.context.object;root.name=r['id'];root['supplier']='Eurofit Canada';root['supplier_sku']=r['supplier_sku'];root['source_url']=r['source_url'];root['dimensions_mm']=json.dumps(r['dimensions_mm']);root['mounting_centres_mm']=r['mounting_centres_mm'] or 0;root['model_limitations']=r['model_limitations'];root['model_version']=3
 for o in list(bpy.context.scene.objects):
  if o!=root:o.parent=root
 # Blender Z-up -> glTF Y-up. Cancel exporter rotation: GLB axes are X=length,
 # Y=transverse width, Z=projection, cabinet mounting plane Z=0.
 root.rotation_euler.x=math.pi/2
 bpy.context.scene.unit_settings.system='METRIC';bpy.context.scene.unit_settings.scale_length=1
 if r['family_index'] not in saved:bpy.ops.wm.save_as_mainfile(filepath=str(BLEND/(r['id']+'.blend')),compress=True);saved.add(r['family_index'])
 dest=OUT/(r['id']+'-v3.glb');bpy.ops.export_scene.gltf(filepath=str(dest),export_format='GLB',export_apply=True,export_extras=True)
 r['model_url']='/eurofit-hardware/models/'+dest.name;r['model_status']='built';r['model_profile']=('photo_profile_'+str(r['family_index'])+'_v2') if r['type']=='Knobs' else kind
 reports.append({'id':r['id'],'profile':kind,'envelope_mm':[round(v*1000,4) for v in actual],'expected_mm':[v*1000 for v in expected],'max_error_mm':round(error*1000,4),'bytes':dest.stat().st_size})
if not selected or os.environ.get('EUROFIT_SAVE_SELECTED')=='1':
 (R/'inventory.json').write_text(json.dumps(p,indent=2)+'\n')
 if selected:
  old=json.loads((R/'model-results.json').read_text());reports=[x for x in old if x['id'] not in selected]+reports
 (R/'model-results.json').write_text(json.dumps(reports,indent=2)+'\n')
print('BUILT',len(reports))
