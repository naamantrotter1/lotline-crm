const express = require('express');
const router = express.Router();
const { query } = require('../db');

// GET /api/counties — list all counties with market stats for a given period
router.get('/', async (req, res, next) => {
  try {
    const { state, period = '90d', metric } = req.query;

    let sql = `
      SELECT
        c.id, c.fips_code, c.name, c.state,
        c.centroid_lat AS lat, c.centroid_lng AS lng,
        c.population, c.population_growth_pct AS growth_pct,
        c.median_household_income AS median_income,
        c.median_home_value, c.unemployment_rate,
        c.flood_risk_pct, c.mh_friendly_zoning, c.priority_market,
        -- market stats
        ms.active_listings, ms.sold_count,
        ms.median_list_price, ms.median_sale_price,
        ms.median_price_per_acre, ms.median_days_on_market,
        ms.absorption_rate_pct, ms.months_of_supply,
        ms.sell_through_rate_pct, ms.list_to_sale_ratio_pct,
        ms.demand_score, ms.opportunity_score
      FROM counties c
      LEFT JOIN market_stats ms
        ON ms.county_id = c.id
        AND ms.period = $1
        AND ms.acreage_bucket = 'all'
        AND ms.zip_code IS NULL
    `;

    const params = [period];

    if (state && state !== 'Both') {
      sql += ` WHERE c.state = $2`;
      params.push(state);
    }

    sql += ` ORDER BY c.state, c.name`;

    const { rows } = await query(sql, params);
    res.json({ data: rows, count: rows.length });
  } catch (err) {
    next(err);
  }
});

// GET /api/counties/:fips — single county detail
router.get('/:fips', async (req, res, next) => {
  try {
    const { fips } = req.params;

    // County base info
    const { rows: [county] } = await query(`
      SELECT * FROM counties WHERE fips_code = $1
    `, [fips]);

    if (!county) return res.status(404).json({ error: 'County not found' });

    // All periods of market stats
    const { rows: stats } = await query(`
      SELECT * FROM market_stats
      WHERE county_id = $1 AND acreage_bucket = 'all' AND zip_code IS NULL
      ORDER BY period
    `, [county.id]);

    // Active listings
    const { rows: listings } = await query(`
      SELECT id, mls_id, address, zip_code, list_price, acreage,
             bedrooms, bathrooms, sqft, days_on_market, property_type, flood_zone
      FROM listings
      WHERE county_id = $1 AND status = 'Active'
      ORDER BY list_date DESC
      LIMIT 20
    `, [county.id]);

    // Recent sold comps
    const { rows: comps } = await query(`
      SELECT id, address, zip_code, list_price, sale_price, acreage,
             bedrooms, bathrooms, sqft, days_on_market, close_date,
             list_to_sale_ratio, property_type
      FROM sold_comps
      WHERE county_id = $1
      ORDER BY close_date DESC
      LIMIT 20
    `, [county.id]);

    // Pipeline deals in this county
    const { rows: deals } = await query(`
      SELECT id, address, status, acquisition_price, target_sale_price,
             projected_profit, all_in_cost, acreage, assigned_to, contract_date
      FROM deals
      WHERE county_id = $1
      ORDER BY created_at DESC
    `, [county.id]);

    res.json({ county, stats, listings, comps, deals });
  } catch (err) {
    next(err);
  }
});

// GET /api/counties/:fips/trend — 24-month trend data
router.get('/:fips/trend', async (req, res, next) => {
  try {
    const { fips } = req.params;
    const { metric = 'median_sale_price' } = req.query;

    const { rows: [county] } = await query(
      'SELECT id FROM counties WHERE fips_code = $1', [fips]
    );
    if (!county) return res.status(404).json({ error: 'County not found' });

    // Build monthly sold comp buckets for trend
    const { rows } = await query(`
      SELECT
        DATE_TRUNC('month', close_date) AS month,
        COUNT(*) AS sales,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sale_price) AS median_price,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_on_market) AS median_dom,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_per_acre) AS median_ppa,
        AVG(list_to_sale_ratio) AS avg_lts
      FROM sold_comps
      WHERE county_id = $1
        AND close_date >= NOW() - INTERVAL '24 months'
      GROUP BY 1
      ORDER BY 1
    `, [county.id]);

    res.json({ data: rows, metric });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
