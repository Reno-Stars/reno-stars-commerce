# The storefront build depends on LIVE PRODUCTION and 502s under its own load

The commerce pipeline is wired and correct. `backend` passes CI **and** builds and
pushes its image. `storefront` fails — and it is not the pipeline.

## What happens

`yarn build` runs `next build`, which prerenders **637 static pages**. Every one
fetches `https://supply-admin.reno-stars.com` — the **live production Medusa
backend**. Partway through, production returns 502 and the build aborts:

```
Generating static pages (0/637) ...
Error occurred prerendering page "/se/products/bowen"
Error: Bad Gateway
  status: 502
Export encountered an error on /[countryCode]/(main)/products/[handle]/page, exiting the build.
```

Observed on three separate runs, failing at a *different* product each time
(`herringbone-bamfield`, `bowen`, `/se/products/bowen`). It also **succeeded
once**, on `a05c4026`. That is the signature of load, not of a broken page.

The backend is healthy when probed directly — `/app` returns 200 throughout.

## Why this matters beyond CI

**Every storefront build puts a burst of hundreds of requests on the production
backend that serves customers.** That was true before this pipeline existed; CI
just made it visible and repeatable. A build can degrade the live shop.

## Four ways out — a product decision, not a pipeline one

1. **Point the build at a non-production backend.** Cleanest, needs one to exist.
2. **Reduce prerendering.** 637 pages × 14 locales is the multiplier; `generateStaticParams`
   could cover fewer, with the rest rendered on demand.
3. **Make prerender fetches tolerant** — retry with backoff, or fall back to
   on-demand rendering for a page whose fetch fails, instead of aborting the build.
4. **Rate-limit the build's concurrency** so production is never hit in a burst.

## What is NOT the problem

* Yarn — fixed; the repo is Yarn 4 and CI now uses it.
* `NEXT_PUBLIC_*` — fixed; supplied at job level and as build-args.
* ESLint — `next lint` is deprecated and its Pages-Router rules crash on this
  app-router project. The separate Lint step is disabled with that written down.
  It still prints inside `next build`, but is NON-FATAL there; it is not what
  stops the build.
