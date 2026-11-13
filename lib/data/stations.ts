import type { Station, Connector, City } from "@/lib/types";

type Row = [string, string, City, string, number, Connector[], number, number, number, number, number];
const C = "CCS2" as const, T = "Type 2" as const, H = "CHAdeMO" as const;

// Mock data: name, area, city, network, maxKw, connectors, ₹/kWh, available, total, km from city centre, rating
const rows: Row[] = [
  ["Select Citywalk", "Saket", "Delhi", "Tata Power EZ Charge", 60, [C, T], 18, 3, 4, 1.2, 4.6],
  ["Connaught Place Inner Circle", "Connaught Place", "Delhi", "Statiq", 30, [C, T], 16, 2, 4, 2.1, 4.4],
  ["Nehru Place Metro Parking", "Nehru Place", "Delhi", "ChargeZone", 120, [C], 21, 1, 2, 3.4, 4.5],
  ["Aerocity Worldmark", "Aerocity", "Delhi", "Jio-bp pulse", 150, [C, T], 24, 4, 6, 4.8, 4.7],
  ["Hauz Khas Village", "Hauz Khas", "Delhi", "Zeon Charging", 30, [C, H, T], 17, 0, 3, 2.7, 4.2],
  ["Dwarka Sector 21 Metro", "Dwarka", "Delhi", "EESL", 22, [T], 12, 2, 3, 6.9, 4.1],
  ["Pacific Mall Tagore Garden", "Rajouri Garden", "Delhi", "Tata Power EZ Charge", 60, [C, T], 18, 2, 3, 5.6, 4.3],
  ["Rohini Sector 9 Mall", "Rohini", "Delhi", "Statiq", 50, [C, H], 19, 1, 2, 9.4, 4.0],
  ["Ambience Mall", "Nathupur", "Gurugram", "Jio-bp pulse", 120, [C, T], 23, 5, 6, 2.2, 4.7],
  ["Cyber Hub", "DLF Cyber City", "Gurugram", "Tata Power EZ Charge", 60, [C, T], 18, 2, 4, 3.6, 4.5],
  ["Golf Course Road Tower", "Sector 54", "Gurugram", "ChargeZone", 90, [C], 20, 3, 4, 5.1, 4.4],
  ["Sohna Road Plaza", "Sector 49", "Gurugram", "Zeon Charging", 30, [C, T], 16, 1, 2, 7.3, 4.0],
  ["DLF Mall of India", "Sector 18", "Noida", "Tata Power EZ Charge", 60, [C, T], 18, 4, 6, 1.5, 4.6],
  ["Botanical Garden Metro", "Sector 38", "Noida", "EESL", 22, [T], 12, 3, 4, 3.0, 4.2],
  ["Noida Expressway Hub", "Sector 62", "Noida", "Statiq", 120, [C, T], 22, 2, 4, 5.8, 4.5],
  ["Pari Chowk Fast Charge", "Greater Noida", "Noida", "ChargeZone", 180, [C], 25, 3, 4, 14.2, 4.8],
  ["Shipra Mall", "Indirapuram", "Ghaziabad", "Jio-bp pulse", 60, [C, T], 19, 2, 3, 2.4, 4.3],
  ["Raj Nagar Extension Square", "Raj Nagar Ext.", "Ghaziabad", "Zeon Charging", 30, [C, H], 16, 0, 2, 6.7, 3.9],
  ["Crown Interiorz Mall", "Sector 35", "Faridabad", "Tata Power EZ Charge", 60, [C, T], 17, 3, 4, 2.9, 4.4],
  ["Sector 15 Metro Station", "Sector 15", "Faridabad", "EESL", 22, [T], 11, 2, 2, 4.2, 4.0],
  ["Delhi–Mathura Highway Stop", "Ballabhgarh", "Faridabad", "ChargeZone", 150, [C, T], 23, 4, 4, 8.8, 4.6],
];

export const STATIONS: Station[] = rows.map((r, i) => ({
  id: `st-${i + 1}`, name: r[0], area: r[1], city: r[2], network: r[3], maxKw: r[4], connectors: r[5],
  pricePerKwh: r[6], available: r[7], total: r[8], distanceKm: r[9], rating: r[10],
}));

export const CITIES: ("Delhi NCR" | City)[] = ["Delhi NCR", "Delhi", "Gurugram", "Noida", "Ghaziabad", "Faridabad"];
