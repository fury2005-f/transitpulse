"use client";

import { OctagonAlert, TriangleAlert } from "lucide-react";
import { Forecast, Status, capacityStatus, fmt, fmtDay, mostCommon } from "../lib";

const TONE: Record<Status, string> = {
  over: "bg-critical-wash text-critical",
  busy: "bg-busy-wash text-busy",
  normal: "bg-sunken text-ink-2",
  quiet: "bg-sunken text-ink-2",
};

export default function WeekStrip({ forecast, selected, onSelect }: {
  forecast: Forecast;
  selected: string;
  onSelect: (date: string) => void;
}) {
  return (
    <div className="mt-10">
      <h3 className="font-semibold">How busy each day will be</h3>
      <p className="mt-1 text-sm text-ink-2">Pick a day to see who is coming.</p>
      <ol className="mt-4 grid auto-cols-[minmax(6.25rem,1fr)] grid-flow-col gap-2 overflow-x-auto pb-2">
        {forecast.daily.map((d) => {
          const s = capacityStatus(d.capacity_used_pct);
          const on = d.date === selected;
          const holiday = mostCommon(Object.values(d.holidays));
          return (
            <li key={d.date}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onSelect(d.date)}
                className={`flex h-full w-full flex-col items-start rounded-lg border bg-surface p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
                  on ? "border-accent ring-1 ring-accent" : "border-line hover:border-ink-2"
                }`}
              >
                <span className="text-sm text-ink-2">{fmtDay(d.date)}</span>
                <span className="mt-1 text-xl font-semibold tabular-nums">{fmt(d.total_riders)}</span>
                <span className="text-xs text-muted">people</span>
                <span className={`mt-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${TONE[s.status]}`}>
                  {s.status === "over" && <OctagonAlert size={12} aria-hidden />}
                  {s.status === "busy" && <TriangleAlert size={12} aria-hidden />}
                  {s.label}
                </span>
                {holiday && <span className="mt-2 text-xs text-ink-2">{holiday}</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
