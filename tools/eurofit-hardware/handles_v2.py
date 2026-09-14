"""Photo-reviewed handle profiles; supplier envelope/anchor dimensions remain authoritative."""
import bpy,math
from mathutils import Vector

def build_handle(i,L,W,H,C,mat):
 def mesh(name,v,f,bevel=0,smooth=False):
  me=bpy.data.meshes.new(name);me.from_pydata(v,[],f);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);me.materials.append(mat)
  for p in me.polygons:p.use_smooth=smooth
  if bevel:
   m=o.modifiers.new('Manufactured edge radius','BEVEL');m.width=bevel;m.segments=5;o.modifiers.new('Face weighted normals','WEIGHTED_NORMAL')
  return o
 def box(name,c,s,b=.0006):
  bpy.ops.mesh.primitive_cube_add(size=1,location=c);o=bpy.context.object;o.name=name;o.dimensions=s;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat)
  m=o.modifiers.new('Edge radius','BEVEL');m.width=min(b,min(s)/3);m.segments=5;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');return o
 def cyl(name,x,y,z,rx,ry,h):
  bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=1,depth=1,location=(x,y,z));o=bpy.context.object;o.name=name;o.scale=(rx,ry,h);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat)
  for p in o.data.polygons:p.use_smooth=True
  m=o.modifiers.new('Turned rim','BEVEL');m.width=min(.0004,h*.1);m.segments=4;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');return o
 def extrude(name,outline,depth=W,bevel=.0006):
  n=len(outline);v=[(x,y,z) for y in [-depth/2,depth/2] for x,z in outline];f=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(j,(j+1)%n,(j+1)%n+n,j+n) for j in range(n)];return mesh(name,v,f,bevel)
 def uframe(thick,rad,feet=None):
  f=feet or L-C
  return extrude('Continuous U grip and legs',[(-L/2,0),(-L/2,H),(L/2,H),(L/2,0),(L/2-f,0),(L/2-f,H-thick),(-L/2+f,H-thick),(-L/2+f,0)],bevel=min(rad,f*.4,thick*.4))
 def sweep(name,height,width,thick,power=3,twist=0,ywave=0):
  n=128;m=32;v=[]
  for k in range(n+1):
   u=k/n;x=L*(u-.5);a=twist*math.sin(2*math.pi*u)
   # Rounded tip section, retaining exact endpoints and continuous end faces.
   tip=min(1,.25+min(u,1-u)*60)
   for j in range(m):
    t=2*math.pi*j/m;co=math.cos(t);si=math.sin(t);y=width(u)/2*math.copysign(abs(co)**(2/power),co)*tip;z=thick/2*math.copysign(abs(si)**(2/power),si)*tip
    v.append((x,y*math.cos(a)-z*math.sin(a)+ywave*math.sin(2*math.pi*u),height(u)+y*math.sin(a)+z*math.cos(a)))
  fs=[tuple(reversed(range(m)))]
  for k in range(n):
   for j in range(m):fs.append((k*m+j,k*m+(j+1)%m,(k+1)*m+(j+1)%m,(k+1)*m+j))
  fs.append(tuple(n*m+j for j in range(m)));o=mesh(name,v,fs,smooth=True);o.data.polygons[0].use_smooth=False;o.data.polygons[-1].use_smooth=False;return o
 def posts(height,round=False,width=.65):
  for x in [-C/2,C/2]:
   h=height((x+L/2)/L)
   if round:cyl('Rounded mounting pedestal',x,0,h/2,min((L-C)/2,W*.5),W*width/2,h)
   else:box('Mounting pedestal',(x,0,h/2),(min(L-C,W*.8),W*width,h))
 # Closed, rounded tubular U.
 if i==0:
  F=L-C;t=W;z=H-t/2;r=min(H*.3,C*.08);path=[]
  for k in range(17):path.append((-C/2,(z-r)*k/16))
  for k in range(1,25):a=math.pi-math.pi/2*k/24;path.append((-C/2+r+r*math.cos(a),z-r+r*math.sin(a)))
  for k in range(1,33):path.append((-C/2+r+(C-2*r)*k/32,z))
  for k in range(1,25):a=math.pi/2-math.pi/2*k/24;path.append((C/2-r+r*math.cos(a),z-r+r*math.sin(a)))
  for k in range(1,17):path.append((C/2,(z-r)*(1-k/16)))
  v=[];N=48
  for k,(x,z) in enumerate(path):
   d=Vector(path[min(k+1,len(path)-1)])-Vector(path[max(k-1,0)]);d.normalize()
   for j in range(N):a=2*math.pi*j/N;v.append((x-d.y*F/2*math.cos(a),W/2*math.sin(a),z+d.x*t/2*math.cos(a)))
  f=[tuple(reversed(range(N)))]+[(k*N+j,k*N+(j+1)%N,(k+1)*N+(j+1)%N,(k+1)*N+j) for k in range(len(path)-1) for j in range(N)]+[tuple((len(path)-1)*N+j for j in range(N))];mesh('Closed bent tubular grip',v,f,smooth=True)
 elif i in [5,10,43,66,80]:
  # Shaft has end overhang only on round T-bar references.
  radius=W*(.40 if i==66 else .50);z=H-W/2
  o=cyl('Round straight rail',0,0,z,radius,radius,L);o.rotation_euler.y=math.pi/2
  for x in [-C/2,C/2]:
   h=z
   if i in [5,43]:box('Broad squared rail foot',(x,0,h/2),(L-C,W*.80,h),.0008)
   else:cyl('Round post',x,0,h/2,min((L-C)/2,W*.32),W*.32,h)
   if i==66:
    o=cyl('Raised end collar',x,0,z,W/2,W/2,min(L-C,W*.5));o.rotation_euler.y=math.pi/2
 elif i in [37,40]:
  # A shell closes against the upper/side flange and is open along the lower edge.
  # Different photographed silhouettes: half-oval H387 versus squared dome H408.
  t=.0015;N=96;M=24;vs=[];fs=[];ex=2 if i==37 else 4
  for side in [0,1]:
   for a in range(N+1):
    theta=math.pi*a/N;xx=math.copysign(abs(math.cos(theta))**(2/ex),math.cos(theta));yy=math.sin(theta)**(2/ex)
    for b in range(M+1):
     phi=math.pi*b/(2*M);vs.append(((L/2-.008-t*side)*xx*math.cos(phi),-W/2+(W-t*side)*yy*math.cos(phi),.002+(H-.002-t*side)*math.sin(phi)))
  grid=(N+1)*(M+1)
  for side in range(2):
   for a in range(N):
    for b in range(M):
     j=side*grid+a*(M+1)+b;f=(j,j+1,j+M+2,j+M+1);fs.append(f if side==0 else tuple(reversed(f)))
  mesh('Open backed formed cup',vs,fs,smooth=True)
  for x in [-C/2,C/2]:
   rx=(L-C)/2;cyl('Oval screw ear',x,-W*.32,.001,rx,W*.18,.002)
   cyl('Recessed screw head',x,-W*.32,.0025,min(.0025,rx*.35),min(.0025,rx*.35),.001)
  # Raised perimeter lip follows the upper semicircle; small gaps distinguish flange.
  for k in range(64):
   a=math.pi*(k+.5)/64;x=(L/2-.003)*math.cos(a);y=-W/2+(W-.002)*math.sin(a)
   # perimeter strip modeled as a joined flat ribbon below shell
  vv=[]
  for a in range(97):
   th=math.pi*a/96
   for radius in [0,1]:vv.append(((L/2-.002-.004*radius)*math.copysign(abs(math.cos(th))**(2/ex),math.cos(th)),-W/2+(W-.002-.004*radius)*math.sin(th)**(2/ex),.0015))
  mesh('Cup backplate upper rim',vv,[(k*2,k*2+1,k*2+3,k*2+2) for k in range(96)],.0001)
 elif i in [36,115,101]:
  # Face plate type H71448 uses a broad plane, not a thin U-bar.
  if i==101:
   box('Broad rectangular face plate',(0,0,H-.0025),(L,W,.005),.0015)
   posts(lambda u:H-.003,False,.45)
  else:
   n=96;r=W/2;v=[]
   for z in [H-.004,H]:
    for j in range(n):a=2*math.pi*j/n;v.append(((L/2-r)*(1 if math.cos(a)>=0 else -1)+r*math.cos(a),r*math.sin(a),z))
   mesh('Capsule face plate',v,[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(j,(j+1)%n,(j+1)%n+n,j+n) for j in range(n)],.0005)
   posts(lambda u:H-.002,True,.65)
 elif i==27:
  # Rounded rectangular ring in the length/projection plane; open central aperture.
  f=L-C;tt=min(H*.20,.004);r=min(H*.26,L*.08)
  def roundrect(x0,x1,z0,z1,rad):
   points=[]
   for cx,cz,a0 in [(x1-rad,z1-rad,0),(x0+rad,z1-rad,90),(x0+rad,z0+rad,180),(x1-rad,z0+rad,270)]:
    for k in range(17):
     a=math.radians(a0+k*90/16);points.append((cx+rad*math.cos(a),cz+rad*math.sin(a)))
   return points
  outer=roundrect(-L/2,L/2,0,H,r);inner=roundrect(-L/2+f,L/2-f,tt,H-tt,max(.001,r-tt));n=len(outer);v=[]
  for y in [-W/2,W/2]:v.extend((x,y,z) for x,z in outer+inner)
  fs=[]
  for j in range(n):
   k=(j+1)%n;fs.extend([(j,k,n+k,n+j),(2*n+j,3*n+j,3*n+k,2*n+k),(j,2*n+j,2*n+k,k),(n+j,n+k,3*n+k,3*n+j)])
  mesh('Continuous radiused open loop',v,fs,.00035)
 elif i in [1,9,11,46,47,48,52,54,55,71,76,89,91,92,105,109]:
  t={47:H*.19,48:H*.18,54:H*.16,55:H*.18,71:H*.20,76:H*.22,92:H*.18,109:H*.18}.get(i,H*.20)
  triangular=i in [47,91];shoulder=i in [48,54,109]
  def height(u):
   if triangular:rise=min(1,u/.25,(1-u)/.25)
   elif shoulder:rise=max(0,min(1,(u-.03)/.28,(.97-u)/.28));rise=rise*rise*(3-2*rise)
   else:rise=math.sin(math.pi*u)**1.5
   return t/2+(H-t)*rise
  def width(u):
   tip=min(1,(.65 if i in [76,89,105] else .25)+min(u,1-u)*25)
   waist={1:.50,9:.70,11:.34,46:.75,47:1,48:.78,52:.48,54:.38,55:.26,71:.9,76:.4,89:.64,92:.45,105:.35,109:.65}.get(i,.6)
   return W*(waist+(1-waist)*abs(2*u-1)**1.7)*tip
  sweep('Sculpted leaf grip',height,width,t,2.4,.65 if i in [52,92] else .20 if i==76 else 0)
  posts(lambda u:height(u),True,.35)
 elif i in [4,17,29,32,62,68,70]:
  t=H*({4:.21,17:.22,22:.18,29:.27,32:.25,62:.27,68:.24,70:.28}[i]);base=H*.63
  height=lambda u:base+(H-t/2-base)*math.sin(math.pi*u)
  sweep('Raised arched grip',height,lambda u:W,t,3.5 if i in [17,29,32,68] else 2.6)
  posts(height,i in [4,62,70],1)
  if i in [29,68]:
   for sy in [-1,1]:
    o=sweep('Nested crown ridge',lambda u:height(u)+t*.23,lambda u:W*.08,t*.25,3);o.location.y=sy*W*.32
 elif i==106:
  # H-71267: shallow arched strap with outward-returning mounting feet.
  # Outside envelope 152 x 20 x 30 mm, anchors 128 mm apart.
  # Form one continuous profile rather than intersecting posts and a flat rail.
  foot=L/2;outer=C/2+.003;inner=C/2-.003;top=H-.005;t=.004
  outline=[(-foot,0),(-foot,.003),(-outer-.002,.003)]
  def curve(a,b,c,n=12):
   return [((1-u)**2*a[0]+2*(1-u)*u*b[0]+u*u*c[0],(1-u)**2*a[1]+2*(1-u)*u*b[1]+u*u*c[1]) for u in [k/n for k in range(1,n+1)]]
  outline+=curve(outline[-1],(-outer,.003),(-outer,.005))
  outline.append((-outer,top-.003))
  outline+=curve(outline[-1],(-outer,top),(-outer+.003,top))
  for k in range(1,65):
   x=(-outer+.003)+(2*outer-.006)*k/64;outline.append((x,top+.005*(1-(x/(outer-.003))**2)))
  outline+=curve(outline[-1],(outer,top),(outer,top-.003))
  outline.append((outer,.005));outline+=curve(outline[-1],(outer,.003),(outer+.002,.003))
  outline.extend([(foot,.003),(foot,0),(inner,0),(inner,top-t-.002)])
  outline+=curve(outline[-1],(inner,top-t),(inner-.002,top-t))
  for k in range(1,65):
   x=(inner-.002)-(2*inner-.004)*k/64;outline.append((x,top-t+.005*(1-(x/(inner-.002))**2)))
  outline+=curve(outline[-1],(-inner,top-t),(-inner,top-t-.002));outline.append((-inner,0))
  extrude('H71267 arched strap with integral outward feet',outline,W,.0007)
 elif i in [18,19,22]:
  # Sweep the bend explicitly: a generic bevel is clamped by the narrow
  # extrusion depth and leaves visibly square elbows on these bent strips.
  t=L-C;r=min(H*.38,C*.12);z=H-t/2;path=[]
  for k in range(17):path.append((-C/2,(z-r)*k/16))
  for k in range(1,25):
   a=math.pi-math.pi*k/48;path.append((-C/2+r+r*math.cos(a),z-r+r*math.sin(a)))
  for k in range(1,33):path.append((-C/2+r+(C-2*r)*k/32,z))
  for k in range(1,25):
   a=math.pi/2-math.pi*k/48;path.append((C/2-r+r*math.cos(a),z-r+r*math.sin(a)))
  for k in range(1,17):path.append((C/2,(z-r)*(1-k/16)))
  v=[];N=32
  for k,(x,z) in enumerate(path):
   d=Vector(path[min(k+1,len(path)-1)])-Vector(path[max(0,k-1)]);d.normalize()
   for j in range(N):
    a=2*math.pi*j/N;co=math.cos(a);si=math.sin(a)
    q=t/2*math.copysign(abs(co)**.25,co);y=W/2*math.copysign(abs(si)**.25,si)
    v.append((x-d.y*q,y,z+d.x*q))
  f=[tuple(reversed(range(N)))]+[(k*N+j,k*N+(j+1)%N,(k+1)*N+(j+1)%N,(k+1)*N+j) for k in range(len(path)-1) for j in range(N)]+[tuple((len(path)-1)*N+j for j in range(N))]
  mesh('Continuous bent rectangular strip',v,f,smooth=True)
  if i==106:
   for x in [-C/2,C/2]:box('Flared plinth',(x,0,.0015),(L-C,W,.003),.001)
 else:
  # Each observed U/bridge profile retains its own radius, bar gauge and foot form.
  rad={6:.0007,7:.0011,13:.001,14:.0005,20:.002,24:.0006,26:.002,30:.003,31:.0006,34:.003,35:.0005,38:.003,42:.001,56:.002,58:.0008,61:.002,63:.0005,65:.0007,67:.001,69:.0005,72:.0008,73:.0006,78:.002,79:.0005,82:.001,86:.004,88:.003,90:.002,91:.002,100:.0006,102:.0008,103:.001,104:.0005,107:.001,110:.0007,111:.0005}[i]
  thickness={14:.005,20:.004,24:.004,31:.004,35:.004,63:.005,73:.004,79:.004,82:.004,88:.004,90:.004,91:.004}.get(i,min(H*.26,W*.80))
  if i in [88,90]:
   box('Slim bridge between oval feet',(0,0,H-thickness/2),(L,W*.64,thickness),.001)
  else:uframe(thickness,rad)
  if i in [34,67,86,88,90,103]:
   # Round outside foot contours visible in the supplier photograph.
   for x in [-C/2,C/2]:cyl('Rounded outer foot',x,0,(H-thickness)/2,(L-C)/2,W/2,H-thickness)
  if i==61:
   for x in [-C/2,C/2]:box('Square mounting plinth',(x,0,.0015),(L-C,W,.003),.0008)
  if i in [30,56,104,107]:
   for sy in [-1,1]:box('Parallel grip moulding',(0,sy*W*.34,H-.0006),(L-.002,W*.09,.0012),.00025)
 # Fit only the visual cross-section to the authoritative outside envelope. All
 # mounting origins are created later at exact C-C and are never transformed.
 bpy.context.view_layer.update();objs=[o for o in bpy.context.scene.objects if o.type=='MESH'];pts=[]
 for o in objs:
  bpy.context.view_layer.objects.active=o
  for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
  pts.extend(o.matrix_world@v.co for v in o.data.vertices)
 lo=[min(v[k] for v in pts) for k in range(3)];hi=[max(v[k] for v in pts) for k in range(3)]
 for o in objs:
  inv=o.matrix_world.inverted()
  for v in o.data.vertices:
   w=o.matrix_world@v.co
   # X is retained except cupped flange support envelope; symmetry keeps feet centres.
   if i in [37,40]:w.x=(w.x-lo[0])*L/(hi[0]-lo[0])-L/2
   w.y=(w.y-lo[1])*W/(hi[1]-lo[1])-W/2;w.z=(w.z-lo[2])*H/(hi[2]-lo[2]);v.co=inv@w
 return 'photo_handle_'+str(i)+'_v2'
