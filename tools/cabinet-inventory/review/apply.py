"""Attach audit findings; never promote a generated model to publication approval."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];REPO=ROOT.parent.parent
review=json.loads((ROOT/'review/audit.json').read_text());rows={p['id']:p for p in review['products']}
for path in [ROOT/'inventory.json',REPO/'backend/src/scripts/data/cabinet-inventory.json']:
 data=json.loads(path.read_text())
 for p in data['products']:
  r=rows[p['id']];p['review_status']=r['review_status'];p['publication_approved']=False;p['review_findings']=[f['code'] for f in r['findings']]
 data['review_summary']=review['summary'];path.write_text(json.dumps(data,indent=2))
