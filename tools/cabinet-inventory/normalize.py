import json,re,html,hashlib,collections
from pathlib import Path
from fractions import Fraction
ROOT=Path(__file__).resolve().parent;REPO=ROOT.parent.parent
FRACTIONS={'½':' 1/2','¼':' 1/4','¾':' 3/4','⅛':' 1/8','⅜':' 3/8','⅝':' 5/8','⅞':' 7/8'}
NUM=r'(?:\d+\s+)?\d+/\d+|\d+(?:\.\d+)?'
def text(s):
 s=html.unescape(re.sub('<[^>]+>',' ',s or ''))
 for a,b in FRACTIONS.items():s=s.replace(a,b)
 return re.sub(r'\s+',' ',s).replace('″','"').replace('”','"').replace('⁄','/').strip()
def number(s):return float(sum(Fraction(n) for n in s.replace('-',' ').split()))
def dims_labeled(s):
 s=text(s);d={};conflict=False
 for n,a in re.findall('('+NUM+r')\s*"\s*([WHD])\b',s,re.I):
  v=round(number(n)*25.4,4);a=a.lower()
  if a in d and d[a]!=v:conflict=True
  d[a]=v
 return d,conflict
FINISH={'WSS':'White Single Shaker','BSS':'Blue Single Shaker','GSS':'Gray Single Shaker','SSW':'White Slim Shaker','MNW':'Natural Wood','MSO':'Smoked Oak','PGW':'White High Gloss'}
def model_kind(code,title):
 if re.fullmatch(r'[23]DB\d+',code):return ('base','drawers'+code[0])
 if re.fullmatch(r'B\d+|BTC\d+|SB\d+|B\d+FH|BSR\d+',code):return ('base','sink' if code.startswith('SB') else 'full' if code.endswith('FH') or code.startswith('BSR') else 'base')
 if re.fullmatch(r'W\d+|WSL\d+|WBF\d+',code):return ('wall','bifold' if code.startswith('WBF') else 'lift' if code.startswith('WSL') else 'doors')
 if re.fullmatch(r'PC\d+',code):return ('pantry','pantry')
 return ('accessory' if not any(x in title.lower() for x in ['cabinet','pantry','closet']) else 'specialty',None)
def base_record(brand,id,sku,title,url):
 return {'id':id,'brand':brand,'supplier_sku':sku or None,'title':text(title),'source_url':url,'source_checked':'2026-09-10','inventory_quantity':None,'pricing_mode':'quote_only','model_url':None,'dimensions_mm':None,'status':'specification_review','review_reasons':[]}
def oppein():
 source=json.loads((ROOT/'oppein-source.json').read_text());old={p['sku']:p for p in json.loads((REPO/'storefront/public/cabinet-library/catalog.json').read_text())['products']};rows=[]
 for item in source:
  p=item.get('product')
  if not p:continue
  sku=p['sku'];parts=sku.split('-');finish=FINISH.get(parts[1] if parts[0] in ['PB','PLY'] and len(parts)>2 else parts[0]);code='-'.join(parts[2:]) if parts[0] in ['PB','PLY'] else '-'.join(parts[1:]);family,kind=model_kind(code,p['name']);d,conflict=dims_labeled(p.get('description',''))
  r=base_record('OPPEIN','oppein-'+sku.lower(),sku,p['name'],item['url']);r.update({'finish':finish,'construction':'Plywood' if sku.startswith('PLY-') else 'Particle board' if sku.startswith('PB-') else None,'family':family,'dimensions_mm':d or None,'dimension_evidence':p.get('description',''),'source_sha256':item['source_sha256'],'supplier_image_url':p.get('image'),'supplier_price_reference':p.get('offers'),'supplier_availability':None})
  if len(d)!=3 or conflict:r['review_reasons'].append('Missing or conflicting explicitly labelled W/H/D')
  if not finish:r['review_reasons'].append('Finish/profile needs verification')
  if not kind or parts[0] not in ['PB','PLY']:r['review_reasons'].append('Detailed profile/footprint or accessory specification needed for modeling')
  if not r['review_reasons']:
   r['status']='ready_for_model';r['model_spec']={'kind':kind,'family':family,'front_style':'slim_shaker' if 'Slim' in finish else 'shaker' if 'Shaker' in finish else 'slab','finish':finish,'construction':r['construction'],'dimensions_mm':d,'legs_mm':114.3 if family in ['base','pantry'] else 0,'toe_mm':0,'frame':False,'code':code}
   if sku in old:r['model_url']='/cabinet-library/'+old[sku]['model_url'];r['status']='model_ready';r['legacy_handle']='oppein-'+sku.lower();r['legacy_variant_sku']=sku
  rows.append(r)
 counts=collections.Counter(r["id"] for r in rows)
 for r in rows:
  if counts[r["id"]]>1:
   r["id"]+="-source-"+r["source_url"].rsplit("-",1)[-1]
   r["review_reasons"].append("Supplier SKU is duplicated across distinct source product pages")
   r["status"]="specification_review";r["model_url"]=None
 return rows
# Explicit manufacturer descriptions reviewed by product ID. Not derived from SKU digits or shipping dimensions.
RULES={
1140:(24,34.5,'base','base',[9,12,15,18,21]),1301:(24,34.5,'base','full',[9,12,15,18,21]),1347:(24,34.5,'base','full',[24,27,30,33,36]),
1473:(12,36,'wall','doors',list(range(9,37,3))),2173:(24,34.5,'base','drawers3',list(range(12,37,3))),2141:(24,34.5,'base','drawers2',list(range(12,37,3))),
2284:(24,34.5,'base','full',[30,33,36,39]),2398:(24,34.5,'base','full',[18]),2370:(24,34.5,'base','full',[9,12]),
3096:(12,24,'wall','doors',[30,36]),3063:(24,None,'wall','doors',[30,36]),3033:(12,None,'wall','lift',[30,36]),
1813:(21,34.5,'base','sink',[24,27,30,33,36]),1790:(21,34.5,'base','full',[12,15,18,21]),
2069:(24,84,'pantry','pantry',[24,30,36]),2087:(24,90,'pantry','pantry',[24,30,36]),2049:(24,90,'pantry','pantry',[15,18]),2059:(24,96,'pantry','pantry',[15,18]),
3970:(.75,96,'panel','panel',[3,6])}
CONFLICTS={1372:'Title says 30-inch wall cabinet but description says 34.5-inch height / 24-inch depth',1348:'Title says 42-inch wall cabinet but description says 34.5-inch height / 24-inch depth',1236:'Title says double doors; description says one door and lists incompatible widths',2105:'Title and dimension table say 96-inch height; short description says 90-inch',2035:'84-inch product page includes 90-inch size rows',2588:'Two drawers specified but described drawer heights sum to more than overall cabinet height',2994:'Description repeatedly says 12-inch height while variants include 15,18,21-inch heights'}
def blue():
 parents={p['id']:p for p in json.loads((ROOT/'blue-products-source.json').read_text())};variants=json.loads((ROOT/'blue-variations-source.json').read_text());rows=[]
 for p in [x for x in parents.values() if x['type']!='variable']+variants:
  parent=parents.get(p.get('parent'),p);pid=parent['id'];v=text(p.get('variation',''));desc=text(parent.get('short_description','')+' '+parent.get('description',''));finishMatch=re.search(r'Color:\s*([^,]+)',v);finish=finishMatch.group(1).strip() if finishMatch else None
  r=base_record('Blue Valley','bvc-'+str(p['id']),text(p.get('sku','')),parent['name'],p['permalink']);r.update({'source_product_id':p['id'],'source_parent_id':pid,'finish':finish,'construction':None,'family':'unclassified','variant_attributes':v,'dimension_evidence':desc,'supplier_image_url':p.get('images',[{}])[0].get('src') if p.get('images') else None,'supplier_price_reference':p['prices'],'supplier_availability':{'is_in_stock':p.get('is_in_stock'),'is_on_backorder':p.get('is_on_backorder')},'source_api_dimensions':p.get('dimensions'),'source_api_formatted_dimensions':p.get('formatted_dimensions')})
  if pid in CONFLICTS:r['review_reasons'].append(CONFLICTS[pid])
  rule=RULES.get(pid)
  if rule:
   depth,height,family,kind,widths=rule
   def axis(label):
    m=re.search(label+r':\s*('+NUM+r')\s*"',v,re.I);return number(m.group(1)) if m else None
   width=axis('Width');vh=axis('Height');height=height if height is not None else vh
   if width not in widths:r['review_reasons'].append('Selected width missing or outside explicitly documented range')
   if height is None or (pid in [3063,3033] and height not in [12,15,18,21]):r['review_reasons'].append('Selected height lacks a verified dimensional specification')
   r['family']=family
   if width and height:r['dimensions_mm']={'w':round(width*25.4,4),'h':round(height*25.4,4),'d':round(depth*25.4,4)}
   if not finish:r['review_reasons'].append('Variant finish not specified')
   if not r['review_reasons']:
    r['status']='ready_for_model';r['model_spec']={'kind':kind,'family':family,'front_style':'shaker' if 'shaker' in finish.lower() else 'slab','finish':finish,'construction':None,'dimensions_mm':r['dimensions_mm'],'legs_mm':0,'toe_mm':114.3 if family in ['base','pantry'] else 0,'frame':False,'code':None}
  else:r['review_reasons'].append('Assembled W/H/D and configuration require further verification; shipping units are not used as cabinet measurements')
  rows.append(r)
 return rows

def macan():
 rows=[]
 for p in json.loads((ROOT/'macan-source.json').read_text()):
  label=p['image_url'].split('/')[-1].split('?')[0].rsplit('.',1)[0].replace('-',' ').strip();id='macan-reference-'+hashlib.sha256((p['collection']+p['image_url']).encode()).hexdigest()[:12]
  r=base_record('Macan',id,None,label,p['source_url']);r.update({'collection':p['collection'],'record_type':'collection_reference','finish':{'white-shaker-frame-cabinets':'White Shaker Face Frame','white-shaker-frameless-cabinets':'White Shaker Frameless','grey-shaker-frame-cabinets':'Grey Shaker Face Frame','blue-shaker-frame-cabinets':'Blue Shaker Face Frame','high-gloss-cabinets':'High Gloss White Frameless'}[p['collection']],'family':'unclassified','supplier_image_url':p['image_url'],'source_sha256':p['sha256'],'review_reasons':['Gallery photograph is not a dimensioned sellable SKU; supplier SKU and W/H/D specification required']})
  rows.append(r)
 return rows
if __name__=='__main__':
 rows=oppein()+blue()+macan();counts={b:dict(collections.Counter(r['status'] for r in rows if r['brand']==b)) for b in ['OPPEIN','Blue Valley','Macan']}
 out={'schema_version':2,'snapshot_date':'2026-09-10','inventory_quantity_policy':'Unknown. Public supplier availability is not Reno Stars stock.','pricing_policy':'Quote only; supplier public prices retained as research references, not selling prices.','counts':counts,'products':rows}
 (ROOT/'inventory.json').write_text(json.dumps(out,indent=2));print(json.dumps(counts,indent=2));print('total',len(rows))
