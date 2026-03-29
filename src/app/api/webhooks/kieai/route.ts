/**
 * KIE.AI webhook handler.
 *
 * KIE.AI requires a callbackUrl on every task submission. This endpoint
 * receives completion callbacks and logs them — the actual status is
 * resolved by client-side polling via /api/generate/[id]/status, so
 * this handler just acknowledges the request and returns 200.
 *
 * If we add server-side completion processing in the future, we can
 * look up the generation by kieAiTaskId from the inputParams JSON column
 * and finalize it here.
 */

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const taskId = body?.data?.taskId ?? body?.taskId ?? "(no taskId)";
    const state = body?.data?.state ?? body?.state ?? "(no state)";
    console.log(`[kieai-webhook] taskId=${taskId} state=${state}`);
  } catch {
    // Non-fatal — just acknowledge
  }

  return NextResponse.json({ ok: true });
}
