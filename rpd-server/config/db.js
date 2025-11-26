const { Pool } = require("pg");
const { process } = require("process");

const pool = new Pool({
  user: process?.env?.DB_USER || "postgres",
  host: process?.env?.DB_HOST || "localhost",
  database: process?.env?.DB_NAME || "Rpd",
  password: process?.env?.DB_PASSWORD || "4774",
  port: parseInt(process?.env?.DB_PORT || "5432"),
});

module.exports = { pool };
