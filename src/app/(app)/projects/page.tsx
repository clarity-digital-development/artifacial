import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProjectsClient } from "./client";

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      character: { select: { name: true } },
    },
  });

  const serialized = projects.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    characterName: p.character?.name ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));

  return <ProjectsClient projects={serialized} />;
}
