"use client";
import { useState, useMemo } from "react";
import { BatteryCharging, Car, ChevronDown, Heart, Plug, Timer, Sparkles } from "lucide-react";
import type { EV } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import RangeBar from "@/components/ui/RangeBar";

const FILTERS = [
  { id: "premium-only", label: "Premium & Luxury", test: (e: EV) => e.segment === "luxury" || e.segment === "premium" },
  { id: "crore", label: "Ultra Luxury (₹1 Cr+)", test: (e: EV) => e.priceLakh >= 100 },
  { id: "range", label: "550+ km range", test: (e: EV) => e.rangeKm >= 550 },
  { id: "all", label: "All cars (incl. budget)", test: () => true },
] as const;

interface Props {
  cars: EV[];
  selectedId: string;
  favourites: string[];
  onToggleFav: (id: string) => void;
  onPick: (id: string) => void;
}

export default function FeaturedEVs({ cars, selectedId, favourites, onToggleFav, onPick }: Props) {
  // Default to Premium & Luxury to hide cheap mass cars by default
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("premium-only");
  const [selectedBrand, setSelectedBrand] = useState<string>("All brands");
  const [showAll, setShowAll] = useState(false);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  const brands = useMemo(() => {
    const list = Array.from(new Set(cars.map((c) => c.brand))).sort();
    return ["All brands", ...list];
  }, [cars]);

  const list = useMemo(() => {
    return cars.filter((ev) => {
      const matchesFilter = FILTERS.find((f) => f.id === filter)!.test(ev);
      const matchesBrand = selectedBrand === "All brands" || ev.brand === selectedBrand;
      return matchesFilter && matchesBrand;
    });
  }, [cars, filter, selectedBrand]);

  const visible = showAll ? list : list.slice(0, 6);

  return (
    <section id="cars" className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand">
            <Sparkles size={13} /> PREMIUM SHOWCASE
          </div>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Featured Electric Vehicles
          </h2>
          <p className="mt-2 max-w-lg text-muted">
            Explore India&apos;s finest premium &amp; luxury electric cars. Porsche, Mercedes-Benz, Audi, BMW and more.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5" role="group" aria-label="Filter cars">
          {/* Brand Dropdown */}
          <div className="relative">
            <select
              value={selectedBrand}
              onChange={(e) => {
                setSelectedBrand(e.target.value);
                setShowAll(false);
              }}
              aria-label="Filter by brand"
              className="appearance-none rounded-full bg-white py-2 pl-4 pr-9 text-sm font-semibold text-ink ring-1 ring-line transition-all hover:ring-brand/40 focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer shadow-sm"
            >
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3.5 top-3 text-muted" />
          </div>

          {/* Filter Chips */}
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => {
                setFilter(f.id);
                setShowAll(false);
              }}
              aria-pressed={filter === f.id}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors shadow-sm ${
                filter === f.id
                  ? "bg-ink text-white"
                  : "bg-white text-muted ring-1 ring-line hover:text-ink hover:bg-mist"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((ev) => {
          const fav = favourites.includes(ev.id);
          const active = selectedId === ev.id;
          const hasImage = Boolean(ev.image && !imgErrors[ev.id]);

          return (
            <article
              key={ev.id}
              className={`flex flex-col justify-between overflow-hidden rounded-3xl bg-white p-5 shadow-soft ring-1 transition-all hover:shadow-card ${
                active ? "ring-2 ring-brand" : "ring-line"
              }`}
            >
              <div>
                <div className="relative flex h-52 w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-brand-soft/60 to-brand-mint/40">
                  {hasImage ? (
                    <img
                      src={ev.image}
                      alt={`${ev.brand} ${ev.name}`}
                      onError={() => setImgErrors((prev) => ({ ...prev, [ev.id]: true }))}
                      className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                    />
                  ) : (
                    <Car size={56} strokeWidth={1.2} className="text-brand/60" />
                  )}
                  <button
                    onClick={() => onToggleFav(ev.id)}
                    aria-pressed={fav}
                    aria-label={fav ? `Remove ${ev.name} from favourites` : `Save ${ev.name}`}
                    className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-2 shadow-sm backdrop-blur transition-colors hover:bg-white"
                  >
                    <Heart size={16} className={fav ? "fill-brand text-brand" : "text-muted"} />
                  </button>
                  <span
                    className={`absolute left-3 top-3 z-10 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-sm backdrop-blur ${
                      ev.segment === "luxury"
                        ? "bg-amber-100 text-amber-900 border border-amber-300"
                        : ev.segment === "premium"
                        ? "bg-brand-soft text-brand-dark border border-brand/20"
                        : "bg-white/90 text-muted"
                    }`}
                  >
                    {ev.segment}
                  </span>
                </div>

                <div className="mt-4 flex items-baseline justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-muted">{ev.brand}</p>
                    <h3 className="text-lg font-bold">{ev.name}</h3>
                  </div>
                  <span className="font-bold text-brand">{formatPrice(ev.priceLakh)}</span>
                </div>

                <div className="mt-4">
                  <RangeBar km={ev.rangeKm} />
                </div>

                <ul className="mt-4 grid grid-cols-3 gap-2 text-xs text-muted">
                  <li className="flex items-center gap-1">
                    <BatteryCharging size={14} className="text-brand shrink-0" />
                    {ev.batteryKwh} kWh
                  </li>
                  <li className="flex items-center gap-1">
                    <Timer size={14} className="text-brand shrink-0" />
                    {ev.fastChargeMin ? `${ev.fastChargeMin} min` : "AC only"}
                  </li>
                  <li className="flex items-center gap-1 truncate" title={ev.connectors.join(", ")}>
                    <Plug size={14} className="text-brand shrink-0" />
                    <span className="truncate">{ev.connectors.join(", ")}</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => onPick(ev.id)}
                className={`mt-5 w-full rounded-xl py-3 text-sm font-bold transition-colors ${
                  active
                    ? "bg-brand text-white shadow-md shadow-brand/20"
                    : "bg-brand-soft text-brand-dark hover:bg-brand-mint/60"
                }`}
              >
                {active ? "Showing compatible chargers" : "Find chargers for this car"}
              </button>
            </article>
          );
        })}
      </div>

      {list.length > 6 && (
        <div className="mt-8 text-center">
          <button
            onClick={() => setShowAll((s) => !s)}
            className="rounded-xl px-6 py-3 text-sm font-bold text-brand ring-1 ring-brand/30 hover:bg-brand-soft"
          >
            {showAll ? "Show fewer cars" : `Show all ${list.length} cars`}
          </button>
        </div>
      )}

      {list.length === 0 && <p className="mt-8 text-muted">No cars match this filter.</p>}
    </section>
  );
}
