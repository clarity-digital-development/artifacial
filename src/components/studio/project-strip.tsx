"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";

interface ProjectData {
  id: string;
  name: string;
  status: string;
  characterName: string | null;
  updatedAt: string;
}

const STATUS_VARIANT: Record<string, "default" | "amber" | "success" | "error"> = {
  draft: "default",
  generating: "amber",
  complete: "success",
  failed: "error",
};

export function ProjectStrip({ projects }: { projects: ProjectData[] }) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
            Projects
          </h2>
          <span className="rounded-full bg-[var(--bg-elevated)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-muted)]">
            {projects.length}
          </span>
        </div>
        <Link
          href="/projects"
          className="text-xs font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-amber)]"
        >
          View All
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <Link key={project.id} href={`/projects/${project.id}`} className="block">
            <div className="group rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 transition-all duration-300 hover:border-[var(--border-default)] hover:bg-[var(--bg-elevated)]">
              <div className="mb-3 flex items-start justify-between">
                <h3 className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-amber)] transition-colors duration-200">
                  {project.name}
                </h3>
                <Badge variant={STATUS_VARIANT[project.status] ?? "default"}>
                  {project.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span className="flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  {project.characterName ?? "No character"}
                </span>
                <span>
                  {new Date(project.updatedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
