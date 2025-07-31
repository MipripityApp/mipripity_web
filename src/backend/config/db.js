const { Pool } = require("pg")
require("dotenv").config()

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }, // Required for connecting to Render PostgreSQL
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