"""
Deal Finder Agent
Searches Zillow for land/lot properties matching the buy box criteria
for placing manufactured homes. Passes qualifying leads to the Due Diligence agent.
"""

import anthropic
import json

DEAL_FINDER_SYSTEM_PROMPT = """You are an expert land acquisition scout for a manufactured home business.
Your job is to find vacant land and lot deals that are ideal for placing manufactured homes to sell.

## Buy Box Criteria
When searching for properties, focus on:
- **Property Type:** Vacant land, lots, or properties with teardown structures
- **Lot Size:** Minimum 0.25 acres (ideal: 0.5–2 acres for single unit, 2+ acres for multi-unit)
- **Price Range:** Under market value — look for motivated sellers, auctions, and price reductions
- **Utilities:** Prefer parcels with existing water, sewer/septic, and electric access (or nearby)
- **Road Access:** Must have road frontage or deeded access
- **Location Factors:** Proximity to employment centers, schools, shopping; growing markets preferred
- **Red Flags to Note:** Flood zones, steep terrain, landlocked parcels, HOA restrictions on manufactured homes

## Your Search Process
1. Search Zillow for properties matching the criteria in the specified area
2. For each promising listing, extract:
   - Address / Parcel ID
   - Asking price and price per acre
   - Lot size (acres)
   - Current zoning (if listed)
   - Days on market
   - Utilities available
   - Zillow URL
   - Any seller notes or special conditions
3. Score each deal (A/B/C) based on how well it fits the buy box
4. Compile results into a structured report

## Output Format
Return your findings as a JSON array of deal objects with this structure:
{
  "search_area": "the area searched",
  "search_date": "date",
  "deals": [
    {
      "address": "",
      "parcel_id": "",
      "asking_price": 0,
      "lot_size_acres": 0,
      "price_per_acre": 0,
      "zoning": "",
      "days_on_market": 0,
      "utilities": {"water": "", "sewer": "", "electric": ""},
      "road_access": "",
      "zillow_url": "",
      "seller_notes": "",
      "score": "A/B/C",
      "score_reasoning": "",
      "red_flags": []
    }
  ],
  "market_summary": ""
}
"""


def create_deal_finder_client():
    """Create an Anthropic client configured for the Deal Finder agent."""
    return anthropic.Anthropic()


def find_deals(search_area: str, additional_criteria: str = "") -> dict:
    """
    Run the Deal Finder agent to search for land deals in the specified area.

    Args:
        search_area: Geographic area to search (e.g., "Tampa, FL", "Polk County, FL")
        additional_criteria: Any additional buy box criteria or preferences

    Returns:
        Dictionary containing found deals and market summary
    """
    client = create_deal_finder_client()

    user_prompt = f"""Search Zillow for vacant land and lot deals in: {search_area}

Additional criteria: {additional_criteria if additional_criteria else "None — use standard buy box criteria."}

Find the best opportunities for placing manufactured homes. Focus on:
1. Deals priced below market value
2. Parcels that appear suitable for manufactured home placement
3. Properties with utility access or easy utility connection
4. Areas with growing demand for affordable housing

Search thoroughly and compile your findings. Return results as the specified JSON format."""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=DEAL_FINDER_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )

    response_text = message.content[0].text

    # Try to extract JSON from the response
    try:
        # Look for JSON block in response
        if "```json" in response_text:
            json_str = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            json_str = response_text.split("```")[1].split("```")[0].strip()
        else:
            json_str = response_text

        deals_data = json.loads(json_str)
    except (json.JSONDecodeError, IndexError):
        # If JSON parsing fails, return the raw response wrapped in a structure
        deals_data = {
            "search_area": search_area,
            "raw_response": response_text,
            "deals": [],
            "parse_error": "Could not parse structured deals — review raw_response"
        }

    return deals_data


if __name__ == "__main__":
    import sys

    area = sys.argv[1] if len(sys.argv) > 1 else "Polk County, FL"
    extra = sys.argv[2] if len(sys.argv) > 2 else ""

    print(f"🔍 Deal Finder Agent — Searching: {area}")
    print("=" * 60)

    results = find_deals(area, extra)
    print(json.dumps(results, indent=2))
