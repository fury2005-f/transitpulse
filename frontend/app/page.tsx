"use client";

import { useEffect, useState } from "react";
import BriefingSection from "./components/BriefingSection";
import ChatPanel from "./components/ChatPanel";
import Footer from "./components/Footer";
import ForecastChart from "./components/ForecastChart";
import LocationPicker from "./components/LocationPicker";
import SituationHero from "./components/SituationHero";
import TopBar from "./components/TopBar";
import WeekStrip from "./components/WeekStrip";
import WhoIsComing from "./components/WhoIsComing";
import { Actuals, Briefing, Forecast, LOCATIONS, LocationId, addDays, getJSON } from "./lib";

type ByLocation<T> = Record<LocationId, T>;

export default function Page() {
  const [location, setLocation] = useState<LocationId>("tourist_hub");
  const [day, setDay] = useState<string | null>(null);
  const [forecasts, setForecasts] = useState<ByLocation<Forecast> | null>(null);
  const [actuals, setActuals] = useState<ByLocation<Actuals> | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [briefingError, setBriefingError] = useState<string | null>(null);

  useEffect(() => {
    // All four locations load once, so switching locations and days is instant.
    (async () => {
      const fs = await Promise.all(LOCATIONS.map((l) => getJSON<Forecast>(`/api/forecast?location=${l.id}&days=7`)));
      const start = fs[0].today;
      const as = await Promise.all(
        LOCATIONS.map((l) => getJSON<Actuals>(`/api/actuals?location=${l.id}&start=${start}&end=${addDays(start, 6)}`)),
      );
      setForecasts(Object.fromEntries(fs.map((f) => [f.location, f])) as ByLocation<Forecast>);
      setActuals(Object.fromEntries(as.map((a) => [a.location, a])) as ByLocation<Actuals>);
    })().catch((e: Error) => setDataError(e.message));

    getJSON<Briefing>("/api/briefing").then(setBriefing).catch((e: Error) => setBriefingError(e.message));
  }, []);

  const forecast = forecasts?.[location];
  const selectedDay = day ?? forecast?.today;

  return (
    <div className="min-h-screen">
      <TopBar />
      <main className="mx-auto max-w-5xl px-4 sm:px-6">
        {dataError ? (
          <ApiProblem message={dataError} />
        ) : !forecasts || !actuals || !forecast || !selectedDay ? (
          <div className="py-16" aria-label="Loading this week's forecast">
            <div className="h-12 w-3/4 animate-pulse rounded bg-sunken motion-reduce:animate-none" />
            <div className="mt-4 h-5 w-1/2 animate-pulse rounded bg-sunken motion-reduce:animate-none" />
          </div>
        ) : (
          <>
            <SituationHero forecasts={Object.values(forecasts)} surges={briefing?.facts.surges} surgesError={briefingError} />
            <BriefingSection briefing={briefing} error={briefingError} />
            <ChatPanel />

            <section id="forecast" className="scroll-mt-6 border-t border-line py-12" aria-labelledby="forecast-title">
              <h2 id="forecast-title" className="font-serif text-2xl font-semibold sm:text-3xl">Explore the forecast</h2>
              <p className="mt-2 max-w-prose text-ink-2">Pick a location and a day to see how busy it will be and who is coming.</p>
              <LocationPicker location={location} onSelect={setLocation} />
              <WeekStrip forecast={forecast} selected={selectedDay} onSelect={setDay} />
              <WhoIsComing forecast={forecast} day={selectedDay} />
              <ForecastChart forecast={forecast} actuals={actuals[location]} />
            </section>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

function ApiProblem({ message }: { message: string }) {
  return (
    <div className="py-16" role="alert">
      <h1 className="font-serif text-3xl font-semibold">The forecast could not be loaded</h1>
      <p className="mt-3 text-ink-2">{message}</p>
      <p className="mt-6 text-sm text-ink-2">Start the backend from the backend folder, then reload this page:</p>
      <pre className="mt-2 w-fit max-w-full overflow-x-auto rounded-lg bg-sunken p-3 font-mono text-sm">.venv\Scripts\python -m uvicorn main:app</pre>
    </div>
  );
}
