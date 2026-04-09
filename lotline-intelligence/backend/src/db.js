const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'lotline_intelligence',
  user:     process.env.DB_USER     || 'lotline',
  password: process.env.DB_PASSWORD || 'lotline_secret',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err);
});

// Simple query helper
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development' && duration > 200) {
      console.log(`Slow query (${duration}ms): ${text.substring(0, 80)}`);
    }
    return res;
  } catch (err) {
    console.error('DB query error:', err.message);
    console.error('Query:', text.substring(0, 200));
    throw err;
  }
}

async function getClient() {
  return pool.connect();
}

module.exports = { query, getClient, pool };
