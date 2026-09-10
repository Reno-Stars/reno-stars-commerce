# Multi-supplier cabinet inventory

**Review update: these are generated draft assets, not approved products. Corrections were applied to 980 models; 125 modeled records still require source clarification. All 1,734 exports were rechecked and 210 representative groups visually re-inspected. Both importers now create drafts. See [the review report](review/REPORT.md).**

Snapshot: 2026-09-10. This is a public **product catalog**, not warehouse stock. Prepared for the native Medusa product viewer; no standalone HTML catalog is required.

| Supplier | Catalog records | Dimensioned models | Specification review |
| --- | ---: | ---: | ---: |
| OPPEIN | 2,030 product pages | 1,510 | 520 |
| Blue Valley | 1,029 variants + 7 simple products | 224 | 812 |
| Macan | 105 collection photo references | 0 | 105 |

The 1,734 generated models include the original 100 OPPEIN models and 1,634 new GLBs. OPPEIN coverage includes plywood and particle board, white/blue/gray shaker, white slim shaker, natural wood, smoked oak and high gloss. Blue Valley includes white shaker, gloss white, natural oak and dark walnut. Counts describe the public snapshot, not a claim that dealer-only inventory is complete.

## Accuracy and exclusions

Only complete, explicitly published assembled W/H/D qualifies for modeling. Blue Valley's public API shipping dimensions have inconsistent unit labels; these are retained as evidence but never used to scale cabinets. Conflicting descriptions, corners and other products needing footprint/profile drawings stay in review. Two OPPEIN microwave pages reuse the same SKU and are separately identified and held.

Macan publishes five collection galleries and seven assembly PDFs. These explain assembly but do not supply complete SKU-level W/H/D. Gallery photos are reference records, not sellable products. A dimensioned dealer catalog is needed to proceed with Macan models.

Modeled **external envelopes** are checked using evaluated Blender geometry to a 0.1 mm tolerance. Cabinet internals, joinery, door profiles and materials are visualization approximations, not fabrication drawings or exact finish scans. Generic oak texture is tinted for natural/smoked/walnut looks. OPPEIN base/pantry body height excludes the separately modeled 114.3 mm viewing feet. Blue Valley assembled height includes its plinth. No appliance, countertop or handle is supplied merely because a visualization shows one.

## Files

- `inventory.csv`: all records and review reasons, suitable for spreadsheet review.
- `inventory.json`: full source evidence, eligibility and geometry checks.
- `*-source.json`: public source snapshots; raw HTML/PDF/photo cache is ignored.
- `model-results.json`: new model envelope checks.
- `../../backend/src/scripts/data/cabinet-inventory.json`: modeled Medusa draft staging records only.
- `../../storefront/public/cabinet-inventory/models/`: portable metre-scaled GLBs with embedded textures.
- Representative editable Blender files are saved locally under `~/Documents/Cabinet-Inventory/representative-blend/`; all models can be regenerated or imported from GLB.

## Rebuild from checked-in evidence

```sh
python3 tools/cabinet-inventory/normalize.py
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python tools/cabinet-inventory/build_models.py
python3 tools/cabinet-inventory/package.py
node --test scripts/tests/cabinet-inventory.cjs scripts/tests/cabinet-library.cjs
npm run test:native --prefix tools/cabinet-viewer
```

Use the actual local Blender executable when installed elsewhere. `package.py` applies portable wood tints and checks source-spec hashes before attaching models; it is required after generation. The native browser suite checks representative models across all eleven supplier/finish combinations, settings, downloads, mobile, and products with no model.

## Medusa import when the stack returns

Deploy storefront assets first, then from `backend`:

```sh
npx medusa exec ./src/scripts/import-cabinet-inventory.ts
CABINET_APPLY=1 npx medusa exec ./src/scripts/import-cabinet-inventory.ts
```

Default invocation is read-only. Production import skips the 125 modeled records with unresolved source conflicts, leaving 1,609 eligible draft records. Apply preflights all pending model URLs before any catalog writes. Existing product handles are skipped, foreign SKU collisions stop the run, and supplier/finish/construction categories are created as needed. Existing products are not overwritten. The original 100 OPPEIN handles and variant SKUs are preserved. Blue Valley uses stable internal `BVC-<variant-id>` SKUs because supplier SKU strings can repeat across variants; the original supplier SKU remains metadata.

Products are quote-only, with no prices and no fabricated inventory. Source price and availability remain research fields in the full snapshot. Imported `model_url`, family and dimension metadata activate the native viewer on each Medusa product page. The importer has been tested with mocked Medusa services; a live dry run and production import remain pending stack availability.

Sources: https://www.oppeincabinetry.ca/ ; https://bluevalleycabinets.ca/ ; https://macancabinets.com/products/ ; https://macancabinets.com/doityourself/
