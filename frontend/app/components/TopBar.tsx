const LINKS = [
  ["#today", "Today"],
  ["#briefing", "Briefing"],
  ["#ask", "Ask"],
  ["#forecast", "Forecast"],
];

export default function TopBar() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-4 py-4 sm:px-6">
        <a href="#today" className="rounded font-serif text-xl font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-accent">
          TransitPulse
        </a>
        <nav aria-label="Sections" className="hidden items-center gap-6 text-sm text-ink-2 sm:flex">
          {LINKS.map(([href, label]) => (
            <a key={href} href={href} className="rounded outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-accent">
              {label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
