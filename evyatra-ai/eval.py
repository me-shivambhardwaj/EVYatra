"""
Evaluation benchmark for EVYatra AI Assistant.
For every car in /data, asks:
1. Price
2. Range
3. Charging time
4. Connector
Prints PASS if the response does not contain "I don't have that info".
Prints a score per car and an overall evaluation report.
"""

import sys
import time
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from main import chat, ChatRequest, get_car_registry

def run_evaluation():
    print("=" * 65)
    print("        EVYATRA AI ASSISTANT EVALUATION BENCHMARK")
    print("=" * 65)

    car_file_map, registry = get_car_registry()
    total_cars = len(registry)
    print(f"Discovered {total_cars} cars in knowledge base (/data).\n")

    test_categories = [
        ("Price", "What is the price of {car}?"),
        ("Range", "What is the range of {car}?"),
        ("Charging Time", "What is the charging time of {car}?"),
        ("Connector", "What connector does {car} use?"),
    ]

    results = []
    total_checks = 0
    total_passes = 0

    for idx, item in enumerate(registry, 1):
        car_name = item["canonical"]
        mapped_file = item["file"]
        print(f"[{idx}/{total_cars}] Evaluating: {car_name} ({mapped_file})")

        car_passes = 0

        for cat_name, q_template in test_categories:
            question = q_template.format(car=car_name)
            req = ChatRequest(question=question, car=car_name, user_name="Evaluator")

            # Try request with retry on rate limit
            status = "FAIL"
            answer = ""
            for attempt in range(3):
                try:
                    resp = chat(req)
                    answer = resp.answer.strip()
                    has_no_info = "i don't have that info" in answer.lower()

                    if not has_no_info and len(answer) > 10:
                        status = "PASS"
                        break
                    else:
                        status = "FAIL"
                        break
                except Exception as e:
                    if "429" in str(e) or "Too Many Requests" in str(e):
                        time.sleep(3.0 * (attempt + 1))
                        continue
                    else:
                        status = "FAIL"
                        answer = str(e)
                        break

            if status == "PASS":
                car_passes += 1
                total_passes += 1

            total_checks += 1
            print(f"   [{status}] {cat_name}: {question}")

            # Modest delay to avoid hitting Groq RPM limits across 140 queries
            time.sleep(0.4)

        score_pct = (car_passes / len(test_categories)) * 100
        print(f"   --> Score for {car_name}: {car_passes}/{len(test_categories)} ({score_pct:.0f}%)\n")
        results.append({
            "car": car_name,
            "passes": car_passes,
            "total": len(test_categories),
            "pct": score_pct
        })

    # Summary Table
    print("=" * 65)
    print("                 FINAL EVALUATION SUMMARY")
    print("=" * 65)
    print(f"{'Car Name':<32} | {'Score':<8} | {'Pass Rate':<10}")
    print("-" * 65)
    for r in results:
        print(f"{r['car']:<32} | {r['passes']}/{r['total']:<6} | {r['pct']:>6.1f}%")
    print("=" * 65)

    overall_pct = (total_passes / total_checks) * 100 if total_checks else 0
    print(f"TOTAL TESTS:  {total_checks}")
    print(f"TOTAL PASSED: {total_passes}")
    print(f"OVERALL SCORE: {total_passes}/{total_checks} ({overall_pct:.1f}%)")
    print("=" * 65)

    return total_passes == total_checks

if __name__ == "__main__":
    success = run_evaluation()
    sys.exit(0 if success else 1)
