import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
import { MobileNav } from "@/components/mobile-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  let totalCredits = 100;
  let contentMode = "SFW";
  let subscriptionTier = "FREE";
  let hasDateOfBirth = false;

  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        subscriptionCredits: true,
        purchasedCredits: true,
        contentMode: true,
        subscriptionTier: true,
        dateOfBirth: true,
      },
    });
    totalCredits = (user?.subscriptionCredits ?? 0) + (user?.purchasedCredits ?? 0);
    contentMode = user?.contentMode ?? "SFW";
    subscriptionTier = user?.subscriptionTier ?? "FREE";
    hasDateOfBirth = !!user?.dateOfBirth;
  }

  return (
    <div className="grain ambient-light flex h-screen bg-[var(--bg-deep)]">
      <Sidebar contentMode={contentMode} />
      <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
        <TopBar
          user={session?.user ?? { name: "Preview", email: "preview@test.com" }}
          credits={totalCredits}
          contentMode={contentMode}
          subscriptionTier={subscriptionTier}
          hasDateOfBirth={hasDateOfBirth}
        />
        <main className="stagger-reveal flex-1 overflow-y-auto px-4 py-4 pb-20 md:px-8 md:py-6 md:pb-6 lg:px-12">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
