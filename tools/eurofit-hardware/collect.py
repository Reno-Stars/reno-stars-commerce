import json,re,hashlib,concurrent.futures
from pathlib import Path
import requests
from bs4 import BeautifulSoup
from PIL import Image,ImageOps,ImageDraw
ROOT=Path(__file__).resolve().parent
p=json.loads((ROOT/'source/products-page-1.json').read_text())['products']
assert not json.loads((ROOT/'source/products-page-2.json').read_text())['products']
imgs=ROOT/'source/images';imgs.mkdir(exist_ok=True)
records=[];jobs=[]
for i,x in enumerate(p):
 soup=BeautifulSoup(x['body_html'],'html.parser');spec={}
 for tr in soup.select('tr'):
  cells=tr.select('td')
  if len(cells)>=2:spec[cells[0].get_text(' ',strip=True)]=cells[1].get_text(' ',strip=True)
 r={'index':i,'id':x['id'],'title':x['title'],'handle':x['handle'],'type':x['product_type'],'spec':spec,'images':[]}
 for j,im in enumerate(x['images']):
  f=imgs/f'{i:03d}-{j:02d}.jpg';r['images'].append({'url':im['src'],'file':str(f.relative_to(ROOT)),'width':im['width'],'height':im['height']});jobs.append((im['src'],f))
 records.append(r)
def get(job):
 url,f=job
 if f.exists():return
 for attempt in range(3):
  try:
   res=requests.get(url,timeout=35);res.raise_for_status();from io import BytesIO
   im=Image.open(BytesIO(res.content)).convert('RGB');im.thumbnail((1400,1400));im.save(f,quality=92);return
  except Exception:
   if attempt==2:raise
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
 for _ in pool.map(get,jobs):pass
(ROOT/'source/families.json').write_text(json.dumps(records,indent=2))
for start in range(0,len(records),24):
 sheet=Image.new('RGB',(1600,1500),'#ffffff');d=ImageDraw.Draw(sheet)
 for n,r in enumerate(records[start:start+24]):
  x=(n%4)*400;y=(n//4)*250
  if r['images']:
   im=Image.open(ROOT/r['images'][0]['file']);im.thumbnail((375,200));sheet.paste(im,(x+(400-im.width)//2,y))
  d.text((x+8,y+206),f"{r['index']:03d} {r['title'][:45]}",fill='black')
 sheet.save(ROOT/f'source/contact-{start:03d}.jpg')
print(json.dumps({'families':len(records),'source_images':len(jobs),'distinct_skus':len(set(v['sku'] for x in p for v in x['variants']))}))
