"""Independent serialized-GLB and source-evidence audit. No blanket human approval."""
import json,re,struct,hashlib,collections,csv,itertools
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[1];REPO=ROOT.parent.parent
CAT=json.loads((ROOT/'inventory.json').read_text());GROUPS=json.loads((ROOT/'review/groups.json').read_text());IMAGES={r['group']:r for r in json.loads((ROOT/'review/image-evidence.json').read_text())}
byid={id:g for g in GROUPS for id in g['ids']}
DECISIONS={d['group']:d for d in json.loads((ROOT/'review/visual-decisions.json').read_text())}
assert len(DECISIONS)==len(GROUPS)
for g in GROUPS:
 d=DECISIONS[g['group']];assert d['representative_id']==g['representative']['id'] and d['agent_visual_inspection']
 assert d['source_image_sha256']==IMAGES[g['group']]['sha256']
 path=REPO/'storefront/public'/g['representative']['model_url'].lstrip('/')
 assert hashlib.sha256(path.read_bytes()).hexdigest()==d['model_sha256'], 'Visual review is stale: '+str(g['group'])
# The placeholder graphic was directly inspected in contact sheet 1, group 2.
placeholder=IMAGES[2]['sha256']
def measure(path):
 data=path.read_bytes();magic,version,total=struct.unpack_from('<4sII',data);assert magic==b'glTF' and version==2 and total==len(data)
 size,typ=struct.unpack_from('<II',data,12);assert typ==0x4e4f534a;g=json.loads(data[20:20+size]);binsize,bintype=struct.unpack_from('<II',data,20+size);assert bintype==0x004e4942;binary=data[28+size:28+size+binsize];lo=np.full(3,np.inf);hi=-lo;names=collections.Counter()
 def matrix(n):
  if 'matrix' in n:return np.array(n['matrix']).reshape((4,4),order='F')
  x,y,z,w=n.get('rotation',[0,0,0,1]);m=np.eye(4);m[:3,:3]=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])@np.diag(n.get('scale',[1,1,1]));m[:3,3]=n.get('translation',[0,0,0]);return m
 def walk(i,parent):
  nonlocal lo,hi
  n=g['nodes'][i];world=parent@matrix(n)
  if 'mesh' in n:
   names[re.sub(r'\.\d+$','',n.get('name',''))]+=1
   for primitive in g['meshes'][n['mesh']]['primitives']:
    a=g['accessors'][primitive['attributes']['POSITION']];assert a['type']=='VEC3' and a['componentType']==5126 and 'sparse' not in a
    v=g['bufferViews'][a['bufferView']];offset=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',12);points=np.ndarray((a['count'],3),dtype='<f4',buffer=binary,offset=offset,strides=(stride,4));assert np.isfinite(points).all()
    p=points@world[:3,:3].T+world[:3,3];lo=np.minimum(lo,p.min(0));hi=np.maximum(hi,p.max(0))
  for j in n.get('children',[]):walk(j,world)
 for i in g['scenes'][g.get('scene',0)]['nodes']:walk(i,np.eye(4))
 return {'envelope_xyz_m':(hi-lo).tolist(),'mesh_nodes':dict(names),'embedded_images':all('bufferView' in i for i in g.get('images',[])),'glb_sha256':hashlib.sha256(data).hexdigest()}
results=[]
for p in CAT['products']:
 g=byid.get(p['id']);findings=[];checks={};model=p.get('model_url')
 def issue(code,detail):findings.append({'code':code,'detail':detail})
 if model:
  d=p['dimensions_mm'];spec=p['model_spec'];checks=measure(REPO/'storefront/public'/model.lstrip('/'));expected=[d['w']/1000,(d['h']+spec['legs_mm'])/1000,d['d']/1000];err=max(abs(a-b) for a,b in zip(checks['envelope_xyz_m'],expected));checks['serialized_envelope_error_m']=err
  if err>.0001:issue('MODEL_ENVELOPE_MISMATCH',f'Exported mesh differs from inventory by {err*1000:.3f} mm')
  if p['brand']=='OPPEIN':
   code=spec['code'];m=re.fullmatch(r'(?:W|PC|WBF|WSL)(\d{2})(\d{2})(\d{2})?',code)
   if m and any(abs(int(m[i])*25.4-d[a])>.01 for i,a in [(1,'w'),(2,'h')]):issue('SOURCE_SIZE_CONFLICT',f'SKU size pattern {code} disagrees with published description: {p["dimension_evidence"]}. Requires supplier clarification, not silent correction.')
   if p['id']=='oppein-ply-ssw-wsl3015':issue('SOURCE_IMAGE_LABEL_MISMATCH','Selected SSW product uses artwork labelled WSS-WSL3015; slim-shaker profile cannot be verified from that image.')
   if p['title']=='Base Microwave Cabinet':issue('SOURCE_CONFIGURATION_CONFLICT','BSR06 and 6-inch width identify a spice-sized unit; title says microwave cabinet.')
   if p['title']=='Pantry Cabinet 2 Full Door':issue('SOURCE_CONFIGURATION_CONFLICT','Title says two full doors; generic model has a horizontal split and four doors.')
   if code=='B21' and '2 Door' in p['title']:issue('SOURCE_CONFIGURATION_CONFLICT','Title specifies two doors; photograph and generated model show one.')
   if p['title']=='Wall Fridge Cabinet' and d['d']<400:issue('SOURCE_CONFIGURATION_CONFLICT','Fridge-cabinet title conflicts with shallow wall-cabinet SKU and image.')
   if 'Short' in p['title'] and d['h']>24*25.4+.01:issue('SOURCE_TITLE_MISMATCH','Short-cabinet title is attached to a 30–42 inch tall unit.')
   if p['finish'] not in ['White Single Shaker','White Slim Shaker','White High Gloss']:issue('CARCASS_FINISH_MISMATCH','Generated box sides match door finish; inspected OPPEIN product illustrations show white boxes with separately coloured fronts. Exposed-end panels are separate.')
   if spec['kind']=='pantry':issue('PANTRY_SPLIT_UNVERIFIED','Generic lower-door split (~57 inches) does not follow the inspected OPPEIN pantry illustration; no measured door-front schedule is available.')
   if code.startswith(('BSR','BTC')):issue('SPECIALTY_INTERIOR_MISMATCH','Generic shelves replace the specified pull-out spice/trash mechanism; no dimensioned specialty insert was modeled.')
  if p['brand']=='Blue Valley':
   pid=p['source_parent_id']
   if pid in [2087,2059]:issue('SOURCE_TABLE_SKU_CONFLICT','Dimension table contains SKU height codes inconsistent with the product/variant height; supplier confirmation required.')
   if pid in [2398,2370]:issue('SPECIALTY_INTERIOR_MISMATCH','Model uses ordinary shelves instead of the specified pull-out bins/spice rack.')
   if pid==2284:issue('SINK_SHELF_INTERFERENCE','Full-height sink base was generated as a generic shelved cabinet; shelf obstructs sink/plumbing space.')
   if spec['kind']=='pantry':issue('PANTRY_SPLIT_UNVERIFIED','Door split and fixed/adjustable shelf layout were generated from a generic formula, not a measured supplier schedule.')
   # Variant SKU can encode a depth which conflicts with the parent page; do not replace the explicit measurement by a guessed SKU decode.
   sku=p['supplier_sku'] or ''
   if re.match(r'(?:[23]DB|B)\d{2}21-',sku) and abs(d['d']-24*25.4)<.01:issue('VARIANT_DEPTH_AMBIGUITY','Variant SKU includes 21 while parent specifies 24-inch depth; resolve against variant-specific drawing before publication.')
  if not g:issue('MISSING_REVIEW_GROUP','No representative visual inspection recorded')
  elif IMAGES[g['group']].get('sha256')==placeholder:issue('REFERENCE_PLACEHOLDER','Representative supplier image is a placeholder. Configuration/finish cannot be photo-verified from it.')
  issue('FINISH_APPROXIMATION','Finish uses generic colour/texture and lacks a calibrated supplier sample; not an exact product finish match.')
  if p['finish'] in ['Natural Wood','Smoked Oak','Natural Oak','Dark Walnut']:issue('WOOD_GRAIN_APPROXIMATION','Generic oak texture/tint differs from supplier grain; drawer-front grain direction is not verified.')
 else:
  for reason in p['review_reasons']:issue('SOURCE_SPECIFICATION_HOLD',reason)
 severe=[f for f in findings if f['code'] not in ['FINISH_APPROXIMATION','WOOD_GRAIN_APPROXIMATION','REFERENCE_PLACEHOLDER']]
 state='specification_hold' if not model else 'correction_required' if severe else 'draft_visual_limitations'
 results.append({'id':p['id'],'brand':p['brand'],'supplier_sku':p['supplier_sku'],'source_url':p['source_url'],'model_url':model,'review_status':state,'publication_approved':False,'source_snapshot_date':CAT['snapshot_date'],'automated_record_checks':True,'individual_visual_inspection':bool(g and p['id']==g['representative']['id']),'representative_visual_group':g['group'] if g else None,'representative_id':g['representative']['id'] if g else None,'visual_method':'Agent inspected source/render comparison for all 210 configuration groups; grouped variants are not individually photo-approved.' if g else 'Held record; no model approved.','checks':checks,'findings':findings})
summary={'records':len(results),'models':sum(bool(r['model_url']) for r in results),'statuses':dict(collections.Counter(r['review_status'] for r in results)),'findings':dict(collections.Counter(f['code'] for r in results for f in r['findings'])),'publication_approved':0,'visual_groups_inspected':210,'method':'All records audited; all model files measured independently from serialized vertex data. Agent visually inspected 210 representative source/render groups, not every variant individually.'}
(ROOT/'review/audit.json').write_text(json.dumps({'summary':summary,'products':results},indent=2))
with (ROOT/'review/audit.csv').open('w',newline='') as f:
 w=csv.writer(f,lineterminator='\n');w.writerow(['id','brand','supplier_sku','review_status','publication_approved','representative_group','source_url','findings'])
 for r in results:w.writerow([r['id'],r['brand'],r['supplier_sku'],r['review_status'],False,r['representative_visual_group'],r['source_url'],' | '.join(f['code']+': '+f['detail'] for f in r['findings'])])
print(json.dumps(summary,indent=2))
