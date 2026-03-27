export default function CharactersLoading() {
  return (
    <div>
      <div className="mb-10 flex items-center justify-between">
        <div>
          <div className="h-8 w-40 animate-pulse rounded-[var(--radius-md)] bg-[var(--bg-elevated)]" />
          <div className="mt-2 h-4 w-56 animate-pulse rounded-[var(--radius-sm)] bg-[var(--bg-elevated)]" />
        </div>
        <div className="h-10 w-36 animate-pulse rounded-[var(--radius-md)] bg-[var(--bg-elevated)]" />
      </div>
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
            <div className="aspect-[3/4] animate-pulse bg-[var(--bg-elevated)]" />
            <div className="p-3.5">
              <div className="h-4 w-24 animate-pulse rounded bg-[var(--bg-elevated)]" />
              <div className="mt-1.5 h-3 w-16 animate-pulse rounded bg-[var(--bg-elevated)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
