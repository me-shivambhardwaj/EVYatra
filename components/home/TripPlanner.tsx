"use client";
import { useState, useMemo } from "react";
import { 
  Route, 
  MapPin, 
  Battery, 
  Zap, 
  Clock, 
  Leaf, 
  IndianRupee, 
  Navigation, 
  AlertTriangle, 
  CheckCircle2, 
  Car,
  ChevronRight,
  ArrowRight
} from "lucide-react";
import type { EV } from "@/lib/types";

interface RoutePreset {
  id: string;
  origin: string;
  destination: string;
  distanceKm: number;
  highways: string;
  stops: {
    km: number;
    name: string;
    operator: string;
    speedKw: number;
    amenities: string[];
  }[];
}

const PRESET_ROUTES: RoutePreset[] = [
  {
    id: "delhi-agra",
    origin: "Delhi NCR",
    destination: "Agra",
    distanceKm: 215,
    highways: "Yamuna Expressway",
    stops: [
      {
        km: 95,
        name: "Express Oasis Plaza, Yamuna Expy KM 95",
        operator: "Jio-bp pulse",
        speedKw: 120,
        amenities: ["Food Court", "Washrooms", "Coffee Shop", "24/7 Security"]
      },
      {
        km: 140,
        name: "Mathura Highway Hub, KM 140",
        operator: "Tata Power EZ Charge",
        speedKw: 60,
        amenities: ["Restaurant", "Rest Area", "EV Lounge"]
      }
    ]
  },
  {
    id: "delhi-jaipur",
    origin: "Delhi NCR",
    destination: "Jaipur",
    distanceKm: 275,
    highways: "Delhi-Mumbai Expressway (NE4)",
    stops: [
      {
        km: 110,
        name: "Pinan WaySide EV Hub, NE4 KM 110",
        operator: "ChargeZone",
        speedKw: 150,
        amenities: ["Food Mall", "Kids Area", "Restrooms", "Free Wi-Fi"]
      },
      {
        km: 195,
        name: "Dausa Highway Service Area",
        operator: "Statiq",
        speedKw: 120,
        amenities: ["Food Court", "Convenience Store", "ATM"]
      }
    ]
  },
  {
    id: "delhi-chandigarh",
    origin: "Delhi NCR",
    destination: "Chandigarh",
    distanceKm: 245,
    highways: "Grand Trunk Road (NH44)",
    stops: [
      {
        km: 55,
        name: "Murthal Grand Haveli EV Station",
        operator: "Tata Power EZ Charge",
        speedKw: 60,
        amenities: ["Iconic Dhabas", "24/7 Dining", "EV Lounge"]
      },
      {
        km: 125,
        name: "Karnal Lake Oasis Supercharger",
        operator: "Jio-bp pulse",
        speedKw: 150,
        amenities: ["Waterfront Cafes", "Fast Food", "Clean Washrooms"]
      }
    ]
  },
  {
    id: "delhi-dehradun",
    origin: "Delhi NCR",
    destination: "Dehradun",
    distanceKm: 255,
    highways: "Delhi–Dehradun Expy / NH334",
    stops: [
      {
        km: 105,
        name: "Cheetal Grand EV Point, Khatauli",
        operator: "Tata Power EZ Charge",
        speedKw: 60,
        amenities: ["Garden Restaurant", "Bakery", "Restrooms"]
      },
      {
        km: 175,
        name: "Roorkee Highway Charging Plaza",
        operator: "Statiq",
        speedKw: 120,
        amenities: ["Food Plaza", "EV Waiting Lounge"]
      }
    ]
  }
];

interface Props {
  cars: EV[];
  selectedCarId: string;
  onSelectCar: (id: string) => void;
}

export default function TripPlanner({ cars, selectedCarId, onSelectCar }: Props) {
  const [selectedRouteId, setSelectedRouteId] = useState<string>("delhi-agra");
  const [startSoc, setStartSoc] = useState<number>(90);
  const [customDistance, setCustomDistance] = useState<number>(200);
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [customDestination, setCustomDestination] = useState<string>("");

  const currentCar = useMemo(() => {
    return cars.find(c => c.id === selectedCarId) || cars[0];
  }, [cars, selectedCarId]);

  const activePreset = useMemo(() => {
    return PRESET_ROUTES.find(r => r.id === selectedRouteId) || PRESET_ROUTES[0];
  }, [selectedRouteId]);

  const tripDistance = isCustom ? customDistance : activePreset.distanceKm;
  const originName = isCustom ? "Delhi NCR" : activePreset.origin;
  const destinationName = isCustom ? (customDestination || "Custom Destination") : activePreset.destination;

  // Real world range adjustment (typically ~85% of ARAI/tested rating for highway speed 80-100 km/h)
  const realHighwayRange = Math.round(currentCar.rangeKm * 0.82);
  
  // Starting range based on SOC
  const initialAvailableRange = Math.round(realHighwayRange * (startSoc / 100));

  // Determine if direct trip is possible (leaving at least 15% reserve buffer)
  const reserveKm = Math.round(realHighwayRange * 0.15);
  const isDirectPossible = initialAvailableRange >= (tripDistance + reserveKm);

  // Stop calculations
  const stopsNeeded = isDirectPossible 
    ? 0 
    : Math.ceil((tripDistance - initialAvailableRange + reserveKm) / (realHighwayRange * 0.65));

  // Recommended stop details
  const recommendedStop = useMemo(() => {
    if (stopsNeeded === 0) return null;
    if (!isCustom && activePreset.stops.length > 0) {
      // Pick best stop: ideally around 40-60% of distance
      const stop = activePreset.stops.find(s => s.km <= initialAvailableRange) || activePreset.stops[0];
      return stop;
    }
    return {
      km: Math.round(initialAvailableRange * 0.75),
      name: `Highway Fast-Charge Plaza (KM ${Math.round(initialAvailableRange * 0.75)})`,
      operator: "Jio-bp / Tata Power Hub",
      speedKw: Math.min(currentCar.maxDcKw || 60, 120),
      amenities: ["Food Plaza", "Restrooms", "Fast Charging"]
    };
  }, [stopsNeeded, isCustom, activePreset, initialAvailableRange, currentCar]);

  // Estimated driving time (avg highway speed ~70 km/h)
  const drivingHours = tripDistance / 70;
  const drivingMinutesTotal = Math.round(drivingHours * 60);

  // Charging time needed (to charge from ~20% back to ~80% or whatever is needed)
  const chargingMinutes = useMemo(() => {
    if (stopsNeeded === 0) return 0;
    // Fast charge from ~20% to 80% takes fastChargeMin or calculated based on maxDcKw
    const kwhToReplenish = (currentCar.batteryKwh * 0.6) * stopsNeeded;
    const chargerKw = recommendedStop ? Math.min(recommendedStop.speedKw, currentCar.maxDcKw || 50) : 50;
    const mins = Math.round((kwhToReplenish / chargerKw) * 60 * 1.15); // with taper buffer
    return Math.max(mins, 20);
  }, [stopsNeeded, currentCar, recommendedStop]);

  const totalTripMinutes = drivingMinutesTotal + chargingMinutes;
  const totalHours = Math.floor(totalTripMinutes / 60);
  const totalMins = totalTripMinutes % 60;

  // Energy & cost estimates (~145 Wh/km for typical Indian EV)
  const totalEnergyKwh = Math.round(tripDistance * 0.145 * 10) / 10;
  const estCostInr = Math.round(totalEnergyKwh * 19.5); // avg ₹19.5/kWh
  const co2SavedKg = Math.round(tripDistance * 0.135 * 10) / 10; // ~135g CO2/km vs petrol car

  // Estimated arrival SOC
  const arrivalSoc = useMemo(() => {
    if (stopsNeeded === 0) {
      const remainingRange = initialAvailableRange - tripDistance;
      return Math.max(5, Math.round((remainingRange / realHighwayRange) * 100));
    } else {
      // Recharged to 80% at stop, then drive remainder
      const kmRemainingAfterStop = recommendedStop ? (tripDistance - recommendedStop.km) : (tripDistance / 2);
      const remainingRange = (realHighwayRange * 0.8) - kmRemainingAfterStop;
      return Math.max(12, Math.min(80, Math.round((remainingRange / realHighwayRange) * 100)));
    }
  }, [stopsNeeded, initialAvailableRange, tripDistance, realHighwayRange, recommendedStop]);

  // Google Maps route link
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originName)}&destination=${encodeURIComponent(destinationName)}${recommendedStop ? `&waypoints=${encodeURIComponent(recommendedStop.name)}` : ""}`;

  return (
    <section id="trip-planner" className="scroll-mt-20 bg-mist/60 py-20 border-t border-line">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        {/* Header */}
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3.5 py-1.5 text-xs font-bold text-brand">
            <Route size={14} /> EV SMART ROUTE PLANNER
          </div>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl text-ink">
            Plan your road trip without range anxiety
          </h2>
          <p className="mt-2 text-muted leading-relaxed">
            Select your car, destination, and starting battery. We calculate exact highway range, recommend fast-charging pit stops, and provide turn-by-turn navigation.
          </p>
        </div>

        {/* Route Preset Chips */}
        <div className="mt-8 flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-bold text-muted mr-1">Popular corridors:</span>
          {PRESET_ROUTES.map((route) => {
            const active = !isCustom && selectedRouteId === route.id;
            return (
              <button
                key={route.id}
                onClick={() => {
                  setSelectedRouteId(route.id);
                  setIsCustom(false);
                }}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-all shadow-sm ${
                  active 
                    ? "bg-brand text-white shadow-brand/20 ring-2 ring-brand" 
                    : "bg-white text-ink ring-1 ring-line hover:border-brand/40 hover:bg-brand-soft/30"
                }`}
              >
                {route.origin} → {route.destination} <span className="opacity-75 text-xs">({route.distanceKm} km)</span>
              </button>
            );
          })}
          <button
            onClick={() => setIsCustom(true)}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-all shadow-sm ${
              isCustom 
                ? "bg-brand text-white shadow-brand/20 ring-2 ring-brand" 
                : "bg-white text-ink ring-1 ring-line hover:border-brand/40 hover:bg-brand-soft/30"
            }`}
          >
            Custom route
          </button>
        </div>

        {/* Main Planning Grid */}
        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_1.1fr]">
          {/* Controls Column */}
          <div className="flex flex-col gap-6 rounded-3xl bg-white p-6 shadow-soft ring-1 ring-line lg:sticky lg:top-24">
            <h3 className="text-lg font-bold text-ink flex items-center gap-2">
              <Car className="text-brand" size={20} /> Trip Parameters
            </h3>

            {/* Car selector */}
            <div>
              <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-2">
                Selected EV
              </label>
              <div className="relative">
                <select
                  value={currentCar.id}
                  onChange={(e) => onSelectCar(e.target.value)}
                  className="w-full appearance-none rounded-2xl bg-mist px-4 py-3.5 pr-10 text-sm font-bold text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-brand"
                >
                  {cars.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.brand} {c.name} ({c.rangeKm} km claimed · {c.batteryKwh} kWh)
                    </option>
                  ))}
                </select>
                <Car size={16} className="pointer-events-none absolute right-4 top-4 text-muted" />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted">
                <span>Real Highway Range: <strong className="text-ink">{realHighwayRange} km</strong></span>
                <span>Max DC Speed: <strong className="text-brand">{currentCar.maxDcKw || 0} kW</strong></span>
              </div>
            </div>

            {/* Custom route inputs if active */}
            {isCustom && (
              <div className="grid gap-3 sm:grid-cols-2 rounded-2xl bg-mist p-4 ring-1 ring-line">
                <div>
                  <label className="text-xs font-semibold text-muted block mb-1">Destination Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Jaipur, Rishikesh"
                    value={customDestination}
                    onChange={(e) => setCustomDestination(e.target.value)}
                    className="w-full rounded-xl bg-white px-3.5 py-2 text-sm font-semibold outline-none ring-1 ring-line focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-muted">Distance</label>
                    <span className="text-xs font-bold text-brand">{customDistance} km</span>
                  </div>
                  <input
                    type="range"
                    min={40}
                    max={600}
                    step={10}
                    value={customDistance}
                    onChange={(e) => setCustomDistance(Number(e.target.value))}
                    className="w-full accent-brand cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* Start Battery SOC Slider */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
                  <Battery size={14} className="text-brand" /> Starting Battery Charge
                </label>
                <span className="text-base font-extrabold text-brand bg-brand-soft px-3 py-0.5 rounded-full">
                  {startSoc}%
                </span>
              </div>
              <input
                type="range"
                min={20}
                max={100}
                step={5}
                value={startSoc}
                onChange={(e) => setStartSoc(Number(e.target.value))}
                className="mt-3 w-full accent-brand cursor-pointer"
              />
              <div className="mt-1 flex justify-between text-[11px] text-muted font-medium">
                <span>20% (Low)</span>
                <span>80% (Recommended daily)</span>
                <span>100% (Full roadtrip)</span>
              </div>
            </div>

            {/* Car Snapshot & Range Status Card */}
            <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-br from-brand-soft/50 to-brand-mint/30 p-4 ring-1 ring-brand/20">
              <div className="relative h-20 w-28 shrink-0 flex items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-line">
                {currentCar.image ? (
                  <img
                    src={currentCar.image}
                    alt={currentCar.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Car size={32} className="text-brand/60" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-muted">{currentCar.brand}</p>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-ink bg-white/80 px-2 py-0.5 rounded shadow-xs">
                    {currentCar.rangeKm} km range
                  </span>
                </div>
                <h4 className="text-base font-extrabold text-ink">{currentCar.name}</h4>
                <p className="mt-0.5 text-xs text-muted">
                  Available initial range: <strong className="text-brand font-bold">{initialAvailableRange} km</strong>
                </p>
                <div className="mt-1.5 w-full bg-line rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="h-full bg-brand rounded-full transition-all duration-300" 
                    style={{ width: `${Math.min(100, Math.round((initialAvailableRange / tripDistance) * 100))}%` }} 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Results & Itinerary Column */}
          <div className="flex flex-col gap-6">
            {/* Feasibility Alert Banner */}
            <div className={`rounded-3xl p-5 shadow-soft ring-1 ${
              isDirectPossible 
                ? "bg-emerald-50 text-emerald-950 ring-emerald-200" 
                : "bg-amber-50 text-amber-950 ring-amber-200"
            }`}>
              <div className="flex items-start gap-3.5">
                {isDirectPossible ? (
                  <CheckCircle2 size={24} className="text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle size={24} className="text-amber-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className="font-extrabold text-base">
                    {isDirectPossible 
                      ? "Direct Trip Possible on Single Charge!" 
                      : `${stopsNeeded} Charging Stop Recommended along the route`}
                  </h4>
                  <p className="mt-1 text-sm opacity-90 leading-relaxed">
                    {isDirectPossible 
                      ? `Your ${currentCar.name} has ${initialAvailableRange} km of range for this ${tripDistance} km trip. You'll arrive with ~${arrivalSoc}% battery remaining.`
                      : `At ${startSoc}% battery, you have ~${initialAvailableRange} km range. A quick ${chargingMinutes}-minute fast charge stop at ${recommendedStop?.name} keeps you worry-free.`}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-line">
                <span className="flex items-center gap-1 text-xs font-semibold text-muted">
                  <Route size={13} className="text-brand" /> Distance
                </span>
                <p className="mt-1 text-xl font-extrabold text-ink">{tripDistance} km</p>
                <span className="text-[11px] text-muted">{isCustom ? "Custom route" : activePreset.highways}</span>
              </div>

              <div className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-line">
                <span className="flex items-center gap-1 text-xs font-semibold text-muted">
                  <Clock size={13} className="text-brand" /> Est. Time
                </span>
                <p className="mt-1 text-xl font-extrabold text-ink">
                  {totalHours}h {totalMins > 0 ? `${totalMins}m` : ""}
                </p>
                <span className="text-[11px] text-muted">
                  {chargingMinutes > 0 ? `Incl. ${chargingMinutes}m charging` : "Non-stop drive"}
                </span>
              </div>

              <div className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-line">
                <span className="flex items-center gap-1 text-xs font-semibold text-muted">
                  <IndianRupee size={13} className="text-brand" /> Charging Cost
                </span>
                <p className="mt-1 text-xl font-extrabold text-ink">₹2.8/km</p>
                <span className="text-[11px] text-emerald-600 font-semibold">
                  65% cheaper than petrol
                </span>
              </div>

              <div className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-line">
                <span className="flex items-center gap-1 text-xs font-semibold text-muted">
                  <Leaf size={13} className="text-emerald-500" /> CO₂ Saved
                </span>
                <p className="mt-1 text-xl font-extrabold text-emerald-600">~{co2SavedKg} kg</p>
                <span className="text-[11px] text-muted">vs Petrol/Diesel ICE</span>
              </div>
            </div>

            {/* Itinerary Timeline */}
            <div className="rounded-3xl bg-white p-6 shadow-soft ring-1 ring-line">
              <h4 className="text-base font-bold text-ink mb-5 flex items-center justify-between">
                <span>Trip Itinerary & Milestones</span>
                <span className="text-xs font-semibold text-muted bg-mist px-3 py-1 rounded-full">
                  Arrival Battery: ~{arrivalSoc}%
                </span>
              </h4>

              <div className="space-y-6 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-line">
                {/* Step 1: Departure */}
                <div className="relative flex items-start gap-4">
                  <div className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full bg-brand text-white ring-4 ring-white">
                    <MapPin size={14} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline justify-between">
                      <p className="font-bold text-ink">Depart from {originName}</p>
                      <span className="text-xs font-bold text-brand bg-brand-soft px-2 py-0.5 rounded">
                        {startSoc}% Battery
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      Full check done · ~{initialAvailableRange} km usable range
                    </p>
                  </div>
                </div>

                {/* Step 2: Charging Stop (if needed) */}
                {recommendedStop && stopsNeeded > 0 ? (
                  <div className="relative flex items-start gap-4">
                    <div className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-white ring-4 ring-white">
                      <Zap size={14} />
                    </div>
                    <div className="flex-1 rounded-2xl bg-mist p-3.5 ring-1 ring-line">
                      <div className="flex flex-wrap items-baseline justify-between gap-1">
                        <p className="font-bold text-ink text-sm">{recommendedStop.name}</p>
                        <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded">
                          +{chargingMinutes} mins stop
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        Operator: <strong className="text-ink">{recommendedStop.operator}</strong> · {recommendedStop.speedKw} kW Ultra-Fast DC
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {recommendedStop.amenities.map(a => (
                          <span key={a} className="rounded bg-white px-2 py-0.5 text-[11px] font-medium text-muted ring-1 ring-line">
                            {a}
                          </span>
                        ))}
                      </div>
                      <div className="mt-2.5 flex items-center gap-2 text-xs font-semibold text-brand">
                        <span>Charge from 20%</span>
                        <ArrowRight size={12} />
                        <span>Leave with 80% SOC</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="relative flex items-start gap-4">
                    <div className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white ring-4 ring-white">
                      <CheckCircle2 size={14} />
                    </div>
                    <div>
                      <p className="font-bold text-ink text-sm">No charging stop needed</p>
                      <p className="text-xs text-muted">
                        No pit-stops needed for this distance. Relax and enjoy the electric drive!
                      </p>
                    </div>
                  </div>
                )}

                {/* Step 3: Destination Arrival */}
                <div className="relative flex items-start gap-4">
                  <div className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full bg-ink text-white ring-4 ring-white">
                    <MapPin size={14} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline justify-between">
                      <p className="font-bold text-ink">Arrive in {destinationName}</p>
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded ring-1 ring-emerald-200">
                        ~{arrivalSoc}% Battery Left
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      {tripDistance} km completed in approx {totalHours}h {totalMins > 0 ? `${totalMins}m` : ""}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-6 pt-5 border-t border-line flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <span className="text-xs text-muted">
                  Ready to go? Launch Google Maps with programmed stops.
                </span>
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sticky bottom-4 z-20 sm:static inline-flex items-center justify-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-bold text-white shadow-lg shadow-brand/30 sm:shadow-md sm:shadow-brand/20 transition-all hover:bg-brand-dark text-center"
                >
                  <Navigation size={16} /> Open Route in Google Maps
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
