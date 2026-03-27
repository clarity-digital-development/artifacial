"use client";

import { useRef, useCallback, useEffect, type ReactNode } from "react";

type SettingsSheetProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

export function SettingsSheet({ open, onClose, children }: SettingsSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const currentTranslateY = useRef(0);

  // Drag-to-dismiss
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const sheetTop = sheetRef.current?.getBoundingClientRect().top ?? 0;
    if (touch.clientY - sheetTop < 40) {
      dragStartY.current = touch.clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (dragStartY.current === null || !sheetRef.current) return;
    const deltaY = e.touches[0].clientY - dragStartY.current;
    if (deltaY > 0) {
      currentTranslateY.current = deltaY;
      sheetRef.current.style.transform = `translateY(${deltaY}px)`;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (dragStartY.current === null || !sheetRef.current) return;
    if (currentTranslateY.current > 100) {
      onClose();
    } else {
      sheetRef.current.style.transform = "translateY(0)";
      sheetRef.current.style.transition = "transform 200ms ease-out";
      setTimeout(() => {
        if (sheetRef.current) sheetRef.current.style.transition = "";
      }, 200);
    }
    dragStartY.current = null;
    currentTranslateY.current = 0;
  }, [onClose]);

  // Reset transform when opening
  useEffect(() => {
    if (open && sheetRef.current) {
      sheetRef.current.style.transform = "translateY(0)";
    }
  }, [open]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`no-stagger fixed inset-0 z-50 bg-black transition-opacity duration-300 md:hidden ${
          open ? "opacity-50 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`no-stagger fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] transition-transform duration-300 md:hidden ${
          open ? "translate-y-0" : "translate-y-full pointer-events-none"
        }`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Drag handle */}
        <div className="sticky top-0 z-10 flex justify-center bg-[var(--bg-surface)] pb-2 pt-3">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        {/* Content — pb-20 clears the mobile nav bar */}
        <div className="px-4 pb-20">
          {children}
        </div>
      </div>
    </>
  );
}
