"""Apply explicit source-review findings; never resolve conflicting dimensions silently."""
import json, collections
from pathlib import Path
R=Path(__file__).resolve().parent
p=json.loads((R/'inventory.json').read_text())
# Compared to the photographed orthographic drawings in Eurofit's catalogue.
# Values are (maximum transverse width, projection), millimetres. A conflict
# holds the whole family, including options not individually drawn.
drawings={0:(8,30),1:(15,25),3:(8,27),4:(19,21),5:(14,37),7:(12,26),8:(14,27),9:(13,27),11:(14,28),12:(28,29),14:(12,30),17:(28,29),18:(20,33),19:(20,30),20:(14,17),21:(48,30),23:(38,12),25:(14,26),28:(24,33),33:(16,28),35:(12,35),37:(37,20),39:(18,30),40:(30,16),41:(10,32),42:(20,31),44:(14,34),45:(14,40),46:(19,23),49:(40,18),50:(12,33),51:(18,33),52:(11,30),53:(12,34),54:(18,25),55:(20,28),56:(12,27),57:(14,37),60:(14,31),61:(14,35),62:(21,25),63:(16,28),64:(14,31),66:(10,34),70:(17,35),74:(19,27),75:(7,34),76:(12,25),77:(21,25),79:(8,27),81:(18,31),83:(8,33),84:(10,30),85:(7,30),87:(22,32),88:(12,27),90:(12,31),91:(6,30),92:(9,28),103:(20,30),104:(10,32),105:(8,30),106:(20,30),107:(17,28),108:(11,26),109:(15,30),111:(8,25),112:(11,32),117:(32,22),119:(32,25),120:(32,22),122:(31,24),123:(31,24),124:(31,24),125:(31,24),126:(30,23),127:(32,24),128:(25,8),129:(23,18),130:(59,20),132:(40,25),134:(33,26),135:(29,30),137:(24,28),138:(20,27),140:(25,29),141:(34,32),142:(32,30),143:(33,33),144:(31,29),145:(22,23),146:(20,45)}
length_conflicts={133:'Catalogue overall length 38 mm; website 28 mm.',136:'Catalogue overall length 37 mm; website 35 mm.',139:'Catalogue diameter 32 mm; website 27 mm.'}
# Recessed/tab hardware needs a verified mounting section; existing field names
# are not enough to orient its installation envelope accurately.
mounting_review={15,16,23,49,93,113,114}
# Profiles with sculpted ornament or crystal inserts require a more faithful
# asset than the parametric profiles implemented here. Retain their records.
complex_profiles={12,94,95,96,97,98,118,123,124,125,130}
for r in p['products']:
 i=r['family_index']; findings=[]
 if i in drawings:
  w,h=drawings[i];r['catalogue_section_mm']={'width':w,'projection':h}
  if r['dimensions_mm']['width']!=w or r['dimensions_mm']['projection']!=h:
   r['issues'].append('CATALOGUE_WEBSITE_DIMENSION_CONFLICT');findings.append(f'Catalogue section {w} mm wide × {h} mm projection differs from website fields. Supplier clarification required.')
  else:findings.append('Website width and projection agree with reviewed catalogue section. Overall length and C-C use the selected website option mapping.')
 else:findings.append('Dimensions transcribed from the supplier product table; no independent matching section confirmed.')
 if i in length_conflicts:r['issues'].append('CATALOGUE_WEBSITE_DIMENSION_CONFLICT');findings.append(length_conflicts[i])
 if i in mounting_review:r['issues'].append('INSTALLATION_SECTION_REVIEW_REQUIRED')
 if i in complex_profiles:r['issues'].append('DETAILED_PROFILE_REQUIRED')
 r['issues']=sorted(set(r['issues']))
 r['review_status']='held' if r['issues'] else 'dimensions_published'
 r['review_findings']=findings
 r['source_checked']='2026-09-11'
 r['dimension_basis']='supplier_product_table_mm'
 r['model_limitations']='External envelope and mounting centres use published dimensions. Unspecified grip sections, edge radii, internal threads and finish appearance are visual approximations; not a fabrication drawing.'
p['review_summary']={'eligible':sum(r['review_status']=='dimensions_published' for r in p['products']),'held':sum(r['review_status']=='held' for r in p['products']),'issues':dict(collections.Counter(v for r in p['products'] for v in r['issues']))}
(R/'inventory.json').write_text(json.dumps(p,indent=2)+'\n')
print(json.dumps(p['review_summary'],indent=2))
