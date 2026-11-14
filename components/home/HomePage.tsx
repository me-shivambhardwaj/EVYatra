"use client";
import { useMemo, useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Hero from "./Hero";
import FeaturedEVs from "./FeaturedEVs";
import NearbyStations, { type StationFilter } from "./NearbyStations";
import TripPlanner from "./TripPlanner";
import IndiaEVMap from "./IndiaEVMap";
import HowItWorks from "./HowItWorks";
import { EVS } from "@/lib/data/evs";
import { STATIONS } from "@/lib/data/stations";
import { useLocalStorage } from "@/hooks/useLocalStorage";

export default function HomePage() {
  const [city, setCity] = useLocalStorage("evyatra:city", "Delhi NCR");
  const [carId, setCarId] = useLocalStorage("evyatra:car", "Hyn-IONIQ 5");
  const [favCars, setFavCars] = useLocalStorage<string[]>("evyatra:fav-cars", []);
  const [favStations, setFavStations] = useLocalStorage<string[]>("evyatra:fav-stations", []);
  const [filter, setFilter] = useState<StationFilter>("all");

  const car = EVS.find((e) => e.id === carId);
  const toggle = (set: typeof setFavCars) => (id: string) => set((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  const stations = useMemo(() => {
    return STATIONS
      .filter((s) => city === "Delhi NCR" || s.city === city)
      .filter((s) => !car || s.connectors.some((c) => car.connectors.includes(c)))
      .filter((s) => (filter === "fast" ? s.maxKw >= 50 : filter === "available" ? s.available > 0 : filter === "saved" ? favStations.includes(s.id) : true))
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [city, car, filter, favStations]);

  const nearest = useMemo(() => STATIONS
    .filter((s) => (city === "Delhi NCR" || s.city === city) && (!car || s.connectors.some((c) => car.connectors.includes(c))))
    .sort((a, b) => a.distanceKm - b.distanceKm)[0], [city, car]);

  const goToChargers = () => document.getElementById("chargers")?.scrollIntoView({ behavior: "smooth" });
  const pickCar = (id: string) => { setCarId(id); setFilter("all"); setTimeout(goToChargers, 50); };

  return (
    <div id="top">
      <Navbar />
      <main>
        <Hero city={city} onCity={setCity} carId={carId} onCar={setCarId} cars={EVS} previewCar={car ?? EVS[0]}
          nearest={nearest} onFind={() => { setFilter("all"); goToChargers(); }} />
        <FeaturedEVs cars={EVS} selectedId={carId} favourites={favCars} onToggleFav={toggle(setFavCars)} onPick={pickCar} />
        <NearbyStations stations={stations} city={city} car={car} filter={filter} onFilter={setFilter}
          favourites={favStations} onToggleFav={toggle(setFavStations)}
          onReset={() => { setFilter("all"); setCity("Delhi NCR"); setCarId(""); }} />
        <IndiaEVMap />
        <TripPlanner cars={EVS} selectedCarId={carId || EVS[0].id} onSelectCar={setCarId} />
        <HowItWorks />
      </main>
      <Footer />
    </div>
  );
}
