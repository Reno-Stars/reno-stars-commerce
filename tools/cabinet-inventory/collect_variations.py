import json,hashlib,concurrent.futures,math
from collect import fetch,RAW,ROOT
u='https://bluevalleycabinets.ca/wp-json/wc/store/v1/products?type=variation&per_page=100'
first=json.loads(fetch(u));h=json.loads((RAW/(hashlib.sha256(u.encode()).hexdigest()+'.source.json')).read_text())['headers'];pages=int(next(v for k,v in h.items() if k.lower()=='x-wp-totalpages'));print('BLUE variation pages',pages,flush=True)
rows=first
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 for group in pool.map(lambda n:json.loads(fetch(u+'&page='+str(n))),range(2,pages+1)):
  rows+=group;print('BLUE variations',len(rows),flush=True)
(ROOT/'blue-variations-source.json').write_text(json.dumps(rows,indent=2));print('BLUE COMPLETE',len(rows),flush=True)
