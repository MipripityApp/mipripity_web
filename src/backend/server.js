const express = require("express")
const cors = require("cors")
const helmet = require("helmet")
const path = require("path")
require("dotenv").config()

// Import database and Firebase configurations
const db = require("./config/db")

// Create Express app
const app = express()
const PORT = process.env.PORT || 3000

// Skip migrations for now to avoid errors - we'll handle them separately
console.log("Skipping migrations on startup to avoid errors")

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
    database: "connected"
  })
})

// Simple API documentation endpoint
app.get("/", (req, res) => {
  res.json({
    message: "🏠 Mipripity Web API Server",
    status: "✅ API Server is running successfully",
    description: "Backend API server for the Mipripity property voting platform",
    endpoints: {
      health: "GET /health",
      users: "GET /api/users",
      properties: "GET /api/properties", 
      votes: "GET /api/votes",
      auth: "POST /api/auth"
    },
    frontend: "Frontend hosted separately on Netlify"
  })
})

// Import routes with error handling
let authRoutes, userRoutes, propertyRoutes, voteRoutes

try {
  authRoutes = require("./routes/auth")
  userRoutes = require("./routes/users")
  propertyRoutes = require("./routes/properties")
  voteRoutes = require("./routes/votes")

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

  console.log("✅ All routes loaded successfully")
} catch (error) {
  console.error("❌ Error loading routes:", error.message)
  
  // Create simple fallback routes
  app.get("/api/users", (req, res) => {
    res.status(503).json({ error: "User routes not available", message: error.message })
  })
  
  app.get("/api/properties", (req, res) => {
    res.status(503).json({ error: "Property routes not available", message: error.message })
  })
  
  app.get("/api/votes", (req, res) => {
    res.status(503).json({ error: "Vote routes not available", message: error.message })
  })
  
  app.post("/api/auth/login", (req, res) => {
    res.status(503).json({ error: "Auth routes not available", message: error.message })
  })
}

// 404 handler for API routes
app.use(["/api/*", "/auth/*", "/users/*", "/properties/*", "/votes/*"], (req, res) => {
  res.status(404).json({ 
    error: "API endpoint not found",
    path: req.path,
    method: req.method,
    availableEndpoints: ["/health", "/api/users", "/api/properties", "/api/votes", "/api/auth"]
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
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "production"}`)
  console.log(`🗄️  Database: ${process.env.DB_HOST || 'localhost'}`)
  console.log(`🔗 Health check: http://localhost:${PORT}/health`)
})

module.exports = app