const { Pool } = require("pg")
require("dotenv").config()

// Determine if we're in production
const isProduction = process.env.NODE_ENV === 'production'

console.log(`Initializing database connection for ${isProduction ? 'production' : 'development'} environment`)

// Database configuration using environment variables
const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  // SSL configuration for production (Render PostgreSQL requires SSL)
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  // Connection pool settings
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
}

// Validate required environment variables
const requiredEnvVars = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']
const missingVars = requiredEnvVars.filter(varName => !process.env[varName])

if (missingVars.length > 0) {
  console.error('Missing required environment variables:', missingVars.join(', '))
  process.exit(1)
}

// Create connection pool
const pool = new Pool(dbConfig)

// Handle pool errors
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err)
  process.exit(-1)
})

// Test database connection
const testConnection = async () => {
  try {
    const client = await pool.connect()
    const result = await client.query('SELECT NOW()')
    console.log("✅ Connected to PostgreSQL database successfully")
    console.log(`Database time: ${result.rows[0].now}`)
    client.release()
  } catch (err) {
    console.error("❌ Database connection error:", err.message)
    // Don't exit the process, let the app handle the error
  }
}

// Test connection on startup
testConnection()

// Export query function and pool
module.exports = {
  query: async (text, params) => {
    const start = Date.now()
    try {
      const res = await pool.query(text, params)
      const duration = Date.now() - start
      if (process.env.NODE_ENV === 'development') {
        console.log('Executed query', { text, duration, rows: res.rowCount })
      }
      return res
    } catch (error) {
      console.error('Database query error:', { text, error: error.message })
      throw error
    }
  },
  pool,
  // Helper function to get a client from the pool
  getClient: () => pool.connect(),
  // Alternative method name for compatibility
  connect: () => pool.connect(),
}