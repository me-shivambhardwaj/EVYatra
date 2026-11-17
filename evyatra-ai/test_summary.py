import os
import re
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
SUMMARY_FILE = BASE_DIR / "cars_summary.json"

generic_files = {"charger-types.md", "charging-cost-tips.md", "ev-knowledge.md"}

def build_cars_summary():
    cars = []
    for p in sorted(DATA_DIR.glob("*.md")):
        if p.name in generic_files:
            continue
        text = p.read_text(encoding="utf-8")
        title_m = re.search(r"^#\s+(.+)$", text, re.MULTILINE)
        title = title_m.group(1).strip() if title_m else p.stem.replace("-", " ").title()

        # Price
        price_m = re.search(r"Ex-showroom Price[^:]*:\s*(?:Approximately\s*)?([^\n]+)", text, re.IGNORECASE)
        price_str = price_m.group(1).strip() if price_m else "N/A"
        # Find numeric values for sorting
        prices_found = [float(x) for x in re.findall(r"[\d\.]+", price_str.replace(",", "")) if float(x) > 0]
        min_price = min(prices_found) if prices_found else 999.0

        # Battery
        bat_m = re.search(r"Battery Capacity[^:]*:\s*([^\n]+)", text, re.IGNORECASE)
        bat_str = bat_m.group(1).strip() if bat_m else "N/A"
        if bat_str.startswith("-"):
            found_kwh = re.findall(r"\d+(?:\.\d+)?\s*kWh", text)
            bat_str = " / ".join(dict.fromkeys(found_kwh)) if found_kwh else bat_str

        # Claimed Range
        claimed_m = re.search(r"Claimed (?:ARAI / MIDC |MIDC |ARAI )?Range[^:]*:\s*([^\n]+)", text, re.IGNORECASE)
        claimed_str = claimed_m.group(1).strip() if claimed_m else "N/A"
        if claimed_str.startswith("-"):
            found_km = re.findall(r"\d+\s*km", text)
            claimed_str = " / ".join(dict.fromkeys(found_km)) if found_km else claimed_str

        # Real Range
        real_m = re.search(r"Real-world Estimated Range[^:]*:\s*([^\n]+)", text, re.IGNORECASE)
        real_str = real_m.group(1).strip() if real_m else "N/A"
        if real_str.startswith("-"):
            found_real = re.findall(r"\d+\s*(?:to|-)\s*\d+\s*km", text)
            real_str = " / ".join(dict.fromkeys(found_real)) if found_real else real_str

        cars.append({
            "name": title,
            "file": p.name,
            "price": price_str,
            "price_min_lakh": min_price,
            "battery": bat_str,
            "claimed_range": claimed_str,
            "real_range": real_str
        })

    cars.sort(key=lambda x: x["price_min_lakh"])
    SUMMARY_FILE.write_text(json.dumps(cars, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Generated cars_summary.json with {len(cars)} cars at {SUMMARY_FILE}")
    return cars

if __name__ == "__main__":
    build_cars_summary()
