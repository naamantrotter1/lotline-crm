const express = require('express');
const router = express.Router();
const { query } = require('../db');

// GET /api/deals — all pipeline deals
router.get('/', async (req, res, next) => {
  try {
    const { status, county_fips, state } = req.query;
    const params = [];
    const where = [];

    if (status) {
      params.push(status);
      where.push(`d.status = $${params.length}`);
    }
    if (county_fips) {
      params.push(county_fips);
      where.push(`c.fips_code = $${params.length}`);
    }
    if (state && state !== 'Both') {
      params.push(state);
      where.push(`c.state = $${params.length}`);
    }

    const { rows } = await query(`
      SELECT
        d.*,
        c.fips_code AS county_fips, c.name AS county_name, c.state
      FROM deals d
      JOIN counties c ON c.id = d.county_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY d.created_at DESC
    `, params);

    // Summary stats
    const active = rows.filter(r => !['closed','dead'].includes(r.status));
    const closed = rows.filter(r => r.status === 'closed');

    const summary = {
      total_active: active.length,
      total_invested: active.reduce((s, r) => s + Number(r.all_in_cost || 0), 0),
      projected_profit: active.reduce((s, r) => s + Number(r.projected_profit || 0), 0),
      avg_projected_roi: active.length
        ? active.reduce((s, r) => s + Number(r.projected_roi_pct || 0), 0) / active.length
        : 0,
      closed_deals: closed.length,
      total_actual_profit: closed.reduce((s, r) => s + Number(r.actual_profit || 0), 0),
    };

    res.json({ data: rows, summary });
  } catch (err) {
    next(err);
  }
});

// GET /api/deals/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows: [deal] } = await query(`
      SELECT d.*, c.fips_code, c.name AS county_name, c.state,
             c.median_household_income, c.median_home_value
      FROM deals d JOIN counties c ON c.id = d.county_id
      WHERE d.id = $1
    `, [req.params.id]);

    if (!deal) return res.status(404).json({ error: 'Deal not found' });

    // Get county market stats for context
    const { rows: [stats] } = await query(`
      SELECT ms.* FROM market_stats ms
      WHERE ms.county_id = $1 AND ms.period = '90d' AND ms.acreage_bucket = 'all'
    `, [deal.county_id]);

    res.json({ deal, market_context: stats });
  } catch (err) {
    next(err);
  }
});

// POST /api/deals — create new deal
router.post('/', async (req, res, next) => {
  try {
    const {
      county_fips, zip_code, lat, lng, address, acreage,
      acquisition_price, home_cost, closing_costs, carrying_costs, install_costs,
      target_sale_price, home_model, sqft, bedrooms, bathrooms,
      status = 'prospecting', notes, assigned_to,
    } = req.body;

    const { rows: [county] } = await query(
      'SELECT id FROM counties WHERE fips_code = $1', [county_fips]
    );
    if (!county) return res.status(400).json({ error: 'Invalid county FIPS' });

    const allIn = (acquisition_price || 0) + (home_cost || 0) +
      (closing_costs || 0) + (carrying_costs || 0) + (install_costs || 0);
    const projProfit = (target_sale_price || 0) - allIn;
    const projROI = allIn > 0 ? (projProfit / allIn) * 100 : 0;

    const { rows: [deal] } = await query(`
      INSERT INTO deals
        (county_id, zip_code, lat, lng, address, acreage,
         acquisition_price, home_cost, closing_costs, carrying_costs, install_costs,
         all_in_cost, target_sale_price, projected_profit, projected_roi_pct,
         home_model, sqft, bedrooms, bathrooms, status, notes, assigned_to)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
      RETURNING *
    `, [county.id, zip_code, lat, lng, address, acreage,
        acquisition_price, home_cost, closing_costs, carrying_costs, install_costs,
        allIn, target_sale_price, projProfit, projROI,
        home_model, sqft, bedrooms, bathrooms, status, notes, assigned_to]);

    res.status(201).json(deal);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/deals/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const allowed = ['status','notes','actual_sale_price','acquisition_price',
      'home_cost','target_sale_price','assigned_to','list_date','sale_close_date'];
    const updates = Object.entries(req.body)
      .filter(([k]) => allowed.includes(k));

    if (!updates.length) return res.status(400).json({ error: 'No valid fields to update' });

    const setClauses = updates.map(([k], i) => `${k} = $${i + 2}`).join(', ');
    const values = updates.map(([, v]) => v);

    const { rows: [deal] } = await query(
      `UPDATE deals SET ${setClauses}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id, ...values]
    );
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    res.json(deal);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
