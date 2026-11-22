"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Database, Search } from "lucide-react";
import { getJSON } from "../lib";

type TableMeta = { id: string; label: string; desc: string; row_count: number; limit: number };
type TablesResponse = { tables: TableMeta[]; today: string };
type RowsResponse = { table: string; columns: string[]; rows: (string | number | null)[][]; total: number; offset: number; limit: number };

const PAGE_SIZE = 50;
const HAS_DATE = new Set(["ridership", "weather", "holidays"]);

export default function DataPage() {
  const [tables, setTables] = useState<TableMeta[] | null>(null);
  const [today, setToday] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [data, setData] = useState<RowsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);

  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [activeFilter, setActiveFilter] = useState<{ from: string; to: string } | null>(null);

  useEffect(() => {
    getJSON<TablesResponse>("/api/data/tables").then((r) => {
      setTables(r.tables);
      setToday(r.today);
    });
  }, []);

  function buildDateRange() {
    if (!year) return null;
    const y = year;
    if (month && day) {
      const d = `${y}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      return { from: d, to: d };
    }
    if (month) {
      const m = month.padStart(2, "0");
      const nextMonth = Number(month) === 12 ? `${Number(y) + 1}-01-01` : `${y}-${String(Number(month) + 1).padStart(2, "0")}-01`;
      return { from: `${y}-${m}-01`, to: nextMonth };
    }
    return { from: `${y}-01-01`, to: `${Number(y) + 1}-01-01` };
  }

  async function loadTable(id: string, off = 0, filter?: { from: string; to: string } | null) {
    setSelected(id);
    setOffset(off);
    setLoading(true);
    const f = filter !== undefined ? filter : activeFilter;
    let url = `/api/data/${id}?offset=${off}&limit=${PAGE_SIZE}`;
    if (f && HAS_DATE.has(id)) {
      url += `&date_from=${f.from}&date_to=${f.to}`;
    }
    const r = await getJSON<RowsResponse>(url);
    setData(r);
    setLoading(false);
  }

  function handleSearch() {
    if (!selected) return;
    const range = buildDateRange();
    setActiveFilter(range);
    setOffset(0);
    loadTable(selected, 0, range);
  }

  function clearFilter() {
    setYear("");
    setMonth("");
    setDay("");
    setActiveFilter(null);
    if (selected) loadTable(selected, 0, null);
  }

  function selectTable(id: string) {
    setActiveFilter(null);
    setYear("");
    setMonth("");
    setDay("");
    loadTable(id, 0, null);
  }

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-line bg-page/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-10">
          <a href="/" className="flex items-center gap-2 rounded text-sm text-ink-2 outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-accent">
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Dashboard</span>
          </a>
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-xs font-bold text-accent-ink">TP</span>
            <span className="text-base font-semibold tracking-tight">Data Explorer</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-10">
        <div className="mb-2 flex items-center gap-3">
          <Database size={24} className="text-accent" />
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Training Data</h1>
        </div>
        <p className="max-w-prose text-ink-2">
          The LightGBM model was trained on synthetic data from <strong>1 Jan 2024</strong> to <strong>21 Dec 2025</strong>.
          The forecast covers <strong>22–28 Dec 2025</strong>.
          {today && <> Demo date: <strong>{today}</strong>.</>}
        </p>

        {!tables ? (
          <div className="mt-8 h-10 w-64 animate-pulse rounded bg-sunken" />
        ) : (
          <>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tables.map((t) => (
                <button
                  key={t.id}
                  onClick={() => selectTable(t.id)}
                  className={`glass rounded-xl p-4 text-left outline-none transition-all duration-200 hover:!border-accent hover:shadow-sm focus-visible:ring-2 focus-visible:ring-accent ${selected === t.id ? "!border-accent ring-1 ring-accent" : ""}`}
                >
                  <span className="font-semibold">{t.label}</span>
                  <span className="ml-2 text-sm text-ink-2">{t.row_count.toLocaleString()} rows</span>
                  <p className="mt-1 text-sm text-ink-2">{t.desc}</p>
                </button>
              ))}
            </div>

            {data && (
              <div className="mt-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <h2 className="text-lg font-semibold">{tables.find((t) => t.id === selected)?.label}</h2>
                  <span className="text-sm text-ink-2">
                    {data.total === 0 ? "No rows" : `${offset + 1}–${Math.min(offset + data.rows.length, data.total)} of ${data.total.toLocaleString()}`}
                  </span>
                </div>

                {selected && HAS_DATE.has(selected) && (
                  <div className="mt-4 flex flex-wrap items-end gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-ink-2">Year</label>
                      <select
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        className="h-10 rounded-lg glass px-3 text-sm outline-none focus-visible:!border-accent focus-visible:ring-2 focus-visible:ring-accent/20"
                      >
                        <option value="">All</option>
                        <option value="2024">2024</option>
                        <option value="2025">2025</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-ink-2">Month</label>
                      <select
                        value={month}
                        onChange={(e) => setMonth(e.target.value)}
                        disabled={!year}
                        className="h-10 rounded-lg glass px-3 text-sm outline-none disabled:opacity-40 focus-visible:!border-accent focus-visible:ring-2 focus-visible:ring-accent/20"
                      >
                        <option value="">All</option>
                        {MONTHS.map((m, i) => (
                          <option key={m} value={String(i + 1)}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-ink-2">Day</label>
                      <select
                        value={day}
                        onChange={(e) => setDay(e.target.value)}
                        disabled={!year || !month}
                        className="h-10 rounded-lg glass px-3 text-sm outline-none disabled:opacity-40 focus-visible:!border-accent focus-visible:ring-2 focus-visible:ring-accent/20"
                      >
                        <option value="">All</option>
                        {Array.from({ length: 31 }, (_, i) => (
                          <option key={i + 1} value={String(i + 1)}>{i + 1}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={handleSearch}
                      disabled={!year}
                      className="flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink outline-none transition-opacity hover:opacity-90 disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                    >
                      <Search size={14} />
                      Search
                    </button>
                    {activeFilter && (
                      <button
                        onClick={clearFilter}
                        className="h-10 rounded-lg glass px-4 text-sm outline-none transition-colors hover:!border-accent focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        Clear
                      </button>
                    )}
                    {activeFilter && (
                      <span className="text-sm text-ink-2">
                        Showing: {activeFilter.from}{activeFilter.from !== activeFilter.to ? ` to ${activeFilter.to}` : ""}
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-4 overflow-x-auto rounded-xl glass">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-line">
                        {data.columns.map((c) => (
                          <th key={c} className="whitespace-nowrap px-4 py-3 font-semibold text-ink-2">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={data.columns.length} className="px-4 py-8 text-center text-ink-2">Loading...</td></tr>
                      ) : data.rows.length === 0 ? (
                        <tr><td colSpan={data.columns.length} className="px-4 py-8 text-center text-ink-2">No rows match this filter</td></tr>
                      ) : (
                        data.rows.map((row, i) => (
                          <tr key={i} className="border-b border-line/50 transition-colors hover:bg-sunken/30">
                            {row.map((cell, j) => (
                              <td key={j} className="whitespace-nowrap px-4 py-2.5 tabular-nums">{cell ?? "—"}</td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {data.total > PAGE_SIZE && (
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <button
                      onClick={() => loadTable(selected!, offset - PAGE_SIZE)}
                      disabled={offset === 0}
                      className="glass rounded-lg px-3 py-2 text-sm outline-none transition-colors hover:!border-accent disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-sm text-ink-2">
                      Page {Math.floor(offset / PAGE_SIZE) + 1} of {Math.ceil(data.total / PAGE_SIZE)}
                    </span>
                    <button
                      onClick={() => loadTable(selected!, offset + PAGE_SIZE)}
                      disabled={offset + PAGE_SIZE >= data.total}
                      className="glass rounded-lg px-3 py-2 text-sm outline-none transition-colors hover:!border-accent disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
