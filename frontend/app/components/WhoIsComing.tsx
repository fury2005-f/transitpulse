import { COUNTRY_NAMES, Forecast, countryWithArticle, disclosure, fmtLongDate } from "../lib";
import NationalityChart from "./NationalityChart";

export default function WhoIsComing({ forecast, day }: { forecast: Forecast; day: string }) {
  const d = forecast.daily.find((x) => x.date === day) ?? forecast.daily[0];
  const entries = Object.entries(d.nationality_mix_pct).sort((a, b) => b[1] - a[1]);
  const top = entries.filter(([code]) => code !== "OTHER").slice(0, 5);
  const rows: [string, number][] = [
    ...top.map(([code, pct]): [string, number] => [COUNTRY_NAMES[code] ?? code, pct]),
    ["All others", 100 - top.reduce((sum, [, pct]) => sum + pct, 0)],
  ];
  const local = d.nationality_mix_pct.IN ?? 0;
  const [topCode, topPct] = entries.find(([code]) => code !== "IN" && code !== "OTHER") ?? ["", 0];
  const holidayNames = [...new Set(Object.values(d.holidays))];
  const holidayCount = Object.keys(d.holidays).length;

  return (
    <div className="mt-10">
      <h3 className="text-lg font-semibold">Who is coming on {fmtLongDate(d.date).replace(/ \d{4}$/, "")}</h3>
      <p className="mt-1 max-w-prose text-ink-2">
        About {Math.round(local)}% will be local visitors from India. The largest international group is from{" "}
        {countryWithArticle(COUNTRY_NAMES[topCode])}, at {topPct.toFixed(1)}%.
        {holidayCount > 0 &&
          ` It is a public holiday in ${holidayCount === 1 ? "one country" : `${holidayCount} countries`} (${holidayNames.join(", ")}).`}
      </p>

      <ul className="mt-6 max-w-2xl space-y-3" aria-label="Visitors by home country">
        {rows.map(([name, pct]) => (
          <li key={name} className="grid grid-cols-[7.5rem_1fr_3.25rem] items-center gap-3 text-sm sm:grid-cols-[9rem_1fr_3.5rem]">
            <span className="truncate font-medium">{name}</span>
            <span className="h-2.5 overflow-hidden rounded-full bg-sunken" aria-hidden>
              <span className="block h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${pct}%` }} />
            </span>
            <span className="text-right tabular-nums text-ink-2">{pct.toFixed(1)}%</span>
          </li>
        ))}
      </ul>

      <details className="mt-6">
        <summary className={disclosure}>Compare the visitor mix across the whole week</summary>
        <NationalityChart forecast={forecast} />
      </details>
    </div>
  );
}
