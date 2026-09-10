import re,json,concurrent.futures,urllib.request,urllib.parse,hashlib
from collect import fetch,Links,ROOT,RAW,HEAD
slugs=['white-shaker-frame-cabinets','white-shaker-frameless-cabinets','grey-shaker-frame-cabinets','blue-shaker-frame-cabinets','high-gloss-cabinets']
allrows=[]
for slug in slugs:
 url='https://macancabinets.com/'+slug+'/';s=fetch(url);m=re.search(r'items_county_0=(\d+)',s);pages=int(m.group(1)) if m else 1
 def page(n):
  p=Links();p.feed(fetch(url+('?page_number_0='+str(n) if n>1 else '')));return list(dict.fromkeys(p.gallery))
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:images=list(dict.fromkeys(x for group in pool.map(page,range(1,pages+1)) for x in group))
 for image in images:allrows.append({'collection':slug,'source_url':url,'image_url':image,'file':hashlib.sha256(image.encode()).hexdigest()+'.jpg'})
 print('MACAN',slug,pages,len(images),flush=True)
(RAW/'macan-images').mkdir(exist_ok=True)
def download(row):
 p=RAW/'macan-images'/row['file']
 if not p.exists():
  u=urllib.parse.urlsplit(row['image_url']);u=urllib.parse.urlunsplit((u.scheme,u.netloc,urllib.parse.quote(urllib.parse.unquote(u.path)),u.query,''))
  with urllib.request.urlopen(urllib.request.Request(u,headers=HEAD),timeout=30) as r:p.write_bytes(r.read())
 row['sha256']=hashlib.sha256(p.read_bytes()).hexdigest();return row
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 rows=list(pool.map(download,allrows))
(ROOT/'macan-source.json').write_text(json.dumps(rows,indent=2));print('MACAN COMPLETE',len(rows),flush=True)
