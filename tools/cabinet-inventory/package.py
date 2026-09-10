"""Validate generated GLBs, preserve wood finish tints, export Medusa staging and CSV."""
import json,struct,hashlib,csv,collections
from pathlib import Path
ROOT=Path(__file__).resolve().parent;REPO=ROOT.parent.parent
catalog=json.loads((ROOT/'inventory.json').read_text());results={r['id']:r for r in json.loads((ROOT/'model-results.json').read_text())};ready=[]
for p in catalog['products']:
 r=results.get(p['id'])
 if r:
  assert r['spec_hash']==hashlib.sha256(json.dumps(p['model_spec'],sort_keys=True).encode()).hexdigest(),p['id']
  assert r['max_error_m']<.0001
  path=REPO/'storefront/public'/r['model_url'].lstrip('/');data=path.read_bytes();magic,version,length=struct.unpack_from('<4sII',data);assert magic==b'glTF' and version==2 and length==len(data)
  size,kind=struct.unpack_from('<II',data,12);assert kind==0x4e4f534a;g=json.loads(data[20:20+size]);f=p['finish'].lower()
  if any(x in f for x in ['wood','oak','walnut']):
   tint=[.42,.30,.21,1] if 'walnut' in f else [.48,.42,.36,1] if 'smoked' in f else [1,1,1,1]
   for m in g.get('materials',[]):
    if m.get('name','').startswith('Supplier finish'):m['pbrMetallicRoughness']['baseColorFactor']=tint
  raw=json.dumps(g,separators=(',',':')).encode();raw+=b' '*((-len(raw))%4);tail=data[20+size:];path.write_bytes(struct.pack('<4sII',b'glTF',2,20+len(raw)+len(tail))+struct.pack('<II',len(raw),kind)+raw+tail)
  p['status']='model_ready';p['model_url']=r['model_url'];p['geometry_validation']=r
 if p['status']=='model_ready':
  assert (REPO/'storefront/public'/p['model_url'].lstrip('/')).is_file()
  ready.append({k:p.get(k) for k in ['id','brand','supplier_sku','title','source_url','source_checked','finish','construction','family','dimensions_mm','model_url','legacy_variant_sku','supplier_image_url','model_spec','review_status','publication_approved','review_findings']})
catalog['counts']={b:dict(collections.Counter(p['status'] for p in catalog['products'] if p['brand']==b)) for b in ['OPPEIN','Blue Valley','Macan']}
(ROOT/'inventory.json').write_text(json.dumps(catalog,indent=2))
(REPO/'backend/src/scripts/data/cabinet-inventory.json').write_text(json.dumps({'snapshot_date':catalog['snapshot_date'],'products':ready},indent=2))
fields=['id','brand','supplier_sku','title','finish','construction','status','width_mm','height_mm','depth_mm','model_url','source_url','review_reasons']
with (ROOT/'inventory.csv').open('w',newline='') as f:
 w=csv.DictWriter(f,fieldnames=fields,lineterminator="\n");w.writeheader()
 for p in catalog['products']:
  row={k:p.get(k) for k in fields};d=p['dimensions_mm'] or {};row.update(width_mm=d.get('w'),height_mm=d.get('h'),depth_mm=d.get('d'),review_reasons='; '.join(p['review_reasons']));w.writerow(row)
print(json.dumps(catalog['counts'],indent=2))
