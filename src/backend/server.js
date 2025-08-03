const express = require("express")
const cors = require("cors")
const helmet = require("helmet")
const path = require("path")
require("dotenv").config()

// Import database, Firebase configurations, and utilities
const db = require("./config/db")
const { admin } = require("./config/firebase")
const { runMigrations, checkMigrationsNeeded } = require("./utils/dbMigrate")

// Create Express app
const app = express()
const PORT = process.env.PORT || 3000

// Only run migrations if needed (not on every restart)
const initializeDatabase = async () => {
  try {
    const migrationsNeeded = await checkMigrationsNeeded()
    if (migrationsNeeded) {
      console.log("Running database migrations...")
      await runMigrations()
      console.log("Database migrations completed")
    } else {
      console.log("Database is up to date, skipping migrations")
    }
  } catch (err) {
    console.error("Database initialization error:", err)
    // Don't exit the process, just log the error
    // process.exit(1)
  }
}

// Initialize database
initializeDatabase()

// Middleware
app.use(helmet()) // Security headers

// Configure CORS for Netlify frontend and development
const allowedOrigins = [
  'https://688cf92ccb2b7f2e7181e641--mipripity.netlify.app', // Your Netlify frontend
  'https://mipripity.netlify.app', // In case you get a custom domain
  process.env.FRONTEND_URL,
  'http://localhost:3000', // Local development
  'http://localhost:3001'  // Alternative local port
].filter(Boolean)

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true)
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true)
    } else {
      console.log('CORS blocked origin:', origin)
      callback(new Error('Not allowed by CORS'))
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with'],
  credentials: true
}))

app.use(express.json({ limit: '10mb' })) // Parse JSON request bodies
app.use(express.urlencoded({ extended: true, limit: '10mb' })) // Parse URL-encoded request bodies

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "production",
    database: "connected" // You could add actual DB health check here
  })
})

// API Routes
const authRoutes = require("./routes/auth")
const userRoutes = require("./routes/users")
const propertyRoutes = require("./routes/properties")
const voteRoutes = require("./routes/votes")

// Use API routes with /api prefix
app.use("/api/auth", authRoutes)
app.use("/api/users", userRoutes)
app.use("/api/properties", propertyRoutes)
app.use("/api/votes", voteRoutes)

// Also support direct access without /api prefix for backward compatibility
app.use("/auth", authRoutes)
app.use("/users", userRoutes)
app.use("/properties", propertyRoutes)
app.use("/votes", voteRoutes)

// Serve static files in production (for API documentation)
if (process.env.NODE_ENV === "production") {
  // Serve static files from the build directory (API documentation page)
  app.use(express.static(path.join(__dirname, "../build")))

  // For non-API routes, serve API documentation instead of React app
  // since the frontend is hosted on Netlify
  app.get("*", (req, res, next) => {
    // If it's an API route, let it fall through to 404 handler
    if (req.path.startsWith('/api/') || 
        req.path.startsWith('/auth/') || 
        req.path.startsWith('/users/') || 
        req.path.startsWith('/properties/') || 
        req.path.startsWith('/votes/')) {
      return next()
    }
    
    // Serve API documentation page for all other routes
    res.sendFile(path.join(__dirname, "../build", "index.html"))
  })
}

// 404 handler for API routes
app.use(["/api/*", "/auth/*", "/users/*", "/properties/*", "/votes/*"], (req, res) => {
  res.status(404).json({ 
    error: "API endpoint not found",
    path: req.path,
    method: req.method
  })
})

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err.stack)
  res.status(500).json({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "development" ? err.message : "Something went wrong",
  })
})

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV || "production"}`)
  console.log(`Database: ${process.env.DB_HOST || 'localhost'}`)
})

module.exports = app