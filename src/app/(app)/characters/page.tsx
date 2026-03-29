import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCharactersWithSignedUrls } from "@/lib/characters";

export default async function CharactersPage() {
  const session = await auth();
  // TODO: re-enable auth redirect before shipping
  // if (!session?.user?.id) redirect("/sign-in");
  const userId = session?.user?.id;

  const characters = userId ? await getCharactersWithSignedUrls(userId) : [];

  return (
    <div>
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">
            Characters
          </h1>
          <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
            {characters.length > 0
              ? `${characters.length} character${characters.length !== 1 ? "s" : ""} in your library`
              : "Your character library"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/edit"
            className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--accent-amber)]/40 px-4 py-2.5 text-sm font-semibold text-[var(--accent-amber)] transition-all duration-200 hover:border-[var(--accent-amber)] hover:bg-[var(--accent-amber-glow)]"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            Photo Editor
          </Link>
          <Link
            href="/characters/new"
            className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-5 py-2.5 text-sm font-semibold text-[var(--bg-deep)] shadow-[0_0_24px_rgba(232,166,52,0.12)] transition-all duration-200 hover:bg-[var(--accent-amber-dim)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Character
          </Link>
        </div>
      </div>

      {characters.length === 0 ? (
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
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
          </div>
          <h2 className="font-display text-xl font-bold text-[var(--text-primary)]">
            Cast your first character
          </h2>
          <p className="mt-3 max-w-sm text-center text-sm leading-relaxed text-[var(--text-secondary)]">
            Upload a selfie or describe who you want to be. Your character will star in every video you create.
          </p>
          <Link
            href="/characters/new"
            className="mt-8 rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-6 py-3 font-semibold text-[var(--bg-deep)] shadow-[0_0_24px_rgba(232,166,52,0.12)] transition-all duration-200 hover:bg-[var(--accent-amber-dim)]"
          >
            Create Character
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          <Link href="/characters/new">
            <div className="group flex aspect-[3/4] flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] transition-all duration-300 hover:border-[var(--accent-amber)]/40 hover:bg-[var(--bg-elevated)]">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-[var(--accent-amber)]/40 text-[var(--accent-amber)] transition-all duration-300 group-hover:border-[var(--accent-amber)] group-hover:bg-[var(--accent-amber-glow)]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
              <span className="text-sm font-medium text-[var(--text-secondary)]">
                New Character
              </span>
            </div>
          </Link>

          {characters.map((character) => (
            <Link key={character.id} href={`/characters/${character.id}`}>
              <div className="group overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] transition-all duration-300 hover:border-[var(--border-default)] hover:shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
                <div className="relative aspect-[3/4] overflow-hidden bg-[var(--bg-input)]">
                  {character.signedUrls[0] ? (
                    <img
                      src={character.signedUrls[0]}
                      alt={character.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <span className="font-display text-4xl text-[var(--text-muted)]">
                        {character.name[0]}
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[var(--bg-surface)] to-transparent" />
                  <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <span className="absolute left-3 top-3 h-3 w-3 border-l border-t border-[var(--accent-amber)]/50" />
                    <span className="absolute right-3 top-3 h-3 w-3 border-r border-t border-[var(--accent-amber)]/50" />
                    <span className="absolute bottom-3 left-3 h-3 w-3 border-b border-l border-[var(--accent-amber)]/50" />
                    <span className="absolute bottom-3 right-3 h-3 w-3 border-b border-r border-[var(--accent-amber)]/50" />
                  </div>
                </div>
                <div className="p-3.5">
                  <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                    {character.name}
                  </p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                    {character.style}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
