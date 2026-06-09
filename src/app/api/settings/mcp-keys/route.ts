/**
 * Settings — API key management.
 *
 * GET    → list user's keys (no raw key — only prefix + metadata)
 * POST   → create a new key, returns the raw value ONCE
 * DELETE → revoke a key by id
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateApiKey, hashApiKey } from "@/lib/mcp/keys";

const MAX_KEYS_PER_USER = 5;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const keys = await prisma.apiKey.findMany({
    where: { userId: session.user.id, revokedAt: null },
    select: { id: true, name: true, prefix: true, createdAt: true, lastUsedAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ keys });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : "";
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const active = await prisma.apiKey.count({
    where: { userId: session.user.id, revokedAt: null },
  });
  if (active >= MAX_KEYS_PER_USER) {
    return NextResponse.json(
      { error: `Maximum ${MAX_KEYS_PER_USER} active keys per account. Revoke an existing key first.` },
      { status: 400 },
    );
  }

  const { raw, prefix } = generateApiKey();
  const hash = hashApiKey(raw);

  const row = await prisma.apiKey.create({
    data: { userId: session.user.id, name, prefix, hash },
    select: { id: true, name: true, prefix: true, createdAt: true },
  });

  return NextResponse.json({
    key: { ...row, raw },
    notice: "Save this key — it will not be shown again.",
  });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const row = await prisma.apiKey.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, revokedAt: true },
  });
  if (!row) return NextResponse.json({ error: "Key not found" }, { status: 404 });
  if (row.revokedAt) return NextResponse.json({ error: "Already revoked" }, { status: 400 });

  await prisma.apiKey.update({
    where: { id: row.id },
    data: { revokedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
