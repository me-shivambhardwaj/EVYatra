import { ArrowUp, Zap } from "lucide-react";

const COLS = [
  { title: "Explore", links: [["Chargers", "#chargers"], ["Cars", "#cars"], ["Compare", "#compare"], ["Trip planner", "#trip-planner"]] },
  { title: "EVYatra", links: [["How it works", "#how"], ["Back to top", "#top"]] },
];

export default function Footer() {
  return (
    <footer className="bg-ink text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.6fr_1fr_1fr]">
        <div>
          <a href="#top" className="flex items-center gap-2 text-xl font-extrabold"><Zap className="text-brand-mint" size={22} /> EVYatra</a>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-brand-mint/80">An EV guide for India. Compare cars, find chargers that fit your connector, and plan trips with fewer surprises.</p>
        </div>
        {COLS.map((c) => (
          <div key={c.title}>
            <h3 className="text-sm font-bold">{c.title}</h3>
            <ul className="mt-4 space-y-3">
              {c.links.map(([label, href]) => (
                <li key={href}><a href={href} className="text-sm text-brand-mint/80 transition-colors hover:text-white">{label}</a></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 text-xs text-brand-mint/70 sm:px-8">
          <p>© {new Date().getFullYear()} EVYatra. Demo data only; prices and availability are illustrative.</p>
          <a href="#top" aria-label="Back to top" className="shrink-0 rounded-full border border-white/20 p-2 hover:bg-white/10"><ArrowUp size={14} /></a>
        </div>
      </div>
    </footer>
  );
}
