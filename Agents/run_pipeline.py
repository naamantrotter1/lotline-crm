"""
Land Acquisition Pipeline — Orchestrator
Coordinates the Deal Finder and Due Diligence agents in sequence:
  1. Deal Finder searches for properties matching buy box criteria
  2. Due Diligence evaluates each deal for manufactured home placement feasibility
  3. Results are saved to the output folder
"""

import json
import os
import sys
from datetime import datetime

from deal_finder import find_deals
from due_diligence import run_due_diligence_batch


def run_pipeline(search_area: str, additional_criteria: str = "", top_n: int = 5):
    """
    Run the full land acquisition pipeline.

    Args:
        search_area: Geographic area to search (e.g., "Tampa, FL")
        additional_criteria: Extra buy box criteria
        top_n: Number of top deals to run due diligence on (to manage cost/time)
    """
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    output_dir = os.path.join(os.path.dirname(__file__), "..", "Due Diligence", f"run_{timestamp}")
    os.makedirs(output_dir, exist_ok=True)

    # ── Step 1: Find Deals ──────────────────────────────────────────────
    print("=" * 70)
    print("STEP 1: DEAL FINDER AGENT")
    print(f"Searching: {search_area}")
    print("=" * 70)

    deals_data = find_deals(search_area, additional_criteria)

    # Save raw deal finder results
    deals_file = os.path.join(output_dir, "01_deals_found.json")
    with open(deals_file, "w") as f:
        json.dump(deals_data, f, indent=2)
    print(f"\nDeals saved to: {deals_file}")

    # Extract and filter deals
    deals = deals_data.get("deals", [])
    if not deals:
        print("\nNo deals found. Check the raw output for details.")
        print(f"Raw output saved to: {deals_file}")
        return

    # Sort by score (A first) and take top N
    score_order = {"A": 0, "B": 1, "C": 2}
    deals.sort(key=lambda d: score_order.get(d.get("score", "C"), 3))
    top_deals = deals[:top_n]

    print(f"\nFound {len(deals)} deals. Running due diligence on top {len(top_deals)}:")
    for d in top_deals:
        print(f"  [{d.get('score', '?')}] {d.get('address', 'Unknown')} — ${d.get('asking_price', '?'):,}")

    # ── Step 2: Due Diligence ───────────────────────────────────────────
    print("\n" + "=" * 70)
    print("STEP 2: DUE DILIGENCE AGENT")
    print("=" * 70)

    dd_results = run_due_diligence_batch(top_deals)

    # Save due diligence results
    dd_file = os.path.join(output_dir, "02_due_diligence.json")
    with open(dd_file, "w") as f:
        json.dump(dd_results, f, indent=2)
    print(f"\nDue diligence saved to: {dd_file}")

    # ── Step 3: Summary Report ──────────────────────────────────────────
    print("\n" + "=" * 70)
    print("PIPELINE SUMMARY")
    print("=" * 70)

    approved = [r for r in dd_results if r.get("overall_verdict") == "APPROVED"]
    conditional = [r for r in dd_results if r.get("overall_verdict") == "CONDITIONAL"]
    rejected = [r for r in dd_results if r.get("overall_verdict") == "REJECTED"]
    other = [r for r in dd_results if r.get("overall_verdict") not in ("APPROVED", "CONDITIONAL", "REJECTED")]

    summary = {
        "pipeline_run": timestamp,
        "search_area": search_area,
        "total_deals_found": len(deals),
        "deals_analyzed": len(top_deals),
        "results": {
            "approved": len(approved),
            "conditional": len(conditional),
            "rejected": len(rejected),
            "needs_review": len(other)
        },
        "approved_properties": [
            {
                "address": r.get("property_address", ""),
                "summary": r.get("summary", ""),
                "asking_price": r.get("original_deal", {}).get("asking_price", ""),
                "action_items": r.get("action_items", [])
            }
            for r in approved
        ],
        "conditional_properties": [
            {
                "address": r.get("property_address", ""),
                "summary": r.get("summary", ""),
                "asking_price": r.get("original_deal", {}).get("asking_price", ""),
                "deal_breakers": r.get("deal_breakers", []),
                "action_items": r.get("action_items", [])
            }
            for r in conditional
        ]
    }

    summary_file = os.path.join(output_dir, "03_summary.json")
    with open(summary_file, "w") as f:
        json.dump(summary, f, indent=2)

    print(f"Search Area: {search_area}")
    print(f"Deals Found: {len(deals)}")
    print(f"Deals Analyzed: {len(top_deals)}")
    print(f"  APPROVED:    {len(approved)}")
    print(f"  CONDITIONAL: {len(conditional)}")
    print(f"  REJECTED:    {len(rejected)}")
    print(f"  NEEDS REVIEW: {len(other)}")
    print(f"\nAll results saved to: {output_dir}")

    if approved:
        print("\nAPPROVED DEALS:")
        for r in approved:
            price = r.get("original_deal", {}).get("asking_price", "?")
            print(f"  {r.get('property_address', 'Unknown')} — ${price:,}")
            print(f"    {r.get('summary', '')}")

    if conditional:
        print("\nCONDITIONAL DEALS (need further investigation):")
        for r in conditional:
            price = r.get("original_deal", {}).get("asking_price", "?")
            print(f"  {r.get('property_address', 'Unknown')} — ${price:,}")
            print(f"    {r.get('summary', '')}")

    return summary


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 run_pipeline.py <search_area> [additional_criteria] [top_n]")
        print()
        print("Examples:")
        print('  python3 run_pipeline.py "Polk County, FL"')
        print('  python3 run_pipeline.py "Tampa, FL" "under $50,000, min 1 acre"')
        print('  python3 run_pipeline.py "Lakeland, FL" "" 3')
        sys.exit(1)

    area = sys.argv[1]
    criteria = sys.argv[2] if len(sys.argv) > 2 else ""
    top = int(sys.argv[3]) if len(sys.argv) > 3 else 5

    run_pipeline(area, criteria, top)
