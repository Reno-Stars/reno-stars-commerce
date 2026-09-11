"""Normalize supplier options; retain quantity tiers as evidence, never as duplicate models."""
import json,re,collections
from pathlib import Path
from bs4 import BeautifulSoup
ROOT=Path(__file__).resolve().parent
source=json.loads((ROOT/'source/products-page-1.json').read_text())['products']
def clean(s):return re.sub(r'\s+',' ',s or '').strip()
def mm(s):return [float(v) for v in re.findall(r'(\d+(?:\.\d+)?)\s*mm\b',s,re.I)]
def slug(s):return re.sub(r'[^a-z0-9]+','-',s.lower()).strip('-')
rows=[]
for index,p in enumerate(source):
 spec={}
 for tr in BeautifulSoup(p['body_html'],'html.parser').select('tr'):
  td=tr.select('td')
  if len(td)>1:spec[clean(td[0].get_text(' ',strip=True))]=clean(td[1].get_text(' ',strip=True))
 def field(*terms):return next((v for k,v in spec.items() if any(t in k.lower() for t in terms)),'')
 cc=mm(field('center to center','available sizes'));lengths=mm(field('overall length'));heights=mm(field('height'));widths=mm(field('internal width','width:'))
 # The website uses a diameter marker for some non-round handles too. Preserve
 # the label; geometric interpretation is a separate reviewed decision.
 grouped=collections.defaultdict(list)
 for v in p['variants']:
  options={o['name']:v.get('option'+str(o['position'])) for o in p['options'] if o['name'].lower()!='quantity'}
  grouped[tuple(options.items())].append(v)
 for option_tuple,variants in grouped.items():
  options=dict(option_tuple);skus=sorted(set(clean(v['sku']) for v in variants if clean(v['sku'])));issues=[]
  if len(skus)!=1:issues.append('MISSING_OR_CONFLICTING_SUPPLIER_SKU')
  sku=skus[0] if len(skus)==1 else ''
  size=next((v for k,v in options.items() if k.lower()=='size'),'');ns=mm(size);selected=ns[0] if len(ns)==1 else None
  finish=next((v for k,v in options.items() if k.lower() in ['finish','finishing','color']),'')
  if not finish:finish=field('finish')
  if ',' in finish:issues.append('AMBIGUOUS_FINISH')
  spacing=None;L=None
  if p['product_type']=='Knob':
   if len(lengths)==1:L=lengths[0]
  elif len(cc)==len(lengths) and len(cc)>0:
   spacing=selected if selected in cc else cc[0] if len(cc)==1 and selected is None else None
   if spacing is not None:L=lengths[cc.index(spacing)]
  if not L:issues.append('MISSING_OR_UNMAPPED_OVERALL_LENGTH')
  H=heights[0] if len(heights)==1 else None
  W=widths[0] if len(widths)==1 else None
  if not W and p['product_type']=='Knob' and ('ø' in field('overall length').lower() or 'round' in field('shape').lower()):W=L
  if not H:issues.append('MISSING_PROJECTION')
  if not W:issues.append('MISSING_WIDTH')
  if p['product_type']!='Knob' and spacing is None:issues.append('MISSING_OR_UNMAPPED_MOUNTING_SPACING')
  if L and spacing and spacing>=L:issues.append('MOUNTING_SPACING_NOT_INSIDE_ENVELOPE')
  if p['title']=='Handle Board':issues.append('DISPLAY_BOARD_NOT_INDIVIDUAL_HARDWARE')
  image=next((v['featured_image']['src'] for v in variants if v.get('featured_image')),p['images'][0]['src'] if p['images'] else None)
  rows.append({'id':'eurofit-'+slug(sku or str(p['id'])+'-'+str(option_tuple)),'supplier_sku':sku,'family_index':index,'family_title':p['title'],'source_product_id':p['id'],'source_url':'https://eurofitcanada.com/products/'+p['handle'],'source_variant_ids':[v['id'] for v in variants],'type':'Appliance Handles' if 'Appliance' in p['title'] else 'Knobs' if p['product_type']=='Knob' else 'Handles','finish':finish,'selected_size':size,'specifications':spec,'dimensions_mm':{'length':L,'width':W,'projection':H},'mounting_centres_mm':spacing,'supplier_image_url':image,'source_options':options,'quantity_tiers':[{'label':v['title'],'supplier_price':v['price'],'available':v['available']} for v in variants],'issues':issues,'review_status':'hold_source_dimensions' if issues else 'awaiting_drawing_review','model_status':'not_built'})
ids=collections.Counter(r['id'] for r in rows)
for r in rows:
 if ids[r['id']]>1:r['issues'].append('SKU_REUSED_FOR_DIFFERENT_OPTIONS');r['review_status']='hold_source_dimensions'
catalog={'source':'https://eurofitcanada.com/collections/handle-knobs','source_checked':'2026-09-11','family_count':len(source),'raw_variant_count':sum(len(p['variants']) for p in source),'products':rows}
(ROOT/'inventory.json').write_text(json.dumps(catalog,indent=2)+'\n')
print(json.dumps({'physical_variants':len(rows),'statuses':dict(collections.Counter(r['review_status'] for r in rows)),'issues':dict(collections.Counter(x for r in rows for x in r['issues']))},indent=2))
