import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { fileData, fileName } = await req.json();

  if (!fileData || !fileName) {
    return NextResponse.json({ error: "Missing fileData or fileName" }, { status: 400 });
  }

  const piApiKey = process.env.PIAPI_API_KEY;
  if (!piApiKey) {
    return NextResponse.json({ error: "API not configured" }, { status: 500 });
  }

  // Strip data URL prefix if present
  const base64Data = (fileData as string).startsWith("data:")
    ? (fileData as string).split(",")[1]
    : fileData;

  const res = await fetch("https://upload.theapi.app/api/ephemeral_resource", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": piApiKey,
    },
    body: JSON.stringify({ file_name: fileName, file_data: base64Data }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `Upload failed: ${text}` }, { status: 502 });
  }

  const data = await res.json();
  const url = data?.data?.url ?? data?.url;
  if (!url) {
    return NextResponse.json({ error: "No URL returned from upload service" }, { status: 502 });
  }

  return NextResponse.json({ url });
}
