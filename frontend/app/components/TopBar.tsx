const LINKS = [
  ["#today", "Today"],
  ["#briefing", "Briefing"],
  ["/chat", "AI Chat"],
  ["/data", "Data"],
  ["#forecast", "Forecast"],
];

export default function TopBar() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-page/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-3 sm:px-6 lg:px-10">
        <a href="/" className="flex items-center gap-2.5 rounded outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-xs font-bold text-accent-ink">TP</span>
          <span className="text-base font-semibold tracking-tight">TransitPulse</span>
        </a>
        <nav aria-label="Sections" className="hidden items-center gap-1 sm:flex">
          {LINKS.map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="rounded-md px-3 py-1.5 text-sm text-ink-2 outline-none transition-colors duration-150 hover:bg-sunken hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
            >
              {label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
