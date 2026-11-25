// ALL DATA IS SYNTHETIC — this is a method demonstration.

export const LOCATIONS = [
  { id: "station_a", name: "Central Station" },
  { id: "station_b", name: "Riverside" },
  { id: "tourist_hub", name: "Old Town" },
  { id: "bus_terminal", name: "Gateway Terminal" },
] as const;
export type LocationId = (typeof LOCATIONS)[number]["id"];

export type Forecast = {
  location: LocationId;
  location_name: string;
  today: string;
  daily_capacity: number;
  hourly: { timestamp: string; forecast: number }[];
  daily: {
    date: string;
    weekday: string;
    total_riders: number;
    capacity_used_pct: number;
    nationality_mix_pct: Record<string, number>;
    holidays: Record<string, string>;
  }[];
};

export type Actuals = {
  location: LocationId;
  hourly: { timestamp: string; riders: number }[];
  daily: { date: string; total_riders: number; nationality_mix_pct: Record<string, number> }[];
};

export type Surge = {
  date: string;
  weekday: string;
  region: string;
  countries: string[];
  locations: string[];
  ratio_min: number;
  ratio_max: number;
  expected_riders: number;
  extra_riders: number;
  holiday: string;
  services: string;
};

export type Briefing = {
  date: string;
  source: "gemini" | "template";
  note: string | null;
  text: string;
  facts: { today_total_riders: number; today_mix_pct: Record<string, number>; surges: Surge[] };
};

export type Cascade = {
  today: string;
  days: {
    date: string;
    weekday: string;
    transport_total: number;
    transport_capacity: number;
    segments: { id: string; name: string; volume: number; unit: string; capacity: number; capacity_pct: number }[];
  }[];
};

export type ChatReply = {
  answer: string;
  sql: string[];
  tool_calls: { tool: string; ok: boolean; error: string | null }[];
};

export async function getJSON<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new Error("The TransitPulse API did not respond.");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    if (body && typeof body.detail === "string") throw new Error(body.detail);
    throw new Error(res.status >= 500 ? "The TransitPulse API is not running or returned an error." : `Request failed (${res.status}).`);
  }
  return body as T;
}

// Visitor mix: the 7 largest groups keep their own color; the rest fold into "Other" (max 8 colors).
export const MIX_KEYS = ["IN", "US", "UK", "AE", "SG", "DE", "AU", "rest"] as const;
export type MixKey = (typeof MIX_KEYS)[number];
export const MIX_LABELS: Record<MixKey, string> = {
  IN: "India", US: "United States", UK: "United Kingdom", AE: "UAE / Gulf",
  SG: "Singapore", DE: "Germany", AU: "Australia", rest: "Other",
};
const PROFILE_NAME_TO_CODE: Record<string, string> = {
  "India (domestic)": "IN", "United States": "US", "United Kingdom": "UK", "UAE / Gulf": "AE",
  Singapore: "SG", Germany: "DE", Australia: "AU",
};

export function foldMix(mix: Record<string, number>, byName = false): Record<MixKey, number> {
  const out = Object.fromEntries(MIX_KEYS.map((k) => [k, 0])) as Record<MixKey, number>;
  for (const [key, value] of Object.entries(mix)) {
    const code = byName ? PROFILE_NAME_TO_CODE[key] : key;
    out[(MIX_KEYS as readonly string[]).includes(code) ? (code as MixKey) : "rest"] += value;
  }
  return out;
}

export const COUNTRY_NAMES: Record<string, string> = {
  IN: "India", US: "United States", UK: "United Kingdom", AE: "UAE and Gulf", SG: "Singapore", DE: "Germany",
  AU: "Australia", JP: "Japan", CN: "China", FR: "France", KR: "South Korea", OTHER: "Other countries",
};

export function mostCommon(values: string[]): string | undefined {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

export type Status = "over" | "busy" | "normal" | "quiet";
export function capacityStatus(pct: number): { status: Status; label: string } {
  if (pct >= 100) return { status: "over", label: "Over limit" };
  if (pct >= 80) return { status: "busy", label: "Busy" };
  if (pct >= 50) return { status: "normal", label: "Normal" };
  return { status: "quiet", label: "Quiet" };
}

// Chart colors (mix palette validated with dataviz validate_palette.js on #fbf9f4).
export const CHART = {
  mix: { IN: "#2a78d6", US: "#eb6834", UK: "#1baf7a", AE: "#eda100", SG: "#e87ba4", DE: "#008300", AU: "#6250d6", rest: "#a9b0b4" },
  forecast: "#1d4a57", actual: "#8a8f8c", grid: "#e6e0d3", axis: "#cfc7b6", muted: "#6c7578", surface: "#fbf9f4",
};
export const CRITICAL = "#d03b3b";

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
export const addDays = (iso: string, n: number) => new Date(utc(iso).getTime() + n * 86_400_000).toISOString().slice(0, 10);
export const fmtDay = (iso: string) =>
  utc(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
export const fmtLongDate = (iso: string) => {
  const d = utc(iso);
  const part = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-GB", { ...o, timeZone: "UTC" });
  return `${part({ weekday: "long" })} ${d.getUTCDate()} ${part({ month: "long" })} ${d.getUTCFullYear()}`;
};
// "the United States", "the UAE and Gulf", but "India"
export const countryWithArticle = (name: string) => (/^(United|UAE)/.test(name) ? `the ${name}` : name);
export const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

export const panel = "rounded-xl glass";
export const disclosure =
  "w-fit cursor-pointer rounded text-sm font-semibold text-accent underline decoration-line underline-offset-4 outline-none hover:decoration-accent focus-visible:ring-2 focus-visible:ring-accent";
