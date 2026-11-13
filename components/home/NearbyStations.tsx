"use client";
import { useState } from "react";
import { Heart, MapPin, Navigation, Plug, Star, Zap } from "lucide-react";
import type { EV, Station } from "@/lib/types";

export type StationFilter = "all" | "fast" | "available" | "saved";
const FILTERS: { id: StationFilter; label: string }[] = [
  { id: "all", label: "All" }, { id: "fast", label: "Fast (50 kW+)" },
  { id: "available", label: "Available now" }, { id: "saved", label: "Saved" },
];

interface Props {
  stations: Station[]; city: string; car?: EV; filter: StationFilter; onFilter: (f: StationFilter) => void;
  favourites: string[]; onToggleFav: (id: string) => void; onReset: () => void;
}

export default function NearbyStations({ stations, city, car, filter, onFilter, favourites, onToggleFav, onReset }: Props) {
  const [count, setCount] = useState(6);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});
  const visible = stations.slice(0, count);

  return (
    <section id="chargers" className="bg-brand-soft/40 py-16">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Nearby charging stations</h2>
            <p className="mt-2 max-w-xl text-muted">
              {car ? `Showing ${stations.length} stations in ${city} that fit the ${car.brand} ${car.name}.` : `Showing ${stations.length} stations in ${city}. Choose a car to see only compatible ones.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter stations">
            {FILTERS.map((f) => (
              <button key={f.id} onClick={() => { onFilter(f.id); setCount(6); }} aria-pressed={filter === f.id}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${filter === f.id ? "bg-ink text-white" : "bg-mist text-muted ring-1 ring-line hover:text-ink"}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {stations.length === 0 ? (
          <div className="mt-10 rounded-3xl bg-mist p-10 text-center">
            <p className="font-bold">No stations match these filters.</p>
            <p className="mt-1 text-sm text-muted">Try another city, a different filter, or a different car.</p>
            <button onClick={onReset} className="mt-5 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white hover:bg-brand-dark">Reset filters</button>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((s) => {
              const fav = favourites.includes(s.id);
              const free = s.available > 0;
              const missing = imgErrors[s.id];
              return (
                <article key={s.id} className="group flex flex-col overflow-hidden rounded-3xl bg-white shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-card">
                  <div className="relative h-40 overflow-hidden">
                    {missing ? (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand via-emerald-500 to-brand-mint">
                        <MapPin size={40} strokeWidth={1.5} className="text-white/90" />
                      </div>
                    ) : (
                      <img
                        src={`/stations/${s.id}.jpg`}
                        alt={s.name}
                        onError={() => setImgErrors((prev) => ({ ...prev, [s.id]: true }))}
                        className="h-40 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    )}
                    <span className={`absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm backdrop-blur ${free ? "bg-white/95 text-brand-dark" : "bg-red-50/95 text-red-700"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${free ? "bg-brand" : "bg-red-500"}`} />
                      {free ? `${s.available}/${s.total} free` : "All in use"}
                    </span>
                    <button onClick={() => onToggleFav(s.id)} aria-pressed={fav} aria-label={fav ? `Remove ${s.name} from saved` : `Save ${s.name}`} className="absolute right-3 top-3 z-10 rounded-full bg-white/95 p-2 shadow-sm backdrop-blur transition-colors hover:bg-white">
                      <Heart size={16} className={fav ? "fill-brand text-brand" : "text-muted"} />
                    </button>
                    <span className="absolute bottom-3 left-3 z-10 inline-flex items-center gap-1 rounded-full bg-ink/75 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
                      <MapPin size={12} />{s.distanceKm} km
                    </span>
                    {s.maxKw >= 50 && (
                      <span className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
                        <Zap size={12} /> Fast
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="font-bold leading-snug">{s.name}</h3>
                    <p className="mt-1 text-sm text-muted">{s.area}, {s.city}</p>
                    <span className="mt-2 inline-flex w-fit rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-semibold text-brand-dark">{s.network}</span>
                    <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <dt className="text-xs text-muted">Speed</dt>
                        <dd className="text-xl font-extrabold leading-tight text-brand">{s.maxKw}<span className="ml-0.5 text-xs font-semibold">kW</span></dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">Price</dt>
                        <dd className="font-bold">₹{s.pricePerKwh}<span className="text-xs font-medium text-muted">/kWh</span></dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">Rating</dt>
                        <dd className="flex items-center gap-1 font-bold"><Star size={13} className="fill-amber-400 text-amber-400" />{s.rating}</dd>
                      </div>
                    </dl>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {s.connectors.map((c) => (
                        <span key={c} className="inline-flex items-center gap-1 rounded-full bg-mist px-2.5 py-1 text-xs font-semibold">
                          <Plug size={12} className="text-brand" />{c}
                        </span>
                      ))}
                    </div>
                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${s.name}, ${s.area}, ${s.city}`)}`} target="_blank" rel="noopener noreferrer"
                      className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand py-3 text-sm font-bold text-white shadow-md shadow-brand/20 transition-colors hover:bg-brand-dark">
                      <Navigation size={14} /> Navigate
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {stations.length > count && (
          <div className="mt-8 text-center">
            <button onClick={() => setCount((c) => c + 6)} className="rounded-xl px-6 py-3 text-sm font-bold text-brand ring-1 ring-brand/30 hover:bg-brand-soft">
              Show more stations ({stations.length - count} left)
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
