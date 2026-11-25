"use client";

import { useEffect, useState } from "react";
import { ArrowDown, Bed, Bus, CableCar, FerrisWheel, ShoppingBag, TrainFront } from "lucide-react";
import { Cascade, Status, capacityStatus, fmt, fmtDay, getJSON, panel } from "../lib";

const ICONS = { loop_bus: Bus, theme_park: FerrisWheel, ropeway: CableCar, hotel: Bed, retail: ShoppingBag } as const;

const TONE: Record<Status, string> = {
  over: "bg-critical-wash text-critical",
  busy: "bg-busy-wash text-busy",
  normal: "bg-sunken text-ink-2",
  quiet: "bg-sunken text-ink-2",
};
const BAR: Record<Status, string> = { over: "bg-critical", busy: "bg-busy", normal: "bg-accent", quiet: "bg-accent opacity-60" };

export default function GroupImpact() {
  const [data, setData] = useState<Cascade | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    getJSON<Cascade>("/api/cascade")
      .then((c) => {
        setData(c);
        // open on the day where the most businesses are over their limit
        const overCount = c.days.map((d) => d.segments.filter((s) => s.capacity_pct >= 100).length);
        setSelected(overCount.indexOf(Math.max(...overCount)));
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const day = data?.days[selected];
  const overToday = day?.segments.filter((s) => s.capacity_pct >= 100) ?? [];

  return (
    <section id="group" className="section-divide scroll-mt-14 py-14" aria-labelledby="group-title">
      <p className="text-sm font-medium text-accent">Group impact</p>
      <h2 id="group-title" className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">One crowd, every business</h2>
      <p className="mt-2 max-w-prose text-ink-2">
        The people arriving by train and bus are the same people who ride the loop bus, visit the park, stay at the
        hotel and shop. Each business reports on its own today — this shows them as one chain, and the chain changes
        shape with who is visiting.
      </p>

      {error ? (
        <p className="mt-6 text-sm text-ink-2" role="alert">Group impact could not be loaded: {error}</p>
      ) : !data || !day ? (
        <div className="mt-8 h-64 animate-pulse rounded-xl bg-sunken motion-reduce:animate-none" aria-label="Loading group impact" />
      ) : (
        <>
          <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Day">
            {data.days.map((d, i) => {
              const over = d.segments.filter((s) => s.capacity_pct >= 100).length;
              return (
                <button
                  key={d.date}
                  role="tab"
                  aria-selected={i === selected}
                  onClick={() => setSelected(i)}
                  className={`rounded-lg px-3 py-2 text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent ${
                    i === selected ? "bg-accent text-accent-ink" : "glass text-ink-2 hover:text-ink"
                  }`}
                >
                  {fmtDay(d.date)}
                  {over > 0 && (
                    <span className={`ml-2 rounded-full px-1.5 text-xs font-semibold ${i === selected ? "bg-white/20" : "bg-critical-wash text-critical"}`}>
                      {over}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className={`${panel} mt-6 flex items-center gap-4 p-5`}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sunken">
              <TrainFront size={20} className="text-accent" aria-hidden />
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium text-ink-2">Arriving by train and bus, all four locations</p>
              <p className="text-2xl font-bold tabular-nums tracking-tight">{fmt(day.transport_total)} <span className="text-base font-normal text-ink-2">people</span></p>
            </div>
            <p className="hidden text-right text-sm text-ink-2 sm:block">
              {overToday.length > 0
                ? `${overToday.length} of ${day.segments.length} businesses over their limit`
                : "Every business within its limit"}
            </p>
          </div>

          <div className="flex justify-center py-3" aria-hidden>
            <ArrowDown size={22} className="text-muted" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {day.segments.map((s) => {
              const Icon = ICONS[s.id as keyof typeof ICONS] ?? Bus;
              const st = capacityStatus(s.capacity_pct);
              return (
                <div key={s.id} className={`${panel} hover-lift flex flex-col p-5`}>
                  <div className="flex items-center gap-2">
                    <Icon size={16} className="text-accent" aria-hidden />
                    <p className="text-sm font-medium text-ink-2">{s.name}</p>
                  </div>
                  <p className="mt-3 text-2xl font-bold tabular-nums tracking-tight">{fmt(s.volume)}</p>
                  <p className="text-xs text-muted">{s.unit} expected</p>
                  <div
                    className="mt-4 h-2 overflow-hidden rounded-full bg-sunken"
                    role="meter" aria-valuenow={Math.round(s.capacity_pct)} aria-valuemin={0} aria-valuemax={100}
                    aria-label={`${s.name} capacity`}
                  >
                    <div className={`h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${BAR[st.status]}`}
                         style={{ width: `${Math.min(s.capacity_pct, 100)}%` }} />
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${TONE[st.status]}`}>{st.label}</span>
                    <span className="text-xs tabular-nums text-ink-2">{Math.round(s.capacity_pct)}% of {fmt(s.capacity)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-6 text-xs text-muted">
            Synthetic data. Each business's share of arrivals depends on nationality: a domestic commuter rarely visits
            the park; a holidaying tour group usually does.
          </p>
        </>
      )}
    </section>
  );
}
