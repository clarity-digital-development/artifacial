"use client";

import Link from "next/link";
import { Card } from "@/components/ui";
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
        <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
          Recent Projects
        </h2>
        <Link
          href="/projects"
          className="text-[var(--text-sm)] text-[var(--text-secondary)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-[var(--accent-amber)]"
        >
          View All
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <Link key={project.id} href={`/projects/${project.id}`} className="block">
            <Card hover className="p-4">
              <div className="mb-2 flex items-start justify-between">
                <h3 className="text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
                  {project.name}
                </h3>
                <Badge variant={STATUS_VARIANT[project.status] ?? "default"}>
                  {project.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-[var(--text-xs)] text-[var(--text-muted)]">
                <span>{project.characterName ?? "No character"}</span>
                <span>
                  {new Date(project.updatedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
