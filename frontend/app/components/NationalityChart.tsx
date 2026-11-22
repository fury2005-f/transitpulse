"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART as c, Forecast, MIX_KEYS, MIX_LABELS, MixKey, fmtDay, foldMix, panel } from "../lib";
import TableView from "./TableView";

type Row = { label: string; holidays: string[] } & Partial<Record<MixKey, number>>;

export default function NationalityChart({ forecast }: { forecast: Forecast }) {
  const [international, setInternational] = useState(false);
  const keys = international ? MIX_KEYS.filter((k) => k !== "IN") : [...MIX_KEYS];

  const rows: Row[] = forecast.daily.map((d) => {
    const mix = foldMix(d.nationality_mix_pct);
    const total = keys.reduce((s, k) => s + mix[k], 0);
    const row: Row = { label: fmtDay(d.date), holidays: [...new Set(Object.values(d.holidays))] };
    for (const k of keys) row[k] = (mix[k] / total) * 100;
    return row;
  });

  return (
    <div className={`${panel} mt-4 p-4 sm:p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-prose text-sm text-ink-2">
          {international
            ? "International visitors only, so the smaller groups are easier to compare."
            : "Every visitor, by home country. Holidays abroad change the mix."}
        </p>
        <div role="group" aria-label="Visitors shown" className="inline-flex rounded-xl glass p-0.5 text-sm">
          {([["Everyone", false], ["International only", true]] as const).map(([label, value]) => (
            <button
              key={label}
              type="button"
              aria-pressed={international === value}
              onClick={() => setInternational(value)}
              className={`rounded-md px-3 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                international === value ? "bg-sunken font-semibold text-ink" : "text-ink-2 hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-ink-2" aria-label="Legend">
        {keys.map((k) => (
          <li key={k} className="flex items-center gap-2">
            <span aria-hidden className="block h-3 w-3 rounded-sm" style={{ background: c.mix[k] }} />
            {MIX_LABELS[k]}
          </li>
        ))}
      </ul>

      <div className="mt-3 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: 0 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke={c.grid} />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: c.axis }} tick={{ fill: c.muted, fontSize: 12 }} dy={6} />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tickFormatter={(v: number) => `${v}%`}
              tickLine={false}
              axisLine={false}
              tick={{ fill: c.muted, fontSize: 12 }}
              width={44}
            />
            <Tooltip
              cursor={{ fill: c.grid, opacity: 0.5 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const r = payload[0].payload as Row;
                return (
                  <div className="rounded-xl glass px-3 py-2 text-sm shadow-md tabular-nums">
                    <p className="font-semibold">{r.label}</p>
                    {r.holidays.length > 0 && <p className="max-w-56 text-ink-2">{r.holidays.join(", ")}</p>}
                    <ul className="mt-1 space-y-0.5">
                      {[...keys].reverse().map((k) => (
                        <li key={k} className="flex items-center gap-2">
                          <span aria-hidden className="block h-2.5 w-2.5 rounded-sm" style={{ background: c.mix[k] }} />
                          <span className="flex-1">{MIX_LABELS[k]}</span>
                          <span>{(r[k] ?? 0).toFixed(1)}%</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              }}
            />
            {keys.map((k, i) => (
              <Bar
                key={k}
                dataKey={k}
                stackId="mix"
                fill={c.mix[k]}
                stroke={c.surface}
                strokeWidth={2}
                radius={i === keys.length - 1 ? [4, 4, 0, 0] : 0}
                maxBarSize={56}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-3 text-sm text-muted">Other covers Japan, China, France, South Korea and all remaining countries.</p>
      <TableView
        caption={`Visitor mix by day at ${forecast.location_name}`}
        head={["Day", ...keys.map((k) => MIX_LABELS[k])]}
        rows={rows.map((r) => [r.label, ...keys.map((k) => `${(r[k] ?? 0).toFixed(1)}%`)])}
      />
    </div>
  );
}
