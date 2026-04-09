#!/usr/bin/env python3
"""
Market statistics calculation engine.
Recalculates all market_stats rows for every county × period × acreage bucket.
Run after any data ingestion to keep stats fresh.

Run: python scripts/calculate_metrics.py
"""

import os, psycopg2, statistics
from datetime import date, timedelta
from dotenv import load_dotenv

load_dotenv()

DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'), 'port': int(os.getenv('DB_PORT', 5432)),
    'database': os.getenv('DB_NAME', 'lotline_intelligence'),
    'user': os.getenv('DB_USER', 'lotline'), 'password': os.getenv('DB_PASSWORD', 'lotline_secret'),
}

PERIODS = {
    '30d':  30,
    '90d':  90,
    '6mo':  182,
    '1yr':  365,
    '2yr':  730,
}

def median(lst):
    return statistics.median(lst) if lst else None

def mean(lst):
    return statistics.mean(lst) if lst else None


def calc_demand_score(absorption_rate, pop_growth, unemployment, months_supply, sell_through):
    """Composite demand score 0-100."""
    scores = {
        'abs':    min(absorption_rate / 30, 1) * 100,
        'growth': min(max((pop_growth + 2) / 8, 0), 1) * 100,
        'unemp':  min(max((10 - unemployment) / 8, 0), 1) * 100,
        'supply': min(max((12 - months_supply) / 10, 0), 1) * 100,
        'sell':   min(sell_through / 100, 1) * 100,
    }
    weights = {'abs': 0.30, 'growth': 0.20, 'unemp': 0.15, 'supply': 0.20, 'sell': 0.15}
    return round(sum(scores[k] * weights[k] for k in scores), 1)


def calc_opportunity_score(months_supply, pop_growth, median_income, absorption_rate, mh_friendly):
    """LotLine opportunity score 0-100."""
    exit_score   = min(max((10 - months_supply) / 8, 0), 1) * 100
    income_score = min(max((median_income - 30000) / 40000, 0), 1) * 100
    growth_score = min(max((pop_growth + 1) / 7, 0), 1) * 100
    abs_score    = min(absorption_rate / 25, 1) * 100
    zone_score   = 100 if mh_friendly else 20
    return round(
        exit_score * 0.30 + income_score * 0.20 +
        growth_score * 0.20 + abs_score * 0.20 + zone_score * 0.10, 1
    )


def main():
    print('📐 Market Stats Recalculation')
    conn = psycopg2.connect(**DB_CONFIG)
    cur  = conn.cursor()

    # Get all counties
    cur.execute("""
        SELECT id, fips_code, population_growth_pct, median_household_income,
               unemployment_rate, mh_friendly_zoning
        FROM counties WHERE state IN ('NC', 'SC')
    """)
    counties = cur.fetchall()
    print(f'  Processing {len(counties)} counties × {len(PERIODS)} periods...')

    total_rows = 0
    today = date.today()

    for cid, fips, pop_growth, median_income, unemployment, mh_friendly in counties:
        for period_key, days in PERIODS.items():
            cutoff = today - timedelta(days=days)

            # ── Sold comps in period ─────────────────────────────────────────
            cur.execute("""
                SELECT sale_price, list_price, price_per_acre, acreage,
                       days_on_market, list_to_sale_ratio
                FROM sold_comps
                WHERE county_id = %s AND close_date >= %s
            """, (cid, cutoff))
            comps = cur.fetchall()

            # ── Active listings ──────────────────────────────────────────────
            cur.execute("""
                SELECT list_price, price_per_acre, acreage FROM listings
                WHERE county_id = %s AND status = 'Active'
            """, (cid,))
            listings = cur.fetchall()

            active_count = len(listings)
            sold_count   = len(comps)
            months_in    = days / 30
            sold_per_mo  = sold_count / months_in if months_in > 0 else 0
            months_supply= round(active_count / sold_per_mo, 2) if sold_per_mo > 0 else 99

            total_avail   = sold_count + active_count
            absorption    = round(sold_count / total_avail * 100, 2) if total_avail > 0 else 0

            # Approximate expired as DOM > 180
            cur.execute("""
                SELECT COUNT(*) FROM listings WHERE county_id = %s AND days_on_market > 180
            """, (cid,))
            expired = cur.fetchone()[0]
            sell_through = round(sold_count / (sold_count + expired) * 100, 2) if (sold_count + expired) > 0 else 0

            sale_prices = [c[0] for c in comps if c[0]]
            list_prices = [c[1] for c in comps if c[1]]
            ppas        = [c[2] for c in comps if c[2]]
            acreages    = [c[3] for c in comps if c[3]]
            doms        = [c[4] for c in comps if c[4]]
            lts_ratios  = [c[5] for c in comps if c[5]]

            demand_score = calc_demand_score(
                absorption, pop_growth or 0, unemployment or 5, months_supply, sell_through
            )
            opp_score = calc_opportunity_score(
                months_supply, pop_growth or 0, median_income or 40000, absorption, mh_friendly or False
            )

            cur.execute("""
                INSERT INTO market_stats (
                    county_id, period, acreage_bucket,
                    active_listings, sold_count,
                    median_list_price, median_sale_price, median_price_per_acre,
                    avg_list_price, avg_sale_price,
                    median_days_on_market, avg_days_on_market,
                    absorption_rate_pct, months_of_supply, sell_through_rate_pct,
                    list_to_sale_ratio_pct, avg_acreage,
                    demand_score, opportunity_score
                ) VALUES (
                    %s, %s, 'all', %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                ON CONFLICT (county_id, zip_code, period, acreage_bucket)
                DO UPDATE SET
                    active_listings = EXCLUDED.active_listings,
                    sold_count = EXCLUDED.sold_count,
                    median_list_price = EXCLUDED.median_list_price,
                    median_sale_price = EXCLUDED.median_sale_price,
                    median_price_per_acre = EXCLUDED.median_price_per_acre,
                    avg_list_price = EXCLUDED.avg_list_price,
                    avg_sale_price = EXCLUDED.avg_sale_price,
                    median_days_on_market = EXCLUDED.median_days_on_market,
                    avg_days_on_market = EXCLUDED.avg_days_on_market,
                    absorption_rate_pct = EXCLUDED.absorption_rate_pct,
                    months_of_supply = EXCLUDED.months_of_supply,
                    sell_through_rate_pct = EXCLUDED.sell_through_rate_pct,
                    list_to_sale_ratio_pct = EXCLUDED.list_to_sale_ratio_pct,
                    avg_acreage = EXCLUDED.avg_acreage,
                    demand_score = EXCLUDED.demand_score,
                    opportunity_score = EXCLUDED.opportunity_score,
                    calculated_at = NOW()
            """, (
                cid, period_key,
                active_count, sold_count,
                median(list_prices), median(sale_prices), median(ppas),
                round(mean(list_prices) or 0), round(mean(sale_prices) or 0),
                round(median(doms) or 0, 1), round(mean(doms) or 0, 1),
                absorption, months_supply, sell_through,
                round(median(lts_ratios) or 0, 2),
                round(mean(acreages) or 0, 2),
                demand_score, opp_score,
            ))
            total_rows += 1

    conn.commit()
    cur.execute("""
        INSERT INTO ingestion_log (source, status, records_out, finished_at)
        VALUES ('calculate_metrics', 'success', %s, NOW())
    """, (total_rows,))
    conn.commit()
    conn.close()
    print(f'  ✅ Calculated {total_rows} stat rows.')


if __name__ == '__main__':
    main()
