import { OctagonAlert, TriangleAlert } from "lucide-react";
import { Forecast, fmt, fmtDay } from "../lib";

const ALERT_FROM = 80; // % of daily limit

export default function CapacityTable({ forecasts }: { forecasts: Forecast[] }) {
  const rows = forecasts
    .flatMap((f) =>
      f.daily
        .filter((d) => d.capacity_used_pct >= ALERT_FROM)
        .map((d) => ({ ...d, location: f.location_name, capacity: f.daily_capacity })),
    )
    .sort((a, b) => b.capacity_used_pct - a.capacity_used_pct);

  if (rows.length === 0) return <p className="mt-4 text-ink-2">No location is expected above {ALERT_FROM}% of its daily limit.</p>;

  return (
    <div className="mt-4">
      <p className="text-sm text-ink-2">Days expected above {ALERT_FROM}% of a location&apos;s daily limit, busiest first.</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[600px] text-left text-sm tabular-nums">
          <thead className="text-ink-2">
            <tr className="border-b border-line">
              <th scope="col" className="py-2 pr-4 font-medium">Status</th>
              <th scope="col" className="py-2 pr-4 font-medium">Location</th>
              <th scope="col" className="py-2 pr-4 font-medium">Day</th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">Expected</th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">Daily limit</th>
              <th scope="col" className="py-2 font-medium">Share of limit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const over = r.capacity_used_pct >= 100;
              return (
                <tr key={`${r.location}-${r.date}`} className={`border-b border-line last:border-0 ${over ? "bg-critical-wash" : ""}`}>
                  <td className="py-2.5 pl-2 pr-4">
                    <span className="flex items-center gap-2 whitespace-nowrap font-medium">
                      {over ? <OctagonAlert size={15} className="text-critical" aria-hidden /> : <TriangleAlert size={15} className="text-busy" aria-hidden />}
                      {over ? "Over limit" : "Busy"}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4">{r.location}</td>
                  <td className="whitespace-nowrap py-2.5 pr-4">{fmtDay(r.date)}</td>
                  <td className="py-2.5 pr-4 text-right">{fmt(r.total_riders)}</td>
                  <td className="py-2.5 pr-4 text-right text-ink-2">{fmt(r.capacity)}</td>
                  <td className="py-2.5 pr-2">{Math.round(r.capacity_used_pct)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
