const express = require('express');
const router = express.Router();
const { query } = require('../db');

// GET /api/reports/county/:fips — county market summary report data
router.get('/county/:fips', async (req, res, next) => {
  try {
    const { fips } = req.params;
    const { period = '90d' } = req.query;

    const { rows: [county] } = await query('SELECT * FROM counties WHERE fips_code = $1', [fips]);
    if (!county) return res.status(404).json({ error: 'County not found' });

    // All periods stats
    const { rows: allStats } = await query(`
      SELECT * FROM market_stats
      WHERE county_id = $1 AND acreage_bucket = 'all' AND zip_code IS NULL
      ORDER BY CASE period
        WHEN '30d'  THEN 1 WHEN '90d' THEN 2 WHEN '6mo' THEN 3
        WHEN '1yr'  THEN 4 WHEN '2yr' THEN 5 END
    `, [county.id]);

    // 24-month trend
    const { rows: trend } = await query(`
      SELECT
        DATE_TRUNC('month', close_date)::date AS month,
        COUNT(*) AS sales,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sale_price) AS median_price,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_on_market) AS median_dom,
        AVG(list_to_sale_ratio) AS avg_lts
      FROM sold_comps
      WHERE county_id = $1
        AND close_date >= NOW() - INTERVAL '24 months'
      GROUP BY 1 ORDER BY 1
    `, [county.id]);

    // Top competing counties (similar opportunity score)
    const targetStats = allStats.find(s => s.period === period);
    const { rows: nearby } = await query(`
      SELECT c.fips_code, c.name, c.state,
             ms.opportunity_score, ms.months_of_supply, ms.median_sale_price
      FROM counties c
      JOIN market_stats ms ON ms.county_id = c.id
        AND ms.period = $1 AND ms.acreage_bucket = 'all' AND ms.zip_code IS NULL
      WHERE c.state = $2 AND c.fips_code != $3
      ORDER BY ms.opportunity_score DESC
      LIMIT 5
    `, [period, county.state, fips]);

    res.json({
      county,
      stats: allStats,
      current_stats: targetStats,
      trend,
      comparable_markets: nearby,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/best-markets — ranking of all counties
router.get('/best-markets', async (req, res, next) => {
  try {
    const { state, period = '90d' } = req.query;
    const params = [period];
    let stateFilter = '';
    if (state && state !== 'Both') {
      params.push(state);
      stateFilter = `AND c.state = $${params.length}`;
    }

    const { rows } = await query(`
      SELECT
        ROW_NUMBER() OVER (ORDER BY ms.opportunity_score DESC NULLS LAST) AS rank,
        c.fips_code, c.name AS county, c.state,
        c.population, c.population_growth_pct AS growth_pct,
        c.median_household_income AS median_income,
        c.unemployment_rate, c.mh_friendly_zoning, c.priority_market,
        ms.opportunity_score, ms.demand_score,
        ms.months_of_supply, ms.absorption_rate_pct,
        ms.median_sale_price, ms.median_days_on_market,
        ms.sell_through_rate_pct, ms.active_listings, ms.sold_count
      FROM counties c
      JOIN market_stats ms ON ms.county_id = c.id
        AND ms.period = $1
        AND ms.acreage_bucket = 'all'
        AND ms.zip_code IS NULL
      WHERE ms.opportunity_score IS NOT NULL ${stateFilter}
      ORDER BY ms.opportunity_score DESC NULLS LAST
    `, params);

    res.json({ data: rows, count: rows.length, period });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
