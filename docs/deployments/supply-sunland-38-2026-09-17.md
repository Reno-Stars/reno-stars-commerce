# Sunland reviewed product library

Publish the 38 reviewed Sunland configurations as quote-only Supply products, with the native product-page 3D viewer and Bathroom subcategories for bases, tubs, screens, and enclosures. Each configuration has a unique internal variant SKU; manufacturer SKUs are preserved separately. No stock quantities or prices are invented.

`/sunland-library/design-catalog.json` provides product URLs, source references, model URLs, gzip-compressed Blender sources, documented dimensions, separate exported envelopes, units and placement guidance. Reuse these assets at original scale in renovation scenes. Four dimension holds and all unreviewed source pages are excluded.

Validation: 38 independent GLB dimension checks; source and rendered views inspected individually; 38 browser GLBs loaded with no JavaScript errors and browser screenshots inspected. Undimensioned surface sections, hardware and tray details remain explicit visual approximations. The local review record is not a manufacturer CAD certification.

The sequential importer `src/scripts/import-sunland-reviewed.ts` preflights every deployed asset hash and existing identity before writes. Dry-run (`SUNLAND_APPLY=0`) must pass before apply (`SUNLAND_APPLY=1`). It checks category/channel assignment and rejects conflicting records. Automated mock integration tests cover dry-run, 38-product apply, idempotent rerun, corrupt asset refusal and existing-record conflicts. Run `node scripts/tests/sunland-import.cjs` and both package TypeScript checks.

Deployment: GitHub is the writable upstream of the Gitea commerce mirror. Merge the reviewed source PR, allow mirror sync and green CI/image builds, then use the infrastructure PR/CD path for both images and the version-pinned import Job. Verify all public product pages, category navigation, deployed asset hashes and native viewers before marking live.

Local validation: backend TypeScript passed and importer tests passed. Full storefront TypeScript reports existing cart/type-alias/related-product errors outside this change; the modified model metadata utility is checked separately. CI build remains required.
