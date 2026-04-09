#!/usr/bin/env python3
"""
PLACEHOLDER: MLS Data Ingestion via Trestle (CoreLogic)
========================================================
This script is ready to activate once you purchase a Trestle MLS feed.

How to purchase:
  1. Go to https://trestle.corelogic.com/
  2. Apply for access to NCRMLS and/or Canopy MLS (Charlotte/SC)
  3. Get credentials: TRESTLE_CLIENT_ID and TRESTLE_CLIENT_SECRET
  4. Set in your .env file and uncomment the code below

What this will pull:
  - Active MH listings (property_type = ManufacturedHome/MobileHome)
  - Sold comps (status = Closed, past 24 months)
  - Fields: price, DOM, acreage, beds, baths, sqft, flood zone, utilities

Cost: Typically $200–500/month for regional MLS coverage.
      Ask about REALTORS® Property Resource (RPR) for bulk access.

RESO Web API standard is used (OData format).
"""

import os
import requests
import psycopg2
from dotenv import load_dotenv

load_dotenv()

# ─── Configuration ────────────────────────────────────────────────────────────
TRESTLE_CLIENT_ID     = os.getenv('TRESTLE_CLIENT_ID', '')
TRESTLE_CLIENT_SECRET = os.getenv('TRESTLE_CLIENT_SECRET', '')
TRESTLE_BASE_URL      = os.getenv('TRESTLE_BASE_URL', 'https://api.listhub.com/reso/odata')

DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'), 'port': int(os.getenv('DB_PORT', 5432)),
    'database': os.getenv('DB_NAME', 'lotline_intelligence'),
    'user': os.getenv('DB_USER', 'lotline'), 'password': os.getenv('DB_PASSWORD', 'lotline_secret'),
}

# ─── MH property type codes (varies by MLS) ───────────────────────────────────
MH_PROPERTY_TYPES = [
    'ManufacturedHome',
    'ManufacturedHomeOnLand',
    'MobileHome',
    'MobileHomeOnLand',
    'Modular',
]

# NC/SC MLS boards to query
TARGET_STATES = ['NC', 'SC']

# ─── RESO field mapping → our DB schema ──────────────────────────────────────
FIELD_MAP = {
    'ListingKey':       'mls_id',
    'ListPrice':        'list_price',
    'ClosePrice':       'sale_price',
    'LotSizeAcres':     'acreage',
    'BedroomsTotal':    'bedrooms',
    'BathroomsTotalDecimal': 'bathrooms',
    'LivingArea':       'sqft',
    'DaysOnMarket':     'days_on_market',
    'ListingContractDate': 'list_date',
    'CloseDate':        'close_date',
    'StandardStatus':   'status',
    'PropertySubType':  'property_type',
    'YearBuilt':        'year_built',
    'Latitude':         'lat',
    'Longitude':        'lng',
    'UnparsedAddress':  'address',
    'PostalCode':       'zip_code',
    'CountyOrParish':   'county_name',
    'StateOrProvince':  'state',
    'FloodZoneCode':    'flood_zone',
    'WaterSource':      'public_utilities',  # parse to boolean
    'Sewer':            'well_septic',       # parse to boolean
}


def get_access_token() -> str:
    """OAuth2 client credentials flow for Trestle."""
    resp = requests.post(
        'https://api.trestle.io/connect/token',
        data={
            'grant_type':    'client_credentials',
            'client_id':     TRESTLE_CLIENT_ID,
            'client_secret': TRESTLE_CLIENT_SECRET,
            'scope':         'api',
        }
    )
    resp.raise_for_status()
    return resp.json()['access_token']


def fetch_active_listings(token: str, page_size: int = 200) -> list:
    """
    Fetch active MH listings in NC and SC via RESO Web API.
    Uses OData $filter to narrow to manufactured homes.
    """
    type_filter = ' or '.join(f"PropertySubType eq '{t}'" for t in MH_PROPERTY_TYPES)
    state_filter = ' or '.join(f"StateOrProvince eq '{s}'" for s in TARGET_STATES)

    odata_filter = (
        f"StandardStatus eq 'Active' "
        f"and ({state_filter}) "
        f"and ({type_filter})"
    )

    headers  = {'Authorization': f'Bearer {token}', 'Accept': 'application/json'}
    results  = []
    url      = f'{TRESTLE_BASE_URL}/Property'
    params   = {
        '$filter':   odata_filter,
        '$select':   ','.join(FIELD_MAP.keys()),
        '$top':      page_size,
        '$skip':     0,
        '$orderby':  'ListingContractDate desc',
    }

    while url:
        resp = requests.get(url, headers=headers, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        results.extend(data.get('value', []))
        # RESO pagination
        url = data.get('@odata.nextLink')
        params = {}  # next link includes all params

    return results


def fetch_sold_comps(token: str, days_back: int = 730) -> list:
    """Fetch sold MH comps from the past N days."""
    from datetime import datetime, timedelta
    cutoff = (datetime.now() - timedelta(days=days_back)).strftime('%Y-%m-%d')

    type_filter  = ' or '.join(f"PropertySubType eq '{t}'" for t in MH_PROPERTY_TYPES)
    state_filter = ' or '.join(f"StateOrProvince eq '{s}'" for s in TARGET_STATES)

    odata_filter = (
        f"StandardStatus eq 'Closed' "
        f"and CloseDate ge {cutoff} "
        f"and ({state_filter}) "
        f"and ({type_filter})"
    )

    headers = {'Authorization': f'Bearer {token}', 'Accept': 'application/json'}
    results = []
    url     = f'{TRESTLE_BASE_URL}/Property'
    params  = {
        '$filter': odata_filter,
        '$select': ','.join(FIELD_MAP.keys()),
        '$top': 200, '$skip': 0,
        '$orderby': 'CloseDate desc',
    }

    while url:
        resp = requests.get(url, headers=headers, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        results.extend(data.get('value', []))
        url    = data.get('@odata.nextLink')
        params = {}

    return results


def map_listing(raw: dict, county_lookup: dict) -> dict:
    """Map RESO fields to our DB schema."""
    mapped = {our_key: raw.get(reso_key) for reso_key, our_key in FIELD_MAP.items()}

    # County ID lookup
    county_name = mapped.get('county_name', '')
    state       = mapped.get('state', '')
    mapped['county_id'] = county_lookup.get(f'{county_name}|{state}')

    # Boolean coercions
    water = str(raw.get('WaterSource', '') or '').lower()
    mapped['public_utilities'] = 'public' in water or 'city' in water or 'municipal' in water

    sewer = str(raw.get('Sewer', '') or '').lower()
    mapped['well_septic'] = 'septic' in sewer or 'well' in sewer or 'private' in sewer

    # List-to-sale ratio
    lp = mapped.get('list_price')
    sp = mapped.get('sale_price')
    if lp and sp and float(lp) > 0:
        mapped['list_to_sale_ratio'] = round(float(sp) / float(lp) * 100, 2)

    # Price per acre
    price = float(sp or lp or 0)
    acres = float(mapped.get('acreage') or 0)
    if price > 0 and acres > 0:
        mapped['price_per_acre'] = round(price / acres, 0)

    mapped['source'] = 'mls'
    return mapped


def upsert_listings(records: list, is_comps: bool = False) -> int:
    """Upsert records into listings or sold_comps table."""
    conn = psycopg2.connect(**DB_CONFIG)
    cur  = conn.cursor()
    table = 'sold_comps' if is_comps else 'listings'
    upserted = 0

    for r in records:
        if not r.get('mls_id') or not r.get('county_id'):
            continue
        try:
            if is_comps:
                cur.execute("""
                    INSERT INTO sold_comps
                      (mls_id, county_id, zip_code, lat, lng, address,
                       list_price, sale_price, price_per_acre, acreage,
                       bedrooms, bathrooms, sqft, days_on_market,
                       list_date, close_date, list_to_sale_ratio,
                       property_type, year_built, flood_zone, source)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT (mls_id) DO UPDATE SET
                      sale_price = EXCLUDED.sale_price,
                      days_on_market = EXCLUDED.days_on_market,
                      close_date = EXCLUDED.close_date,
                      updated_at = NOW()
                """, (
                    r.get('mls_id'), r.get('county_id'), r.get('zip_code'),
                    r.get('lat'), r.get('lng'), r.get('address'),
                    r.get('list_price'), r.get('sale_price'), r.get('price_per_acre'),
                    r.get('acreage'), r.get('bedrooms'), r.get('bathrooms'),
                    r.get('sqft'), r.get('days_on_market'), r.get('list_date'),
                    r.get('close_date'), r.get('list_to_sale_ratio'),
                    r.get('property_type'), r.get('year_built'),
                    r.get('flood_zone'), r.get('source'),
                ))
            else:
                cur.execute("""
                    INSERT INTO listings
                      (mls_id, county_id, zip_code, lat, lng, address,
                       list_price, price_per_acre, acreage, bedrooms, bathrooms, sqft,
                       days_on_market, list_date, status, property_type, year_built,
                       well_septic, public_utilities, flood_zone, source)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT (mls_id) DO UPDATE SET
                      list_price = EXCLUDED.list_price,
                      days_on_market = EXCLUDED.days_on_market,
                      status = EXCLUDED.status,
                      updated_at = NOW()
                """, (
                    r.get('mls_id'), r.get('county_id'), r.get('zip_code'),
                    r.get('lat'), r.get('lng'), r.get('address'),
                    r.get('list_price'), r.get('price_per_acre'), r.get('acreage'),
                    r.get('bedrooms'), r.get('bathrooms'), r.get('sqft'),
                    r.get('days_on_market'), r.get('list_date'), r.get('status'),
                    r.get('property_type'), r.get('year_built'),
                    r.get('well_septic'), r.get('public_utilities'),
                    r.get('flood_zone'), r.get('source'),
                ))
            upserted += 1
        except Exception as e:
            print(f'    ⚠ Upsert failed for {r.get("mls_id")}: {e}')
            continue

    conn.commit()
    conn.close()
    return upserted


def main():
    print('🏠 MLS Ingest via Trestle — PLACEHOLDER')
    if not TRESTLE_CLIENT_ID or not TRESTLE_CLIENT_SECRET:
        print("""
  ❌ Trestle credentials not configured.

  To activate this script:
  1. Purchase MLS access at https://trestle.corelogic.com/
  2. Set TRESTLE_CLIENT_ID and TRESTLE_CLIENT_SECRET in your .env file
  3. Run this script again

  This script is fully implemented and ready to go — it just needs credentials.
        """)
        return

    print('  Getting access token...')
    token = get_access_token()

    # Build county name→id lookup
    conn = psycopg2.connect(**DB_CONFIG)
    cur  = conn.cursor()
    cur.execute("SELECT id, name, state FROM counties")
    county_lookup = {f'{name}|{state}': cid for cid, name, state in cur.fetchall()}
    conn.close()

    print('  Fetching active listings...')
    raw_listings = fetch_active_listings(token)
    listings = [map_listing(r, county_lookup) for r in raw_listings]
    n = upsert_listings(listings, is_comps=False)
    print(f'  ✓ {n} active listings upserted')

    print('  Fetching sold comps (24 months)...')
    raw_comps = fetch_sold_comps(token, days_back=730)
    comps = [map_listing(r, county_lookup) for r in raw_comps]
    n = upsert_listings(comps, is_comps=True)
    print(f'  ✓ {n} sold comps upserted')

    print('  Running metrics recalculation...')
    import subprocess
    subprocess.run(['python', 'scripts/calculate_metrics.py'], check=True)

    print('\n  ✅ MLS ingest complete.')


if __name__ == '__main__':
    main()
