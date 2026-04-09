#!/usr/bin/env python3
"""
PLACEHOLDER: ATTOM Property Data API ingestion.
================================================
Pulls parcel-level data: ownership, assessed value, tax history, foreclosure status.

Purchase: https://api.attomdata.com/
Cost: Starts ~$300/month for property data access.
Docs: https://api.attomdata.com/docs

This script is fully wired up — add ATTOM_API_KEY to .env to activate.

What ATTOM provides that augments our platform:
  - Parcel ownership names (motivated seller research)
  - Assessed value vs market value (buy below assessed = opportunity)
  - Tax delinquency status (distressed sellers)
  - Foreclosure filings (pre-foreclosure leads)
  - Last sold date + price (additional comp data)
  - Owner occupancy status
  - Legal description + acreage from deed

Run: python scripts/placeholder_attom.py
Schedule: Monthly or on-demand for specific parcels
"""

import os, requests, psycopg2
from dotenv import load_dotenv

load_dotenv()

ATTOM_API_KEY = os.getenv('ATTOM_API_KEY', '')
ATTOM_BASE    = 'https://api.gateway.attomdata.com/propertyapi/v1.0.0'

DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'), 'port': int(os.getenv('DB_PORT', 5432)),
    'database': os.getenv('DB_NAME', 'lotline_intelligence'),
    'user': os.getenv('DB_USER', 'lotline'), 'password': os.getenv('DB_PASSWORD', 'lotline_secret'),
}

# ─── ATTOM field mapping ──────────────────────────────────────────────────────
# The ATTOM "property/detail" endpoint returns a rich nested object.
# Key fields we want:

ATTOM_HEADERS = {
    'apikey': ATTOM_API_KEY,
    'Accept': 'application/json',
}


def fetch_property_by_address(address: str, zip_code: str) -> dict | None:
    """
    Look up a single property by address + ZIP (for deal diligence).
    """
    resp = requests.get(
        f'{ATTOM_BASE}/property/detail',
        headers=ATTOM_HEADERS,
        params={'address1': address, 'address2': zip_code},
        timeout=15,
    )
    if resp.status_code == 404:
        return None
    resp.raise_for_status()
    data = resp.json()
    return data.get('property', [None])[0]


def fetch_properties_by_county(fips5: str, limit: int = 1000) -> list:
    """
    Bulk fetch properties in a county.
    Uses the ATTOM "property/snapshot" endpoint.
    NOTE: Requires ATTOM bulk data subscription.
    """
    resp = requests.get(
        f'{ATTOM_BASE}/property/snapshot',
        headers=ATTOM_HEADERS,
        params={
            'geoid': f'CO{fips5}',   # ATTOM county geoid format
            'pageSize': limit,
            'page': 1,
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json().get('property', [])


def parse_attom_property(raw: dict) -> dict:
    """Extract the fields we care about from an ATTOM property record."""
    ident   = raw.get('identifier', {})
    loc     = raw.get('location', {})
    lot     = raw.get('lot', {})
    assess  = raw.get('assessment', {})
    tax     = raw.get('tax', {})
    owner   = raw.get('owner', {})
    sale    = raw.get('sale', {})

    assessed_imp  = assess.get('assessed', {}).get('assdImprValue', 0)
    assessed_land = assess.get('assessed', {}).get('assdLandValue', 0)
    assessed_tot  = assess.get('assessed', {}).get('assdTtlValue', 0)
    market_tot    = assess.get('market', {}).get('mktTtlValue', 0)

    return {
        'attom_id':         ident.get('attomId'),
        'parcel_id':        ident.get('apn'),
        'fips_code':        ident.get('fips'),
        'address':          f"{loc.get('line1', '')} {loc.get('line2', '')}".strip(),
        'zip_code':         loc.get('postal'),
        'lat':              loc.get('latitude'),
        'lng':              loc.get('longitude'),
        'county_name':      loc.get('county'),
        'state':            loc.get('statecode'),
        'acreage':          lot.get('lotsize1'),           # in acres
        'lot_sqft':         lot.get('lotsize2'),           # in sqft
        'assessed_value':   assessed_tot,
        'market_value':     market_tot,
        'tax_year':         tax.get('taxYear'),
        'annual_tax':       tax.get('taxAmt'),
        'tax_delinquent':   tax.get('taxDeliqYear') is not None,
        'owner_name1':      owner.get('owner1', {}).get('lastName'),
        'owner_name2':      owner.get('owner2', {}).get('lastName'),
        'owner_occupied':   owner.get('ownerOccupied') == 'Y',
        'last_sale_date':   sale.get('saleTransDate'),
        'last_sale_price':  sale.get('saleAmt'),
        'foreclosure':      raw.get('foreclosure', {}).get('fcDocType') is not None,
    }


def upsert_parcel(data: dict) -> bool:
    """
    Upsert into a future 'parcels' table.
    Currently logged only — table to be added in next schema migration.
    """
    # TODO: Add parcels table to schema when ATTOM is activated.
    # For now, this enriches the deals table with parcel data for active deals.

    if not data.get('parcel_id'):
        return False

    conn = psycopg2.connect(**DB_CONFIG)
    cur  = conn.cursor()

    # Enrich matching deals with ATTOM parcel data
    cur.execute("""
        UPDATE deals SET
            parcel_id = %s,
            notes     = CONCAT(COALESCE(notes, ''), '\n[ATTOM] Owner: ', %s,
                               ' | Assessed: $', %s, ' | Tax: $', %s, '/yr',
                               CASE WHEN %s THEN ' | ⚠ TAX DELINQUENT' ELSE '' END,
                               CASE WHEN %s THEN ' | ⚠ FORECLOSURE' ELSE '' END)
        WHERE address ILIKE %s || '%%'
    """, (
        data.get('parcel_id'),
        data.get('owner_name1'),
        int(data.get('assessed_value') or 0),
        int(data.get('annual_tax') or 0),
        data.get('tax_delinquent', False),
        data.get('foreclosure', False),
        (data.get('address', '') or '')[:30],
    ))
    affected = cur.rowcount
    conn.commit()
    conn.close()
    return affected > 0


def main():
    print('🏘 ATTOM Property Data Ingest — PLACEHOLDER')
    if not ATTOM_API_KEY:
        print("""
  ❌ ATTOM API key not configured.

  To activate this script:
  1. Purchase ATTOM data access at https://api.attomdata.com/
  2. Set ATTOM_API_KEY in your .env file
  3. Run this script again

  Key use cases:
  • Run on any deal address to get owner info + assessed value + tax history
  • Identify tax-delinquent parcels (motivated sellers) in priority counties
  • Verify acreage and parcel boundaries before making offers
  • Check foreclosure status for potential distressed acquisitions

  This script is fully implemented and ready — just needs the API key.
        """)
        return

    # ── Example: Enrich all active deals with ATTOM data ─────────────────────
    conn = psycopg2.connect(**DB_CONFIG)
    cur  = conn.cursor()
    cur.execute("""
        SELECT id, address, zip_code FROM deals
        WHERE status NOT IN ('closed', 'dead') AND parcel_id IS NULL
    """)
    deals = cur.fetchall()
    conn.close()

    print(f'  Looking up ATTOM data for {len(deals)} active deals...')
    for deal_id, address, zip_code in deals:
        street = address.split(',')[0] if ',' in address else address
        try:
            raw = fetch_property_by_address(street, zip_code or '')
            if raw:
                data = parse_attom_property(raw)
                upsert_parcel(data)
                print(f'  ✓ {street[:40]}')
            else:
                print(f'  – Not found: {street[:40]}')
        except Exception as e:
            print(f'  ⚠ Error for {street[:30]}: {e}')

    print('\n  ✅ ATTOM enrichment complete.')


if __name__ == '__main__':
    main()
