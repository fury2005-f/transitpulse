import { TriangleAlert } from "lucide-react";

export default function Footer() {
  return (
    <footer className="section-divide mt-8">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-8 text-sm text-ink-2 sm:px-6 lg:px-10">
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-accent text-[10px] font-bold text-accent-ink">TP</span>
          <span className="font-semibold text-ink">TransitPulse</span>
        </div>
        <p className="flex items-center gap-2 text-muted">
          <TriangleAlert size={14} aria-hidden />
          All data is synthetic — this is a method demonstration
        </p>
      </div>
    </footer>
  );
}
