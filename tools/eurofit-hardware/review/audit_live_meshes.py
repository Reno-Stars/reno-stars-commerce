import json,struct,hashlib,argparse
from pathlib import Path
import numpy as np
parser=argparse.ArgumentParser(description='Screen downloaded GLBs for geometry warnings; not visual approval.');parser.add_argument('directory',type=Path);root=parser.parse_args().directory;out=[]
for path in sorted((root/'models').glob('*.glb')):
 data=path.read_bytes();n=struct.unpack_from('<I',data,12)[0];g=json.loads(data[20:20+n]);b=data[28+n:];counts={'triangles':0,'degenerate_triangles':0,'opposed_vertex_normals':0,'nonfinite_values':0,'negative_volume_primitives':0};details=[]
 def arr(i):
  a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];dt={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']];sz={'VEC3':3,'VEC2':2,'VEC4':4,'SCALAR':1}[a['type']];item=np.dtype(dt).itemsize;return np.ndarray((a['count'],sz),dtype=dt,buffer=b,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',sz*item),item))
 for mesh in g.get('meshes',[]):
  for pr in mesh['primitives']:
   if pr.get('mode',4)!=4:continue
   pos=arr(pr['attributes']['POSITION']);ix=arr(pr['indices']).ravel().reshape(-1,3) if 'indices' in pr else np.arange(len(pos)).reshape(-1,3);tri=pos[ix].astype(float);face=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);area=np.linalg.norm(face,axis=1);deg=area<1e-14;opp=0
   if 'NORMAL' in pr['attributes']:
    normals=arr(pr['attributes']['NORMAL']);dots=(face*normals[ix].mean(axis=1)).sum(axis=1);opp=int(((dots<-area*.1)&~deg).sum());counts['nonfinite_values']+=int((~np.isfinite(normals)).sum())
   vol=float((tri[:,0]*np.cross(tri[:,1],tri[:,2])).sum()/6);counts['triangles']+=len(ix);counts['degenerate_triangles']+=int(deg.sum());counts['opposed_vertex_normals']+=opp;counts['nonfinite_values']+=int((~np.isfinite(pos)).sum());counts['negative_volume_primitives']+=int(vol < -1e-12)
   if deg.any() or opp or vol < -1e-12:details.append({'mesh':mesh.get('name'),'degenerate':int(deg.sum()),'opposed_normals':opp,'signed_volume_m3':vol})
 out.append({'id':path.stem,**counts,'details':details})
(root/'mesh-audit.json').write_text(json.dumps(out,indent=2));print(json.dumps({'models':len(out),'with_degenerate':sum(r['degenerate_triangles']>0 for r in out),'with_opposed_normals':sum(r['opposed_vertex_normals']>0 for r in out),'with_negative_volume':sum(r['negative_volume_primitives']>0 for r in out),'nonfinite':sum(r['nonfinite_values'] for r in out)},indent=2))
print(json.dumps(next((r for r in out if r['id']=='eurofit-h-71267-128cp'),{}),indent=2))
