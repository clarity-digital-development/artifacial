import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { imageCredits: true, videoCredits: true },
  });

  return (
    <div className="grain ambient-light vignette flex h-screen bg-[var(--bg-deep)]">
      <Sidebar />
      <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
        <TopBar
          user={session.user}
          credits={{
            image: user?.imageCredits ?? 0,
            video: user?.videoCredits ?? 0,
          }}
        />
        <main className="stagger-reveal flex-1 overflow-y-auto px-8 py-6 lg:px-12">
          {children}
        </main>
      </div>
    </div>
  );
}
