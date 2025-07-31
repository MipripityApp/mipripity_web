const express = require("express")
const cors = require("cors")
const helmet = require("helmet")
const path = require("path")
require("dotenv").config()

// Import database, Firebase configurations, and utilities
const db = require("./config/db")
const { admin } = require("./config/firebase")
const { runMigrations } = require("./utils/dbMigrate")

// Create Express app
const app = express()
const PORT = process.env.PORT || 3000

// Run database migrations
runMigrations()
  .then(() => console.log("Database migrations completed"))
  .catch((err) => console.error("Migration error:", err))

// Middleware
app.use(helmet()) // Security headers
app.use(cors()) // Enable CORS for all routes
app.use(express.json()) // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })) // Parse URL-encoded request bodies

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  })
})

// Import routes
const authRoutes = require("./routes/auth")
const userRoutes = require("./routes/users")
const propertyRoutes = require("./routes/properties")
const voteRoutes = require("./routes/votes")

// Use routes
app.use("/api/auth", authRoutes)
app.use("/api/users", userRoutes)
app.use("/api/properties", propertyRoutes)
app.use("/api/votes", voteRoutes)

// Serve static files in production (for frontend)
if (process.env.NODE_ENV === "production") {
  // Serve static files from the build directory
  app.use(express.static(path.join(__dirname, "../../build")))

  // Handle React routing, return all requests to React app
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../../build", "index.html"))
  })
}

// 404 handler for API routes
app.use("/api/*", (req, res) => {
  res.status(404).json({ error: "API endpoint not found" })
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({
    error: "Server error",
    message: process.env.NODE_ENV === "development" ? err.message : "Something went wrong",
  })
})

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`)
})

module.exports = app