"""Blender: metre-scale product envelopes, separate mounting anchors, glTF PBR."""
import bpy,json,math,os,sys,hashlib
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
 elif kind=='cup':
  # Open underside, domed shell and flanged mounting feet.
  N=64;M=16;vs=[];fs=[];t=.0015
  for side in [0,1]:
   for a in range(N+1):
    angle=math.pi*a/N
    for b in range(M+1):
     phi=math.pi*b/(2*M);vs.append(((L/2-t*side)*math.cos(angle)*math.cos(phi),-W/2+(W-t*side)*math.sin(angle)*math.cos(phi),t+(H-t-t*side)*math.sin(phi)))
  grid=(N+1)*(M+1)
  for side in range(2):
   for a in range(N):
    for b in range(M):
     j=side*grid+a*(M+1)+b;f=(j,j+1,j+M+2,j+M+1);fs.append(f if not side else tuple(reversed(f)))
  o=mesh('Hollow cup shell',vs,fs,mat)
  for f in o.data.polygons:f.use_smooth=True
  for x in [-C/2,C/2]:box('Cup mounting flange',(x,0,.001),(min(.012,L-C),W*.60,.002))
 elif kind=='round_rail':
  radius=W/2;z=H-radius;cylinder('Cylindrical grip',0,0,z,radius,L,'x')
  for x in [-C/2,C/2]:
   foot=min(W*.75,L-C)
   if i in [5,43]:box('Square standoff',(x,0,z/2),(foot,W*.85,z))
   else:cylinder('Round standoff',x,0,z/2,W*.28,z)
   if i in [5,66]:cylinder('Grip collar',x,0,z,radius*.98,min(W*.40,(L-C)*.8),'x')
 elif kind=='tube_bend':
  # Radius of the 90-degree corners is visual; end centres retain C-C.
  rad=W/2;turn=min(.008,H*.27);vs=[];path=[]
  for n in range(13):path.append((-C/2,H-rad-turn if n==12 else (H-rad-turn)*n/12))
  for n in range(1,17):a=math.pi-n*math.pi/32;path.append((-C/2+turn+turn*math.cos(a),H-rad-turn+turn*math.sin(a)))
  for n in range(1,33):path.append((-C/2+turn+(C-2*turn)*n/32,H-rad))
  for n in range(1,17):a=math.pi/2-n*math.pi/32;path.append((C/2-turn+turn*math.cos(a),H-rad-turn+turn*math.sin(a)))
  for n in range(1,13):path.append((C/2,(H-rad-turn)*(1-n/12)))
  for n,(x,z) in enumerate(path):
   a=Vector(path[min(n+1,len(path)-1)])-Vector(path[max(n-1,0)]);a.normalize()
   for j in range(32):ang=j*math.pi/16;vs.append((x-((L-C)/2)*a.y*math.cos(ang),rad*math.sin(ang),z+rad*a.x*math.cos(ang)))
  fs=[]
  for n in range(len(path)-1):
   for j in range(32):fs.append((n*32+j,n*32+(j+1)%32,(n+1)*32+(j+1)%32,(n+1)*32+j))
  o=mesh('Bent tubular grip',vs,fs,mat)
  for f in o.data.polygons:f.use_smooth=True
 elif kind in ['bow','twisted']:
  thickness=min(.006,W*.35);path=[];widths=[]
  leaf=i in [1,9,11,46,47,54,55,76,89,105,109]
  strap=i in [18,19,48,54,106]
  base=thickness/2 if leaf or strap else H*.65
  def elevation(u):
   rise=min(1,math.sin(math.pi*u)*4) if strap else math.sin(math.pi*u)**.8
   return base+(H-thickness/2-base)*rise
  for n in range(65):
   u=n/64;x=-L/2+u*L;arch=math.sin(math.pi*u)**.65
   path.append((x,elevation(u)));widths.append(W*(1-.42*math.sin(math.pi*u)) if leaf else W)
  strip('Sculpted arch grip',path,widths,thickness,kind=='twisted')
  for x in [-C/2,C/2]:
   u=(x+L/2)/L;h=elevation(u)
   box('Mounting foot',(x,0,h/2),(max(.002,min(.015,L-C)),W*.52,h))
 elif kind=='oval_plate':
  # Capsule grip extruded as a continuous plate.
  rad=W/2;vs=[]
  for z in [H-.005,H]:
   for n in range(96):a=n*math.pi/48;vs.append(((L/2-rad)*(1 if math.cos(a)>=0 else -1)+rad*math.cos(a),rad*math.sin(a),z))
  fs=[tuple(reversed(range(96))),tuple(range(96,192))]+[(n,(n+1)%96,(n+1)%96+96,n+96) for n in range(96)]
  mesh('Oval plate grip',vs,fs,mat,.0005)
  for x in [-C/2,C/2]:cylinder('Plate post',x,0,(H-.004)/2,min(W*.25,(L-C)/2),(H-.004))
 else:
  t={7:.006,24:.013,42:.009}.get(i,min(H*.32,.009));foot={14:.030,20:.024,24:.033,35:.020,63:.024,88:.028}.get(i,min(max(.003,(L-C)*.65),.026));foot=min(foot,L-C)
  if kind=='blade_feet':
   gripwidth=W*.70 if i in [35,88,91] else W
   box('Blade grip',(0,0,H-t/2),(L,gripwidth,t))
  else:box('Rectangular grip',(0,0,H-t/2),(L,W,t),.0012 if i in [38,86] else .0004)
  for x in [-C/2,C/2]:
   box('Mounting standoff',(x,0,(H-t)/2),(foot,W,H-t),.0012 if i in [38,86] else .0004)
   if i in [61,65]:box('Foot plinth',(x,0,.001),(min(L-C,foot*1.2),W,.002))
  if i in [30,56,104,107]:
   # Recessed narrow channels on the broad grip; geometric seam, no painted stripe.
   for sy in [-1,1]:box('Raised grip edge',(0,sy*(W/2-.0007),H-.0007),(L-.001,.0014,.0014),.0002)
  if i==27:box('Lower loop return',(0,0,.002),(L,W,.004))
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
 bpy.ops.object.empty_add();root=bpy.context.object;root.name=r['id'];root['supplier']='Eurofit Canada';root['supplier_sku']=r['supplier_sku'];root['source_url']=r['source_url'];root['dimensions_mm']=json.dumps(r['dimensions_mm']);root['mounting_centres_mm']=r['mounting_centres_mm'] or 0;root['model_limitations']=r['model_limitations'];root['model_version']=2 if r['type']=='Knobs' else 1
 for o in list(bpy.context.scene.objects):
  if o!=root:o.parent=root
 # Blender Z-up -> glTF Y-up. Cancel exporter rotation: GLB axes are X=length,
 # Y=transverse width, Z=projection, cabinet mounting plane Z=0.
 root.rotation_euler.x=math.pi/2
 bpy.context.scene.unit_settings.system='METRIC';bpy.context.scene.unit_settings.scale_length=1
 if r['family_index'] not in saved:bpy.ops.wm.save_as_mainfile(filepath=str(BLEND/(r['id']+'.blend')),compress=True);saved.add(r['family_index'])
 dest=OUT/(r['id']+('-v2' if r['type']=='Knobs' else '')+'.glb');bpy.ops.export_scene.gltf(filepath=str(dest),export_format='GLB',export_apply=True,export_extras=True)
 r['model_url']='/eurofit-hardware/models/'+dest.name;r['model_status']='built';r['model_profile']=('photo_profile_'+str(r['family_index'])+'_v2') if r['type']=='Knobs' else kind
 reports.append({'id':r['id'],'profile':kind,'envelope_mm':[round(v*1000,4) for v in actual],'expected_mm':[v*1000 for v in expected],'max_error_mm':round(error*1000,4),'bytes':dest.stat().st_size})
if not selected or os.environ.get('EUROFIT_SAVE_SELECTED')=='1':
 (R/'inventory.json').write_text(json.dumps(p,indent=2)+'\n')
 if selected:
  old=json.loads((R/'model-results.json').read_text());reports=[x for x in old if x['id'] not in selected]+reports
 (R/'model-results.json').write_text(json.dumps(reports,indent=2)+'\n')
print('BUILT',len(reports))
