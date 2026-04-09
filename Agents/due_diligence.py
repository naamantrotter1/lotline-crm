"""
Due Diligence Agent
Takes property deals found by the Deal Finder agent and performs due diligence
to verify whether a manufactured home can legally be placed on each parcel.
"""

import anthropic
import json

DUE_DILIGENCE_SYSTEM_PROMPT = """You are an expert real estate due diligence analyst specializing in manufactured home placement.
Your job is to evaluate whether a specific parcel of land is legally and practically suitable
for placing a manufactured home (or multiple units) for sale.

## Due Diligence Checklist

For each property, investigate and report on ALL of the following:

### 1. Zoning & Land Use
- What is the current zoning designation?
- Does the zoning allow manufactured homes (HUD-code homes)?
- Is there a distinction between "manufactured home" and "mobile home" in local code?
- Are there any overlay districts or special use areas?
- Is a special use permit or variance required?
- What are the setback requirements?
- What is the maximum lot coverage allowed?
- Are there minimum square footage requirements for homes?

### 2. Building & Placement Regulations
- Does the county/city require a permanent foundation for manufactured homes?
- Are there tie-down and anchoring requirements?
- What are the local building permit requirements?
- Are there aesthetic requirements (skirting, roofing pitch, siding material)?
- Is there a minimum year/model requirement for manufactured homes?
- Are multi-section (doublewide) homes treated differently than single-section?

### 3. Deed Restrictions & HOA
- Are there any deed restrictions or covenants that prohibit manufactured homes?
- Is the property in an HOA? If so, do CC&Rs allow manufactured homes?
- Are there any easements that would limit placement?

### 4. Utilities & Infrastructure
- Water: Municipal water available? Well permit needed?
- Sewer: Municipal sewer or septic system required? Perc test done?
- Electric: Distance to nearest power line? Service capacity?
- Gas: Natural gas available or propane only?
- Internet/Cable: Available?
- Stormwater: Any drainage requirements?

### 5. Environmental & Physical
- Is the property in a FEMA flood zone? What zone?
- Are there wetlands on or near the property?
- Is an environmental assessment needed?
- Soil conditions — suitable for foundation/septic?
- Topography — is the lot relatively flat?
- Any protected species or habitats?

### 6. Access & Legal
- Does the property have legal road access?
- Can manufactured home delivery trucks access the site?
- Are there any pending liens or tax issues?
- Are property taxes current?
- Any pending litigation involving the parcel?

### 7. Financial Viability
- Estimated total cost to prepare site (grading, utilities, permits)
- Estimated timeline from purchase to home placement
- Comparable manufactured home sale prices in the area
- Estimated total investment vs. projected sale price
- Risk level assessment

## Output Format
Return your analysis as JSON:
{
  "property_address": "",
  "analysis_date": "",
  "overall_verdict": "APPROVED / CONDITIONAL / REJECTED",
  "confidence_level": "HIGH / MEDIUM / LOW",
  "summary": "1-2 sentence executive summary",
  "zoning": {
    "designation": "",
    "manufactured_homes_allowed": true/false,
    "permit_required": "",
    "setbacks": "",
    "notes": ""
  },
  "building_regulations": {
    "foundation_required": "",
    "aesthetic_requirements": "",
    "notes": ""
  },
  "deed_restrictions": {
    "has_restrictions": true/false,
    "hoa": true/false,
    "details": ""
  },
  "utilities": {
    "water": {"available": true/false, "details": ""},
    "sewer": {"available": true/false, "details": ""},
    "electric": {"available": true/false, "details": ""},
    "notes": ""
  },
  "environmental": {
    "flood_zone": "",
    "wetlands": true/false,
    "soil_suitable": true/false,
    "notes": ""
  },
  "access": {
    "road_access": true/false,
    "delivery_accessible": true/false,
    "notes": ""
  },
  "financial_viability": {
    "estimated_site_prep_cost": "",
    "estimated_timeline": "",
    "comparable_sales": "",
    "risk_level": "LOW / MEDIUM / HIGH",
    "notes": ""
  },
  "action_items": ["list of next steps if proceeding"],
  "deal_breakers": ["list of issues that would prevent placement"],
  "risk_factors": ["list of risks to be aware of"]
}
"""


def create_due_diligence_client():
    """Create an Anthropic client configured for the Due Diligence agent."""
    return anthropic.Anthropic()


def run_due_diligence(deal: dict) -> dict:
    """
    Run due diligence analysis on a single property deal.

    Args:
        deal: Dictionary containing deal information from the Deal Finder agent

    Returns:
        Dictionary containing the due diligence analysis
    """
    client = create_due_diligence_client()

    user_prompt = f"""Perform full due diligence on this property for manufactured home placement:

Property Details:
- Address: {deal.get('address', 'Unknown')}
- Parcel ID: {deal.get('parcel_id', 'Unknown')}
- Asking Price: ${deal.get('asking_price', 'Unknown')}
- Lot Size: {deal.get('lot_size_acres', 'Unknown')} acres
- Listed Zoning: {deal.get('zoning', 'Unknown')}
- Utilities Listed: {json.dumps(deal.get('utilities', {}), indent=2)}
- Road Access: {deal.get('road_access', 'Unknown')}
- Seller Notes: {deal.get('seller_notes', 'None')}
- Red Flags from Initial Screen: {json.dumps(deal.get('red_flags', []))}

Based on the property location and available information, research and analyze:
1. Whether manufactured homes are legally allowed on this parcel
2. What permits and approvals would be needed
3. Whether the physical site is suitable
4. What the total investment and timeline would look like
5. Any deal-breakers or significant risks

Be thorough but practical. Flag anything that needs in-person verification.
Return your analysis in the specified JSON format."""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=DUE_DILIGENCE_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )

    response_text = message.content[0].text

    try:
        if "```json" in response_text:
            json_str = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            json_str = response_text.split("```")[1].split("```")[0].strip()
        else:
            json_str = response_text

        analysis = json.loads(json_str)
    except (json.JSONDecodeError, IndexError):
        analysis = {
            "property_address": deal.get("address", "Unknown"),
            "raw_response": response_text,
            "overall_verdict": "REVIEW_NEEDED",
            "parse_error": "Could not parse structured analysis — review raw_response"
        }

    return analysis


def run_due_diligence_batch(deals: list) -> list:
    """
    Run due diligence on multiple deals.

    Args:
        deals: List of deal dictionaries from the Deal Finder agent

    Returns:
        List of due diligence analysis results
    """
    results = []
    for i, deal in enumerate(deals):
        print(f"  Analyzing deal {i+1}/{len(deals)}: {deal.get('address', 'Unknown')}")
        analysis = run_due_diligence(deal)
        analysis["original_deal"] = deal
        results.append(analysis)
    return results


if __name__ == "__main__":
    # Example: run due diligence on a single test property
    test_deal = {
        "address": "123 Example Rd, Lakeland, FL 33801",
        "parcel_id": "Unknown",
        "asking_price": 45000,
        "lot_size_acres": 1.0,
        "zoning": "RS-1",
        "utilities": {"water": "Municipal", "sewer": "Septic needed", "electric": "Available"},
        "road_access": "Paved road frontage",
        "seller_notes": "Motivated seller",
        "red_flags": []
    }

    print("📋 Due Diligence Agent — Analyzing Property")
    print("=" * 60)

    result = run_due_diligence(test_deal)
    print(json.dumps(result, indent=2))
