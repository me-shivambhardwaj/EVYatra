"use client";
import { useState } from "react";
import { Car, ChevronDown, MapPin, Search } from "lucide-react";
import type { EV, Station } from "@/lib/types";
import { CITIES } from "@/lib/data/stations";
import { formatPrice } from "@/lib/format";
import RangeBar from "@/components/ui/RangeBar";

interface Props {
  city: string; onCity: (c: string) => void;
  carId: string; onCar: (id: string) => void;
  cars: EV[]; previewCar: EV; nearest?: Station; onFind: () => void;
}

export default function Hero({ city, onCity, carId, onCar, cars, previewCar, nearest, onFind }: Props) {
  const [imgError, setImgError] = useState(false);

  return (
    <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 pt-10 sm:px-8 lg:grid-cols-[1.15fr_1fr] lg:pb-24 lg:pt-16">
      <div>
        <p className="text-sm font-bold uppercase tracking-wide text-brand">EV guide for India</p>
        <h1 className="mt-5 text-[2.75rem] font-extrabold leading-[1.02] tracking-tight sm:text-6xl lg:text-[4.25rem]">
          Find the right EV. Find the right charger.
        </h1>
        <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
          Compare mass-market and luxury cars, check compatible charging stations near you, and plan your route before you leave.
        </p>

        <form
          onSubmit={(e) => { e.preventDefault(); onFind(); }}
          className="mt-9 flex max-w-xl flex-col gap-2 rounded-3xl bg-white p-3 shadow-card sm:flex-row sm:items-center"
        >
          <label className="relative flex-1 rounded-2xl px-4 py-2 hover:bg-mist">
            <span className="flex items-center gap-1 text-xs text-muted"><MapPin size={12} /> City</span>
            <select value={city} onChange={(e) => onCity(e.target.value)} className="w-full appearance-none bg-transparent pr-6 text-base font-bold outline-none">
              {CITIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <ChevronDown size={16} className="pointer-events-none absolute bottom-3.5 right-4 text-muted" />
          </label>
          <span className="hidden h-10 w-px bg-line sm:block" />
          <label className="relative flex-1 rounded-2xl px-4 py-2 hover:bg-mist">
            <span className="flex items-center gap-1 text-xs text-muted"><Car size={12} /> Your car</span>
            <select value={carId} onChange={(e) => onCar(e.target.value)} className="w-full appearance-none bg-transparent pr-6 text-base font-bold outline-none">
              <option value="">Select model</option>
              {cars.map((c) => <option key={c.id} value={c.id}>{c.brand} {c.name}</option>)}
            </select>
            <ChevronDown size={16} className="pointer-events-none absolute bottom-3.5 right-4 text-muted" />
          </label>
          <button type="submit" className="flex items-center justify-center gap-2 rounded-2xl bg-brand px-6 py-4 text-sm font-bold text-white transition-colors hover:bg-brand-dark">
            <Search size={16} /> Find chargers
          </button>
        </form>
      </div>

      <div className="relative mx-auto w-full max-w-md lg:max-w-none">
        <div className="rounded-[28px] bg-white p-6 shadow-card ring-1 ring-line">
          <div className="relative flex h-56 w-full items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-brand-soft to-brand-mint sm:h-64">
            {previewCar.image && !imgError ? (
              <img
                src={previewCar.image}
                alt={`${previewCar.brand} ${previewCar.name}`}
                onError={() => setImgError(true)}
                className="h-full w-full object-cover transition-all duration-500"
              />
            ) : (
              <Car size={72} strokeWidth={1.2} className="text-brand/60" />
            )}
            <span className="absolute left-4 top-4 z-10 rounded-full bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-wider text-ink shadow-sm backdrop-blur">
              {previewCar.segment}
            </span>
          </div>
          <div className="mt-5 flex items-baseline justify-between gap-3">
            <div>
              <span className="text-xs font-semibold text-muted">{previewCar.brand}</span>
              <h2 className="text-2xl font-bold">{previewCar.name}</h2>
            </div>
            <span className="text-xl font-bold text-brand">{formatPrice(previewCar.priceLakh)}</span>
          </div>
          <div className="mt-4"><RangeBar km={previewCar.rangeKm} /></div>
        </div>
        <div className="mt-5 ml-auto w-[85%] rounded-3xl bg-ink px-6 py-5 text-white shadow-card sm:w-[72%] lg:mt-6 lg:ml-0 lg:w-[75%]">
          <p className="font-bold">Nearest charger</p>
          <p className="mt-1 text-sm font-semibold text-brand-mint">
            {nearest ? `${nearest.maxKw} kW · ${nearest.distanceKm} km away` : "No compatible charger in this city"}
          </p>
          {nearest && <p className="mt-0.5 text-xs text-brand-mint/70">{nearest.name}, {nearest.area}</p>}
        </div>
      </div>
    </section>
  );
}
