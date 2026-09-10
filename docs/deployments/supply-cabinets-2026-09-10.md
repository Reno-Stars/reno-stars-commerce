# Supply cabinet rollout status — 2026-09-10

User authorized proceeding after Enter OS restoration. Application PR #8 merged into GitHub main at `814b43ec8ffc4e6c6eeb71684052704d22d8cf00`. The Enter OS commerce pull mirror was refreshed and contains that commit.

Production importer excludes the 125 source-conflicted models. 1,609 records qualify as quote-only drafts; existing handles are skipped. Eleven model/import tests pass and the native viewer browser checks pass. No products have been imported or published.

## Deployment blocker

Both image-build jobs in Enter OS commerce Actions run 706469 failed before source checkout. The runner could not fetch `https://git.moleculesai.app/actions/checkout` (`unable to fetch packfile`). Retrying failed at the same step. Direct infrastructure Git fetch also fails with `bad pack header`, including HTTP/1.1/protocol-v0 retry. Repository API reads and normal Git ref discovery work. The restored services are healthy; this is a Git-fetch/build-path failure.

Infrastructure PR #214 changed only the two Medusa image tags to `814b43ec8ffc`. The follow-up hold PR restores both to `fb128a2923e8` because those builds never produced new images. The last observed applied CD commit remains `3e4e736742a3a5d859be87bd8196dd9ded159250`. The running storefront/backend digests remain the pre-existing values; health endpoint returns 200 and the storefront loads with its normal cookie redirect.

## Resume after platform repair

1. Rerun commerce build workflow 706469 and CI workflow 706470; confirm both image builds succeed.
2. Use the ordinary infrastructure PR/CD flow to deploy the resulting image tags/digests. Keep backend one replica with Recreate strategy.
3. Verify live cabinet GLB URLs and the native viewer bundle before database writes.
4. Apply the accompanying one-time dry-run Job through the infrastructure repository. It references existing backend secrets by name; it contains no credentials. Confirm the compiled script and JSON are present in the built image and inspect its logs. It deliberately has no TTL, so periodic CD reapplication cannot rerun a completed import.
5. Only after a successful dry run, create a separately named apply Job with CABINET_APPLY=1. Retain its completion/logs; verify draft counts, dimensions, model URLs and source-conflict exclusions. Use Medusa preview/admin access to inspect drafts. Customer publication remains a separate product approval step.

Local access requires HTTPS_PROXY=http://127.0.0.1:1056 with the existing Enter OS kubeconfig; direct access to the cluster address times out. Kubernetes credentials permit reading deployment/job status but not arbitrary Medusa pod exec. Use the existing infrastructure Job workflow rather than changing permissions.
