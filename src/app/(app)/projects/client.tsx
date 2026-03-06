"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

interface ProjectItem {
  id: string;
  name: string;
  status: string;
  characterName: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_VARIANT: Record<string, "default" | "amber" | "success" | "error"> = {
  draft: "default",
  generating: "amber",
  complete: "success",
  failed: "error",
};

export function ProjectsClient({ projects }: { projects: ProjectItem[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const handleNewProject = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed to create project");
      const project = await res.json();
      router.push(`/projects/${project.id}`);
    } catch {
      setCreating(false);
    }
  };

  return (
    <div>
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">
            Projects
          </h1>
          <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
            {projects.length > 0
              ? `${projects.length} project${projects.length !== 1 ? "s" : ""}`
              : "Your video projects"}
          </p>
        </div>
        <button
          onClick={handleNewProject}
          disabled={creating}
          className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-5 py-2.5 text-sm font-semibold text-[var(--bg-deep)] shadow-[0_0_24px_rgba(232,166,52,0.12)] transition-all duration-200 hover:bg-[var(--accent-amber-dim)] disabled:pointer-events-none disabled:opacity-40"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {creating ? "Creating..." : "New Project"}
        </button>
      </div>

      {projects.length === 0 ? (
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
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </div>
          </div>
          <h2 className="font-display text-xl font-bold text-[var(--text-primary)]">
            Start your first project
          </h2>
          <p className="mt-3 max-w-sm text-center text-sm leading-relaxed text-[var(--text-secondary)]">
            Create a project, describe your video, and generate it with your characters.
          </p>
          <button
            onClick={handleNewProject}
            disabled={creating}
            className="mt-8 rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-6 py-3 font-semibold text-[var(--bg-deep)] shadow-[0_0_24px_rgba(232,166,52,0.12)] transition-all duration-200 hover:bg-[var(--accent-amber-dim)] disabled:pointer-events-none disabled:opacity-40"
          >
            {creating ? "Creating..." : "Create Project"}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <div className="group rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 transition-all duration-300 hover:border-[var(--border-default)] hover:bg-[var(--bg-elevated)]">
                <div className="mb-3 flex items-start justify-between">
                  <h3 className="font-medium text-[var(--text-primary)] transition-colors duration-200 group-hover:text-[var(--accent-amber)]">
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
      )}
    </div>
  );
}
