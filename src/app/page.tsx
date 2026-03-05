import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg-deep)] px-8">
      <h1 className="font-display text-[var(--text-3xl)] font-bold tracking-tight text-[var(--text-primary)]">
        Artifacial
      </h1>
      <p className="mt-4 max-w-md text-center text-[var(--text-secondary)]">
        Create AI characters from selfies or descriptions, then direct
        short-form videos scene by scene.
      </p>
      <div className="mt-10 flex gap-4">
        <Link
          href="/sign-in"
          className="rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-6 py-3 font-medium text-[var(--bg-deep)] transition-colors hover:bg-[var(--accent-amber-dim)]"
        >
          Get Started
        </Link>
        <Link
          href="/examples"
          className="rounded-[var(--radius-md)] border border-[var(--border-default)] px-6 py-3 font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)]"
        >
          See Examples
        </Link>
      </div>
    </div>
  );
}
