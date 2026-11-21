import { TriangleAlert } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-ink-2 sm:px-6">
        <p className="font-serif font-semibold text-ink">TransitPulse</p>
        <p className="flex items-center gap-2">
          <TriangleAlert size={14} aria-hidden />
          All data is synthetic — this is a method demonstration
        </p>
      </div>
    </footer>
  );
}
