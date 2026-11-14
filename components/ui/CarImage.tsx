"use client";
import { useState } from "react";
import { Car } from "lucide-react";
import type { EV } from "@/lib/types";

// Looks for /public/cars/<ev.id>.png, then .jpg, then .webp, then falls back to an icon.
const EXTS = ["png", "jpg", "webp"];

export default function CarImage({ ev, iconSize = 56 }: { ev: EV; iconSize?: number }) {
  const [step, setStep] = useState(0);
  if (step >= EXTS.length) return <Car size={iconSize} strokeWidth={1.2} className="text-brand/60" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={`${ev.id}-${step}`}
      src={`/cars/${ev.id}.${EXTS[step]}`}
      alt={`${ev.brand} ${ev.name}`}
      onError={() => setStep((s) => s + 1)}
      className="h-full w-full object-contain p-3"
    />
  );
}