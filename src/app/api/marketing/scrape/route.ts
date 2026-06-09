/**
 * POST /api/marketing/scrape
 * Body: { url: string }
 * Returns: ProductInfo (synchronous)
 *
 * Synchronous URL → structured product data. Tiered free-first strategy in
 * src/lib/marketing/scraper.ts (Shopify .json → JSON-LD → Open Graph →
 * fallback HTML). SSRF-hardened via safeFetchUserUrl.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fetchProductFromUrl } from "@/lib/marketing/scraper";
import { sanitizeClientError } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 });

  try {
    const product = await fetchProductFromUrl(url);
    return NextResponse.json({ product });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[marketing/scrape]", msg);
    return NextResponse.json({ error: sanitizeClientError(msg, "marketing/scrape") }, { status: 400 });
  }
}
