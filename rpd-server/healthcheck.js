const { pool } = require('./config/db');

async function healthCheck() {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    process.exit(0);
  } catch (err) {
    console.error('Health check failed:', err);
    process.exit(1);
  }
}

healthCheck(); 