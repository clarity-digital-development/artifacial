import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Proxies a file download to avoid cross-origin issues with R2 signed URLs.
 * The browser's `download` attribute only works for same-origin links, so we
 * stream the file through our own domain with Content-Disposition: attachment.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = req.nextUrl.searchParams.get("url");
  const filename = req.nextUrl.searchParams.get("filename") ?? "download";

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const hostname = parsed.hostname;

  // Allow our R2 account domain (*.r2.cloudflarestorage.com scoped to our account)
  const r2AccountId = process.env.R2_ACCOUNT_ID?.trim();
  const isR2 = r2AccountId
    ? hostname === `${r2AccountId}.r2.cloudflarestorage.com` ||
      hostname.endsWith(`.${r2AccountId}.r2.cloudflarestorage.com`)
    : hostname.endsWith(".r2.cloudflarestorage.com");

  // Allow our configured public/bucket URL prefixes
  const explicitPrefixes = [
    process.env.R2_PUBLIC_URL?.trim(),
    process.env.R2_BUCKET_URL?.trim(),
  ].filter(Boolean) as string[];

  const matchesPrefix = explicitPrefixes.some((p) => url.startsWith(p));

  // Allow all piapi.ai subdomains (our generation provider CDN)
  const isPiapi = hostname === "piapi.ai" || hostname.endsWith(".piapi.ai");

  if (!isR2 && !matchesPrefix && !isPiapi) {
    console.warn(`[download] blocked URL hostname=${hostname}`);
    return NextResponse.json({ error: "URL not allowed" }, { status: 403 });
  }

  try {
    const upstream = await fetch(url);
    if (!upstream.ok) {
      return NextResponse.json({ error: "Upstream fetch failed" }, { status: 502 });
    }

    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";

    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
