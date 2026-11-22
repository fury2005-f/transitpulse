"use client";

import { useEffect, useRef, useState } from "react";
import { OctagonAlert, Users } from "lucide-react";
import { Forecast, Status, Surge, capacityStatus, disclosure, fmt, fmtDay, fmtLongDate, mostCommon, panel } from "../lib";
import CapacityTable from "./CapacityTable";

const STATUS_BAR: Record<Status, string> = {
  over: "bg-critical",
  busy: "bg-busy",
  normal: "bg-accent",
  quiet: "bg-accent opacity-60",
};

const TONE: Record<Status, string> = {
  over: "bg-critical-wash text-critical",
  busy: "bg-busy-wash text-busy",
  normal: "bg-sunken text-ink-2",
  quiet: "bg-sunken text-ink-2",
};

const GROUP: Record<string, string> = {
  Domestic: "local", Western: "Western", "East Asian": "East Asian",
  "Southeast Asian": "Southeast Asian", Gulf: "Gulf", Other: "international",
};

const noYear = (iso: string) => fmtLongDate(iso).replace(/ \d{4}$/, "");
const about = (n: number) => fmt(Math.round(n / 100) * 100);
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function times(lo: number, hi: number) {
  const [a, b] = [Math.round(lo), Math.round(hi)];
  if (a === b) return a === 2 ? "about twice" : `about ${a} times`;
  return `${a} to ${b} times`;
}

function places(locations: string[]) {
  if (locations.length === 4) return "every location";
  if (locations.length === 1) return locations[0];
  return `${locations.slice(0, -1).join(", ")} and ${locations[locations.length - 1]}`;
}

type Item = { key: string; date: string; icon: "over" | "surge"; headline: string; detail: string };

export default function SituationHero({ forecasts, surges, surgesError }: {
  forecasts: Forecast[];
  surges?: Surge[];
  surgesError: string | null;
}) {
  const today = forecasts[0].today;
  const todayTotal = forecasts.reduce((sum, f) => sum + f.daily[0].total_riders, 0);

  const items: Item[] = [
    ...forecasts.flatMap((f) =>
      f.daily
        .filter((d) => d.capacity_used_pct >= 100)
        .map((d) => ({
          key: `${f.location}-${d.date}`,
          date: d.date,
          icon: "over" as const,
          headline: `${f.location_name} will be over its limit on ${noYear(d.date)}`,
          detail: `About ${about(d.total_riders)} people are expected. The daily limit is ${fmt(f.daily_capacity)}.`,
        })),
    ),
    ...[...(surges ?? [])]
      .sort((a, b) => b.extra_riders - a.extra_riders)
      .slice(0, 3)
      .map((s) => ({
        key: `${s.date}-${s.region}`,
        date: s.date,
        icon: "surge" as const,
        headline: capitalise(
          `${times(s.ratio_min, s.ratio_max)} as many ${GROUP[s.region] ?? s.region} visitors as usual on ${s.holiday.split(", ")[0]}, ${fmtDay(s.date)}`,
        ),
        detail: `At ${places(s.locations)}. Prepare: ${s.services}.`,
      })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <section id="today" className="scroll-mt-14 py-14 sm:py-20" aria-labelledby="today-heading">
      <div className="reveal">
        <p className="text-sm font-medium text-accent">Operations overview</p>
        <h1 id="today-heading" className="mt-2 text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
          {noYear(today)}
        </h1>
        <p className="mt-3 text-lg text-ink-2">
          About <span className="font-semibold text-ink">{about(todayTotal)}</span> people expected today across all four locations.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {forecasts.map((f, i) => (
          <LocationCard key={f.location} forecast={f} index={i} />
        ))}
      </div>

      {items.length > 0 ? (
        <div className="reveal mt-12" style={{ "--d": "400ms" } as React.CSSProperties}>
          <h2 className="text-lg font-semibold">Needs attention this week</h2>
          <ul className="mt-4 space-y-3">
            {items.map((item) => (
              <li key={item.key} className={`flex gap-4 rounded-xl glass p-4 transition-colors duration-150 ${item.icon === "over" ? "hover:border-critical/30" : "hover:border-accent/30"}`}>
                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${item.icon === "over" ? "bg-critical-wash" : "bg-sunken"}`}>
                  {item.icon === "over" ? (
                    <OctagonAlert size={16} className="text-critical" aria-label="Over limit" />
                  ) : (
                    <Users size={16} className="text-accent" aria-label="Visitor surge" />
                  )}
                </span>
                <div>
                  <p className="text-sm font-semibold">{item.headline}</p>
                  <p className="mt-0.5 text-sm text-ink-2">{item.detail}</p>
                </div>
              </li>
            ))}
            {!surges && (
              <li className="rounded-xl glass p-4 text-sm text-ink-2">
                {surgesError ? `Visitor surges could not be checked: ${surgesError}` : "Checking for visitor surges…"}
              </li>
            )}
          </ul>
          <details className="mt-5">
            <summary className={disclosure}>See every busy day at each location</summary>
            <CapacityTable forecasts={forecasts} />
          </details>
        </div>
      ) : surges ? (
        <p className="reveal mt-10 text-ink-2" style={{ "--d": "400ms" } as React.CSSProperties}>
          Nothing needs attention this week.
        </p>
      ) : !surgesError ? (
        <p className="reveal mt-10 text-sm text-ink-2" style={{ "--d": "400ms" } as React.CSSProperties}>
          Checking for visitor surges{"…"}
        </p>
      ) : null}
    </section>
  );
}

function LocationCard({ forecast, index }: { forecast: Forecast; index: number }) {
  const day = forecast.daily[0];
  const s = capacityStatus(day.capacity_used_pct);
  const holiday = mostCommon(Object.values(day.holidays));

  return (
    <div
      className={`reveal-scale hover-lift ${panel} flex flex-col p-5`}
      style={{ "--d": `${index * 100 + 100}ms` } as React.CSSProperties}
    >
      <p className="text-sm font-medium text-ink-2">{forecast.location_name}</p>
      <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight sm:text-4xl">
        <CountUp target={day.total_riders} />
      </p>
      <p className="mt-0.5 text-xs text-muted">people expected</p>
      <CapBar pct={day.capacity_used_pct} status={s.status} />
      <div className="mt-4 flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${TONE[s.status]}`}>
          {s.label}
        </span>
        {holiday && <span className="truncate text-xs text-ink-2">{holiday}</span>}
      </div>
    </div>
  );
}

function CountUp({ target }: { target: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = fmt(target);
      return;
    }
    let frame: number;
    let start: number;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / 800, 1);
      el.textContent = fmt(Math.round(p * p * (3 - 2 * p) * target));
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return <span ref={ref}>0</span>;
}

function CapBar({ pct, status }: { pct: number; status: Status }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <div className="mt-4 h-2 overflow-hidden rounded-full bg-sunken" role="meter" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Capacity">
      <div
        className={`h-full rounded-full transition-[width] duration-1000 ease-out motion-reduce:transition-none ${STATUS_BAR[status]}`}
        style={{ width: mounted ? `${Math.min(pct, 100)}%` : "0%" }}
      />
    </div>
  );
}
