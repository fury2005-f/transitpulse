"use client";

import { LOCATIONS, LocationId } from "../lib";

// The four locations drawn as stops on one route line.
export default function LocationPicker({ location, onSelect }: { location: LocationId; onSelect: (id: LocationId) => void }) {
  return (
    <div role="group" aria-label="Location" className="relative mt-8 grid grid-cols-4">
      <span aria-hidden className="route-line absolute left-[12.5%] right-[12.5%] top-[11px] h-1 rounded-full bg-route" />
      {LOCATIONS.map((l) => {
        const on = l.id === location;
        return (
          <button
            key={l.id}
            type="button"
            aria-pressed={on}
            onClick={() => onSelect(l.id)}
            className="group relative flex min-h-11 flex-col items-center gap-2 rounded-md pb-1 text-center outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span
              className={`block h-[26px] w-[26px] rounded-full border-4 border-route transition-colors ${
                on ? "bg-route" : "bg-page group-hover:bg-sunken"
              }`}
            />
            <span className={`text-sm sm:text-base ${on ? "font-semibold text-ink" : "text-ink-2 group-hover:text-ink"}`}>
              {l.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
