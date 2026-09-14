# Eurofit model revision 3

Release scope: all 407 existing Eurofit products (370 handles, 37 knobs), their versioned GLB assets, and hardware camera framing. No new product or supplier records are introduced.

The H-71267 profile now uses an arched strap with outward-returning feet. Handle families use separate photo-derived profiles rather than the earlier broad generic buckets. Cup handles use formed shells and oval flanges; K-388 no longer converges duplicated crown vertices into a pinched centre. Export cleanup welds coincident vertices, triangulates, removes collapsed faces and recalculates normals. The hardware camera fits a bounding sphere so long products remain visible after rotation.

Validation:
- All 407 exported envelopes and mounting anchors checked independently in Three.js against the existing supplier dimension records.
- Full triangle/normal screening: no collapsed triangles, opposing vertex normals, nonfinite coordinates or negative-volume primitive warnings.
- Framing: 1,221 model/aspect cases, each checked in 12 orientations.
- Native viewer tested with substituted release assets on H-71267, K-388, H-459, H-471 and H-002; default/rotated studio views inspected.
- Source/render contact sheets reviewed across 74 handle families. Supplier family photos may differ in length or finish from the chosen representative. This is not individual visual approval of all 407 variants.
- Idempotent migration verifies existing supplier identity and old/new hashes, preflights all deployed assets before writing, preserves unrelated metadata, and performs zero writes on rerun or corrupt-asset preflight failure.

Limitations remain explicit: contour radii, moulding details and metallic finishes are photo-derived approximations, not manufacturer CAD. Previous cabinet evidence gaps remain unchanged; this release does not certify missing cabinet references or fabricate Macan dimensions.

Deployment and live verification evidence will be appended after rollout.
