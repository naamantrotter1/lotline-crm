const express = require('express');
const router = express.Router();
const { query } = require('../db');

// GET /api/stats/counties — market stats table (all counties, one period)
router.get('/counties', async (req, res, next) => {
  try {
    const { period = '90d', state, sort = 'opportunity_score', order = 'DESC' } = req.query;

    const allowedSorts = ['opportunity_score','demand_score','months_of_supply',
      'absorption_rate_pct','median_sale_price','median_days_on_market',
      'sell_through_rate_pct','active_listings','sold_count'];
    const safeSort = allowedSorts.includes(sort) ? `ms.${sort}` : 'ms.opportunity_score';
    const safeOrder = order === 'ASC' ? 'ASC' : 'DESC';

    const params = [period];
    let stateFilter = '';
    if (state && state !== 'Both') {
      params.push(state);
      stateFilter = `AND c.state = $2`;
    }

    const { rows } = await query(`
      SELECT
        c.fips_code, c.name AS county, c.state,
        c.population, c.population_growth_pct AS growth_pct,
        c.median_household_income AS median_income,
        c.unemployment_rate, c.flood_risk_pct,
        c.mh_friendly_zoning, c.priority_market,
        ms.period,
        ms.active_listings, ms.sold_count,
        ms.median_list_price, ms.median_sale_price,
        ms.median_price_per_acre, ms.median_days_on_market,
        ms.absorption_rate_pct, ms.months_of_supply,
        ms.sell_through_rate_pct, ms.list_to_sale_ratio_pct,
        ms.demand_score, ms.opportunity_score
      FROM counties c
      JOIN market_stats ms ON ms.county_id = c.id
        AND ms.period = $1
        AND ms.acreage_bucket = 'all'
        AND ms.zip_code IS NULL
      WHERE 1=1 ${stateFilter}
      ORDER BY ${safeSort} ${safeOrder} NULLS LAST
    `, params);

    res.json({ data: rows, count: rows.length, period });
  } catch (err) {
    next(err);
  }
});

// GET /api/stats/top-markets — top N counties by opportunity score
router.get('/top-markets', async (req, res, next) => {
  try {
    const { limit = 10, period = '90d', state } = req.query;
    const params = [period, Math.min(Number(limit), 50)];
    let stateFilter = '';
    if (state && state !== 'Both') {
      params.push(state);
      stateFilter = `AND c.state = $${params.length}`;
    }

    const { rows } = await query(`
      SELECT
        c.fips_code, c.name AS county, c.state,
        c.population_growth_pct AS growth_pct,
        c.median_household_income AS median_income,
        c.mh_friendly_zoning, c.priority_market,
        ms.opportunity_score, ms.demand_score,
        ms.months_of_supply, ms.absorption_rate_pct,
        ms.median_sale_price, ms.active_listings
      FROM counties c
      JOIN market_stats ms ON ms.county_id = c.id
        AND ms.period = $1
        AND ms.acreage_bucket = 'all'
        AND ms.zip_code IS NULL
      WHERE ms.opportunity_score IS NOT NULL ${stateFilter}
      ORDER BY ms.opportunity_score DESC NULLS LAST
      LIMIT $2
    `, params);

    res.json({ data: rows, period });
  } catch (err) {
    next(err);
  }
});

// GET /api/stats/overview — high-level numbers for the dashboard header
router.get('/overview', async (req, res, next) => {
  try {
    const { state } = req.query;
    const params = [];
    let stateFilter = '';
    if (state && state !== 'Both') {
      params.push(state);
      stateFilter = `WHERE c.state = $1`;
    }

    const [listingsRes, compsRes, dealsRes] = await Promise.all([
      query(`SELECT COUNT(*) FROM listings l JOIN counties c ON c.id = l.county_id ${stateFilter}`, params),
      query(`SELECT COUNT(*), AVG(sale_price) as avg_price, PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sale_price) as median_price
             FROM sold_comps s JOIN counties c ON c.id = s.county_id
             ${stateFilter} ${stateFilter ? 'AND' : 'WHERE'} s.close_date >= NOW() - INTERVAL '90 days'`,
             params),
      query('SELECT COUNT(*) FROM deals WHERE status NOT IN (\'closed\',\'dead\')'),
    ]);

    res.json({
      active_listings: parseInt(listingsRes.rows[0].count),
      sales_90d:       parseInt(compsRes.rows[0].count),
      median_price_90d: compsRes.rows[0].median_price,
      active_deals:    parseInt(dealsRes.rows[0].count),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
