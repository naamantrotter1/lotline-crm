require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const countiesRouter   = require('./routes/counties');
const listingsRouter   = require('./routes/listings');
const compsRouter      = require('./routes/comps');
const dealsRouter      = require('./routes/deals');
const statsRouter      = require('./routes/stats');
const reportsRouter    = require('./routes/reports');

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/counties',  countiesRouter);
app.use('/api/listings',  listingsRouter);
app.use('/api/comps',     compsRouter);
app.use('/api/deals',     dealsRouter);
app.use('/api/stats',     statsRouter);
app.use('/api/reports',   reportsRouter);

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ─── Startup ─────────────────────────────────────────────────────────────────
async function start() {
  // Try connecting to an existing PostgreSQL first
  const testPool = new Pool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME     || 'lotline_intelligence',
    user:     process.env.DB_USER     || 'lotline',
    password: process.env.DB_PASSWORD || 'lotline_secret',
    connectionTimeoutMillis: 2000,
  });

  let useEmbedded = false;
  try {
    await testPool.query('SELECT 1');
    await testPool.end();
    console.log('  ✓ Connected to existing PostgreSQL');
  } catch {
    await testPool.end().catch(() => {});
    useEmbedded = true;
  }

  if (useEmbedded) {
    console.log('\n🐘 Starting embedded PostgreSQL...');
    const { startEmbeddedPostgres } = require('./startDb');
    await startEmbeddedPostgres();

    // Wait for port to be ready
    await new Promise(r => setTimeout(r, 2000));

    // Apply schema and seed if needed
    const { pool, query } = require('./db');
    try {
      const { rows } = await query('SELECT COUNT(*) FROM counties');
      if (parseInt(rows[0].count) === 0) {
        await applySchemaAndSeed(query);
      } else {
        console.log(`  ✓ Database already seeded (${rows[0].count} counties)`);
      }
    } catch {
      // Table doesn't exist yet — apply schema first
      await applySchemaAndSeed(query);
    }
  }

  app.listen(PORT, () => {
    console.log(`\n🏠 LotLine Intelligence API`);
    console.log(`   Running on http://localhost:${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);
  });
}

async function applySchemaAndSeed(query) {
  console.log('  📋 Applying schema...');
  const schemaPath = path.resolve(__dirname, '../../database/schema-embedded.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  const statements = schema.split(';').map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    await query(stmt).catch(err => console.warn('  Schema warning:', err.message));
  }
  console.log('  ✓ Schema applied');

  console.log('  🌱 Seeding data (background)...');
  const { execFile } = require('child_process');
  await new Promise((resolve, reject) => {
    const child = execFile(process.execPath, [path.resolve(__dirname, 'seed/index.js')], {
      env: { ...process.env, DB_HOST: 'localhost', DB_PORT: String(process.env.DB_PORT || 5432) },
    }, (err, stdout, stderr) => {
      if (stdout) process.stdout.write(stdout);
      if (err) { console.warn('  Seed warning:', err.message); }
      resolve();
    });
  });
  console.log('  ✓ Seeding complete');
}

start().catch(err => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
