import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSignedR2Url } from "@/lib/r2";
import { GalleryClient } from "./gallery-client";
import Link from "next/link";

export default async function GalleryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const projects = await prisma.project.findMany({
    where: {
      userId: session.user.id,
      status: "complete",
      finalVideoUrl: { not: null },
    },
    orderBy: { updatedAt: "desc" },
    include: {
      character: { select: { name: true, referenceImages: true } },
    },
  });

  const items = await Promise.all(
    projects.map(async (p) => {
      let videoUrl: string | null = null;
      let characterThumbnail: string | null = null;

      try {
        if (p.finalVideoUrl) {
          videoUrl = await getSignedR2Url(p.finalVideoUrl, 86400);
        }
      } catch {
        // R2 may not be configured
      }

      try {
        if (p.character?.referenceImages[0]) {
          characterThumbnail = await getSignedR2Url(
            p.character.referenceImages[0],
            86400
          );
        }
      } catch {
        // R2 may not be configured
      }

      return {
        id: p.id,
        name: p.name,
        prompt: p.prompt,
        videoUrl,
        characterName: p.character?.name ?? null,
        characterThumbnail,
        completedAt: p.updatedAt.toISOString(),
      };
    })
  );

  if (items.length === 0) {
    return (
      <div>
        <div className="mb-10">
          <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">
            Gallery
          </h1>
          <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
            Your completed videos
          </p>
        </div>

        <div className="flex flex-col items-center justify-center py-24">
          <div className="relative mb-8">
            <div className="absolute -inset-4 rounded-full bg-[var(--accent-amber)] opacity-[0.03] blur-[40px]" />
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)]">
              <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-[var(--text-muted)]"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
            </div>
          </div>
          <h2 className="font-display text-xl font-bold text-[var(--text-primary)]">
            No videos yet
          </h2>
          <p className="mt-3 max-w-sm text-center text-sm leading-relaxed text-[var(--text-secondary)]">
            Your completed videos will appear here. Create a project and
            generate your first video to get started.
          </p>
          <Link
            href="/projects"
            className="mt-8 rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-6 py-3 font-semibold text-[var(--bg-deep)] shadow-[0_0_24px_rgba(232,166,52,0.12)] transition-all duration-200 hover:bg-[var(--accent-amber-dim)]"
          >
            Go to Projects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-10">
        <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">
          Gallery
        </h1>
        <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
          {items.length} completed video{items.length !== 1 ? "s" : ""}
        </p>
      </div>

      <GalleryClient items={items} />
    </div>
  );
}
