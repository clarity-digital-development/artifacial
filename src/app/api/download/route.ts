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

  // Only allow downloading from our R2 bucket or known generation API domains
  const r2Domain = process.env.R2_ACCOUNT_ID
    ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : null;

  const allowed = [
    r2Domain,
    process.env.R2_PUBLIC_URL,
    process.env.R2_BUCKET_URL,
    "https://cdn.piapi.ai",
    "https://resource.piapi.ai",
  ].filter(Boolean);

  const isAllowed = allowed.some((prefix) => url.startsWith(prefix!));
  if (!isAllowed) {
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
