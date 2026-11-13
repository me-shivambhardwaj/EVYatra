import { MAX_RANGE_KM } from "@/lib/format";

export default function RangeBar({ km }: { km: number }) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-sm text-muted"><span>Range</span><span className="font-semibold text-ink">{km} km</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-line" role="img" aria-label={`Claimed range ${km} kilometres`}>
        <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${Math.min(100, (km / MAX_RANGE_KM) * 100)}%` }} />
      </div>
    </div>
  );
}
