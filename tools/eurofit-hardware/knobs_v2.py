"""Individual photo-derived knob profiles. Envelope is measured; fine contours are visual."""
import bpy, math

def build_knob(i,L,W,H,mat):
 def loft(name,rings,power=4):
  # rings: normalized z, full X/Y size factors, superellipse exponent.
  if rings[-1][1]==0:
   end=rings[-1];rings=rings[:-1]
   # A single planar face avoids degenerate rings and radial reflection seams.
   if end[0]>rings[-1][0]:rings[-1]=(end[0],*rings[-1][1:])
  N=128;vs=[]
  for row in rings:
   z,sx,sy=row[:3];n=row[3] if len(row)>3 else power
   for j in range(N):
    a=2*math.pi*j/N;c=math.cos(a);s=math.sin(a)
    vs.append((L*sx/2*math.copysign(abs(c)**(2/n),c),W*sy/2*math.copysign(abs(s)**(2/n),s),H*z))
  fs=[tuple(reversed(range(N)))]
  for k in range(len(rings)-1):
   for j in range(N):fs.append((k*N+j,k*N+(j+1)%N,(k+1)*N+(j+1)%N,(k+1)*N+j))
  fs.append(tuple((len(rings)-1)*N+j for j in range(N)))
  me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);me.materials.append(mat)
  for f in me.polygons:f.use_smooth=True
  me.polygons[0].use_smooth=False;me.polygons[-1].use_smooth=False
  # Smooth ring contours without moving the measured external silhouette.
  return o
 def roundpart(name,rows):return loft(name,[(z,r,r,2) for z,r in rows],2)
 def squarestem(base=.5,neck=.32,top=.62):
  loft('Sculpted square pedestal',[(0,base,base),(.025,base+.03,base+.03),(.075,base+.03,base+.03),(.12,base,base),(.17,base*.82,base*.82),(.25,neck+.03,neck+.03),(.40,neck,neck),(.55,neck+.04,neck+.04),(.67,top,top)])
 if i in (119,143):
  if i==119:
   rows=[(0,.48),(.02,.53),(.06,.54),(.10,.50),(.15,.41),(.23,.32),(.34,.28),(.44,.29),(.52,.34),(.57,.46),(.61,.71),(.65,.94),(.69,1),(.75,1),(.79,.97),(.82,.88),(.84,.80),(.85,.80),(.86,.75),(.90,.74),(.92,.70),(.94,.69),(.985,.68),(1,.64),(1,.59),(.975,.57),(.97,.52),(.97,0)]
  else:
   rows=[(0,.43),(.025,.48),(.08,.48),(.11,.44),(.14,.36),(.20,.30),(.34,.29),(.43,.31),(.49,.38),(.53,.55),(.56,.71),(.60,.86),(.66,.96),(.73,1),(.81,.99),(.86,.94),(.89,.88),(.905,.86),(.915,.79),(.94,.79),(.96,.73),(.975,.72),(1,.69),(1,.65),(.98,.63),(.97,.59),(.975,.55),(.985,0)]
  roundpart('K179 concentric stepped crown' if i==119 else 'K62343 rounded crown and turned neck',rows)
 elif i==142:
  roundpart('K62301 continuous bowl and bell foot',[(0,.48),(.025,.55),(.075,.57),(.12,.52),(.17,.42),(.23,.32),(.30,.27),(.36,.27),(.41,.31),(.45,.39),(.49,.53),(.55,.67),(.64,.82),(.75,.93),(.88,.99),(.97,1),(1,.98),(.985,.94),(.955,.84),(.91,.72),(.87,.58),(.845,.40),(.84,.20),(.84,0)])
 elif i==144:
  loft('K62861 continuous flared rounded square',[(0,.31,.31,3),(.03,.35,.35,3),(.16,.38,.38,3),(.32,.44,.44,3),(.48,.56,.56,3),(.60,.73,.73,3),(.68,.91,.91,3.5),(.73,1,1,4),(.80,1,1,4),(.85,.96,.96,4),(.93,.83,.83,4),(.975,.76,.76,4),(.99,.69,.69,4),(1,.55,.55,4),(1,0,0,4)])
 elif i==141:
  roundpart('K62231 bell foot and round neck',[(0,.45),(.03,.49),(.09,.49),(.15,.43),(.22,.32),(.32,.25),(.43,.24),(.53,.28),(.61,.39),(.66,.52)])
  loft('K62231 rounded square cushion',[(.62,.63,.63),(.68,.88,.88),(.73,.99,.99),(.78,1,1),(.88,.97,.97),(.95,.88,.88),(.985,.66,.66),(1,0,0)],5)
 elif i==134:
  loft('K61368 square flared pedestal',[(0,.56,.56,5),(.035,.62,.62,5),(.11,.61,.61,4),(.19,.48,.48,3),(.30,.30,.30,2),(.43,.24,.24,2),(.57,.25,.25,2),(.68,.35,.35,2),(.76,.54,.54,2)])
  roundpart('K61368 shallow round disc',[(.76,.78),(.79,.96),(.82,1),(.91,1),(.95,.97),(.985,.88),(1,0)])
 elif i in (120,131):
  loft('Straight square foot and flared shoulder',[(0,.43,.43),(.03,.45,.45),(.32,.45,.45),(.45,.51,.51),(.55,.64,.64),(.66,.89,.89)],16)
  # Low broad four-sided pyramid, with a slim rounded perimeter lip.
  loft('Slim crown perimeter',[(.66,.89,.89,40),(.70,1,1,40),(.77,1,1,40)],40)
  vs=[(-L/2,-W/2,H*.77),(L/2,-W/2,H*.77),(L/2,W/2,H*.77),(-L/2,W/2,H*.77),(0,0,H)]
  me=bpy.data.meshes.new('Four faces');me.from_pydata(vs,[],[(0,1,4),(1,2,4),(2,3,4),(3,0,4)]);me.update();o=bpy.data.objects.new('Four planar pyramid facets',me);bpy.context.collection.objects.link(o);me.materials.append(mat)
 elif i==126:
  squarestem(.60,.36,.76)
  loft('K360 stepped cushion crown',[(.63,.77,.77),(.66,.95,.95),(.69,1,1),(.73,1,1),(.75,.93,.93),(.78,.93,.93),(.82,.98,.98),(.86,.95,.95),(.94,.76,.76),(1,0,0)],6)
 elif i==129:
  loft('K417 rounded pedestal',[(0,.57,.62),(.025,.61,.67),(.10,.61,.67),(.16,.55,.60),(.22,.41,.42),(.35,.34,.32),(.55,.40,.36),(.65,.56,.58)],5)
  loft('K417 rounded rectangular cap',[(.63,.80,.80),(.68,.96,.96),(.73,1,1),(.91,1,1),(.97,.96,.96),(1,.85,.85),(1,0,0)],4)
 elif i==140:
  loft('K62217 tapered square stem',[(0,.42,.42),(.04,.45,.45),(.20,.45,.45),(.46,.51,.51),(.60,.64,.64)],8)
  loft('K62217 bevelled square cap',[(.57,.74,.74),(.63,1,1),(.78,1,1),(.96,.79,.79),(1,.77,.77),(1,0,0)],24)
 elif i==138:
  loft('K61711 slab stem',[(0,.67,.64),(.04,.69,.66),(.72,.69,.66)],28)
  loft('K61711 rectangular crown',[(.70,.98,.98),(.73,1,1),(.98,1,1),(1,.98,.98),(1,0,0)],28)
  # Fine central recessed groove is represented by two banks, continuous into stem.
  # Shallow dark line follows the photograph's manufactured split detail.
  dark=mat.copy();dark.name='K61711 groove shadow';dark.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.035,.035,.03,1)
  bpy.ops.mesh.primitive_cube_add(size=1,location=(0,0,H+.000015));o=bpy.context.object;o.name='Central cap groove';o.dimensions=(.00035,W*.98,.00003);o.data.materials.append(dark)
 elif i==137:
  loft('K61709 tapered rectangular stem',[(0,.29,.40),(.04,.32,.43),(.35,.35,.46),(.56,.46,.58),(.78,.70,.80)],8)
  loft('K61709 bevelled crown with flat ridge',[(.74,.94,.94),(.80,1,1),(.84,1,1),(1,.40,.80),(1,0,0)],5)
 elif i==121:
  roundpart('K323 cylindrical pedestal',[(0,.25),(.04,.28),(.13,.28),(.18,.24),(.57,.24),(.66,.35)])
  for name,sx,sy,cy,bottom,top in [('Rear arched cap',1,.70,.15,.70,1),('Middle nested step',.93,.52,-.14,.65,.91),('Front nested step',.85,.40,-.30,.61,.81)]:
   o=loft('K323 '+name,[(bottom,sx*.92,sy*.9),(bottom+.025,sx,sy),(top-.04,sx,sy),(top,sx*.95,sy*.94),(top,0,0)],6)
   o.location.y=cy*W
 elif i==127:
  loft('K388 flared stem',[(0,.24,.29,2),(.04,.26,.31,2),(.25,.27,.32,2),(.46,.30,.38,2),(.61,.43,.52,2),(.80,.68,.75,2)])
  N=128;vs=[]
  boundary=[]
  for j in range(N):
   a=2*math.pi*j/N;x=math.cos(a);y=.5*math.sin(a)+.45*x*x;boundary.append((x,y))
  ymin=min(y for x,y in boundary);ymax=max(y for x,y in boundary)
  for scale,zoffset in [(1,-.14),(1,0),(.94,.018),(.65,.018),(0,.018)]:
   for x,y in boundary:
    vs.append((L*.5*x*scale,W*((y-ymin)/(ymax-ymin)-.5)*scale,H*(.8974+.09*x*x*scale+zoffset)))
  fs=[tuple(reversed(range(N)))]
  for k in range(4):
   for j in range(N):fs.append((k*N+j,k*N+(j+1)%N,(k+1)*N+(j+1)%N,(k+1)*N+j))
  me=bpy.data.meshes.new('Kidney crown');me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new('K388 kidney shaped scoop',me);bpy.context.collection.objects.link(o);me.materials.append(mat)
  for f in me.polygons:f.use_smooth=True
 else:raise ValueError(i)
