import { Briefing, CHART as c, MIX_KEYS, MIX_LABELS, fmt, foldMix } from "../lib";

export default function BriefingSection({ briefing, error }: { briefing: Briefing | null; error: string | null }) {
  return (
    <section id="briefing" className="scroll-mt-6 border-t border-line py-12" aria-labelledby="briefing-title">
      <h2 id="briefing-title" className="font-serif text-2xl font-semibold sm:text-3xl">Morning briefing</h2>
      <p className="mt-2 max-w-prose text-ink-2">
        {briefing?.source === "gemini"
          ? "Written each morning by Gemini from the forecast. Every number in it is checked against the data."
          : "A summary of the week, written each morning from the forecast."}
      </p>

      {error ? (
        <p className="mt-5 text-ink-2">The briefing could not be loaded: {error}</p>
      ) : !briefing ? (
        <div className="mt-5 space-y-3" aria-label="Loading briefing">
          {[80, 65, 72].map((w) => (
            <div key={w} className="h-4 animate-pulse rounded bg-sunken motion-reduce:animate-none" style={{ width: `${w}%` }} />
          ))}
        </div>
      ) : (
        <>
          <TodayMix mix={briefing.facts.today_mix_pct} total={briefing.facts.today_total_riders} />
          <div className="mt-8 max-w-prose space-y-3 border-l-[3px] border-accent pl-5 leading-relaxed">{renderText(briefing.text)}</div>
        </>
      )}
    </section>
  );
}

function TodayMix({ mix, total }: { mix: Record<string, number>; total: number }) {
  const folded = foldMix(mix, true);
  const top = MIX_KEYS.filter((k) => folded[k] >= 1).sort((a, b) => folded[b] - folded[a]).slice(0, 5);
  return (
    <div className="mt-6 max-w-2xl">
      <p>About {fmt(Math.round(total / 100) * 100)} people are expected today across all four locations.</p>
      <div
        className="mt-3 flex h-3 gap-0.5 overflow-hidden rounded-full"
        role="img"
        aria-label={top.map((k) => `${MIX_LABELS[k]} ${folded[k].toFixed(1)}%`).join(", ")}
      >
        {MIX_KEYS.map((k) => (
          <span key={k} style={{ width: `${folded[k]}%`, background: c.mix[k] }} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums text-ink-2">
        {top.map((k) => (
          <li key={k} className="flex items-center gap-2">
            <span aria-hidden className="block h-2.5 w-2.5 rounded-sm" style={{ background: c.mix[k] }} />
            {MIX_LABELS[k]} {folded[k].toFixed(1)}%
          </li>
        ))}
      </ul>
    </div>
  );
}

// Light renderer for Gemini text (briefing and chat): section headings, bullets and paragraphs, markdown stripped.
export function renderText(text: string) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length)
      blocks.push(
        <ul key={blocks.length} className="list-disc space-y-2 pl-5 marker:text-muted">
          {list.map((item, i) => <li key={i}>{item}</li>)}
        </ul>,
      );
    list = [];
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || /^(transitpulse )?morning (operations )?briefing/i.test(line.replace(/\*\*/g, ""))) continue;
    const clean = line.replace(/\*\*/g, "").replace(/^#+\s*/, "");
    const bullet = clean.match(/^(?:[-*•]|\d+\.)\s+(.*)$/);
    if (bullet) {
      list.push(bullet[1]);
      continue;
    }
    flush();
    const heading = /^#/.test(line) || /^\*\*[^*]+\*\*:?$/.test(line) || (clean.length < 40 && !/[.!?]$/.test(clean));
    blocks.push(
      heading ? <h3 key={blocks.length} className="pt-2 font-semibold">{clean.replace(/:$/, "")}</h3> : <p key={blocks.length}>{clean}</p>,
    );
  }
  flush();
  return blocks;
}
