#!/usr/bin/env python3
"""
Census ACS 5-Year Estimates ingestion script.
Pulls county-level demographic data for NC (37) and SC (45).

Endpoint: https://api.census.gov/data/2022/acs/acs5
Free API key: https://api.census.gov/data/key_signup.html

Run: python scripts/ingest_census.py
Schedule: Monthly
"""

import os, sys, requests, psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONFIG = {
    'host':     os.getenv('DB_HOST', 'localhost'),
    'port':     int(os.getenv('DB_PORT', 5432)),
    'database': os.getenv('DB_NAME', 'lotline_intelligence'),
    'user':     os.getenv('DB_USER', 'lotline'),
    'password': os.getenv('DB_PASSWORD', 'lotline_secret'),
}

CENSUS_API_KEY = os.getenv('CENSUS_API_KEY', '')

# ─── ACS Variables ────────────────────────────────────────────────────────────
# B01003_001E = Total population
# B19013_001E = Median household income
# B25077_001E = Median home value
# B25002_002E = Occupied housing units
# B25003_003E = Renter-occupied
# B25003_002E = Owner-occupied
ACS_VARS = ','.join([
    'NAME',
    'B01003_001E',   # population
    'B19013_001E',   # median HHI
    'B25077_001E',   # median home value
    'B25002_001E',   # total housing units
    'B25003_002E',   # owner occupied
    'B25003_003E',   # renter occupied
])

ACS_BASE = 'https://api.census.gov/data/2022/acs/acs5'

NC_FIPS = '37'
SC_FIPS = '45'


def fetch_acs_for_state(state_fips: str) -> list:
    """Fetch ACS county data for one state."""
    params = {
        'get':  ACS_VARS,
        'for':  'county:*',
        'in':   f'state:{state_fips}',
    }
    if CENSUS_API_KEY:
        params['key'] = CENSUS_API_KEY

    resp = requests.get(ACS_BASE, params=params, timeout=30)
    resp.raise_for_status()
    data = resp.json()

    # First row is headers
    headers = data[0]
    rows = data[1:]

    results = []
    for row in rows:
        r = dict(zip(headers, row))
        fips = r['state'] + r['county']
        results.append({
            'fips_code':               fips,
            'population':              _int(r.get('B01003_001E')),
            'median_household_income': _num(r.get('B19013_001E')),
            'median_home_value':       _num(r.get('B25077_001E')),
            'housing_units':           _int(r.get('B25002_001E')),
            'owner_occupied':          _int(r.get('B25003_002E')),
            'renter_occupied':         _int(r.get('B25003_003E')),
        })

    return results


def _int(v):
    try:
        n = int(v)
        return n if n >= 0 else None
    except (TypeError, ValueError):
        return None


def _num(v):
    try:
        n = float(v)
        return n if n >= 0 else None
    except (TypeError, ValueError):
        return None


def compute_growth(cur, fips: str, new_pop: int) -> float | None:
    """Pull previous population from DB and compute % change."""
    cur.execute('SELECT population FROM counties WHERE fips_code = %s', (fips,))
    row = cur.fetchone()
    if not row or not row[0] or not new_pop:
        return None
    old_pop = row[0]
    return round((new_pop - old_pop) / old_pop * 100, 2)


def upsert_counties(records: list) -> int:
    conn = psycopg2.connect(**DB_CONFIG)
    try:
        cur = conn.cursor()
        updated = 0
        for r in records:
            hou  = r['housing_units'] or 0
            own  = r['owner_occupied'] or 0
            rent = r['renter_occupied'] or 0
            owner_pct  = round(own  / hou * 100, 1) if hou else None
            renter_pct = round(rent / hou * 100, 1) if hou else None

            growth = compute_growth(cur, r['fips_code'], r['population'])

            cur.execute("""
                UPDATE counties SET
                    population              = %s,
                    population_growth_pct   = COALESCE(%s, population_growth_pct),
                    median_household_income = %s,
                    median_home_value       = %s,
                    housing_units           = %s,
                    owner_pct               = %s,
                    renter_pct              = %s,
                    updated_at              = NOW()
                WHERE fips_code = %s
            """, (
                r['population'], growth,
                r['median_household_income'],
                r['median_home_value'],
                r['housing_units'],
                owner_pct, renter_pct,
                r['fips_code'],
            ))
            updated += cur.rowcount

        # Log ingestion
        cur.execute("""
            INSERT INTO ingestion_log (source, status, records_in, records_out, finished_at)
            VALUES ('census_acs', 'success', %s, %s, NOW())
        """, (len(records), updated))

        conn.commit()
        return updated
    except Exception as e:
        conn.rollback()
        cur.execute("""
            INSERT INTO ingestion_log (source, status, error_msg, finished_at)
            VALUES ('census_acs', 'error', %s, NOW())
        """, (str(e),))
        conn.commit()
        raise
    finally:
        conn.close()


def main():
    print('📊 Census ACS Ingest — NC + SC Counties')
    if not CENSUS_API_KEY:
        print('  ⚠ No CENSUS_API_KEY set. Using keyless endpoint (rate limited).')

    all_records = []
    for state, name in [(NC_FIPS, 'NC'), (SC_FIPS, 'SC')]:
        print(f'  Fetching {name}...')
        records = fetch_acs_for_state(state)
        print(f'    → {len(records)} counties')
        all_records.extend(records)

    print(f'\n  Total: {len(all_records)} counties. Upserting...')
    updated = upsert_counties(all_records)
    print(f'  ✅ Updated {updated} county rows.')


if __name__ == '__main__':
    main()
