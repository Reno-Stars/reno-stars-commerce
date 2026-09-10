import json,hashlib,concurrent.futures,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=Path.home()/'Documents/Cabinet-Inventory/preview/review';OUT.mkdir(exist_ok=True)
rows=json.loads((ROOT/'inventory.json').read_text())['products'];groups={}
for p in rows:
 if p['status']!='model_ready':continue
 s=p['model_spec'];key=json.dumps([p['brand'],s['code'] or p.get('source_parent_id'),p['title'],p['dimensions_mm']],sort_keys=True)
 if key not in groups:groups[key]={'group':len(groups)+1,'representative':p,'ids':[]}
 groups[key]['ids'].append(p['id'])
g=list(groups.values());(ROOT/'review/groups.json').write_text(json.dumps(g,indent=2));(OUT/'groups.json').write_text(json.dumps(g))
def get(a):
 p=a['representative'];url=p['supplier_image_url'];path=OUT/(str(a['group'])+'-source.jpg')
 try:
  if not path.exists():
   with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=30) as r:path.write_bytes(r.read())
  return {'group':a['group'],'url':url,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
 except Exception as e:return {'group':a['group'],'error':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:res=list(pool.map(get,g))
(ROOT/'review/image-evidence.json').write_text(json.dumps(res,indent=2));print('groups',len(g),'image failures',sum('error' in r for r in res))
