/**
 * Starts an embedded PostgreSQL instance, creates the DB, runs the schema, and seeds data.
 * Runs automatically when the backend starts if no external Postgres is available.
 */

const path = require('path');
const fs   = require('fs');

const DB_DIR  = path.resolve(__dirname, '../../data/pgdata');
const DB_PORT = parseInt(process.env.DB_PORT || '5432');
const DB_NAME = process.env.DB_NAME || 'lotline_intelligence';
const DB_USER = process.env.DB_USER || 'lotline';
const DB_PASS = process.env.DB_PASSWORD || 'lotline_secret';

async function startEmbeddedPostgres() {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');

  const pg = new EmbeddedPostgres({
    databaseDir: DB_DIR,
    user:        DB_USER,
    password:    DB_PASS,
    port:        DB_PORT,
    persistent:  true,
  });

  if (!fs.existsSync(DB_DIR) || !fs.existsSync(path.join(DB_DIR, 'PG_VERSION'))) {
    console.log('  🗄  Initialising embedded PostgreSQL cluster...');
    await pg.initialise();
  }

  await pg.start();
  console.log(`  ✓ Embedded PostgreSQL running on port ${DB_PORT}`);

  // Create DB and user if missing
  try {
    await pg.createDatabase(DB_NAME);
    console.log(`  ✓ Database "${DB_NAME}" ready`);
  } catch (e) {
    // Already exists — that's fine
  }

  return pg;
}

module.exports = { startEmbeddedPostgres };
