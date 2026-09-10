import re,json,hashlib,time,urllib.request,concurrent.futures,html
from pathlib import Path
from html.parser import HTMLParser
ROOT=Path(__file__).resolve().parent;RAW=ROOT/'raw';RAW.mkdir(exist_ok=True)
HEAD={'User-Agent':'Mozilla/5.0 (compatible; product-catalog-research)'}
def fetch(url):
 key=hashlib.sha256(url.encode()).hexdigest();p=RAW/(key+'.html')
 if p.exists():return p.read_text()
 for attempt in range(3):
  try:
   with urllib.request.urlopen(urllib.request.Request(url,headers=HEAD),timeout=35) as r:s=r.read().decode('utf8');headers=dict(r.headers)
   p.write_text(s);(RAW/(key+'.source.json')).write_text(json.dumps({'url':url,'retrieved_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'sha256':hashlib.sha256(s.encode()).hexdigest(),'headers':{k:v for k,v in headers.items() if k.lower() in ['content-type','x-wp-total','x-wp-totalpages']}},indent=2));return s
  except Exception:
   if attempt==2:raise
   time.sleep(1+attempt)
def clean(s):return re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]+>',' ',s))).strip()
def structured(s):
 out=[]
 for x in re.findall(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>',s,re.S):
  try:
   d=json.loads(x);out.extend(d if isinstance(d,list) else d.get('@graph',[d]))
  except:pass
 return out
class Links(HTMLParser):
 def __init__(self):super().__init__();self.links=[];self.images=[];self.gallery=[]
 def handle_starttag(self,t,a):
  d=dict(a)
  if t=='a' and d.get('href'):self.links.append(d['href'])
  if t=='a' and 'bwg_lightbox' in d.get('class','') and d.get('href'):self.gallery.append(d['href'])
  if t=='img':self.images.append(d)
def collect_oppein():
 urls=[html.unescape(u) for u in re.findall('<loc>(.*?)</loc>',(RAW/'oppein-sitemap.txt').read_text()) if '/shop/' in u and '/category/' not in u]
 existing=Path('/Users/renostars/Documents/OPPEIN-WSS-Library/catalog/raw')
 def one(url):
  try:
   sku=url.split('/shop/')[-1].upper();old=next((p for p in existing.glob('*.html') if sku.startswith(p.stem+'-')),None)
   s=old.read_text() if old else fetch(url);items=structured(s);product=next((d for d in items if d.get('@type')=='Product'),None)
   return {'url':url,'product':product,'breadcrumb':next((d for d in items if d.get('@type')=='BreadcrumbList'),None),'source_sha256':hashlib.sha256(s.encode()).hexdigest(),'status':'collected' if product else 'no_product_schema'}
  except Exception as e:return {'url':url,'status':'fetch_failed','error':str(e)}
 out=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
  for row in pool.map(one,urls):
   out.append(row)
   if len(out)%25==0:print('OPPEIN',len(out),'/',len(urls),flush=True);(ROOT/'oppein-source.json').write_text(json.dumps(out,indent=2))
 (ROOT/'oppein-source.json').write_text(json.dumps(out,indent=2));print('OPPEIN COMPLETE',len(out),flush=True)
def collect_other():
 blue=json.loads((RAW/'blue-products.txt').read_text())
 urls=[p['permalink'] for p in blue]
 macan=Links();macan.feed((RAW/'macan-home.txt').read_text());urls+=list(dict.fromkeys(u for u in macan.links if u.startswith('https://macancabinets.com/') and any(v in u for v in ['cabinets/','products/','doityourself/'])))
 out=[]
 def one(url):
  try:
   s=fetch(url);p=Links();p.feed(s);return {'url':url,'source_sha256':hashlib.sha256(s.encode()).hexdigest(),'links':p.links,'images':p.images,'structured':structured(s),'status':'collected'}
  except Exception as e:return {'url':url,'status':'fetch_failed','error':str(e)}
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
  for row in pool.map(one,urls):out.append(row);print('OTHER',len(out),row['url'],flush=True)
 (ROOT/'other-source.json').write_text(json.dumps(out,indent=2));print('OTHER COMPLETE',len(out),flush=True)
if __name__=='__main__':
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as p:
  list(p.map(lambda f:f(),[collect_oppein,collect_other]))
