"use client";
import { useMemo, useState } from "react";
import { BatteryCharging, ChevronDown, Heart, Plug, Timer } from "lucide-react";
import type { EV } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import RangeBar from "@/components/ui/RangeBar";
import { Car } from "lucide-react";

const EXTS = ["webp", "png", "jpg"];
function CarImage({ ev }: { ev: EV }) {
  const custom = (ev as EV & { image?: string }).image; // used if your data has an image field
  const sources = [...(custom ? [custom] : []), ...EXTS.map((x) => `/cars/${ev.id}.${x}`)];
  const [step, setStep] = useState(0);
  if (step >= sources.length) return <Car size={56} strokeWidth={1.2} className="text-brand/60" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img key={sources[step]} src={sources[step]} alt={`${ev.brand} ${ev.name}`}
      loading="lazy"
      onError={() => setStep((s) => s + 1)} className="h-full w-full object-contain p-3" />
  );
}

const BANDS = [
  { id: "all", label: "All", test: () => true },
  { id: "u10", label: "Under ₹10 L", test: (e: EV) => e.priceLakh < 10 },
  { id: "10-20", label: "₹10–20 L", test: (e: EV) => e.priceLakh >= 10 && e.priceLakh < 20 },
  { id: "20-50", label: "₹20–50 L", test: (e: EV) => e.priceLakh >= 20 && e.priceLakh < 50 },
  { id: "50+", label: "₹50 L+", test: (e: EV) => e.priceLakh >= 50 },
] as const;

interface Props { cars: EV[]; selectedId: string; favourites: string[]; onToggleFav: (id: string) => void; onPick: (id: string) => void }

export default function FeaturedEVs({ cars, selectedId, favourites, onToggleFav, onPick }: Props) {
  const [band, setBand] = useState<(typeof BANDS)[number]["id"]>("all");
  const [brand, setBrand] = useState("all");
  const [showAll, setShowAll] = useState(false);

  // One spec badge per car, computed from the full list (not the filtered one)
  const badges = useMemo(() => {
    const map: Record<string, string> = {};
    if (!cars.length) return map;
    const longest = cars.reduce((a, b) => (b.rangeKm > a.rangeKm ? b : a));
    const charging = cars.filter((c) => c.fastChargeMin > 0);
    const fastest = charging.length ? charging.reduce((a, b) => (b.fastChargeMin < a.fastChargeMin ? b : a)) : null;
    const value = cars.reduce((a, b) => (b.rangeKm / b.priceLakh > a.rangeKm / a.priceLakh ? b : a));
    map[value.id] = "Best value";
    if (fastest) map[fastest.id] = "Fastest charging";
    map[longest.id] = "Longest range"; // wins ties, applied last
    return map;
  }, [cars]);

  const brands = useMemo(() => Array.from(new Set(cars.map((c) => c.brand))).sort(), [cars]);
  const list = cars
    .filter(BANDS.find((b) => b.id === band)!.test)
    .filter((c) => brand === "all" || c.brand === brand);
  const visible = showAll ? list : list.slice(0, 6);

  return (
    <section id="cars" className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Explore electric cars</h2>
        <p className="mt-2 max-w-lg text-muted">Compare popular EVs in India. Pick one to see only the chargers that fit it.</p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2" role="group" aria-label="Filter cars">
        <label className="relative">
          <span className="sr-only">Brand</span>
          <select value={brand} onChange={(e) => { setBrand(e.target.value); setShowAll(false); }}
            className="appearance-none rounded-full bg-white py-2 pl-4 pr-9 text-sm font-semibold ring-1 ring-line outline-none">
            <option value="all">All brands</option>
            {brands.map((b) => <option key={b}>{b}</option>)}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted" />
        </label>
        {BANDS.map((b) => (
          <button key={b.id} onClick={() => { setBand(b.id); setShowAll(false); }} aria-pressed={band === b.id}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${band === b.id ? "bg-ink text-white" : "bg-white text-muted ring-1 ring-line hover:text-ink"}`}>
            {b.label}
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((ev) => {
          const fav = favourites.includes(ev.id);
          const active = selectedId === ev.id;
          const badge = badges[ev.id];
          return (
            <article key={ev.id} className={`rounded-3xl bg-white p-5 shadow-soft ring-1 transition-shadow hover:shadow-card ${active ? "ring-2 ring-brand" : "ring-line"}`}>
              <div className="relative flex h-40 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-brand-soft to-brand-mint/70">
                <CarImage ev={ev} />
                {badge && <span className="absolute left-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-bold text-brand-dark shadow-sm">{badge}</span>}
                <button onClick={() => onToggleFav(ev.id)} aria-pressed={fav} aria-label={fav ? `Remove ${ev.name} from favourites` : `Save ${ev.name}`}
                  className="absolute right-3 top-3 rounded-full bg-white/90 p-2 transition-colors hover:bg-white">
                  <Heart size={16} className={fav ? "fill-brand text-brand" : "text-muted"} />
                </button>
              </div>
              <div className="mt-4 flex items-baseline justify-between gap-3">
                <div><p className="text-xs text-muted">{ev.brand}</p><h3 className="text-lg font-bold">{ev.name}</h3></div>
                <span className="font-bold text-brand">{formatPrice(ev.priceLakh)}</span>
              </div>
              <div className="mt-4"><RangeBar km={ev.rangeKm} /></div>
              <ul className="mt-4 grid grid-cols-3 gap-2 text-xs text-muted">
                <li className="flex items-center gap-1"><BatteryCharging size={14} className="text-brand" />{ev.batteryKwh} kWh</li>
                <li className="flex items-center gap-1"><Timer size={14} className="text-brand" />{ev.fastChargeMin ? `${ev.fastChargeMin} min` : "AC only"}</li>
                <li className="flex items-center gap-1"><Plug size={14} className="text-brand" />{ev.connectors.join(", ")}</li>
              </ul>
              <button onClick={() => onPick(ev.id)}
                className={`mt-5 w-full rounded-xl py-3 text-sm font-bold transition-colors ${active ? "bg-brand text-white" : "bg-brand-soft text-brand-dark hover:bg-brand-mint/60"}`}>
                {active ? "Showing compatible chargers" : "Find chargers for this car"}
              </button>
            </article>
          );
        })}
      </div>

      {list.length > 6 && (
        <div className="mt-8 text-center">
          <button onClick={() => setShowAll((s) => !s)} className="rounded-xl px-6 py-3 text-sm font-bold text-brand ring-1 ring-brand/30 hover:bg-brand-soft">
            {showAll ? "Show fewer cars" : `Show all ${list.length} cars`}
          </button>
        </div>
      )}
      {list.length === 0 && <p className="mt-8 text-muted">No cars match these filters.</p>}
      <p className="mt-6 text-xs text-muted">Prices are approximate ex-showroom. Range is the claimed figure and real-world range is usually lower.</p>
    </section>
  );
}