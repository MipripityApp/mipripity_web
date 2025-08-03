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
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
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
    message: "🏠 Mipripity Web API Server is running",
    status: "✅ API Server is running successfully",
    description: "Backend API server for the Mipripity property voting platform",
    endpoints: {
      health: "GET /health",
      users: "GET, POST, PATCH, PUT /api/users",
      properties: "GET, POST, PATCH, PUT /api/properties", 
      votes: "GET, POST, PATCH, PUT /api/votes",
      property_images: "GET, POST, PATCH, PUT /api/property_images",
      categories: "GET /api/categories (read-only)",
      vote_options: "GET /api/vote_options (read-only)",
      auth: "POST /api/auth"
    },
    frontend: "Frontend hosted separately on Netlify"
  })
})

// Import routes with error handling
let authRoutes, userRoutes, propertyRoutes, voteRoutes, propertyImageRoutes, categoryRoutes, voteOptionRoutes

try {
  // Try to load existing routes
  try {
    authRoutes = require("./routes/auth")
    console.log("✅ Auth routes loaded")
  } catch (err) {
    console.log("⚠️  Auth routes not found:", err.message)
  }

  try {
    userRoutes = require("./routes/users")
    console.log("✅ User routes loaded")
  } catch (err) {
    console.log("⚠️  User routes not found:", err.message)
  }

  try {
    propertyRoutes = require("./routes/properties")
    console.log("✅ Property routes loaded")
  } catch (err) {
    console.log("⚠️  Property routes not found:", err.message)
  }

  try {
    voteRoutes = require("./routes/votes")
    console.log("✅ Vote routes loaded")
  } catch (err) {
    console.log("⚠️  Vote routes not found:", err.message)
  }

  try {
    propertyImageRoutes = require("./routes/property_images")
    console.log("✅ Property image routes loaded")
  } catch (err) {
    console.log("⚠️  Property image routes not found:", err.message)
  }

  try {
    categoryRoutes = require("./routes/categories")
    console.log("✅ Category routes loaded")
  } catch (err) {
    console.log("⚠️  Category routes not found:", err.message)
  }

  try {
    voteOptionRoutes = require("./routes/vote_options")
    console.log("✅ Vote option routes loaded")
  } catch (err) {
    console.log("⚠️  Vote option routes not found:", err.message)
  }

  // Use API routes with /api prefix
  if (authRoutes) {
    app.use("/api/auth", authRoutes)
    app.use("/auth", authRoutes) // Direct access
  }

  if (userRoutes) {
    app.use("/api/users", userRoutes)
    app.use("/users", userRoutes) // Direct access
  }

  if (propertyRoutes) {
    app.use("/api/properties", propertyRoutes)
    app.use("/properties", propertyRoutes) // Direct access
  }

  if (voteRoutes) {
    app.use("/api/votes", voteRoutes)
    app.use("/votes", voteRoutes) // Direct access
  }

  if (propertyImageRoutes) {
    app.use("/api/property_images", propertyImageRoutes)
    app.use("/property_images", propertyImageRoutes) // Direct access
  }

  if (categoryRoutes) {
    app.use("/api/categories", categoryRoutes)
    app.use("/categories", categoryRoutes) // Direct access
  }

  if (voteOptionRoutes) {
    app.use("/api/vote_options", voteOptionRoutes)
    app.use("/vote_options", voteOptionRoutes) // Direct access
  }

  console.log("✅ All available routes loaded successfully")

} catch (error) {
  console.error("❌ Error loading routes:", error.message)
}

// Create fallback routes for missing route files
if (!userRoutes) {
  app.get(["/api/users", "/users"], (req, res) => {
    res.status(503).json({ 
      error: "User routes not available", 
      message: "Please create routes/users.js file" 
    })
  })
}

if (!voteRoutes) {
  app.all(["/api/votes*", "/votes*"], (req, res) => {
    res.status(503).json({ 
      error: "Vote routes not available", 
      message: "Please create routes/votes.js file" 
    })
  })
}

if (!propertyImageRoutes) {
  app.all(["/api/property_images*", "/property_images*"], (req, res) => {
    res.status(503).json({ 
      error: "Property image routes not available", 
      message: "Please create routes/property_images.js file" 
    })
  })
}

if (!categoryRoutes) {
  app.get(["/api/categories*", "/categories*"], (req, res) => {
    res.status(503).json({ 
      error: "Category routes not available", 
      message: "Please create routes/categories.js file" 
    })
  })
}

if (!voteOptionRoutes) {
  app.get(["/api/vote_options*", "/vote_options*"], (req, res) => {
    res.status(503).json({ 
      error: "Vote option routes not available", 
      message: "Please create routes/vote_options.js file" 
    })
  })
}

if (!authRoutes) {
  app.post(["/api/auth/login", "/auth/login"], (req, res) => {
    res.status(503).json({ 
      error: "Auth routes not available", 
      message: "Please create routes/auth.js file" 
    })
  })
}

// 404 handler for API routes
app.use(["/api/*", "/auth/*", "/users/*", "/properties/*", "/votes/*", "/property_images/*", "/categories/*", "/vote_options/*"], (req, res) => {
  res.status(404).json({ 
    error: "API endpoint not found",
    path: req.path,
    method: req.method,
    availableEndpoints: [
      "/health", 
      "/api/users", 
      "/api/properties", 
      "/api/votes", 
      "/api/property_images",
      "/api/categories",
      "/api/vote_options",
      "/api/auth"
    ]
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
  console.log(`📖 API docs: http://localhost:${PORT}/`)
})

module.exports = app