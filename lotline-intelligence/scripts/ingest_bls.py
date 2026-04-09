#!/usr/bin/env python3
"""
Bureau of Labor Statistics — County Unemployment Rate ingestion.
Pulls Local Area Unemployment Statistics (LAUS) for all NC/SC counties.

API: https://api.bls.gov/publicAPI/v2/timeseries/data/
Register for free key: https://data.bls.gov/registrationEngine/

Series ID format: LAUCN{FIPS5}{season_code}
  - Unemployment rate: season_code = 04
  e.g., LAUCN370610000000004 = Duplin County NC unemployment rate (unadjusted)

Run: python scripts/ingest_bls.py
Schedule: Monthly
"""

import os, requests, psycopg2, json
from dotenv import load_dotenv

load_dotenv()

DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'), 'port': int(os.getenv('DB_PORT', 5432)),
    'database': os.getenv('DB_NAME', 'lotline_intelligence'),
    'user': os.getenv('DB_USER', 'lotline'), 'password': os.getenv('DB_PASSWORD', 'lotline_secret'),
}
BLS_API_KEY = os.getenv('BLS_API_KEY', '')
BLS_BASE    = 'https://api.bls.gov/publicAPI/v2/timeseries/data/'
BATCH_SIZE  = 50   # BLS allows up to 50 series per request (with key)

# Unemployment rate = measure code 03, but LAUS uses:
#   03 = Unemployment rate
#   The FIPS pads to 15 digits with zeros: LAUCN{5-digit-FIPS}{zeros}
# LAUCN + county FIPS (5 digit) + 0000000 + 03 (unemployment rate)

def make_series_id(fips5: str) -> str:
    """LAUS county unemployment rate series."""
    return f'LAUCN{fips5}0000000003'


def fetch_all_fips() -> list[dict]:
    """Pull all NC/SC county FIPS codes from DB."""
    conn = psycopg2.connect(**DB_CONFIG)
    cur  = conn.cursor()
    cur.execute("SELECT fips_code FROM counties WHERE state IN ('NC','SC') ORDER BY fips_code")
    rows = cur.fetchall()
    conn.close()
    return [r[0] for r in rows]


def fetch_bls_batch(series_ids: list[str]) -> dict:
    """Fetch a batch of BLS series. Returns {series_id: latest_value}."""
    payload = {
        'seriesid':  series_ids,
        'startyear': '2023',
        'endyear':   '2024',
    }
    if BLS_API_KEY:
        payload['registrationkey'] = BLS_API_KEY

    resp = requests.post(BLS_BASE, json=payload, timeout=30)
    resp.raise_for_status()
    data = resp.json()

    if data.get('status') != 'REQUEST_SUCCEEDED':
        raise ValueError(f"BLS error: {data.get('message')}")

    results = {}
    for series in data.get('Results', {}).get('series', []):
        sid  = series['seriesID']
        vals = series.get('data', [])
        if vals:
            # Take the most recent annual or period value
            latest = sorted(vals, key=lambda x: (x['year'], x['period']), reverse=True)[0]
            try:
                results[sid] = float(latest['value'])
            except (ValueError, KeyError):
                pass
    return results


def update_unemployment(fips_to_rate: dict) -> int:
    conn = psycopg2.connect(**DB_CONFIG)
    try:
        cur = conn.cursor()
        updated = 0
        for fips, rate in fips_to_rate.items():
            cur.execute(
                'UPDATE counties SET unemployment_rate = %s, updated_at = NOW() WHERE fips_code = %s',
                (rate, fips)
            )
            updated += cur.rowcount

        cur.execute("""
            INSERT INTO ingestion_log (source, status, records_in, records_out, finished_at)
            VALUES ('bls_laus', 'success', %s, %s, NOW())
        """, (len(fips_to_rate), updated))
        conn.commit()
        return updated
    except Exception as e:
        conn.rollback()
        raise
    finally:
        conn.close()


def main():
    print('📈 BLS LAUS Unemployment Ingest')
    if not BLS_API_KEY:
        print('  ⚠ No BLS_API_KEY. Rate limits apply (25 series/request, no key).')

    all_fips = fetch_all_fips()
    print(f'  Found {len(all_fips)} counties in DB')

    # Build series IDs and batch them
    series_map = {make_series_id(f): f for f in all_fips}
    batches    = [list(series_map.keys())[i:i+BATCH_SIZE] for i in range(0, len(series_map), BATCH_SIZE)]

    fips_to_rate = {}
    for i, batch in enumerate(batches):
        print(f'  Batch {i+1}/{len(batches)}...')
        try:
            results = fetch_bls_batch(batch)
            for sid, rate in results.items():
                fips = series_map.get(sid)
                if fips:
                    fips_to_rate[fips] = rate
        except Exception as e:
            print(f'    ⚠ Batch failed: {e}')
            continue

    print(f'  Got rates for {len(fips_to_rate)} counties. Updating DB...')
    updated = update_unemployment(fips_to_rate)
    print(f'  ✅ Updated {updated} county rows.')


if __name__ == '__main__':
    main()
