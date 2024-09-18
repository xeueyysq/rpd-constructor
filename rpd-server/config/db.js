const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'db',
    database: 'Rpd',
    password: 'admin',
    port: 5432,
});

module.exports = { pool }