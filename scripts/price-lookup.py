#!/usr/bin/env python3
"""
price-lookup — one command to get BUY + SELL + MARGIN for any supply-store product.

WHY THIS EXISTS
---------------
The supply store (Medusa) splits pricing across TWO places:
  * SELL price  -> Medusa core `price` table (what supply.reno-stars.com shows customers)
  * BUY  price  -> our custom `supply_info` module (`import_price_amount`), populated
                   from dealer price lists (HTBC / Triforest / DP / Sunland / Oakel PDFs)
An agent that only reads the storefront `price` table sees the SELL price and wrongly
concludes "there is no buy price." (That happened 2026-07-08 with Palermo/Milano.)
This script joins both so nobody has to remember the schema.

USAGE
-----
  python3 scripts/price-lookup.py <search>        # SKU, our_sku, importer_sku, or name substring
  python3 scripts/price-lookup.py palermo
  python3 scripts/price-lookup.py htbcflooring-NE006
  python3 scripts/price-lookup.py "nordic elegance"

Runs against the local commerce Postgres via `docker exec reno-commerce-postgres`.
No deps beyond python3 + docker.
"""
import subprocess, sys, json

CONTAINER = "reno-commerce-postgres"
DB_USER, DB_NAME = "medusa", "medusa_commerce"

SQL = r"""
SELECT json_agg(row_to_json(t)) FROM (
  SELECT
    p.title,
    pv.sku                         AS variant_sku,
    si.our_sku,
    si.importer_sku,
    si.supplier_name,
    si.import_price_amount::float  AS buy,
    si.import_price_currency       AS buy_ccy,
    (SELECT pr.amount::float FROM product_variant_price_set pvps
       JOIN price pr ON pr.price_set_id = pvps.price_set_id AND pr.currency_code='cad'
      WHERE pvps.variant_id = pv.id LIMIT 1) AS sell_cad,
    si.raw_import_price_amount     AS raw,
    (si.spec->>'size')             AS size
  FROM product p
  JOIN product_variant pv ON pv.product_id = p.id
  LEFT JOIN product_product_variant_supply_info_supply_info l ON l.product_variant_id = pv.id
  LEFT JOIN supply_info si ON si.id = l.supply_info_id
  WHERE pv.sku ILIKE %(q)s
     OR si.our_sku ILIKE %(q)s
     OR si.importer_sku ILIKE %(q)s
     OR p.title ILIKE %(q)s
     OR p.handle ILIKE %(q)s
  ORDER BY p.title, pv.sku
  LIMIT 50
) t;
"""


def run(term: str):
    like = f"%{term}%"
    # psql -v is awkward with ILIKE %(q)s; inline the param safely via a here-doc + set.
    q = SQL.replace("%(q)s", "'" + like.replace("'", "''") + "'")
    out = subprocess.check_output(
        ["docker", "exec", "-i", CONTAINER, "psql", "-U", DB_USER, "-d", DB_NAME,
         "-t", "-A", "-c", q]
    ).decode().strip()
    return json.loads(out) if out and out != "" else []


def fmt(v, ccy="CAD"):
    return "—" if v is None else f"${v:,.2f} {ccy}"


def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    term = " ".join(sys.argv[1:])
    rows = run(term)
    if not rows:
        print(f"No products match '{term}'.")
        return
    print(f"\n{len(rows)} match(es) for '{term}':\n")
    for r in rows:
        buy, sell = r.get("buy"), r.get("sell_cad")
        margin = ""
        if buy and sell and sell:
            margin = f"  margin {((sell-buy)/sell*100):.0f}%  (markup {((sell-buy)/buy*100):.0f}%)"
        raw = r.get("raw") or {}
        src = raw.get("source") or raw.get("effective") or ""
        unit = raw.get("unit") or ""
        print(f"• {r['title']}  [{r.get('variant_sku') or ''}]")
        print(f"    supplier : {r.get('supplier_name') or '—'}"
              f"   our_sku {r.get('our_sku') or '—'}   importer {r.get('importer_sku') or '—'}")
        print(f"    BUY  {fmt(buy, (r.get('buy_ccy') or 'cad').upper())} {unit}"
              f"    SELL {fmt(sell)}{margin}")
        if r.get("size") or src:
            print(f"    size {r.get('size') or '—'}   src {src or '—'}")
        print()


if __name__ == "__main__":
    main()
