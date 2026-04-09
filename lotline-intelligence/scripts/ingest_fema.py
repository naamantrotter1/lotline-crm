#!/usr/bin/env python3
"""
FEMA National Flood Hazard Layer (NFHL) ingestion.
Pulls flood zone data for NC and SC counties.

REST API: https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer
Flood zone polygons layer: /28

This script queries the FEMA ArcGIS REST API for zone classifications
by county FIPS and calculates the percentage of county area in flood zones.

Run: python scripts/ingest_fema.py
Schedule: Quarterly
"""

import os, requests, psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'), 'port': int(os.getenv('DB_PORT', 5432)),
    'database': os.getenv('DB_NAME', 'lotline_intelligence'),
    'user': os.getenv('DB_USER', 'lotline'), 'password': os.getenv('DB_PASSWORD', 'lotline_secret'),
}

NFHL_BASE = 'https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer'
FLOOD_ZONE_LAYER  = 28   # Flood Hazard Zone polygons
COUNTY_LAYER      = 75   # NFHL county/study areas

# High-risk flood zones (SFHAs — Special Flood Hazard Areas)
HIGH_RISK_ZONES  = {'A', 'AE', 'AH', 'AO', 'AR', 'A99', 'V', 'VE'}
MODERATE_ZONES   = {'B', 'X (shaded)', 'X500'}
MINIMAL_ZONES    = {'C', 'X', 'D'}

def fetch_flood_data_for_county(fips5: str) -> dict:
    """
    Query FEMA NFHL for flood zone breakdown in a county.
    Returns dict with high/moderate/minimal zone percentages.
    """
    state_fips  = fips5[:2]
    county_fips = fips5[2:]

    # Query flood zones clipped to this county
    url = f'{NFHL_BASE}/{FLOOD_ZONE_LAYER}/query'
    params = {
        'where':       f"DFIRM_ID LIKE '{state_fips}{county_fips}%' OR DFIRM_ID LIKE '{fips5}%'",
        'outFields':   'FLD_ZONE,ZONE_SUBTY,SHAPE_Area',
        'returnGeometry': 'false',
        'f':           'json',
        'resultRecordCount': 2000,
    }

    try:
        resp = requests.get(url, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        features = data.get('features', [])

        total_area = 0
        sfha_area  = 0
        for feat in features:
            attrs = feat.get('attributes', {})
            zone  = str(attrs.get('FLD_ZONE', '') or '').strip().upper()
            area  = float(attrs.get('SHAPE_Area', 0) or 0)
            total_area += area
            if zone in HIGH_RISK_ZONES:
                sfha_area += area

        flood_risk_pct = round(sfha_area / total_area * 100, 1) if total_area > 0 else 0
        return {'fips_code': fips5, 'flood_risk_pct': flood_risk_pct, 'raw_features': len(features)}

    except Exception as e:
        print(f'    ⚠ FEMA query failed for {fips5}: {e}')
        return {'fips_code': fips5, 'flood_risk_pct': None, 'error': str(e)}


def update_flood_data(records: list) -> int:
    conn = psycopg2.connect(**DB_CONFIG)
    try:
        cur = conn.cursor()
        updated = 0
        for r in records:
            if r.get('flood_risk_pct') is None:
                continue
            cur.execute(
                'UPDATE counties SET flood_risk_pct = %s, updated_at = NOW() WHERE fips_code = %s',
                (r['flood_risk_pct'], r['fips_code'])
            )
            updated += cur.rowcount

        cur.execute("""
            INSERT INTO ingestion_log (source, status, records_in, records_out, finished_at)
            VALUES ('fema_nfhl', 'success', %s, %s, NOW())
        """, (len(records), updated))
        conn.commit()
        return updated
    except Exception as e:
        conn.rollback()
        raise
    finally:
        conn.close()


def main():
    print('🌊 FEMA NFHL Flood Zone Ingest')

    # Get all NC/SC FIPS from DB
    conn = psycopg2.connect(**DB_CONFIG)
    cur  = conn.cursor()
    cur.execute("SELECT fips_code, name, state FROM counties WHERE state IN ('NC','SC') ORDER BY fips_code")
    counties = cur.fetchall()
    conn.close()

    print(f'  Processing {len(counties)} counties...')
    records = []
    for fips, name, state in counties:
        print(f'  {state} {name}...', end='', flush=True)
        result = fetch_flood_data_for_county(fips)
        records.append(result)
        pct = result.get('flood_risk_pct')
        print(f' {pct}%' if pct is not None else ' ⚠')

    updated = update_flood_data(records)
    print(f'\n  ✅ Updated {updated} counties with flood zone data.')


if __name__ == '__main__':
    main()
