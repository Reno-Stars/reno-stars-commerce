# Supply storefront deployment handoff — September 10, 2026

**Resolved:** CD applied current main at 00:48:33 UTC. Live category hierarchy and full pagination verified. No further rollout action is needed. The client-ops namespace access limitation remains; provide the intended namespace administration connection separately.

Please check/reconcile the Reno Stars CD controller against the current `Reno-Stars/reno-stars-infra` main branch on Enter OS. The approved commerce update has not reached the running deployments.

- Current infra main at the last check: `a1e77b664e16da15a3ced6d8ff40c5e319f9199f` (PR #223).
- Desired storefront/backend image tags in main: `dc6426e5ecb5`.
- Commerce source: `dc6426e5ecb5649a3f6a2da492c0081aa3796a61`, application PR #9.
- Build run 706607 and CI run 706608: all jobs succeeded. Automated image deployment PR #221 merged.
- `reno-stars-cd-state` still reports applied commit `2fba033695a8d056e8e4a20519d147b686a6cab5`, applied at `2026-09-11T00:28:24Z`, unchanged at `00:44:25Z` (5:44 PM Vancouver).
- Running storefront digest remains `sha256:73178159453be077928abdc326bf425e2349b4d1a30b150ba04215087135b84a` and backend remains `sha256:b561239a9bf7c300efb400477f67fa0ba2a9d0b9452ff6e5f21dcdb990ab06c9`, both source `814b43ec8ffc`.
- Client identity cannot inspect CI namespace pods or patch either deployment; no RBAC changes were attempted.

Publication is already complete: Job `supply-cabinets-publish-v1` published 1,609 eligible quote-only products, left 125 source-conflicted models excluded, and created Cabinets > supplier > finish/construction (18 leaf categories). Do not reimport or create duplicate products.

PR #223 preserves the exact completed Job manifest from PR #219. It reverses the unnecessary multi-document reformat in #220, avoiding a tag-to-digest rewrite of the completed Job's immutable pod template. Product data and publication script are unchanged.

After rollout, verify:
1. `/ca/store` shows Cabinets and latest cabinet arrivals.
2. `/ca/categories/cabinets` shows OPPEIN and Blue Valley, with 1,609 total products.
3. `/ca/categories/cabinets-oppein` exposes finish/construction subcategories.
4. `/ca/categories/cabinets?page=11` has 12 products and `?page=135` has the final one.
5. Native 3D viewers load on `/ca/products/oppein-ply-gss-2db36` and `/ca/products/bvc-2402`.

The two product pages already passed browser verification: HTTP 200, rendered models, working scene and lighting controls, quote requests, model downloads, and approximation disclosure under Description.
