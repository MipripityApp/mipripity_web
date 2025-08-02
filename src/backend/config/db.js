const { Pool } = require("pg")
require("dotenv").config()

console.log('Using database configuration from environment variables');

// Database configuration using environment variables
const pool = new Pool({
  host: process.env.DB_HOST || "dpg-d20dlveuk2gs73c64e60-a.frankfurt-postgres.render.com",
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME || "mipripity_db",
  user: process.env.DB_USER || "mipripity_db_user",
  password: process.env.DB_PASSWORD || "MLLnBlsd9K57fNB9abKXpJGpWD7DKpJ2",
  ssl: { rejectUnauthorized: false } // Required for connecting to Render PostgreSQL
})

// Test database connection
pool
  .connect()
  .then(() => console.log("Connected to PostgreSQL database"))
  .catch((err) => console.error("Database connection error:", err.stack))

// Export pool for use in other files
module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
}