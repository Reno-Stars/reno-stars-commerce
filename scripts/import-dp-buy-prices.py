#!/usr/bin/env python3
"""
import-dp-buy-prices — fill BUY (wholesale) price for DP Tile products in supply_info
from the dealer PDF `DP-PRODUCT-LIST-RENO-STAR.pdf`.

DP supply_info rows have importer_sku = 'dptile-<MODEL>'. The dealer PDF lists:
    PRODUCT: <NAME> <MODEL> <SIZE>
    RETAIL PRICE: $<retail>/SQFT
    WHOLESALE PRICE: $<wholesale>/SQFT     <- this is our BUY/cost price
One price block can cover several MODELs (multi-colour listings). Size variants of
the same model (24x24 vs 24x48) get separate prices in the PDF; we key by MODEL and
keep the FIRST occurrence (matches how the existing xlsx-sourced rows were priced).

Only fills rows where import_price_amount IS NULL (idempotent; never overwrites).

USAGE
  python3 scripts/import-dp-buy-prices.py            # DRY RUN (no writes)
  python3 scripts/import-dp-buy-prices.py --apply     # write matched buy prices
"""
import subprocess, sys, re, json, os

PDF = os.path.expanduser("~/Downloads/price lists/DP-PRODUCT-LIST-RENO-STAR.pdf")
CONTAINER, DB_USER, DB_NAME = "reno-commerce-postgres", "medusa", "medusa_commerce"
SOURCE = "DP-PRODUCT-LIST-RENO-STAR.pdf"

MODEL_RE = re.compile(r"\b([A-Z]{1,4}\d[A-Z0-9]{2,})\b")
RETAIL_RE = re.compile(r"RETAIL PRICE:\s*\$?([\d.]+)", re.I)
WHOLE_RE = re.compile(r"WHOLESALE PRICE:\s*\$?([\d.]+)", re.I)


def parse_pdf():
    txt = subprocess.check_output(["pdftotext", "-layout", PDF, "-"]).decode("utf-8", "ignore")
    prices = {}            # MODEL -> {"wholesale": float, "retail": float}
    pending_models, retail = [], None
    for line in txt.splitlines():
        wm = WHOLE_RE.search(line)
        rm = RETAIL_RE.search(line)
        if rm:
            retail = float(rm.group(1))
            continue
        if wm:
            whole = float(wm.group(1))
            for m in pending_models:
                prices.setdefault(m, {"wholesale": whole, "retail": retail})
            pending_models, retail = [], None
            continue
        # accumulate model codes on PRODUCT / continuation lines (before the price)
        for m in MODEL_RE.findall(line):
            if m not in pending_models:
                pending_models.append(m)
    return prices


def dp_rows_missing_price():
    q = ("SELECT id, importer_sku FROM supply_info "
         "WHERE supplier_name='DP Tile & Stone' AND import_price_amount IS NULL "
         "AND importer_sku IS NOT NULL")
    out = subprocess.check_output(
        ["docker", "exec", "-i", CONTAINER, "psql", "-U", DB_USER, "-d", DB_NAME,
         "-t", "-A", "-F", "\t", "-c", q]).decode().strip()
    rows = []
    for ln in out.splitlines():
        if "\t" in ln:
            sid, isku = ln.split("\t", 1)
            rows.append((sid, isku))
    return rows


def main():
    apply = "--apply" in sys.argv
    prices = parse_pdf()
    rows = dp_rows_missing_price()
    print(f"PDF parsed: {len(prices)} model→price entries")
    print(f"DP rows missing buy price: {len(rows)}\n")

    matches, misses = [], []
    for sid, isku in rows:
        model = isku[len("dptile-"):] if isku.startswith("dptile-") else isku
        p = prices.get(model)
        (matches if p else misses).append((sid, isku, model, p))

    print(f"MATCHED (would fill): {len(matches)}")
    for sid, isku, model, p in matches[:12]:
        print(f"  {isku:28} buy ${p['wholesale']:.2f}  retail ${p['retail']}")
    if len(matches) > 12:
        print(f"  … +{len(matches)-12} more")
    print(f"\nUNMATCHED (no PDF price, left NULL): {len(misses)}  e.g. "
          + ", ".join(m[2] for m in misses[:6]))

    if not apply:
        print("\nDRY RUN — no writes. Re-run with --apply to fill the matched rows.")
        return

    n = 0
    for sid, isku, model, p in matches:
        raw = json.dumps({"unit": "per_sf", "source": SOURCE,
                          "retail_per_sf": p["retail"], "wholesale_per_sf": p["wholesale"]})
        q = (f"UPDATE supply_info SET import_price_amount={p['wholesale']}, "
             f"import_price_currency='cad', "
             f"raw_import_price_amount='{raw.replace(chr(39), chr(39)*2)}'::json "
             f"WHERE id='{sid}' AND import_price_amount IS NULL;")
        subprocess.check_output(["docker", "exec", "-i", CONTAINER, "psql", "-U", DB_USER,
                                 "-d", DB_NAME, "-c", q])
        n += 1
    print(f"\nAPPLIED: filled {n} DP buy prices from {SOURCE}.")


if __name__ == "__main__":
    main()
