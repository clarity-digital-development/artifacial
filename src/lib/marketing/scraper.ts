/**
 * URL → structured product data for Marketing Studio.
 *
 * Tiered free-first strategy:
 *  1. Shopify `.json` cheat code — append `.json` to any /products/* URL on a
 *     Shopify storefront. Returns the full product object (title, body_html,
 *     images[], variants[], vendor). Zero auth. Works on most Shopify stores.
 *  2. JSON-LD `@type: Product` parse — Shopify themes ship this by default;
 *     WooCommerce widely supports via Yoast/RankMath; DTC brands on
 *     Webflow/Framer almost always include it.
 *  3. Open Graph fallback (og:title, og:description, og:image).
 *  4. <title> + <meta name="description"> + first <img> in <main>.
 *
 * Defends against SSRF via safeFetchUserUrl (rejects private/loopback/link-local,
 * caps payload at 5 MB, 10 s timeout, 3-redirect max).
 *
 * No external scraping vendor for v1 — defer Firecrawl to v2 only if we observe
 * gaps in production telemetry.
 */

import { safeFetchUserUrl } from "@/lib/security/safe-fetch";

export interface ProductInfo {
  /** Product title — best-available across sources */
  name: string;
  /** Description — short marketing copy. ~200 chars typical. */
  description: string;
  /** Primary product image URL (resolved absolute) */
  imageUrl: string | null;
  /** Additional product images (first 8) */
  additionalImages: string[];
  /** Brand / vendor / site name */
  brand: string | null;
  /** Price as a human-readable string ("$49.99") — best-effort */
  price: string | null;
  /** Which extraction tier succeeded, for telemetry */
  source: "shopify-json" | "json-ld" | "open-graph" | "fallback-html";
  /** Echoed-back source URL */
  sourceUrl: string;
}

const FETCH_OPTS = {
  maxBytes: 5 * 1024 * 1024,
  maxRedirects: 3,
  timeoutMs: 10_000,
  userAgent: "Mozilla/5.0 (compatible; ArtifacialBot/1.0; +https://artifacial.app)",
};

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function fetchProductFromUrl(rawUrl: string): Promise<ProductInfo> {
  const url = new URL(rawUrl);

  // Tier 1: Shopify cheat code
  if (/\/products\//i.test(url.pathname) && !url.pathname.endsWith(".json")) {
    try {
      const jsonUrl = `${url.origin}${url.pathname.replace(/\/$/, "")}.json${url.search}`;
      const result = await tryShopifyJson(jsonUrl, rawUrl);
      if (result) return result;
    } catch {
      // fall through
    }
  }

  // Tier 2-4: fetch HTML
  const buf = await safeFetchUserUrl(rawUrl, FETCH_OPTS);
  const html = buf.toString("utf8");

  // Tier 2: JSON-LD Product
  const jsonLd = parseJsonLdProduct(html);
  if (jsonLd) {
    return {
      ...jsonLd,
      brand: jsonLd.brand ?? extractSiteName(html),
      imageUrl: resolveUrl(jsonLd.imageUrl, rawUrl),
      additionalImages: jsonLd.additionalImages.map((u) => resolveUrl(u, rawUrl)).filter(Boolean) as string[],
      sourceUrl: rawUrl,
      source: "json-ld",
    };
  }

  // Tier 3: Open Graph
  const og = parseOpenGraph(html);
  if (og.title || og.image) {
    return {
      name: og.title ?? extractTitle(html) ?? new URL(rawUrl).hostname,
      description: og.description ?? extractMetaDescription(html) ?? "",
      imageUrl: resolveUrl(og.image, rawUrl),
      additionalImages: [],
      brand: og.siteName ?? extractSiteName(html),
      price: null,
      source: "open-graph",
      sourceUrl: rawUrl,
    };
  }

  // Tier 4: fallback
  return {
    name: extractTitle(html) ?? new URL(rawUrl).hostname,
    description: extractMetaDescription(html) ?? "",
    imageUrl: resolveUrl(extractFirstMainImage(html), rawUrl),
    additionalImages: [],
    brand: extractSiteName(html),
    price: null,
    source: "fallback-html",
    sourceUrl: rawUrl,
  };
}

// ─── Tier 1: Shopify .json ───────────────────────────────────────────────────

async function tryShopifyJson(jsonUrl: string, originalUrl: string): Promise<ProductInfo | null> {
  let buf: Buffer;
  try {
    buf = await safeFetchUserUrl(jsonUrl, FETCH_OPTS);
  } catch {
    return null;
  }
  let data: unknown;
  try {
    data = JSON.parse(buf.toString("utf8"));
  } catch {
    return null;
  }
  const obj = data as { product?: ShopifyProduct };
  const product = obj.product;
  if (!product || typeof product !== "object") return null;

  const images = (product.images ?? []).map((i) => i.src).filter(Boolean) as string[];
  const variants = product.variants ?? [];
  const firstVariant = variants[0];

  return {
    name: product.title ?? "Product",
    description: stripHtml(product.body_html ?? "").slice(0, 600),
    imageUrl: images[0] ?? null,
    additionalImages: images.slice(1, 8),
    brand: product.vendor ?? null,
    price: firstVariant?.price ? `$${firstVariant.price}` : null,
    source: "shopify-json",
    sourceUrl: originalUrl,
  };
}

interface ShopifyProduct {
  title?: string;
  body_html?: string;
  vendor?: string;
  images?: Array<{ src: string }>;
  variants?: Array<{ price?: string }>;
}

// ─── Tier 2: JSON-LD ─────────────────────────────────────────────────────────

interface JsonLdResult {
  name: string;
  description: string;
  imageUrl: string | null;
  additionalImages: string[];
  brand: string | null;
  price: string | null;
}

function parseJsonLdProduct(html: string): JsonLdResult | null {
  // Match every <script type="application/ld+json">…</script> block.
  // [\s\S] needed so . matches across newlines (no /s flag needed for older Node).
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const blob = match[1].trim();
    let data: unknown;
    try {
      data = JSON.parse(blob);
    } catch {
      continue;
    }

    const product = findProductNode(data);
    if (!product) continue;
    return jsonLdToProductInfo(product);
  }
  return null;
}

// Recurse to find a `@type: "Product"` node — JSON-LD often nests Product
// inside @graph arrays or BreadcrumbList siblings.
function findProductNode(node: unknown): Record<string, unknown> | null {
  if (!node) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findProductNode(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof node !== "object") return null;
  const obj = node as Record<string, unknown>;
  const type = obj["@type"];
  if (typeof type === "string" && type.toLowerCase() === "product") return obj;
  if (Array.isArray(type) && type.some((t) => typeof t === "string" && t.toLowerCase() === "product")) return obj;
  // Descend into @graph and other nested holders
  for (const key of ["@graph", "mainEntity", "itemListElement"] as const) {
    if (key in obj) {
      const found = findProductNode(obj[key]);
      if (found) return found;
    }
  }
  return null;
}

function jsonLdToProductInfo(p: Record<string, unknown>): JsonLdResult {
  const name = stringOr(p.name, "Product");
  const description = stripHtml(stringOr(p.description, "")).slice(0, 600);

  // image can be string | string[] | { url } | array of those
  const imageRaw = p.image;
  const images = normalizeImageField(imageRaw);

  // brand can be string | { name }
  let brand: string | null = null;
  const brandRaw = p.brand;
  if (typeof brandRaw === "string") brand = brandRaw;
  else if (brandRaw && typeof brandRaw === "object") {
    const bn = (brandRaw as Record<string, unknown>).name;
    if (typeof bn === "string") brand = bn;
  }

  // price often lives in offers[0].price or offers.price
  let price: string | null = null;
  const offers = p.offers;
  const offer = Array.isArray(offers) ? offers[0] : offers;
  if (offer && typeof offer === "object") {
    const o = offer as Record<string, unknown>;
    const priceVal = o.price ?? o.lowPrice;
    const currency = stringOr(o.priceCurrency, "USD");
    if (priceVal !== undefined && priceVal !== null) {
      const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : `${currency} `;
      price = `${symbol}${priceVal}`;
    }
  }

  return {
    name,
    description,
    imageUrl: images[0] ?? null,
    additionalImages: images.slice(1, 8),
    brand,
    price,
  };
}

function normalizeImageField(v: unknown): string[] {
  if (!v) return [];
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) {
    const out: string[] = [];
    for (const item of v) {
      if (typeof item === "string") out.push(item);
      else if (item && typeof item === "object") {
        const url = (item as Record<string, unknown>).url;
        if (typeof url === "string") out.push(url);
      }
    }
    return out;
  }
  if (typeof v === "object") {
    const url = (v as Record<string, unknown>).url;
    if (typeof url === "string") return [url];
  }
  return [];
}

// ─── Tier 3: Open Graph ──────────────────────────────────────────────────────

function parseOpenGraph(html: string): {
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
} {
  return {
    title: extractMeta(html, "og:title"),
    description: extractMeta(html, "og:description"),
    image: extractMeta(html, "og:image:secure_url") ?? extractMeta(html, "og:image"),
    siteName: extractMeta(html, "og:site_name"),
  };
}

function extractMeta(html: string, property: string): string | null {
  // Allow both `property=` and `name=` attribute forms; both orders of attrs.
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `<meta\\s+[^>]*?(?:property|name)=["']${escaped}["'][^>]*?content=["']([^"']+)["']`,
    "i",
  );
  const re2 = new RegExp(
    `<meta\\s+[^>]*?content=["']([^"']+)["'][^>]*?(?:property|name)=["']${escaped}["']`,
    "i",
  );
  return (html.match(re)?.[1] ?? html.match(re2)?.[1] ?? null);
}

// ─── Tier 4: fallback ────────────────────────────────────────────────────────

function extractTitle(html: string): string | null {
  return html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? null;
}

function extractMetaDescription(html: string): string | null {
  return extractMeta(html, "description");
}

function extractFirstMainImage(html: string): string | null {
  // Prefer <main>...<img src="..."> but fall back to body-wide
  const mainMatch = html.match(/<main[\s\S]*?<img[^>]+src=["']([^"']+)["']/i);
  if (mainMatch?.[1]) return mainMatch[1];
  return html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ?? null;
}

function extractSiteName(html: string): string | null {
  return extractMeta(html, "og:site_name") ?? extractMeta(html, "application-name");
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function stringOr(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function resolveUrl(maybeRelative: string | null, base: string): string | null {
  if (!maybeRelative) return null;
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return null;
  }
}
