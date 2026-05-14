import {
  createProductCategoriesWorkflow,
  createProductsWorkflow,
} from "@medusajs/core-flows";
import {
  ExecArgs,
  IProductModuleService,
  ISalesChannelModuleService,
} from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
  ProductStatus,
} from "@medusajs/framework/utils";

// ── Configure sites to import here ────────────────────────────────────────
//
// Each entry imports from a WooCommerce Store API at
//   https://<domain>/wp-json/wc/store/v1/products
//
// `sourceTag` is stamped on product.metadata.source so we can dedupe + filter
// later. `categoryPrefix` (optional) prepends a string to category names so
// each vendor's categories don't collide with NeoNova's (e.g. "Floor Tile"
// from NeoNova would collide with "Floor Tile" from a flooring vendor).
const SITES = [
  {
    domain: "flooringliquidators.ca",
    sourceTag: "flooringliquidators.ca",
    brandName: "Flooring Liquidators",
    categoryPrefix: "",
  },
  {
    domain: "htbcflooring.com",
    sourceTag: "htbcflooring.com",
    brandName: "HT BC Flooring",
    categoryPrefix: "",
  },
];

const BATCH_SIZE = 5;
const CURRENCY = "cad";

type WCImage = { id: number; src: string; alt?: string; name?: string };
type WCCategory = { id: number; name: string; slug: string };
type WCAttribute = {
  id: number;
  name: string;
  taxonomy?: string;
  has_variations?: boolean;
  terms?: Array<{ id: number; name: string; slug: string }>;
};
type WCPrices = {
  price?: string;
  regular_price?: string;
  currency_code?: string;
  currency_minor_unit?: number;
};
type WCProduct = {
  id: number;
  name: string;
  slug: string;
  parent: number;
  type: string;
  sku?: string;
  description?: string;
  short_description?: string;
  permalink?: string;
  prices?: WCPrices;
  images?: WCImage[];
  categories?: WCCategory[];
  attributes?: WCAttribute[];
  variations?: Array<{ id: number; attributes: Array<{ name: string; value: string }> }>;
  is_purchasable?: boolean;
  is_in_stock?: boolean;
};

async function fetchAllWCProducts(domain: string): Promise<WCProduct[]> {
  const all: WCProduct[] = [];
  const PER = 100;
  for (let page = 1; page <= 200; page++) {
    const url = `https://${domain}/wp-json/wc/store/v1/products?per_page=${PER}&page=${page}`;
    const resp = await fetch(url);
    if (resp.status === 400 || resp.status === 404) break;
    if (!resp.ok) throw new Error(`Fetch ${domain} page ${page} → ${resp.status}`);
    const data = (await resp.json()) as WCProduct[];
    if (!Array.isArray(data) || data.length === 0) break;
    all.push(...data);
    if (data.length < PER) break;
  }
  return all;
}

// Strip Divi shortcodes (et_pb_*) and HTML entities, collapse whitespace.
// htbcflooring's description bodies are >100 KB of [et_pb_*] noise per product.
function cleanDescription(raw?: string): string {
  if (!raw) return "";
  return raw
    // Strip Divi shortcodes
    .replace(/\[\/?et_pb_[^\]]*\]/gi, "")
    .replace(/\[et_pb_line_break_holder\]/gi, "")
    // Strip generic shortcodes
    .replace(/\[(\/?)([a-z_]+)([^\]]*)\]/gi, "")
    // Strip <style> and <script>
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    // Break tags → newlines
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    // Drop remaining HTML
    .replace(/<[^>]+>/g, " ")
    // Decode common HTML entities
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&#8216;/g, "‘")
    .replace(/&#8217;/g, "’")
    .replace(/&#8220;/g, "“")
    .replace(/&#8221;/g, "”")
    .replace(/&#8243;/g, "″")
    .replace(/&#038;/g, "&")
    .replace(/&#036;/g, "$")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// WC prices: integer string in currency_minor_unit (cents). e.g. "12999" = $129.99
// Medusa 2.0 expects decimal amount, so divide by 100 (assuming minor_unit=2).
function parseWCPrice(p?: WCPrices): number {
  if (!p?.price) return 0;
  const n = parseInt(p.price, 10);
  if (!isFinite(n) || n <= 0) return 0;
  const divisor = Math.pow(10, p.currency_minor_unit ?? 2);
  return Math.round((n / divisor) * 100) / 100;
}

function isDefaultName(name: string): boolean {
  return /^(title|default title|default option)$/i.test((name || "").trim());
}

export default async function importWooCommerce({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const salesChannelModule: ISalesChannelModuleService = container.resolve(
    ModuleRegistrationName.SALES_CHANNEL
  );
  const productModule: IProductModuleService = container.resolve(
    ModuleRegistrationName.PRODUCT
  );

  const [defaultSalesChannel] = await salesChannelModule.listSalesChannels({
    name: "Default Sales Channel",
  });
  if (!defaultSalesChannel) {
    throw new Error("Default Sales Channel not found");
  }

  const existingCategories = await productModule.listProductCategories(
    {},
    { take: 5000 }
  );
  const catByName = new Map<string, string>(
    existingCategories.map((c) => [c.name, c.id])
  );
  logger.info(`Loaded ${catByName.size} existing categories`);

  const existingProducts = await productModule.listProducts(
    {},
    { take: 50000, select: ["handle"] as any }
  );
  const existingHandles = new Set(existingProducts.map((p) => p.handle));
  logger.info(`Loaded ${existingHandles.size} existing product handles`);

  for (const site of SITES) {
    logger.info("");
    logger.info(`════════ Importing from ${site.domain} ════════`);

    const products = await fetchAllWCProducts(site.domain);
    // Skip product variations that come back at the top level (parent !== 0)
    const topLevel = products.filter((p) => !p.parent || p.parent === 0);
    logger.info(`  ✓ Fetched ${products.length} (${topLevel.length} top-level products)`);

    // ── Discover + create categories from WC categories[]
    const catNames = new Set<string>();
    for (const p of topLevel) {
      for (const c of p.categories || []) {
        const name = site.categoryPrefix
          ? `${site.categoryPrefix}${c.name}`
          : c.name;
        catNames.add(name);
      }
    }
    const toCreate = Array.from(catNames).filter((n) => !catByName.has(n));
    logger.info(`  ${catNames.size} unique categories on source, ${toCreate.length} new to create`);
    for (const name of toCreate) {
      try {
        const { result } = await createProductCategoriesWorkflow(
          container
        ).run({
          input: {
            product_categories: [{ name, is_active: true }],
          },
        });
        catByName.set(result[0].name, result[0].id);
      } catch (e: any) {
        if (/already exists/i.test(e.message)) {
          // re-list to capture the handle-collision case
          const refetch = await productModule.listProductCategories(
            { name } as any,
            { take: 5 }
          );
          const match = refetch.find((c) => c.name === name);
          if (match) catByName.set(match.name, match.id);
        } else {
          logger.warn(`    ⚠ category "${name}" failed: ${e.message}`);
        }
      }
    }

    // ── Filter to products not already imported by handle (use the same
    //    safe-handle transform we apply on insert, so re-runs are idempotent)
    const safeHandleOf = (s: string, id: number) =>
      (s || `${site.sourceTag.split(".")[0]}-${id}`)
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "") || `product-${id}`;
    const toImport = topLevel.filter(
      (p) => !existingHandles.has(safeHandleOf(p.slug, p.id))
    );
    const skipped = topLevel.length - toImport.length;
    logger.info(`  ${toImport.length} new products to import (${skipped} already exist)`);

    let imported = 0;
    let failed = 0;
    const failures: Array<{ handle: string; error: string }> = [];

    for (let i = 0; i < toImport.length; i += BATCH_SIZE) {
      const batch = toImport.slice(i, i + BATCH_SIZE);

      const medusaProducts = batch.map((sp) => {
        // ── Catalog-only mode: collapse every WC product into ONE "Default"
        // variant. Available colours/sizes/finishes from variable products
        // are stashed in metadata.options for reference and could be surfaced
        // on the product page later. This dodges every variant-attribute
        // edge case in WC data (missing terms, undefined values, etc.).
        const availableOptions: Record<string, string[]> = {};
        const realAttrs = (sp.attributes || []).filter(
          (a) => !isDefaultName(a.name)
        );
        for (const a of realAttrs) {
          const set = new Set<string>();
          for (const t of a.terms || []) if (t.name?.trim()) set.add(t.name);
          // Also pull from variations (catches values not in parent terms)
          for (const v of sp.variations || []) {
            for (const va of v.attributes || []) {
              const clean = va.name.replace(/^(attribute_pa_|attribute_)/i, "");
              if (
                (a.name.toLowerCase().replace(/\s+/g, "-") === clean.toLowerCase() ||
                  a.taxonomy?.toLowerCase() === clean.toLowerCase() ||
                  a.name.toLowerCase() === clean.toLowerCase()) &&
                va.value?.trim()
              ) {
                set.add(va.value);
              }
            }
          }
          if (set.size > 0) availableOptions[a.name] = Array.from(set);
        }

        const options = [{ title: "Default", values: ["Default"] }];
        const variantSku =
          sp.sku && sp.sku.trim()
            ? `${site.sourceTag.split(".")[0]}-${sp.sku.trim()}`
            : `${site.sourceTag.split(".")[0]}-${sp.id}`;
        const variant: any = {
          title: "Default",
          sku: variantSku,
          options: { Default: "Default" },
          manage_inventory: false,
        };
        const amount = parseWCPrice(sp.prices);
        if (amount > 0) {
          variant.prices = [{ amount, currency_code: CURRENCY }];
        }
        const variants = [variant];

        const category_ids = (sp.categories || [])
          .map((c) => {
            const name = site.categoryPrefix
              ? `${site.categoryPrefix}${c.name}`
              : c.name;
            return catByName.get(name);
          })
          .filter(Boolean) as string[];

        // Prefer description; fall back to short_description if cleaned is too short
        let description = cleanDescription(sp.description);
        if (description.length < 40) {
          const short = cleanDescription(sp.short_description);
          if (short.length > description.length) description = short;
        }

        // Sanitize handle — strip non-URL-safe chars (UTF-8 BOM %EF%BB%BF,
        // accents, etc.) so Medusa's validator doesn't reject the product.
        const safeHandle = (sp.slug || `${site.sourceTag.split(".")[0]}-${sp.id}`)
          .toLowerCase()
          .normalize("NFKD")
          .replace(/[̀-ͯ]/g, "") // strip combining marks
          .replace(/[^a-z0-9-]+/g, "-")    // anything not URL-safe → dash
          .replace(/-+/g, "-")              // collapse multiple dashes
          .replace(/^-|-$/g, "")            // trim leading/trailing dashes
          || `product-${sp.id}`;

        return {
          title: sp.name.replace(/&#8211;/g, "–").replace(/&amp;/g, "&"),
          handle: safeHandle,
          description,
          status: ProductStatus.PUBLISHED,
          category_ids,
          images: (sp.images || []).map((img) => ({ url: img.src })),
          options,
          variants,
          sales_channels: [{ id: defaultSalesChannel.id }],
          metadata: {
            wc_id: sp.id.toString(),
            source: site.sourceTag,
            brand: site.brandName,
            source_url: sp.permalink || "",
            imported_at: new Date().toISOString(),
            // Surface available colors/sizes/finishes for the product page UI
            options:
              Object.keys(availableOptions).length > 0
                ? JSON.stringify(availableOptions)
                : "",
          },
        };
      });

      try {
        await createProductsWorkflow(container).run({
          input: { products: medusaProducts as any },
        });
        imported += medusaProducts.length;
        medusaProducts.forEach((p: any) => existingHandles.add(p.handle));
      } catch (e: any) {
        logger.warn(
          `  Batch ${Math.floor(i / BATCH_SIZE) + 1} bulk insert failed: ${e.message}. Retrying individually...`
        );
        for (const single of medusaProducts) {
          try {
            await createProductsWorkflow(container).run({
              input: { products: [single as any] },
            });
            imported += 1;
            existingHandles.add((single as any).handle);
          } catch (singleErr: any) {
            failed += 1;
            failures.push({
              handle: (single as any).handle,
              error: singleErr.message?.slice(0, 200) || "unknown",
            });
          }
        }
      }

      if ((i + BATCH_SIZE) % 50 === 0 || i + BATCH_SIZE >= toImport.length) {
        logger.info(
          `  progress: ${Math.min(i + BATCH_SIZE, toImport.length)}/${
            toImport.length
          } | imported=${imported} failed=${failed}`
        );
      }
    }

    logger.info(`  ✅ ${site.domain}: imported ${imported}, skipped ${skipped}, failed ${failed}`);
    if (failures.length > 0) {
      logger.info(`    first 5 failures:`);
      failures.slice(0, 5).forEach((f) =>
        logger.info(`      - ${f.handle}: ${f.error}`)
      );
    }
  }

  logger.info("");
  logger.info("✅ All WooCommerce sources processed");
}
