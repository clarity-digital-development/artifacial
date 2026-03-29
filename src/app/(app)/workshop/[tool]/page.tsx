import { notFound } from "next/navigation";
import { getToolBySlug } from "@/lib/workshop/tools";
import { WorkshopToolPageClient } from "./tool-page-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tool: string }>;
}) {
  const { tool: slug } = await params;
  const tool = getToolBySlug(slug);
  return {
    title: tool ? `${tool.name} — Workshop` : "Workshop",
  };
}

export default async function WorkshopToolPage({
  params,
}: {
  params: Promise<{ tool: string }>;
}) {
  // TODO: re-enable auth
  const { tool: slug } = await params;
  const tool = getToolBySlug(slug);
  if (!tool) notFound();

  return <WorkshopToolPageClient tool={tool} totalCredits={0} />;
}
