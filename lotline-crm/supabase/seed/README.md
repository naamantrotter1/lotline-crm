# Seed data

## ZIP → County crosswalk (NC / SC / FL)

Migration `127_seed_county_zips_starter.sql` seeds a starter set of
high-population ZIPs per state so the Deal Calculator works out of the box.

For the **complete** ~5,000-row crosswalk:

1. Download the latest `HUD_ZIP_COUNTY` CSV from
   https://www.huduser.gov/portal/datasets/usps_crosswalk.html
   (free, requires a HUD account; the file is ~40,000 rows nationwide).

2. Save the CSV anywhere on your machine, e.g. `~/Downloads/HUD_ZIP_COUNTY_092024.csv`.

3. Run the seed script with your service-role key:

   ```bash
   SUPABASE_URL='https://kukwppzrhbbaxppkvtjs.supabase.co' \
   SUPABASE_SERVICE_ROLE_KEY='<service-role-key>' \
   node scripts/seed-zip-county.mjs ~/Downloads/HUD_ZIP_COUNTY_092024.csv
   ```

The script:
- Filters to ZIPs in counties whose FIPS code starts with `37` (NC),
  `45` (SC), or `12` (FL).
- Marks the highest-RES_RATIO county per ZIP as `is_primary = true`.
- Upserts in batches of 500. Idempotent — re-running is a no-op.

After the bulk import you can verify with:

```sql
SELECT * FROM public._calc_v2_zip_seed_check;
```

You should see ~3,500-5,000 rows depending on the HUD release.
