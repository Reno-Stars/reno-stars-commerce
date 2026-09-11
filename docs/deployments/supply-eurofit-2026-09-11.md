# Eurofit Supply import — 2026-09-11

## Scope and review

- Collection: https://eurofitcanada.com/collections/handle-knobs
- 147 families / 781 normalized option groups, including one display board.
- Prepared: 407 models (370 handles, 37 knobs), spanning 89 families.
- Held: 374 option groups, including 15 whose sole blocker is detailed profile modeling. Full reasons in `tools/eurofit-hardware/held-items.csv`.
- Published dimensions determine external envelopes and mounting centres. Small profile
  details, finish appearance and internal thread geometry are not manufacturer CAD.
- First photograph for every family and catalogue drawing contact sheets were reviewed.
  This does not claim individual manual review of all secondary/finish photographs.

## Code / deployment

- Commerce PR10: main `41da9ec3054193e603124c2cc90d7aa68cd696fe`.
- Follow-up PR11: main `db6365d27d164595fa5b3f9010e7b0059803b426` (SKU-specific titles).
- CI708570: frontend and backend succeeded for db6365d27d16.
- Build708569: succeeded.
- Infra PR227 deployed both images. PR226 added the one-time import Job; both merged after CI/build success.
- Import completed at 22:53:32 UTC: 407 unique products, exact manifest match; rerun found 407 existing and zero pending.
- Live API verified every SKU/model hash. All category routes, last-page counts, and handle/knob native viewers passed. See evidence JSON files.
- PR12 (`9aa452f112c0bd85f48e50b62b31b9fcdea4240c`) removes internal metadata from customer specifications; deployed through infra PR229, commit `0ca9e0488af877e631bb8eff978568740af1865e`, applied 23:14:13 UTC. Both live handle and knob specifications passed at 23:14:51 UTC.

## Checks

- Independently loaded every GLB in Three.js, checked mesh bounds, mounting plane and anchors.
  Maximum envelope error: 0.0957 mm; source units converted to metres.
- Native Next.js product component: cabinet regression, both hardware fixtures, scene and
  lighting controls, preference persistence, PNG download, missing-model handling and mobile
  layout passed without browser errors.
- Importer mock: all 407 quote-only published records, four-category hierarchy, exact rerun;
  corrupt asset aborts before any catalog writes.
- Backend TypeScript passed. Standalone storefront TypeScript reports existing unrelated
  cart/icon errors; production CI build and changed viewer compilation passed.

## Publication contract

Cabinet Hardware → Eurofit → Handles / Knobs. Default Sales Channel. No invented selling
prices or stock quantities. Import verifies SHA-256 of deployed assets before creating
products. Completed Job is retained without TTL to prevent CD recreating it. Never edit its
pod template after it has been applied.
