export type Connector = "CCS2" | "Type 2" | "CHAdeMO";
export type City = "Delhi" | "Gurugram" | "Noida" | "Ghaziabad" | "Faridabad";
export type EVSegment = "mass" | "premium" | "luxury";

export interface EV {
  id: string;
  name: string;
  brand: string;
  priceLakh: number;
  rangeKm: number;
  batteryKwh: number;
  fastChargeMin: number;
  maxDcKw: number;
  connectors: Connector[];
  segment: EVSegment;
  image?: string;
}

export interface Station {
  id: string;
  name: string;
  area: string;
  city: City;
  network: string;
  maxKw: number;
  connectors: Connector[];
  pricePerKwh: number;
  available: number;
  total: number;
  distanceKm: number;
  rating: number;
}
