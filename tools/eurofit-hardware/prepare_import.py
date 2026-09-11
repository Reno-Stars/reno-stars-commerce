import json,csv,hashlib
from pathlib import Path
R=Path(__file__).resolve().parent;repo=R.parent.parent
p=json.loads((R/'inventory.json').read_text());rows=[]
for r in p['products']:
 if r['model_status']!='built':continue
 file=repo/'storefront/public'/r['model_url'].lstrip('/')
 rows.append({k:r[k] for k in ['id','supplier_sku','family_title','family_index','source_url','source_checked','finish','type','dimensions_mm','mounting_centres_mm','supplier_image_url','model_url','model_limitations','model_profile','review_status','review_findings','source_variant_ids']})
 rows[-1]['sha256']=hashlib.sha256(file.read_bytes()).hexdigest()
 rows[-1]['bytes']=file.stat().st_size
out={'supplier':'Eurofit Canada','source_collection':p['source'],'checked':p['source_checked'],'source_families':p['family_count'],'physical_options':len(p['products']),'held_count':len(p['products'])-len(rows),'products':rows}
dest=repo/'backend/src/scripts/data/eurofit-hardware.json';dest.write_text(json.dumps(out,indent=2)+'\n')
with (R/'held-items.csv').open('w') as f:
 w=csv.writer(f,lineterminator="\n");w.writerow(['SKU','Product','Finish','Source','Reasons'])
 for r in p['products']:
  if r['model_status']!='built':w.writerow([r['supplier_sku'],r['family_title'],r['finish'],r['source_url'],'; '.join(r['issues'])])
print('Prepared',len(rows),'models')
