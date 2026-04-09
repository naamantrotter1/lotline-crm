const express = require('express');
const router = express.Router();
const { query } = require('../db');

// GET /api/listings — paginated, filtered active listings
router.get('/', async (req, res, next) => {
  try {
    const {
      state, county_fips, zip,
      min_price, max_price,
      min_acres, max_acres,
      property_type,
      min_beds, max_dom,
      limit = 100, offset = 0,
      sort = 'list_date', order = 'DESC',
    } = req.query;

    const params = [];
    let where = [`l.status = 'Active'`];

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
      where.push(`l.zip_code = $${params.length}`);
    }
    if (min_price) {
      params.push(Number(min_price));
      where.push(`l.list_price >= $${params.length}`);
    }
    if (max_price) {
      params.push(Number(max_price));
      where.push(`l.list_price <= $${params.length}`);
    }
    if (min_acres) {
      params.push(Number(min_acres));
      where.push(`l.acreage >= $${params.length}`);
    }
    if (max_acres) {
      params.push(Number(max_acres));
      where.push(`l.acreage <= $${params.length}`);
    }
    if (property_type && property_type !== 'All') {
      params.push(property_type);
      where.push(`l.property_type = $${params.length}`);
    }
    if (min_beds) {
      params.push(Number(min_beds));
      where.push(`l.bedrooms >= $${params.length}`);
    }
    if (max_dom) {
      params.push(Number(max_dom));
      where.push(`l.days_on_market <= $${params.length}`);
    }

    const allowedSorts = ['list_price','list_date','days_on_market','acreage','price_per_acre'];
    const safeSort = allowedSorts.includes(sort) ? `l.${sort}` : 'l.list_date';
    const safeOrder = order === 'ASC' ? 'ASC' : 'DESC';

    const sql = `
      SELECT
        l.id, l.mls_id, l.zip_code, l.lat, l.lng, l.address,
        l.list_price, l.price_per_acre, l.acreage, l.bedrooms, l.bathrooms,
        l.sqft, l.days_on_market, l.list_date, l.property_type, l.year_built,
        l.well_septic, l.public_utilities, l.flood_zone,
        c.fips_code AS county_fips, c.name AS county_name, c.state
      FROM listings l
      JOIN counties c ON c.id = l.county_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY ${safeSort} ${safeOrder}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(Math.min(Number(limit), 500));
    params.push(Number(offset));

    const { rows } = await query(sql, params);

    // Count
    const countSql = `
      SELECT COUNT(*) FROM listings l
      JOIN counties c ON c.id = l.county_id
      ${where.length ? 'WHERE ' + where.slice(0, -0).join(' AND ') : ''}
    `;
    // simplified count (re-use same where, minus pagination params)
    const countParams = params.slice(0, -2);
    const { rows: [{ count }] } = await query(
      `SELECT COUNT(*) FROM listings l JOIN counties c ON c.id = l.county_id ${where.length ? 'WHERE ' + where.join(' AND ') : ''}`,
      countParams
    );

    res.json({ data: rows, total: parseInt(count), limit: Number(limit), offset: Number(offset) });
  } catch (err) {
    next(err);
  }
});

// GET /api/listings/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows: [listing] } = await query(`
      SELECT l.*, c.fips_code AS county_fips, c.name AS county_name, c.state
      FROM listings l JOIN counties c ON c.id = l.county_id
      WHERE l.id = $1
    `, [req.params.id]);

    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    res.json(listing);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
