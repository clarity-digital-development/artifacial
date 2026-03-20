import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NewCharacterClient } from "./new-character-client";

export default async function NewCharacterPage() {
  const session = await auth();
  let contentMode = "SFW";

  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { contentMode: true },
    });
    contentMode = user?.contentMode ?? "SFW";
  }

  return <NewCharacterClient contentMode={contentMode} />;
}
