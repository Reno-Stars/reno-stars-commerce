# Cabinet inventory review — 2026-09-10

**The library is a draft and is not ready for customer publication.** The earlier statement that 1,734 models were “ready” described generated assets and passing envelope checks, not comprehensive product approval. This review supersedes that description.

## Coverage and method

- Audited all 3,171 snapshot records: 2,030 OPPEIN pages, 1,036 Blue Valley product/variant records and 105 Macan photo references.
- Independently decoded all 1,734 GLBs, traversed their scene transforms, and measured actual serialized mesh vertices. All external envelopes match the staging dimensions within 0.1 mm. This validates export scale, not the correctness of the supplier specification.
- Rendered and visually inspected 210 representative configuration/size groups, covering all model-bearing records. Each comparison includes supplier imagery and the model. Of the 210 representative source images, 126 contain product imagery and 84 are placeholders. These are **representative inspections, not 1,734 individual photo approvals**. Inspection decisions are bound to source/model hashes in `visual-decisions.json`.
- Examined every distinct modeled title/dimension combination and reviewed the Blue Valley parent specifications used by the size rules. Retained existing specification holds for the other record families. The review uses the checked-in September 10 source snapshot, plus supplier-image retrieval during review; it is not a new crawl of every live page.
- No source dimension was silently replaced with a guessed SKU-derived value. Finish samples, door-front schedules, hardware dimensions and manufacturing tolerances are not independently established by this evidence.

## Disposition

| Result | Records |
| --- | ---: |
| Modeled records requiring correction or source clarification | 1,066 |
| Modeled records with visual limitations but no additional flagged conflict | 668 |
| Records already held for specifications / missing model geometry | 1,437 |
| Approved for customer publication | **0** |

The 668 remaining draft models are not certified matches: generic finishes, unverified internal details and/or absent comparison imagery still limit them. Issue counts below overlap.

## Material findings

| Finding | Affected modeled records | Required action |
| --- | ---: | --- |
| OPPEIN SKU/description width conflict | 24 | Resolve against dimensioned supplier drawings. W1236 is described as 21 inches wide; ten W3036 records are described as 33 inches wide. Do not assume the SKU or text is correct. |
| Cabinet box finish differs from inspected OPPEIN product illustrations | 841 | Separate white carcass materials from coloured/wood fronts; verify exposed end-panel options per product. This is a family-derived finding, not individual finish approval. |
| Pantry door split/layout unverified or inconsistent | 166 | Replace generic front splits and shelf positions using supplier schedules; inspect regenerated models. |
| Specialty insert missing | 63 | Replace ordinary shelves with the correct spice pull-out/trash mechanism, or explicitly restrict the asset to an envelope-only model. |
| Blue Valley sink-base shelf interference | 12 | Remove ordinary interior shelf and check sink/plumbing clearance. |
| Blue Valley variant depth ambiguity | 72 | Resolve variant SKUs containing `21` against parent descriptions specifying 24-inch depth; do not decode these as dimensions without confirmation. |
| Blue Valley dimension-table SKU height conflict | 20 | Resolve 90/96-inch listings whose table codes end in 84/90. |
| Source title/configuration conflicts | 4 | Resolve microwave/spice identity, one-vs-two base doors, full-vs-split pantry doors, and a shallow “fridge” cabinet. |
| Tall units mislabelled “Wall Short Cabinet” | 4 | Confirm and correct the supplier-derived product title. |
| Slim-shaker listing uses WSS-labelled artwork | 1 | Obtain the correct SSW reference before approving its profile. |
| Representative source image is a placeholder | 805 | Obtain usable product imagery; this count refers to group members, not individually downloaded variant pictures. |
| Generic finish approximation | 1,734 | Confirm actual finish references before describing the appearance as an exact supplier match. |
| Generic wood texture/grain approximation | 502 | Replace or approve grain, tint and orientation against finish samples. |

Macan remains a reference-only collection: no SKU-level dimensions were established by its public galleries and assembly instructions. Its 105 photographs must not be imported as 105 sellable products.

## Changes made during review

- Added row-level findings and explicit `publication_approved: false` to both the inventory and Medusa staging data.
- Changed **both** cabinet importers to create Medusa drafts. The multi-supplier importer rejects missing review dispositions. Neither importer publishes these models automatically.
- Added review filters, per-model findings, source/render comparisons, and a searchable full review report to the local HTML preview.
- Preserved GLBs for diagnosis. **This review has not corrected their geometry/materials.** The outstanding correction queue is the row-level CSV; do not confuse flagging a defect with fixing it.

## Evidence and reproduction

- `audit.csv`: all records, disposition and concrete findings.
- `audit.json`: per-record findings and independently measured GLB bounds.
- `groups.json`, `image-evidence.json`, `visual-decisions.json`: source/model linkage and representative inspection log.
- Local visual comparisons: `~/Documents/Cabinet-Inventory/preview/review/sheet-1.png` through `sheet-14.png`, with individual source/render images alongside.
- Open `http://localhost:8772/review/` while the local preview server is running.

After changing any model or source, regenerate comparisons and inspect affected groups before updating `visual-decisions.json`; `audit.py` rejects stale representative model hashes. Run:

```sh
python3 tools/cabinet-inventory/review/audit.py
python3 tools/cabinet-inventory/review/apply.py
python3 tools/cabinet-inventory/review/update_preview.py
node --test scripts/tests/cabinet-library.cjs scripts/tests/cabinet-inventory.cjs
```

Audit requires NumPy. The importer remains read-only unless `CABINET_APPLY=1`; apply now creates drafts only. Nothing was changed in the production database.
