import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { contentMode } = await req.json();

  if (contentMode !== "SFW" && contentMode !== "NSFW") {
    return NextResponse.json({ error: "Invalid content mode" }, { status: 400 });
  }

  // Disabling NSFW — immediate, no confirmation needed
  if (contentMode === "SFW") {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { contentMode: "SFW" },
    });
    return NextResponse.json({ contentMode: "SFW" });
  }

  // Enabling NSFW — user confirmed they are 18+ via the modal
  await prisma.user.update({
    where: { id: session.user.id },
    data: { contentMode: "NSFW" },
  });

  return NextResponse.json({ contentMode: "NSFW" });
}
