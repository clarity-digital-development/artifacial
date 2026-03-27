"use client";

type BottomButtonProps = {
  isGenerating: boolean;
  onClick: () => void;
};

export function BottomButton({ isGenerating, onClick }: BottomButtonProps) {
  return (
    <div className="no-stagger fixed bottom-16 left-0 right-0 z-40 px-4 pb-[env(safe-area-inset-bottom)] md:hidden">
      <button
        onClick={onClick}
        disabled={isGenerating}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] bg-[var(--accent-amber)] text-base font-semibold text-[var(--bg-deep)] shadow-[0_0_24px_rgba(232,166,52,0.2)] transition-all duration-200 disabled:opacity-50"
      >
        {isGenerating ? (
          <>
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2v4m0 12v4m-7.07-3.93 2.83-2.83m8.48-8.48 2.83-2.83M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83" />
            </svg>
            Generating...
          </>
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Generation
          </>
        )}
      </button>
    </div>
  );
}
