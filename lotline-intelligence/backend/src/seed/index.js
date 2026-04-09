#!/usr/bin/env node
/**
 * Database seed script.
 * Usage:
 *   node src/seed/index.js          -- seed only if tables empty
 *   node src/seed/index.js --fresh  -- truncate and re-seed
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const { query, pool } = require('../db');
const { ALL_COUNTIES } = require('../data/counties');
const { generateListings, generateSoldComps, enrichDeals } = require('../services/mockData');
const { calcAllStats } = require('../services/metrics');

const FRESH = process.argv.includes('--fresh');

async function run() {
  console.log('🌱 LotLine Intelligence — Database Seeder');
  console.log(FRESH ? '⚠️  FRESH mode: truncating all tables first' : '');

  try {
    // ── Optional truncate ────────────────────────────────────────────────────
    if (FRESH) {
      await query('TRUNCATE market_stats, deals, sold_comps, listings, counties RESTART IDENTITY CASCADE');
      console.log('  ✓ Tables truncated');
    } else {
      const { rows } = await query('SELECT COUNT(*) FROM counties');
      if (parseInt(rows[0].count) > 0) {
        console.log(`  ℹ Counties already seeded (${rows[0].count} rows). Use --fresh to re-seed.`);
        await pool.end();
        return;
      }
    }

    // ── 1. Counties ──────────────────────────────────────────────────────────
    console.log('\n1. Seeding counties...');
    let countyMap = {}; // fips → db id

    for (const c of ALL_COUNTIES) {
      const res = await query(`
        INSERT INTO counties
          (fips_code, name, state, centroid_lat, centroid_lng,
           population, population_growth_pct, median_household_income,
           median_home_value, unemployment_rate, flood_risk_pct,
           mh_friendly_zoning, priority_market)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (fips_code) DO UPDATE SET
          population = EXCLUDED.population,
          updated_at = NOW()
        RETURNING id
      `, [c.fips, c.name, c.state, c.lat, c.lng,
          c.pop, c.growth, c.income, c.homeValue,
          c.unemployment, c.floodRisk, c.mhFriendly, c.priority]);
      countyMap[c.fips] = res.rows[0].id;
    }
    console.log(`  ✓ ${ALL_COUNTIES.length} counties inserted`);

    // ── 2. Active Listings ───────────────────────────────────────────────────
    console.log('\n2. Generating 500 active listings...');
    const listings = generateListings(500);
    let listingInserted = 0;
    for (const l of listings) {
      const cid = countyMap[l.county_fips];
      if (!cid) continue;
      await query(`
        INSERT INTO listings
          (mls_id, county_id, zip_code, lat, lng, address,
           list_price, price_per_acre, acreage, bedrooms, bathrooms, sqft,
           days_on_market, list_date, status, property_type, year_built,
           well_septic, public_utilities, flood_zone, source)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
        ON CONFLICT (mls_id) DO NOTHING
      `, [l.mls_id, cid, l.zip_code, l.lat, l.lng, l.address,
          l.list_price, l.price_per_acre, l.acreage, l.bedrooms, l.bathrooms, l.sqft,
          l.days_on_market, l.list_date, l.status, l.property_type, l.year_built,
          l.well_septic, l.public_utilities, l.flood_zone, l.source]);
      listingInserted++;
    }
    console.log(`  ✓ ${listingInserted} listings inserted`);

    // ── 3. Sold Comps ────────────────────────────────────────────────────────
    console.log('\n3. Generating 1,500 sold comps...');
    const comps = generateSoldComps(1500);
    let compInserted = 0;
    for (const c of comps) {
      const cid = countyMap[c.county_fips];
      if (!cid) continue;
      await query(`
        INSERT INTO sold_comps
          (mls_id, county_id, zip_code, lat, lng, address,
           list_price, sale_price, price_per_acre, acreage, bedrooms, bathrooms, sqft,
           days_on_market, list_date, close_date, list_to_sale_ratio,
           property_type, year_built, source)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
        ON CONFLICT (mls_id) DO NOTHING
      `, [c.mls_id, cid, c.zip_code, c.lat, c.lng, c.address,
          c.list_price, c.sale_price, c.price_per_acre, c.acreage, c.bedrooms, c.bathrooms, c.sqft,
          c.days_on_market, c.list_date, c.close_date, c.list_to_sale_ratio,
          c.property_type, c.year_built, c.source]);
      compInserted++;
    }
    console.log(`  ✓ ${compInserted} sold comps inserted`);

    // ── 4. Pipeline Deals ────────────────────────────────────────────────────
    console.log('\n4. Seeding 17 pipeline deals...');
    const deals = enrichDeals();
    let dealInserted = 0;
    for (const d of deals) {
      const cid = countyMap[d.county_fips];
      if (!cid) continue;
      await query(`
        INSERT INTO deals
          (county_id, zip_code, lat, lng, address,
           acquisition_price, home_cost, closing_costs, carrying_costs, install_costs,
           all_in_cost, target_sale_price, projected_profit, projected_roi_pct,
           actual_sale_price, actual_profit, actual_roi_pct,
           status, contract_date, close_date, list_date, sale_close_date,
           days_to_close, acreage, home_model, sqft, bedrooms, bathrooms, notes, assigned_to)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30)
        ON CONFLICT DO NOTHING
      `, [cid, d.zip_code, d.lat, d.lng, d.address,
          d.acquisition_price, d.home_cost, d.closing_costs, d.carrying_costs, d.install_costs,
          d.all_in_cost, d.target_sale_price, d.projected_profit, d.projected_roi_pct,
          d.actual_sale_price || null, d.actual_profit || null, d.actual_roi_pct || null,
          d.status, d.contract_date || null, d.close_date || null,
          d.list_date || null, d.sale_close_date || null,
          d.days_to_close, d.acreage, d.home_model, d.sqft, d.bedrooms, d.bathrooms,
          d.notes, d.assigned_to || null]);
      dealInserted++;
    }
    console.log(`  ✓ ${dealInserted} pipeline deals inserted`);

    // ── 5. Market Stats ──────────────────────────────────────────────────────
    console.log('\n5. Calculating market statistics...');
    const { ALL_COUNTIES: counties } = require('../data/counties');
    const allStats = calcAllStats(counties, listings, comps);
    let statsInserted = 0;
    for (const s of allStats) {
      const cid = countyMap[s.county_fips];
      if (!cid) continue;
      await query(`
        INSERT INTO market_stats
          (county_id, period, acreage_bucket, active_listings, sold_count,
           median_list_price, median_sale_price, median_price_per_acre,
           avg_list_price, avg_sale_price,
           median_days_on_market, avg_days_on_market,
           absorption_rate_pct, months_of_supply, sell_through_rate_pct,
           list_to_sale_ratio_pct, avg_acreage, demand_score, opportunity_score)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
        ON CONFLICT (county_id, zip_code, period, acreage_bucket)
        DO UPDATE SET
          active_listings = EXCLUDED.active_listings,
          sold_count = EXCLUDED.sold_count,
          demand_score = EXCLUDED.demand_score,
          opportunity_score = EXCLUDED.opportunity_score,
          calculated_at = NOW()
      `, [cid, s.period, s.acreage_bucket, s.active_listings, s.sold_count,
          s.median_list_price, s.median_sale_price, s.median_price_per_acre,
          s.avg_list_price, s.avg_sale_price,
          s.median_days_on_market, s.avg_days_on_market,
          s.absorption_rate_pct, s.months_of_supply, s.sell_through_rate_pct,
          s.list_to_sale_ratio_pct, s.avg_acreage, s.demand_score, s.opportunity_score]);
      statsInserted++;
    }
    console.log(`  ✓ ${statsInserted} market stat rows inserted`);

    console.log('\n✅ Seed complete!');
  } catch (err) {
    console.error('\n❌ Seed failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
