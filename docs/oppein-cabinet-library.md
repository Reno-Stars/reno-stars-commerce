# OPPEIN dimensioned cabinet library

Adds 100 OPPEIN White Single Shaker plywood cabinet sizes to a reusable asset library. Each has a published W/H/D, glTF binary model, product thumbnail, provenance and placement metadata. Standard base, wall and pantry cabinets only. The 83 other entries found on the collection page are excluded; no incomplete corner, trim or hardware models are published.

## Viewer and data

- `/cabinet-library/index.html`: public searchable 3D library, desktop/mobile orbit and zoom.
- `/ca/products/<handle>`: native product-page 3D viewer, enabled by public product metadata.
- `/cabinet-library/catalog.json`: public SKU/dimensions/model manifest.
- `/cabinet-library/models/<SKU>.glb`: glTF 2.0, metres, Y up, X width, +Z front.
- Origin: rear-left-floor for base/pantry, rear-left-bottom for wall cabinets.
- Cabinet body envelope follows sourced W/H/D. Adjustable feet shown separately at 114.3 mm; not silently added to body dimensions.
- Published dimensions are not verification of internal joinery, hinge placement or door profile; those details are visual interpretations. Cabinet handles and finished end cover panels are not included.
- Downloadable placement JSON has metre positions, fixed scale 1, source SKU and dimensions.

## Import and deployment

1. Deploy storefront assets and viewer code through the existing Enter OS deployment pipeline.
2. Verify `/cabinet-library/index.html`, a GLB and a PNG on the live domain.
3. Run `npx medusa exec ./src/scripts/import-oppein-wss.ts` in the backend environment for a read-only dry run.
4. Run `OPPEIN_APPLY=1 npx medusa exec ./src/scripts/import-oppein-wss.ts` to create the category and 100 quote-only products. This requires backend database access. The importer checks deployed model and poster availability, skips existing product handles and rejects conflicting SKUs. Prices and inventory quantities are not invented.
5. Verify the category, product preview, product embedded viewer, contact-price text and mobile navigation on the live site. Refresh Next caches through the normal deployment/revalidation mechanism.

Products have `metadata.model_url` and/or `metadata.cabinet_library_sku` to enable their native React viewer. Other products are unaffected. The storefront price utility handles `pricing_mode: quote_only` without a fake zero-priced sale or indefinite loading placeholder.

## Validation

`node --test scripts/tests/cabinet-library.cjs`: verifies all 100 manifests/assets, quote-only display, and default read-only importer behavior.

All 100 Blender-generated mesh envelopes checked against published dimensions to <0.1 mm. All 100 GLBs loaded in Chrome to generate thumbnails. Desktop/mobile viewer check passed with no page errors or horizontal overflow. Three cabinets imported into a Blender scene at true scale using the reusable source files. Backend TypeScript check passed. Full storefront TypeScript check has existing errors in unrelated cart, global type, country-select and related-products code.

## Source deliverables on the authoring Mac

`/Users/renostars/Documents/OPPEIN-WSS-Library/` contains the original HTML evidence, catalog collector, normalization script, Blender generator, 100 `.blend` files, geometry validation, browser checks and `source/place_cabinets.py`. Source page: https://www.oppeincabinetry.ca/white-single-shaker-plywood .

The working implementation is based on production source commit `fb128a2923e8`; unrelated changes in the original Mac checkout are preserved. This change has not yet been deployed or imported into the production database.

## Furnished kitchen presentation

`/cabinet-library/home.html` adds two 2200 × 1468 Blender Cycles renders and an interactive kitchen cutaway. Ten cabinet instances use eight existing SKUs at scale 1, with separate counters, toe kicks, handles, appliances and furnishings. The room GLB is approximately 4 MB after reducing all browser textures to 1024 pixels; full-resolution material assets remain packed in the Blender scene.

The kitchen’s path-traced renders include soft window light, an exterior garden environment, under-cabinet lighting, quartz, oak, stainless steel, eased edges and depth of field. The interactive cutaway uses portable PBR materials and an optimized lighting environment; it does not reproduce all Cycles light transport.

Source scene: `/Users/renostars/Documents/OPPEIN-WSS-Library/scenes/OPPEIN-Home-Kitchen.blend`. Scene placement JSON is available beside the room GLB. Browser checks passed for both render tabs, GLB loading, eight SKU links and mobile layout without horizontal overflow. All ten scene cabinet roots retain scale `[1,1,1]`.

## Individual cabinet scenes and lighting

Every SKU now has an interactive Three.js presentation with three backgrounds (Warm oak room, Modern stone room, Slate studio) and independent Window daylight, Soft studio and Warm evening lighting presets. Brightness and light direction sliders update immediately. Settings persist across cabinet selection and reload, and are included in the URL. Users can reset the camera or lighting and download a PNG of the current view.

The product page renders the same engine directly in a React-managed canvas with native React controls. It does not load or iframe the standalone HTML library. Mobile controls stack without horizontal scrolling. Wall cabinets display mounted 1.45 m above the presentation floor. Background geometry and lights are presentation-only: original GLBs, placement metadata and cabinet dimensions are unchanged.

Viewer source and reproducible build: `tools/cabinet-viewer/`. Run `npm ci` and `npm run build` there to rebuild the committed browser bundle. Three.js license is distributed alongside the bundle. Serve `storefront/public/cabinet-library` on port 8768, then run `npm test` in the tool directory; set `CABINET_VIEWER_URL` to test another URL. Test artifacts go into the ignored `out/` directory.

Validation: all 100 SKUs load without browser errors; all nine scene/lighting combinations checked; brightness/direction changes, settings persistence, camera/light controls, PNG export, embedded view and mobile overflow checked. Rendering runs on demand and pauses while offscreen.

### Real-time material and rendering refinement

The per-SKU viewer uses physical satin paint with a restrained clear coat and metre-scaled roughness variation, metallic drawer hardware, a rectangular softbox highlight and softer cast shadows. GTAO contact shading adds depth to recesses and contact points, followed by a linear HDR output transform and FXAA. Oak backgrounds use 180 × 1200 mm staggered plank geometry, grain/roughness maps and a subtle bump surface; stone has roughness variation. Decorative plant leaves and pot rims have shaped geometry.

These are presentation material interpretations, not measured manufacturer finish parameters. Model geometry, source dimensions and downloadable GLBs remain unchanged. All 100 products loaded without browser errors; the nine scene/preset combinations, sliders, saved settings, embedded/mobile presentation and PNG export passed browser checks after the rendering upgrade.

### Native Medusa product-page integration

`ProductTemplate` includes `ProductModelViewer`. A valid HTTPS or root-relative `.glb` URL in `metadata.model_url` enables the viewer for any product; an OPPEIN `cabinet_library_sku` provides a local library fallback. No model metadata means no viewer section. Optional `width_mm`, `height_mm`, `depth_mm` and `model_family` supply dimension text and mounting presentation. Only positive numeric dimensions are displayed; none are inferred from visual geometry.

The GPU engine loads when the product preview nears the viewport, with shared scene/lighting preferences, retry handling, PNG export and model downloads. It disposes GPU resources when changing products. All rendering assets use absolute storefront paths and the static asset directory bypasses country middleware. No local preview URL, HTML catalog or iframe is used in the product customer flow.

Run `npm run test:native` in `tools/cabinet-viewer` to launch a temporary Next.js fixture using the real component. The fixture is removed afterward and is not part of the shipped app. Checks cover models from metadata, products without models, product switching, preferences, image export, mobile layout and the absence of HTML/iframe requests. Production still requires storefront deployment and the prepared Medusa product import.
