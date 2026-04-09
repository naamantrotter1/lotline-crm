const express = require('express');
const router = express.Router();
const { query } = require('../db');

// GET /api/comps — sold comps with full filtering
router.get('/', async (req, res, next) => {
  try {
    const {
      state, county_fips, zip,
      min_price, max_price,
      min_acres, max_acres,
      property_type,
      date_from, date_to,
      max_dom,
      limit = 200, offset = 0,
      sort = 'close_date', order = 'DESC',
    } = req.query;

    const params = [];
    const where = [];

    if (state && state !== 'Both') {
      params.push(state);
      where.push(`c.state = $${params.length}`);
    }
    if (county_fips) {
      params.push(county_fips);
      where.push(`c.fips_code = $${params.length}`);
    }
    if (zip) {
      params.push(zip);
      where.push(`s.zip_code = $${params.length}`);
    }
    if (min_price) {
      params.push(Number(min_price));
      where.push(`s.sale_price >= $${params.length}`);
    }
    if (max_price) {
      params.push(Number(max_price));
      where.push(`s.sale_price <= $${params.length}`);
    }
    if (min_acres) {
      params.push(Number(min_acres));
      where.push(`s.acreage >= $${params.length}`);
    }
    if (max_acres) {
      params.push(Number(max_acres));
      where.push(`s.acreage <= $${params.length}`);
    }
    if (property_type && property_type !== 'All') {
      params.push(property_type);
      where.push(`s.property_type = $${params.length}`);
    }
    if (date_from) {
      params.push(date_from);
      where.push(`s.close_date >= $${params.length}`);
    }
    if (date_to) {
      params.push(date_to);
      where.push(`s.close_date <= $${params.length}`);
    }
    if (max_dom) {
      params.push(Number(max_dom));
      where.push(`s.days_on_market <= $${params.length}`);
    }

    const allowedSorts = ['sale_price','close_date','days_on_market','acreage','price_per_acre','list_to_sale_ratio'];
    const safeSort = allowedSorts.includes(sort) ? `s.${sort}` : 's.close_date';
    const safeOrder = order === 'ASC' ? 'ASC' : 'DESC';

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const sql = `
      SELECT
        s.id, s.mls_id, s.zip_code, s.lat, s.lng, s.address,
        s.list_price, s.sale_price, s.price_per_acre, s.acreage,
        s.bedrooms, s.bathrooms, s.sqft, s.days_on_market,
        s.list_date, s.close_date, s.list_to_sale_ratio,
        s.property_type, s.year_built,
        c.fips_code AS county_fips, c.name AS county_name, c.state
      FROM sold_comps s
      JOIN counties c ON c.id = s.county_id
      ${whereClause}
      ORDER BY ${safeSort} ${safeOrder}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(Math.min(Number(limit), 1000));
    params.push(Number(offset));

    const { rows } = await query(sql, params);

    // count
    const countParams = params.slice(0, -2);
    const { rows: [{ count }] } = await query(
      `SELECT COUNT(*) FROM sold_comps s JOIN counties c ON c.id = s.county_id ${whereClause}`,
      countParams
    );

    res.json({ data: rows, total: parseInt(count) });
  } catch (err) {
    next(err);
  }
});

// GET /api/comps/summary — aggregate summary stats for a filter set
router.get('/summary', async (req, res, next) => {
  try {
    const { county_fips, state, date_from, date_to } = req.query;
    const params = [];
    const where = [];

    if (county_fips) {
      params.push(county_fips);
      where.push(`c.fips_code = $${params.length}`);
    }
    if (state && state !== 'Both') {
      params.push(state);
      where.push(`c.state = $${params.length}`);
    }
    if (date_from) {
      params.push(date_from);
      where.push(`s.close_date >= $${params.length}`);
    }
    if (date_to) {
      params.push(date_to);
      where.push(`s.close_date <= $${params.length}`);
    }

    const { rows: [summary] } = await query(`
      SELECT
        COUNT(*) AS total_sales,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.sale_price) AS median_sale_price,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.list_price) AS median_list_price,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.days_on_market) AS median_dom,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.price_per_acre) AS median_ppa,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.list_to_sale_ratio) AS median_lts,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.acreage) AS median_acreage,
        AVG(s.sale_price) AS avg_sale_price,
        MIN(s.sale_price) AS min_sale_price,
        MAX(s.sale_price) AS max_sale_price
      FROM sold_comps s
      JOIN counties c ON c.id = s.county_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    `, params);

    res.json(summary);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
