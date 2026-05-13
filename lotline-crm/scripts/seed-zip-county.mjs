#!/usr/bin/env node
/**
 * seed-zip-county.mjs — bulk-load ZIP→county rows from a HUD USPS crosswalk
 * CSV into public.county_zips.
 *
 * Usage:
 *   SUPABASE_URL=...            \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/seed-zip-county.mjs path/to/HUD_ZIP_COUNTY.csv
 *
 * The HUD CSV (from https://www.huduser.gov/portal/datasets/usps_crosswalk.html)
 * has columns: ZIP, COUNTY, RES_RATIO, BUS_RATIO, OTH_RATIO, TOT_RATIO
 *
 * COUNTY is a 5-digit FIPS code. We:
 *   1. Filter to FIPS codes starting with '37' (NC), '45' (SC), or '12' (FL).
 *   2. For each ZIP, mark the row with the highest RES_RATIO as is_primary.
 *   3. Look up the county UUID via public.counties.fips_code.
 *   4. Upsert in batches of 500 rows.
 *
 * Idempotent: re-running with the same CSV is a no-op.
 */

import fs from 'node:fs';
import path from 'node:path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing env: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('Usage: node scripts/seed-zip-county.mjs path/to/HUD_ZIP_COUNTY.csv');
  process.exit(1);
}
if (!fs.existsSync(csvPath)) {
  console.error(`File not found: ${csvPath}`);
  process.exit(1);
}

const SUPPORTED_PREFIXES = new Set(['37', '45', '12']);   // NC / SC / FL state FIPS
const BATCH_SIZE = 500;

// ── 1. Parse CSV ────────────────────────────────────────────────────────────

function parseCSV(text) {
  // HUD CSVs are clean (no embedded commas / quotes). Simple split is safe.
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toUpperCase());
  const zipIdx   = header.indexOf('ZIP');
  const countyIdx = header.indexOf('COUNTY');
  const resIdx   = header.indexOf('RES_RATIO');
  if (zipIdx < 0 || countyIdx < 0) {
    throw new Error(`Unexpected CSV header. Got: ${header.join(',')}`);
  }
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',').map(c => c.replace(/"/g, '').trim());
    rows.push({
      zip: cells[zipIdx].padStart(5, '0'),
      fips: cells[countyIdx].padStart(5, '0'),
      resRatio: resIdx >= 0 ? Number(cells[resIdx]) || 0 : 0,
    });
  }
  return rows;
}

console.log(`Reading ${csvPath}…`);
const raw = parseCSV(fs.readFileSync(csvPath, 'utf8'));
console.log(`  ${raw.length.toLocaleString()} rows total in CSV`);

const filtered = raw.filter(r => SUPPORTED_PREFIXES.has(r.fips.slice(0, 2)));
console.log(`  ${filtered.length.toLocaleString()} rows in NC/SC/FL`);

// Group by ZIP to mark the highest-RES_RATIO county as primary
const byZip = new Map();
for (const r of filtered) {
  if (!byZip.has(r.zip)) byZip.set(r.zip, []);
  byZip.get(r.zip).push(r);
}
const primaryByZipFips = new Set();
for (const [zip, list] of byZip) {
  list.sort((a, b) => b.resRatio - a.resRatio);
  primaryByZipFips.add(`${zip}|${list[0].fips}`);
}

// ── 2. Fetch county_id by fips_code ─────────────────────────────────────────

async function rpc(method, body) {
  const url = `${SUPABASE_URL}/rest/v1/${body.table}${body.query ? `?${body.query}` : ''}`;
  const res = await fetch(url, {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: body.body ? JSON.stringify(body.body) : undefined,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${method} ${url} → ${res.status}: ${txt}`);
  }
  return res;
}

console.log('Fetching county_id ↔ fips_code map from Supabase…');
const countiesRes = await fetch(`${SUPABASE_URL}/rest/v1/counties?select=id,fips_code,state`, {
  headers: {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  },
});
if (!countiesRes.ok) {
  console.error(await countiesRes.text());
  process.exit(1);
}
const counties = await countiesRes.json();
const fipsToCounty = new Map(counties.map(c => [c.fips_code, c]));
console.log(`  ${counties.length} counties loaded`);

// ── 3. Build upsert payload ────────────────────────────────────────────────

const payload = [];
for (const r of filtered) {
  const county = fipsToCounty.get(r.fips);
  if (!county) continue; // FIPS missing from counties table (shouldn't happen)
  payload.push({
    zip_code: r.zip,
    county_id: county.id,
    state: county.state,
    is_primary: primaryByZipFips.has(`${r.zip}|${r.fips}`),
  });
}
console.log(`  ${payload.length.toLocaleString()} rows to upsert`);

// ── 4. Upsert in batches ───────────────────────────────────────────────────

let done = 0;
for (let i = 0; i < payload.length; i += BATCH_SIZE) {
  const slice = payload.slice(i, i + BATCH_SIZE);
  const url = `${SUPABASE_URL}/rest/v1/county_zips?on_conflict=zip_code,county_id`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(slice),
  });
  if (!res.ok) {
    console.error(`Batch ${i / BATCH_SIZE + 1} failed: ${res.status}`);
    console.error(await res.text());
    process.exit(1);
  }
  done += slice.length;
  process.stdout.write(`\r  upserted ${done.toLocaleString()} / ${payload.length.toLocaleString()}`);
}
console.log('\nDone.');
