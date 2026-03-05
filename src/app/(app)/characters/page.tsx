import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCharactersWithSignedUrls } from "@/lib/characters";
import { Card } from "@/components/ui/card";

export default async function CharactersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const characters = await getCharactersWithSignedUrls(session.user.id);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">
            Characters
          </h1>
          <p className="mt-1 text-[var(--text-sm)] text-[var(--text-secondary)]">
            Your character library
          </p>
        </div>
        <Link
          href="/characters/new"
          className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-4 py-2.5 text-[var(--text-base)] font-medium text-[var(--bg-deep)] transition-colors hover:bg-[var(--accent-amber-dim)]"
        >
          + New Character
        </Link>
      </div>

      {characters.length === 0 ? (
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
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <h2 className="font-display text-xl font-semibold text-[var(--text-primary)]">
            Cast your first character
          </h2>
          <p className="mt-2 max-w-sm text-center text-[var(--text-sm)] text-[var(--text-secondary)]">
            Upload a selfie or describe who you want to be
          </p>
          <div className="mt-6 flex gap-3">
            <Link
              href="/characters/new"
              className="rounded-[var(--radius-md)] bg-[var(--accent-amber)] px-5 py-2.5 font-medium text-[var(--bg-deep)] transition-colors hover:bg-[var(--accent-amber-dim)]"
            >
              Create Character
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {/* New character card */}
          <Link href="/characters/new">
            <Card
              hover
              className="flex aspect-[3/4] flex-col items-center justify-center gap-2 border-dashed"
            >
              <span className="text-2xl text-[var(--accent-amber)]">+</span>
              <span className="text-[var(--text-sm)] text-[var(--text-secondary)]">
                New Character
              </span>
            </Card>
          </Link>

          {characters.map((character) => (
            <Link key={character.id} href={`/characters/${character.id}`}>
              <Card hover className="overflow-hidden">
                <div className="aspect-[3/4] bg-[var(--bg-input)]">
                  {character.signedUrls[0] ? (
                    <img
                      src={character.signedUrls[0]}
                      alt={character.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <span className="text-3xl text-[var(--text-muted)]">
                        {character.name[0]}
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="truncate text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
                    {character.name}
                  </p>
                  <p className="text-[var(--text-xs)] capitalize text-[var(--text-muted)]">
                    {character.style}
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
