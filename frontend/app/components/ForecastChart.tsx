"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Actuals, CHART as c, CRITICAL, Forecast, fmt, fmtDay, panel } from "../lib";
import TableView from "./TableView";

type Row = { label: string; forecast: number; actual: number | null; pct: number; holidays: string[] };

export default function ForecastChart({ forecast, actuals }: { forecast: Forecast; actuals: Actuals }) {
  const [compare, setCompare] = useState(false);
  const cap = forecast.daily_capacity;
  const actualByDate = new Map(actuals.daily.map((d) => [d.date, d.total_riders]));
  const rows: Row[] = forecast.daily.map((d) => ({
    label: fmtDay(d.date),
    forecast: d.total_riders,
    actual: actualByDate.get(d.date) ?? null,
    pct: d.capacity_used_pct,
    holidays: [...new Set(Object.values(d.holidays))],
  }));
  const peak = Math.max(cap, ...rows.flatMap((r) => [r.forecast, r.actual ?? 0]));
  const yMax = Math.ceil((peak * 1.1) / 2000) * 2000;
  const compared = rows.filter((r) => r.actual);
  const avgMiss = compared.reduce((s, r) => s + Math.abs(r.forecast - r.actual!) / r.actual!, 0) / (compared.length || 1);

  return (
    <div className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div className="max-w-prose">
          <h3 className="font-semibold">People per day through the week</h3>
          <p className="mt-1 text-sm text-ink-2">The red dashed line is the daily limit of {fmt(cap)} people.</p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} className="h-4 w-4 accent-accent" />
          Compare with what actually happened
        </label>
      </div>

      <div className={`${panel} mt-4 p-4`}>
        {compare && (
          <ul className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-2" aria-label="Legend">
            <LegendLine color={c.forecast} label="Forecast" />
            <LegendLine color={c.actual} label="What happened" />
          </ul>
        )}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 12, right: 12, bottom: 4, left: 0 }}>
              <CartesianGrid vertical={false} stroke={c.grid} />
              <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: c.axis }} tick={{ fill: c.muted, fontSize: 12 }} dy={6} />
              <YAxis
                domain={[0, yMax]}
                tickFormatter={(v: number) => (v === 0 ? "0" : `${v / 1000}k`)}
                tickLine={false}
                axisLine={false}
                tick={{ fill: c.muted, fontSize: 12 }}
                width={40}
              />
              <ReferenceLine y={cap} stroke={CRITICAL} strokeWidth={1.5} strokeDasharray="6 4" />
              <Tooltip
                cursor={{ stroke: c.axis }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const r = payload[0].payload as Row;
                  return (
                    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow-sm tabular-nums">
                      <p className="font-semibold">{r.label}</p>
                      <p className="mt-1">About {fmt(r.forecast)} people expected</p>
                      {compare && r.actual !== null && <p>{fmt(r.actual)} actually came</p>}
                      <p className="text-ink-2">{Math.round(r.pct)}% of the daily limit</p>
                      {r.holidays.length > 0 && <p className="mt-1 max-w-56 text-ink-2">{r.holidays.join(", ")}</p>}
                    </div>
                  );
                }}
              />
              {compare && (
                <Line
                  dataKey="actual"
                  stroke={c.actual}
                  strokeWidth={2}
                  dot={{ r: 4, fill: c.actual, stroke: c.surface, strokeWidth: 2 }}
                  isAnimationActive={false}
                  connectNulls
                />
              )}
              <Line
                dataKey="forecast"
                stroke={c.forecast}
                strokeWidth={2.5}
                dot={{ r: 4, fill: c.forecast, stroke: c.surface, strokeWidth: 2 }}
                activeDot={{ r: 5, stroke: c.surface, strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {compare && compared.length > 0 && (
        <p className="mt-3 max-w-prose text-sm text-ink-2">
          This week the forecast was within {(avgMiss * 100).toFixed(1)}% of what actually happened, on average. The real
          counts are shown only to check the forecast; it was made without them.
        </p>
      )}
      <TableView
        caption={`People per day at ${forecast.location_name}`}
        head={compare ? ["Day", "Forecast", "Actual", "Share of limit", "Holidays"] : ["Day", "Forecast", "Share of limit", "Holidays"]}
        rows={rows.map((r) => [
          r.label,
          fmt(r.forecast),
          ...(compare ? [r.actual === null ? "-" : fmt(r.actual)] : []),
          `${Math.round(r.pct)}%`,
          r.holidays.join(", ") || "-",
        ])}
      />
    </div>
  );
}

function LegendLine({ color, label }: { color: string; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span aria-hidden className="block w-6 border-t-2" style={{ borderColor: color }} />
      {label}
    </li>
  );
}
