/**
 * GET /docs/mcp/skill
 *
 * Public, unauthenticated, plain-text mirror of the same markdown skill
 * document served via the MCP server at `artifacial://skill/usage-guide`.
 * Lets users link it from blog posts, share it with their team, paste it
 * into Claude as context manually, or download it for offline use.
 */

import { NextResponse } from "next/server";
import { SKILL_CONTENT } from "@/lib/mcp/skill";

export const runtime = "nodejs";

export async function GET() {
  return new NextResponse(SKILL_CONTENT, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Content-Disposition": 'inline; filename="artifacial-mcp-skill.md"',
    },
  });
}
