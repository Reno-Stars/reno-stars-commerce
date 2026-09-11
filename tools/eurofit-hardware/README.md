# Eurofit hardware inventory

Source collection: https://eurofitcanada.com/collections/handle-knobs
Collected 2026-09-11. 147 families, 1,557 quantity-tier variants, 781 physical option groups.
Quantity tiers are source evidence, not duplicate products or Reno Stars selling prices.

407 dimensioned visualization models are prepared. 374 option groups remain on hold;
see `held-items.csv` for all missing dimensions, conflicts, identity issues, installation
section questions and sculpted profiles requiring further work. One held record is a
merchandising display board, not individual hardware.

## Review scope

- All 147 first family photographs inspected, plus catalogue drawing contact sheets for
  126 matching codes. Not all 793 secondary/finish images were individually inspected.
- Explicit drawing comparisons and conflicts are in `review.py`. Website-only records
  are identified; a matching catalogue section was not found/confirmed for every family.
- Overall dimensions and mounting-centre spacing use supplier millimetres. Cross-sections,
  minor radii, decorative details, thread interiors and rendered finish colours remain
  approximations, disclosed in the GLB and product description.
- All 407 exported files are independently checked with Three.js for mesh envelope,
  mounting plane, centre spacing and metre scale. `glb-validation.json` records results.
- Generated previews of all 89 eligible families were visually compared against source
  photographs. This is family-level review, not a claim of individually reviewed finishes.

## Rebuild

1. `python collect.py` downloads public source data/images.
2. `python normalize.py && python review.py` rebuilds the eligibility inventory.
3. `Blender --background --python build_models.py` creates GLBs and one editable `.blend`
   per eligible family in `~/Documents/Eurofit-Hardware/blender/`.
4. `node ../cabinet-viewer/tests/eurofit-bounds.mjs` checks the actual exported geometry.
5. `python prepare_import.py` packages the eligible records, byte counts and SHA-256 hashes.

Public GLBs use X=length, Y=transverse width, Z=projection, in metres. Mounting plane is
Z=0; mounting-anchor empty nodes stay at the published C-C spacing. Presentation cabinet
panels belong only to the viewer and are not exported with the hardware.

Serve the repo locally and open `tools/eurofit-hardware/review.html` for source/model QA.
The ecommerce integration uses the native React product viewer, not this authoring page.

## Publication

`backend/src/scripts/import-eurofit-hardware.ts` is read-only by default. It validates
identities, existing products and exact deployed GLB bytes before any write. Set
`EUROFIT_APPLY=1` only when deployed assets and visual review are ready. The import uses
Cabinet Hardware → Eurofit → Handles / Knobs, the Default Sales Channel, published
status, and quote-only pricing. A rerun skips exact matching records and rejects conflicts.

## Refreshing the supplier snapshot

The family-index review/profile maps belong to this frozen 2026-09-11 collection ordering.
Do not reuse them blindly after collecting a changed/reordered collection. Reconcile the
stable Shopify product IDs against `source/families.json`, preserve/rebuild the family map,
and review new or changed specifications before generating or publishing replacements.
Existing deployed GLBs remain independent of subsequent supplier website changes.

## Knob revision 2

The first knob release used generic profile families. Customer feedback identified clear
silhouette mismatches despite passing envelope checks. `knobs_v2.py` replaces all 37 knob
finishes with 15 individual photo-derived profiles. Versioned `-v2.glb` paths avoid stale
browser assets. Old files remain for existing links. Dimension checks do not establish
visual fidelity; compare the actual profile and supplier photograph separately.

`update-eurofit-hardware-v2.ts` renames the public category to Hardware (stable URL retained),
removes Cabinet from all supplier titles, and updates only the 37 knob assets. It preserves
unrelated metadata and requires exact prior or new hashes before any write.
