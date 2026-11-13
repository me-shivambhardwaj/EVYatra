import { Car, MapPinned, Route } from "lucide-react";

const STEPS = [
  { id: "compare", icon: Car, title: "Pick your car", body: "Compare price, battery and range across popular Indian EVs, and choose the one you drive or want to buy." },
  { id: "match", icon: MapPinned, title: "Find chargers that fit", body: "See stations that support your car's connector, with charging speed, price per kWh and live availability." },
  { id: "trip-planner", icon: Route, title: "Plan the route", body: "Choose a start and destination and get suggested charging stops along the way, before you leave." },
];

export default function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24">
      <h2 className="max-w-xl text-3xl font-extrabold tracking-tight sm:text-4xl">How EVYatra works</h2>
      <ol className="mt-10 grid gap-5 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.id} id={s.id} className="scroll-mt-24 rounded-3xl bg-white p-7 shadow-soft ring-1 ring-line">
            <div className="flex items-center justify-between">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand"><s.icon size={22} /></span>
              <span className="text-sm font-bold text-muted">Step {i + 1}</span>
            </div>
            <h3 className="mt-6 text-xl font-bold">{s.title}</h3>
            <p className="mt-2 leading-relaxed text-muted">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
