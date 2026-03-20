import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSignedR2Url } from "@/lib/r2";
import { GalleryClient } from "./gallery-client";
import Link from "next/link";

export default async function GalleryPage() {
  const session = await auth();
  // TODO: re-enable auth redirect before shipping
  // if (!session?.user?.id) redirect("/sign-in");
  const userId = session?.user?.id;

  const generations = userId ? await prisma.generation.findMany({
    where: {
      userId,
      status: "COMPLETED",
      outputUrl: { not: null },
    },
    orderBy: { completedAt: "desc" },
    take: 60,
    select: {
      id: true,
      workflowType: true,
      modelId: true,
      contentMode: true,
      resolution: true,
      durationSec: true,
      withAudio: true,
      creditsCost: true,
      outputUrl: true,
      thumbnailUrl: true,
      inputParams: true,
      generationTimeMs: true,
      queuedAt: true,
      completedAt: true,
    },
  }) : [];

  const items = await Promise.all(
    generations.map(async (g) => {
      let videoUrl: string | null = null;

      try {
        if (g.outputUrl) {
          // R2 keys don't start with http — sign them
          videoUrl = g.outputUrl.startsWith("http")
            ? g.outputUrl
            : await getSignedR2Url(g.outputUrl, 86400);
        }
      } catch {
        // R2 may not be configured in dev
      }

      const params = g.inputParams as Record<string, unknown> | null;
      const prompt = (params?.prompt as string) ?? null;

      return {
        id: g.id,
        videoUrl,
        prompt,
        modelId: g.modelId ?? "unknown",
        workflowType: g.workflowType,
        resolution: g.resolution,
        durationSec: g.durationSec ?? 5,
        withAudio: g.withAudio,
        creditsCost: g.creditsCost,
        generationTimeMs: g.generationTimeMs,
        completedAt: g.completedAt?.toISOString() ?? g.queuedAt.toISOString(),
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
            Your completed generations
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
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="m10 8 5 3-5 3z" />
                <line x1="2" y1="21" x2="22" y2="21" />
                <line x1="7" y1="17" x2="7" y2="21" />
                <line x1="17" y1="17" x2="17" y2="21" />
              </svg>
            </div>
          </div>
          <h2 className="font-display text-xl font-bold text-[var(--text-primary)]">
            No generations yet
          </h2>
          <p className="mt-3 max-w-sm text-center text-sm leading-relaxed text-[var(--text-secondary)]">
            Your completed videos will appear here. Head to the generator to
            create your first one.
          </p>
          <Link
            href="/generate"
            className="mt-8 rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-6 py-3 font-semibold text-[var(--bg-deep)] shadow-[0_0_24px_rgba(232,166,52,0.12)] transition-all duration-200 hover:bg-[var(--accent-amber-dim)]"
          >
            Start Generating
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">
            Gallery
          </h1>
          <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
            {items.length} completed generation{items.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/generate"
          className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-5 py-2.5 text-sm font-semibold text-[var(--bg-deep)] shadow-[0_0_24px_rgba(232,166,52,0.12)] transition-all duration-200 hover:bg-[var(--accent-amber-dim)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Generation
        </Link>
      </div>

      <GalleryClient items={items} />
    </div>
  );
}
