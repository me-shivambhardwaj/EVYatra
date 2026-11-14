"use client";
import { useState, useMemo } from "react";
import { 
  Globe2, 
  Leaf, 
  Zap, 
  Fuel, 
  Trees, 
  MapPin, 
  TrendingUp, 
  ShieldCheck, 
  ArrowUpRight,
  Sparkles
} from "lucide-react";

interface RegionHub {
  id: string;
  name: string;
  state: string;
  stations: number;
  fastDc: number;
  co2SavedTonnes: number;
  treesEquiv: number;
  fuelSavedLakhLitre: number;
  topNetworks: string[];
  x: number; // percentage on SVG viewBox
  y: number;
}

const REGION_HUBS: RegionHub[] = [
  {
    id: "delhi-ncr",
    name: "Delhi NCR",
    state: "Delhi, Haryana & UP",
    stations: 2140,
    fastDc: 890,
    co2SavedTonnes: 54200,
    treesEquiv: 2168000,
    fuelSavedLakhLitre: 240,
    topNetworks: ["Tata Power", "Statiq", "Jio-bp pulse", "ChargeZone"],
    x: 35,
    y: 32
  },
  {
    id: "maharashtra",
    name: "Mumbai & Pune",
    state: "Maharashtra",
    stations: 2850,
    fastDc: 1220,
    co2SavedTonnes: 72400,
    treesEquiv: 2896000,
    fuelSavedLakhLitre: 320,
    topNetworks: ["Tata Power", "Jio-bp pulse", "Zeon", "Magenta"],
    x: 29,
    y: 59
  },
  {
    id: "karnataka",
    name: "Bengaluru Hub",
    state: "Karnataka",
    stations: 1980,
    fastDc: 810,
    co2SavedTonnes: 49800,
    treesEquiv: 1992000,
    fuelSavedLakhLitre: 220,
    topNetworks: ["Bescom", "Ather Grid", "Tata Power", "ChargeZone"],
    x: 39,
    y: 77
  },
  {
    id: "tamil-nadu",
    name: "Chennai & Coimbatore",
    state: "Tamil Nadu",
    stations: 1420,
    fastDc: 620,
    co2SavedTonnes: 36200,
    treesEquiv: 1448000,
    fuelSavedLakhLitre: 160,
    topNetworks: ["Zeon Charging", "Relux", "Tata Power"],
    x: 43,
    y: 84
  },
  {
    id: "telangana",
    name: "Hyderabad Metro",
    state: "Telangana",
    stations: 1180,
    fastDc: 530,
    co2SavedTonnes: 29800,
    treesEquiv: 1192000,
    fuelSavedLakhLitre: 132,
    topNetworks: ["TSREDCO", "Statiq", "Jio-bp pulse"],
    x: 43,
    y: 65
  },
  {
    id: "gujarat",
    name: "Ahmedabad & Surat",
    state: "Gujarat",
    stations: 1050,
    fastDc: 490,
    co2SavedTonnes: 26500,
    treesEquiv: 1060000,
    fuelSavedLakhLitre: 118,
    topNetworks: ["Tata Power", "ChargeZone", "Statiq"],
    x: 21,
    y: 50
  },
  {
    id: "rajasthan",
    name: "Jaipur & NE4 Corridor",
    state: "Rajasthan",
    stations: 780,
    fastDc: 340,
    co2SavedTonnes: 19500,
    treesEquiv: 780000,
    fuelSavedLakhLitre: 86,
    topNetworks: ["Statiq", "Jio-bp pulse", "Tata Power"],
    x: 28,
    y: 40
  },
  {
    id: "west-bengal",
    name: "Kolkata & Asansol",
    state: "West Bengal",
    stations: 690,
    fastDc: 280,
    co2SavedTonnes: 17200,
    treesEquiv: 688000,
    fuelSavedLakhLitre: 76,
    topNetworks: ["CESC", "Tata Power", "Snap-E"],
    x: 68,
    y: 53
  },
  {
    id: "kerala",
    name: "Kochi & Trivandrum",
    state: "Kerala",
    stations: 840,
    fastDc: 380,
    co2SavedTonnes: 21400,
    treesEquiv: 856000,
    fuelSavedLakhLitre: 95,
    topNetworks: ["KSEB", "Zeon Charging", "Tata Power"],
    x: 37,
    y: 89
  },
  {
    id: "punjab-chandigarh",
    name: "Chandigarh & NH44",
    state: "Punjab & Haryana",
    stations: 610,
    fastDc: 290,
    co2SavedTonnes: 15300,
    treesEquiv: 612000,
    fuelSavedLakhLitre: 68,
    topNetworks: ["Statiq", "Tata Power", "Jio-bp pulse"],
    x: 33,
    y: 25
  }
];

export default function IndiaEVMap() {
  const [selectedHubId, setSelectedHubId] = useState<string>("delhi-ncr");

  const selectedHub = useMemo(() => {
    return REGION_HUBS.find((h) => h.id === selectedHubId) || REGION_HUBS[0];
  }, [selectedHubId]);

  // Total All-India statistics
  const nationalStats = useMemo(() => {
    return {
      totalStations: 14860,
      totalCo2Tonnes: 356400,
      totalFuelLakhLitre: 1580,
      totalTreesLakh: 142.5,
      cleanGwh: 892,
    };
  }, []);

  return (
    <section id="impact" className="scroll-mt-20 bg-ink py-20 text-white relative overflow-hidden">
      {/* Decorative ambient background glows */}
      <div className="pointer-events-none absolute -left-40 top-0 h-96 w-96 rounded-full bg-brand/15 blur-3xl" />
      <div className="pointer-events-none absolute right-0 bottom-0 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="mx-auto max-w-7xl px-5 sm:px-8 relative z-10">
        {/* Section Header */}
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand/20 px-3.5 py-1.5 text-xs font-bold text-brand-mint border border-brand/30">
            <Globe2 size={14} /> NATIONWIDE CLEAN MOBILITY GRID
          </div>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-5xl text-white">
            India Charging Map &amp; Environmental Impact
          </h2>
          <p className="mt-3 text-lg text-slate-300 leading-relaxed">
            Every electric kilometre driven in India reduces tailpipe carbon emissions. Explore active charging stations across India and see how our green transition is saving the planet.
          </p>
        </div>

        {/* Big Environmental Impact Highlights Bar */}
        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:gap-6">
          <div className="rounded-3xl bg-white/5 p-6 backdrop-blur-md ring-1 ring-white/10 transition-all hover:bg-white/10">
            <div className="flex items-center justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/20 text-brand-mint">
                <Leaf size={22} />
              </span>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800">
                -100% Tailpipe
              </span>
            </div>
            <p className="mt-4 text-3xl font-black text-white tracking-tight sm:text-4xl">
              {nationalStats.totalCo2Tonnes.toLocaleString()}+
            </p>
            <p className="mt-1 text-sm font-semibold text-brand-mint">Tonnes CO₂ Prevented</p>
            <p className="mt-1 text-xs text-slate-400">Stopping greenhouse gases from polluting Indian air.</p>
          </div>

          <div className="rounded-3xl bg-white/5 p-6 backdrop-blur-md ring-1 ring-white/10 transition-all hover:bg-white/10">
            <div className="flex items-center justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-400">
                <Fuel size={22} />
              </span>
              <span className="text-xs font-bold text-blue-300 bg-blue-950/60 px-2 py-0.5 rounded-full border border-blue-800">
                Crude Saved
              </span>
            </div>
            <p className="mt-4 text-3xl font-black text-white tracking-tight sm:text-4xl">
              {(nationalStats.totalFuelLakhLitre / 10).toFixed(1)}M
            </p>
            <p className="mt-1 text-sm font-semibold text-blue-300">Litres of Fuel Saved</p>
            <p className="mt-1 text-xs text-slate-400">Reducing import dependency on petrol and diesel.</p>
          </div>

          <div className="rounded-3xl bg-white/5 p-6 backdrop-blur-md ring-1 ring-white/10 transition-all hover:bg-white/10">
            <div className="flex items-center justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400">
                <Trees size={22} />
              </span>
              <span className="text-xs font-bold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800">
                Nature Equiv.
              </span>
            </div>
            <p className="mt-4 text-3xl font-black text-white tracking-tight sm:text-4xl">
              {nationalStats.totalTreesLakh.toFixed(1)}M
            </p>
            <p className="mt-1 text-sm font-semibold text-emerald-400">Equivalent Trees Planted</p>
            <p className="mt-1 text-xs text-slate-400">CO₂ absorption impact equivalent to mature forests.</p>
          </div>

          <div className="rounded-3xl bg-white/5 p-6 backdrop-blur-md ring-1 ring-white/10 transition-all hover:bg-white/10">
            <div className="flex items-center justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400">
                <Zap size={22} />
              </span>
              <span className="text-xs font-bold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-800">
                Live Stations
              </span>
            </div>
            <p className="mt-4 text-3xl font-black text-white tracking-tight sm:text-4xl">
              {nationalStats.totalStations.toLocaleString()}+
            </p>
            <p className="mt-1 text-sm font-semibold text-amber-300">Charging Stations Active</p>
            <p className="mt-1 text-xs text-slate-400">Fast highway corridors and city rapid chargers.</p>
          </div>
        </div>

        {/* Interactive Map & Regional Breakdown Grid */}
        <div className="mt-12 grid gap-8 lg:grid-cols-[1.1fr_1fr] items-center">
          {/* Interactive Map Visualizer */}
          <div className="rounded-3xl bg-white/5 p-6 sm:p-8 backdrop-blur-md ring-1 ring-white/10 relative">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div>
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                  <MapPin size={18} className="text-brand" /> Interactive India EV Grid
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Click any pulsating station hub to view local impact</p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-950/70 px-3 py-1 rounded-full border border-emerald-800">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" /> Live
              </span>
            </div>

            {/* Stylized SVG Map of India with Interactive Hubs */}
            <div className="relative mt-6 h-[460px] w-full flex items-center justify-center">
              <svg
                viewBox="0 0 100 100"
                className="h-full w-full max-h-[460px] drop-shadow-[0_0_25px_rgba(22,163,74,0.15)]"
              >
                {/* Stylized geometric outline of India */}
                <path
                  d="M 33 12 
                     L 38 12 L 43 17 L 46 23 L 42 27 L 48 29 L 58 31 L 64 34 L 75 33 L 83 31 L 86 35 L 82 40 L 76 43 L 74 48 L 76 53 L 70 56 L 63 56 L 58 63 L 53 71 L 49 79 L 45 87 L 43 92 L 41 95 L 39 92 L 35 84 L 32 75 L 29 65 L 23 58 L 18 52 L 18 45 L 24 40 L 26 34 L 28 27 L 31 18 Z"
                  fill="#0f172a"
                  stroke="#334155"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />

                {/* Major Expressway Green Corridors */}
                {/* Delhi to Agra & Jaipur */}
                <line x1="35" y1="32" x2="28" y2="40" stroke="#16a34a" strokeWidth="0.8" strokeDasharray="1.5 1" opacity="0.7" />
                <line x1="35" y1="32" x2="33" y2="25" stroke="#16a34a" strokeWidth="0.8" strokeDasharray="1.5 1" opacity="0.7" />
                {/* Mumbai to Pune & Bengaluru */}
                <line x1="29" y1="59" x2="39" y2="77" stroke="#16a34a" strokeWidth="0.8" strokeDasharray="1.5 1" opacity="0.7" />
                {/* Bengaluru to Chennai & Kochi */}
                <line x1="39" y1="77" x2="43" y2="84" stroke="#16a34a" strokeWidth="0.8" strokeDasharray="1.5 1" opacity="0.7" />
                <line x1="39" y1="77" x2="37" y2="89" stroke="#16a34a" strokeWidth="0.8" strokeDasharray="1.5 1" opacity="0.7" />
                {/* Hyderabad to Bengaluru */}
                <line x1="43" y1="65" x2="39" y2="77" stroke="#16a34a" strokeWidth="0.8" strokeDasharray="1.5 1" opacity="0.7" />
                {/* Delhi to Ahmedabad */}
                <line x1="35" y1="32" x2="21" y2="50" stroke="#16a34a" strokeWidth="0.8" strokeDasharray="1.5 1" opacity="0.7" />
                {/* Ahmedabad to Mumbai */}
                <line x1="21" y1="50" x2="29" y2="59" stroke="#16a34a" strokeWidth="0.8" strokeDasharray="1.5 1" opacity="0.7" />

                {/* Interactive Regional Hub Pins */}
                {REGION_HUBS.map((hub) => {
                  const isSelected = selectedHubId === hub.id;
                  return (
                    <g
                      key={hub.id}
                      onClick={() => setSelectedHubId(hub.id)}
                      className="cursor-pointer transition-transform hover:scale-125"
                    >
                      {/* Pulse circle */}
                      <circle
                        cx={hub.x}
                        cy={hub.y}
                        r={isSelected ? "4.5" : "2.5"}
                        fill={isSelected ? "#22c55e" : "#16a34a"}
                        opacity={isSelected ? "0.35" : "0.2"}
                        className="animate-ping"
                      />
                      {/* Outer ring */}
                      <circle
                        cx={hub.x}
                        cy={hub.y}
                        r={isSelected ? "3.2" : "2.2"}
                        fill={isSelected ? "#22c55e" : "#10b981"}
                        stroke="#ffffff"
                        strokeWidth={isSelected ? "0.8" : "0.5"}
                      />
                      {/* Core dot */}
                      <circle
                        cx={hub.x}
                        cy={hub.y}
                        r={isSelected ? "1.5" : "1.0"}
                        fill="#052e16"
                      />
                      {/* Text label */}
                      <text
                        x={hub.x + 3.5}
                        y={hub.y + 1}
                        fill={isSelected ? "#4ade80" : "#94a3b8"}
                        fontSize="2.8"
                        fontWeight={isSelected ? "bold" : "normal"}
                        className="pointer-events-none select-none"
                      >
                        {hub.name.split(" ")[0]}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Map Footer badge */}
              <div className="absolute bottom-2 left-2 rounded-xl bg-slate-900/90 px-3 py-1.5 text-[11px] text-slate-400 border border-slate-800 backdrop-blur">
                ⚡ <span className="text-white font-semibold">Green Corridors:</span> NE4 · Yamuna Expy · NH44 · Mumbai-Pune
              </div>
            </div>
          </div>

          {/* Regional Hub Detail Card */}
          <div className="flex flex-col gap-6">
            <div className="rounded-3xl bg-white/5 p-5 sm:p-8 backdrop-blur-md ring-1 ring-white/10">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-mint">
                    Selected EV Territory
                  </span>
                  <h3 className="text-xl sm:text-3xl font-black text-white mt-1 break-words">
                    {selectedHub.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">{selectedHub.state}</p>
                </div>
                <span className="shrink-0 rounded-2xl bg-brand/20 px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-extrabold text-brand-mint border border-brand/30">
                  {selectedHub.stations.toLocaleString()} Stations
                </span>
              </div>

              {/* Regional Stats Grid */}
              <div className="mt-6 grid grid-cols-2 gap-3.5">
                <div className="rounded-2xl bg-white/5 p-4 border border-white/5">
                  <span className="text-xs text-slate-400 font-medium">Fast DC Chargers (50kW+)</span>
                  <p className="mt-1 text-xl font-bold text-white flex items-center gap-1.5">
                    <Zap size={16} className="text-amber-400" /> {selectedHub.fastDc.toLocaleString()}
                  </p>
                </div>

                <div className="rounded-2xl bg-white/5 p-4 border border-white/5">
                  <span className="text-xs text-slate-400 font-medium">CO₂ Stopped Here</span>
                  <p className="mt-1 text-xl font-bold text-emerald-400 flex items-center gap-1.5">
                    <Leaf size={16} /> {(selectedHub.co2SavedTonnes / 1000).toFixed(1)}k Tonnes
                  </p>
                </div>

                <div className="rounded-2xl bg-white/5 p-4 border border-white/5">
                  <span className="text-xs text-slate-400 font-medium">Trees Equivalent</span>
                  <p className="mt-1 text-xl font-bold text-emerald-300 flex items-center gap-1.5">
                    <Trees size={16} /> {(selectedHub.treesEquiv / 100000).toFixed(1)} Lakh
                  </p>
                </div>

                <div className="rounded-2xl bg-white/5 p-4 border border-white/5">
                  <span className="text-xs text-slate-400 font-medium">Fuel Saved</span>
                  <p className="mt-1 text-xl font-bold text-blue-300 flex items-center gap-1.5">
                    <Fuel size={16} /> {selectedHub.fuelSavedLakhLitre} Lakh L
                  </p>
                </div>
              </div>

              {/* Dominant Networks in this hub */}
              <div className="mt-6 pt-5 border-t border-white/10">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Top Charging Networks in {selectedHub.name}:
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedHub.topNetworks.map((net) => (
                    <span
                      key={net}
                      className="rounded-xl bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 border border-white/10"
                    >
                      {net}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Switcher of Top Hubs */}
            <div className="rounded-3xl bg-white/5 p-5 backdrop-blur-md ring-1 ring-white/10">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                Switch regional charging hubs:
              </p>
              <div className="flex flex-wrap gap-2">
                {REGION_HUBS.map((hub) => (
                  <button
                    key={hub.id}
                    onClick={() => setSelectedHubId(hub.id)}
                    className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                      selectedHubId === hub.id
                        ? "bg-brand text-white shadow-md shadow-brand/30 ring-1 ring-brand-mint"
                        : "bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white"
                    }`}
                  >
                    {hub.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
