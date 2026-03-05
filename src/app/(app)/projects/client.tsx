"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card } from "@/components/ui";
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
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">
            Projects
          </h1>
          <p className="mt-1 text-[var(--text-sm)] text-[var(--text-secondary)]">
            Your video projects
          </p>
        </div>
        <Button onClick={handleNewProject} disabled={creating}>
          {creating ? "Creating..." : "+ New Project"}
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-[var(--border-default)]">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-[var(--text-muted)]"
            >
              <rect x="2" y="2" width="20" height="20" rx="2.18" />
              <line x1="7" y1="2" x2="7" y2="22" />
              <line x1="17" y1="2" x2="17" y2="22" />
              <line x1="2" y1="12" x2="22" y2="12" />
            </svg>
          </div>
          <h2 className="font-display text-xl font-semibold text-[var(--text-primary)]">
            Start your first project
          </h2>
          <p className="mt-2 max-w-sm text-center text-[var(--text-sm)] text-[var(--text-secondary)]">
            Create a project, describe your video, and generate it with your characters
          </p>
          <Button className="mt-6" onClick={handleNewProject} disabled={creating}>
            {creating ? "Creating..." : "Create Project"}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card hover className="p-5">
                <div className="mb-3 flex items-start justify-between">
                  <h3 className="font-medium text-[var(--text-primary)]">
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
      )}
    </div>
  );
}
