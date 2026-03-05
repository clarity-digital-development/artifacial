import { signIn } from "@/lib/auth";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-deep)]">
      <div className="w-full max-w-sm rounded-[var(--radius-lg)] bg-[var(--bg-surface)] p-8 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        <h1 className="mb-2 text-center font-display text-2xl font-bold text-[var(--text-primary)]">
          Artifacial
        </h1>
        <p className="mb-8 text-center text-sm text-[var(--text-secondary)]">
          Sign in to start creating
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/studio" });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-4 py-3 text-base font-medium text-[var(--bg-deep)] transition-colors hover:bg-[var(--accent-amber-dim)]"
          >
            Continue with Google
          </button>
        </form>
      </div>
    </div>
  );
}
