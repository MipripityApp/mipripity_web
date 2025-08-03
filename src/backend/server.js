const express = require("express")
const cors = require("cors")
const helmet = require("helmet")
const path = require("path")
require("dotenv").config()

// Force production environment
process.env.NODE_ENV = 'production'

// Import database configuration
const db = require("./config/db")

// Create Express app
const app = express()
const PORT = process.env.PORT || 3000

// Skip migrations for now to avoid errors - we'll handle them separately
console.log("Skipping migrations on startup to avoid errors")

// Middleware
app.use(helmet()) // Security headers

// Configure CORS for Netlify frontend
const allowedOrigins = [
  'https://688cf92ccb2b7f2e7181e641--mipripity.netlify.app', // Your Netlify frontend
  'https://mipripity.netlify.app', // In case you get a custom domain
  process.env.FRONTEND_URL
].filter(Boolean)

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true)
    
    if (allowedOrigins.indexOf(origin) !== -1) {
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
      users: "GET, POST, PATCH, PUT, DELETE /users",
      properties: "GET, POST, PATCH, PUT, DELETE /properties", 
      votes: "GET, POST, PATCH, PUT, DELETE /votes",
      property_images: "GET, POST, PATCH, PUT, DELETE /property_images",
      categories: "GET /categories (read-only)",
      vote_options: "GET /vote_options (read-only)",
      auth: "POST /auth/login, POST /auth/register"
    },
    frontend: "Frontend hosted separately on Netlify"
  })
})

// =============================================================================
// USERS ROUTES
// =============================================================================

// GET all users
app.get("/users", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM users ORDER BY created_at DESC")
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    })
  } catch (error) {
    console.error("Error during login:", error)
    res.status(500).json({
      success: false,
      error: "Failed to login",
      message: error.message
    })
  }
})

// POST register
app.post("/auth/register", async (req, res) => {
  try {
    const { name, email, password, phone } = req.body
    
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: "Name, email, and password are required"
      })
    }
    
    // Check if user already exists
    const existingUser = await db.query("SELECT * FROM users WHERE email = $1", [email])
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: "User with this email already exists"
      })
    }
    
    // Create new user
    const result = await db.query(
      "INSERT INTO users (name, email, password, phone) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, email, password, phone]
    )
    
    // Remove password from response
    const { password: _, ...userWithoutPassword } = result.rows[0]
    
    res.status(201).json({
      success: true,
      data: userWithoutPassword,
      message: "User registered successfully"
    })
  } catch (error) {
    console.error("Error during registration:", error)
    res.status(500).json({
      success: false,
      error: "Failed to register user",
      message: error.message
    })
  }
})

// =============================================================================
// ADDITIONAL API ROUTES WITH /api PREFIX
// =============================================================================

// Add /api prefix routes for all endpoints
app.use("/api/users", (req, res, next) => {
  req.url = req.url.replace('/api/users', '/users')
  req.originalUrl = req.originalUrl.replace('/api/users', '/users')
  next()
})

app.use("/api/properties", (req, res, next) => {
  req.url = req.url.replace('/api/properties', '/properties')
  req.originalUrl = req.originalUrl.replace('/api/properties', '/properties')
  next()
})

app.use("/api/votes", (req, res, next) => {
  req.url = req.url.replace('/api/votes', '/votes')
  req.originalUrl = req.originalUrl.replace('/api/votes', '/votes')
  next()
})

app.use("/api/property_images", (req, res, next) => {
  req.url = req.url.replace('/api/property_images', '/property_images')
  req.originalUrl = req.originalUrl.replace('/api/property_images', '/property_images')
  next()
})

app.use("/api/categories", (req, res, next) => {
  req.url = req.url.replace('/api/categories', '/categories')
  req.originalUrl = req.originalUrl.replace('/api/categories', '/categories')
  next()
})

app.use("/api/vote_options", (req, res, next) => {
  req.url = req.url.replace('/api/vote_options', '/vote_options')
  req.originalUrl = req.originalUrl.replace('/api/vote_options', '/vote_options')
  next()
})

app.use("/api/auth", (req, res, next) => {
  req.url = req.url.replace('/api/auth', '/auth')
  req.originalUrl = req.originalUrl.replace('/api/auth', '/auth')
  next()
})

// =============================================================================
// ANALYTICS AND STATISTICS ROUTES
// =============================================================================

// GET vote statistics for a property
app.get("/properties/:id/stats", async (req, res) => {
  try {
    const { id } = req.params
    
    const result = await db.query(`
      SELECT 
        vo.option_text,
        vo.id as vote_option_id,
        COUNT(v.id) as vote_count,
        ROUND(COUNT(v.id) * 100.0 / NULLIF(SUM(COUNT(v.id)) OVER(), 0), 2) as percentage
      FROM vote_options vo
      LEFT JOIN votes v ON vo.id = v.vote_option_id AND v.property_id = $1
      GROUP BY vo.id, vo.option_text
      ORDER BY vote_count DESC
    `, [id])
    
    const totalVotes = await db.query(
      "SELECT COUNT(*) as total FROM votes WHERE property_id = $1",
      [id]
    )
    
    res.json({
      success: true,
      data: {
        statistics: result.rows,
        total_votes: parseInt(totalVotes.rows[0].total)
      }
    })
  } catch (error) {
    console.error("Error fetching property statistics:", error)
    res.status(500).json({
      success: false,
      error: "Failed to fetch property statistics",
      message: error.message
    })
  }
})

// GET overall platform statistics
app.get("/stats", async (req, res) => {
  try {
    const userCount = await db.query("SELECT COUNT(*) as count FROM users")
    const propertyCount = await db.query("SELECT COUNT(*) as count FROM properties")
    const voteCount = await db.query("SELECT COUNT(*) as count FROM votes")
    const imageCount = await db.query("SELECT COUNT(*) as count FROM property_images")
    
    const recentActivity = await db.query(`
      SELECT 'vote' as type, created_at, user_id, property_id FROM votes
      UNION ALL
      SELECT 'property' as type, created_at, user_id, id as property_id FROM properties
      ORDER BY created_at DESC
      LIMIT 10
    `)
    
    res.json({
      success: true,
      data: {
        total_users: parseInt(userCount.rows[0].count),
        total_properties: parseInt(propertyCount.rows[0].count),
        total_votes: parseInt(voteCount.rows[0].count),
        total_images: parseInt(imageCount.rows[0].count),
        recent_activity: recentActivity.rows
      }
    })
  } catch (error) {
    console.error("Error fetching platform statistics:", error)
    res.status(500).json({
      success: false,
      error: "Failed to fetch platform statistics",
      message: error.message
    })
  }
})

// 404 handler for API routes
app.use(["/api/*"], (req, res) => {
  res.status(404).json({ 
    error: "API endpoint not found",
    path: req.path,
    method: req.method,
    availableEndpoints: [
      "GET /health", 
      "GET,POST,PUT,PATCH,DELETE /users", 
      "GET,POST,PUT,PATCH,DELETE /properties", 
      "GET,POST,PUT,PATCH,DELETE /votes", 
      "GET,POST,PUT,PATCH,DELETE /property_images",
      "GET /categories",
      "GET /vote_options",
      "POST /auth/login",
      "POST /auth/register",
      "GET /properties/:id/stats",
      "GET /stats"
    ]
  })
})

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err.stack)
  res.status(500).json({
    error: "Internal Server Error",
    message: "Something went wrong",
  })
})

// Start server
app.listen(PORT, '0.0.0.0', () => {
  const liveUrl = 'https://mipripity-web.onrender.com'
  console.log(`🚀 Server running on Render at ${liveUrl}`)
  console.log(`🌍 Environment: production`)
  console.log(`🗄️  Database: ${process.env.DB_HOST}`)
  console.log(`🔗 Health check: ${liveUrl}/health`)
  console.log(`📖 API docs: ${liveUrl}/`)
  console.log(`🏠 Available routes:`)
  console.log(`   - Users: ${liveUrl}/users`)
  console.log(`   - Properties: ${liveUrl}/properties`)
  console.log(`   - Votes: ${liveUrl}/votes`)
  console.log(`   - Property Images: ${liveUrl}/property_images`)
  console.log(`   - Categories: ${liveUrl}/categories`)
  console.log(`   - Vote Options: ${liveUrl}/vote_options`)
  console.log(`   - Auth: ${liveUrl}/auth/login, ${liveUrl}/auth/register`)
  console.log(`   - Statistics: ${liveUrl}/stats, ${liveUrl}/properties/:id/stats`)
})

module.exports = app
    console.error("Error fetching users:", error)
    res.status(500).json({
      success: false,
      error: "Failed to fetch users",
      message: error.message
    })

// GET user by ID
app.get("/users/:id", async (req, res) => {
  try {
    const { id } = req.params
    const result = await db.query("SELECT * FROM users WHERE id = $1", [id])
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      })
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error("Error fetching user:", error)
    res.status(500).json({
      success: false,
      error: "Failed to fetch user",
      message: error.message
    })
  }
})

// POST create new user
app.post("/users", async (req, res) => {
  try {
    const { name, email, password, phone } = req.body
    
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: "Name, email, and password are required"
      })
    }
    
    const result = await db.query(
      "INSERT INTO users (name, email, password, phone) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, email, password, phone]
    )
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: "User created successfully"
    })
  } catch (error) {
    console.error("Error creating user:", error)
    res.status(500).json({
      success: false,
      error: "Failed to create user",
      message: error.message
    })
  }
})

// PUT/PATCH update user
app.put("/users/:id", async (req, res) => {
  try {
    const { id } = req.params
    const { name, email, password, phone } = req.body
    
    const result = await db.query(
      "UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), password = COALESCE($3, password), phone = COALESCE($4, phone), updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *",
      [name, email, password, phone, id]
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      })
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: "User updated successfully"
    })
  } catch (error) {
    console.error("Error updating user:", error)
    res.status(500).json({
      success: false,
      error: "Failed to update user",
      message: error.message
    })
  }
})

app.patch("/users/:id", async (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body
    
    const setClause = Object.keys(updates).map((key, index) => `${key} = $${index + 1}`).join(', ')
    const values = Object.values(updates)
    values.push(id)
    
    const query = `UPDATE users SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length} RETURNING *`
    
    const result = await db.query(query, values)
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      })
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: "User updated successfully"
    })
  } catch (error) {
    console.error("Error updating user:", error)
    res.status(500).json({
      success: false,
      error: "Failed to update user",
      message: error.message
    })
  }
})

// DELETE user
app.delete("/users/:id", async (req, res) => {
  try {
    const { id } = req.params
    
    const result = await db.query("DELETE FROM users WHERE id = $1 RETURNING *", [id])
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      })
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: "User deleted successfully"
    })
  } catch (error) {
    console.error("Error deleting user:", error)
    res.status(500).json({
      success: false,
      error: "Failed to delete user",
      message: error.message
    })
  }
})

// =============================================================================
// PROPERTIES ROUTES
// =============================================================================

// GET all properties
app.get("/properties", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT p.*, u.name as owner_name, c.name as category_name 
      FROM properties p 
      LEFT JOIN users u ON p.user_id = u.id 
      LEFT JOIN categories c ON p.category_id = c.id 
      ORDER BY p.created_at DESC
    `)
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    })
  } catch (error) {
    console.error("Error fetching properties:", error)
    res.status(500).json({
      success: false,
      error: "Failed to fetch properties",
      message: error.message
    })
  }
})

// GET property by ID
app.get("/properties/:id", async (req, res) => {
  try {
    const { id } = req.params
    const result = await db.query(`
      SELECT p.*, u.name as owner_name, c.name as category_name 
      FROM properties p 
      LEFT JOIN users u ON p.user_id = u.id 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.id = $1
    `, [id])
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Property not found"
      })
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error("Error fetching property:", error)
    res.status(500).json({
      success: false,
      error: "Failed to fetch property",
      message: error.message
    })
  }
})

// POST create new property
app.post("/properties", async (req, res) => {
  try {
    const { title, description, location, price, user_id, category_id, bedrooms, bathrooms, square_feet } = req.body
    
    if (!title || !description || !location || !price || !user_id) {
      return res.status(400).json({
        success: false,
        error: "Title, description, location, price, and user_id are required"
      })
    }
    
    const result = await db.query(
      "INSERT INTO properties (title, description, location, price, user_id, category_id, bedrooms, bathrooms, square_feet) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *",
      [title, description, location, price, user_id, category_id, bedrooms, bathrooms, square_feet]
    )
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: "Property created successfully"
    })
  } catch (error) {
    console.error("Error creating property:", error)
    res.status(500).json({
      success: false,
      error: "Failed to create property",
      message: error.message
    })
  }
})

// PUT update property
app.put("/properties/:id", async (req, res) => {
  try {
    const { id } = req.params
    const { title, description, location, price, category_id, bedrooms, bathrooms, square_feet } = req.body
    
    const result = await db.query(
      "UPDATE properties SET title = COALESCE($1, title), description = COALESCE($2, description), location = COALESCE($3, location), price = COALESCE($4, price), category_id = COALESCE($5, category_id), bedrooms = COALESCE($6, bedrooms), bathrooms = COALESCE($7, bathrooms), square_feet = COALESCE($8, square_feet), updated_at = CURRENT_TIMESTAMP WHERE id = $9 RETURNING *",
      [title, description, location, price, category_id, bedrooms, bathrooms, square_feet, id]
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Property not found"
      })
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: "Property updated successfully"
    })
  } catch (error) {
    console.error("Error updating property:", error)
    res.status(500).json({
      success: false,
      error: "Failed to update property",
      message: error.message
    })
  }
})

// PATCH update property
app.patch("/properties/:id", async (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body
    
    const setClause = Object.keys(updates).map((key, index) => `${key} = $${index + 1}`).join(', ')
    const values = Object.values(updates)
    values.push(id)
    
    const query = `UPDATE properties SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length} RETURNING *`
    
    const result = await db.query(query, values)
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Property not found"
      })
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: "Property updated successfully"
    })
  } catch (error) {
    console.error("Error updating property:", error)
    res.status(500).json({
      success: false,
      error: "Failed to update property",
      message: error.message
    })
  }
})

// DELETE property
app.delete("/properties/:id", async (req, res) => {
  try {
    const { id } = req.params
    
    const result = await db.query("DELETE FROM properties WHERE id = $1 RETURNING *", [id])
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Property not found"
      })
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: "Property deleted successfully"
    })
  } catch (error) {
    console.error("Error deleting property:", error)
    res.status(500).json({
      success: false,
      error: "Failed to delete property",
      message: error.message
    })
  }
})

// =============================================================================
// VOTES ROUTES
// =============================================================================

// GET all votes
app.get("/votes", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT v.*, u.name as voter_name, p.title as property_title, vo.option_text as vote_option_text 
      FROM votes v 
      LEFT JOIN users u ON v.user_id = u.id 
      LEFT JOIN properties p ON v.property_id = p.id 
      LEFT JOIN vote_options vo ON v.vote_option_id = vo.id 
      ORDER BY v.created_at DESC
    `)
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    })
  } catch (error) {
    console.error("Error fetching votes:", error)
    res.status(500).json({
      success: false,
      error: "Failed to fetch votes",
      message: error.message
    })
  }
})

// GET votes by property ID
app.get("/votes/property/:propertyId", async (req, res) => {
  try {
    const { propertyId } = req.params
    const result = await db.query(`
      SELECT v.*, u.name as voter_name, vo.option_text as vote_option_text 
      FROM votes v 
      LEFT JOIN users u ON v.user_id = u.id 
      LEFT JOIN vote_options vo ON v.vote_option_id = vo.id 
      WHERE v.property_id = $1 
      ORDER BY v.created_at DESC
    `, [propertyId])
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    })
  } catch (error) {
    console.error("Error fetching votes for property:", error)
    res.status(500).json({
      success: false,
      error: "Failed to fetch votes for property",
      message: error.message
    })
  }
})

// GET votes by user ID
app.get("/votes/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params
    const result = await db.query(`
      SELECT v.*, p.title as property_title, vo.option_text as vote_option_text 
      FROM votes v 
      LEFT JOIN properties p ON v.property_id = p.id 
      LEFT JOIN vote_options vo ON v.vote_option_id = vo.id 
      WHERE v.user_id = $1 
      ORDER BY v.created_at DESC
    `, [userId])
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    })
  } catch (error) {
    console.error("Error fetching votes for user:", error)
    res.status(500).json({
      success: false,
      error: "Failed to fetch votes for user",
      message: error.message
    })
  }
})

// POST create new vote
app.post("/votes", async (req, res) => {
  try {
    const { user_id, property_id, vote_option_id, comment } = req.body
    
    if (!user_id || !property_id || !vote_option_id) {
      return res.status(400).json({
        success: false,
        error: "User ID, property ID, and vote option ID are required"
      })
    }
    
    // Check if user has already voted for this property
    const existingVote = await db.query(
      "SELECT * FROM votes WHERE user_id = $1 AND property_id = $2",
      [user_id, property_id]
    )
    
    if (existingVote.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: "User has already voted for this property"
      })
    }
    
    const result = await db.query(
      "INSERT INTO votes (user_id, property_id, vote_option_id, comment) VALUES ($1, $2, $3, $4) RETURNING *",
      [user_id, property_id, vote_option_id, comment]
    )
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: "Vote created successfully"
    })
  } catch (error) {
    console.error("Error creating vote:", error)
    res.status(500).json({
      success: false,
      error: "Failed to create vote",
      message: error.message
    })
  }
})

// PUT update vote
app.put("/votes/:id", async (req, res) => {
  try {
    const { id } = req.params
    const { vote_option_id, comment } = req.body
    
    const result = await db.query(
      "UPDATE votes SET vote_option_id = COALESCE($1, vote_option_id), comment = COALESCE($2, comment), updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *",
      [vote_option_id, comment, id]
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Vote not found"
      })
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: "Vote updated successfully"
    })
  } catch (error) {
    console.error("Error updating vote:", error)
    res.status(500).json({
      success: false,
      error: "Failed to update vote",
      message: error.message
    })
  }
})

// DELETE vote
app.delete("/votes/:id", async (req, res) => {
  try {
    const { id } = req.params
    
    const result = await db.query("DELETE FROM votes WHERE id = $1 RETURNING *", [id])
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Vote not found"
      })
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: "Vote deleted successfully"
    })
  } catch (error) {
    console.error("Error deleting vote:", error)
    res.status(500).json({
      success: false,
      error: "Failed to delete vote",
      message: error.message
    })
  }
})

// =============================================================================
// PROPERTY IMAGES ROUTES
// =============================================================================

// GET all property images
app.get("/property_images", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT pi.*, p.title as property_title 
      FROM property_images pi 
      LEFT JOIN properties p ON pi.property_id = p.id 
      ORDER BY pi.created_at DESC
    `)
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    })
  } catch (error) {
    console.error("Error fetching property images:", error)
    res.status(500).json({
      success: false,
      error: "Failed to fetch property images",
      message: error.message
    })
  }
})

// GET property images by property ID
app.get("/property_images/property/:propertyId", async (req, res) => {
  try {
    const { propertyId } = req.params
    const result = await db.query(
      "SELECT * FROM property_images WHERE property_id = $1 ORDER BY created_at DESC",
      [propertyId]
    )
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    })
  } catch (error) {
    console.error("Error fetching property images:", error)
    res.status(500).json({
      success: false,
      error: "Failed to fetch property images",
      message: error.message
    })
  }
})

// GET property image by ID
app.get("/property_images/:id", async (req, res) => {
  try {
    const { id } = req.params
    const result = await db.query(
      "SELECT * FROM property_images WHERE id = $1",
      [id]
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Property image not found"
      })
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error("Error fetching property image:", error)
    res.status(500).json({
      success: false,
      error: "Failed to fetch property image",
      message: error.message
    })
  }
})

// POST create new property image
app.post("/property_images", async (req, res) => {
  try {
    const { property_id, image_url, alt_text, is_primary } = req.body
    
    if (!property_id || !image_url) {
      return res.status(400).json({
        success: false,
        error: "Property ID and image URL are required"
      })
    }
    
    const result = await db.query(
      "INSERT INTO property_images (property_id, image_url, alt_text, is_primary) VALUES ($1, $2, $3, $4) RETURNING *",
      [property_id, image_url, alt_text, is_primary || false]
    )
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: "Property image created successfully"
    })
  } catch (error) {
    console.error("Error creating property image:", error)
    res.status(500).json({
      success: false,
      error: "Failed to create property image",
      message: error.message
    })
  }
})

// PUT update property image
app.put("/property_images/:id", async (req, res) => {
  try {
    const { id } = req.params
    const { image_url, alt_text, is_primary } = req.body
    
    const result = await db.query(
      "UPDATE property_images SET image_url = COALESCE($1, image_url), alt_text = COALESCE($2, alt_text), is_primary = COALESCE($3, is_primary), updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *",
      [image_url, alt_text, is_primary, id]
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Property image not found"
      })
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: "Property image updated successfully"
    })
  } catch (error) {
    console.error("Error updating property image:", error)
    res.status(500).json({
      success: false,
      error: "Failed to update property image",
      message: error.message
    })
  }
})

// DELETE property image
app.delete("/property_images/:id", async (req, res) => {
  try {
    const { id } = req.params
    
    const result = await db.query("DELETE FROM property_images WHERE id = $1 RETURNING *", [id])
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Property image not found"
      })
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: "Property image deleted successfully"
    })
  } catch (error) {
    console.error("Error deleting property image:", error)
    res.status(500).json({
      success: false,
      error: "Failed to delete property image",
      message: error.message
    })
  }
})

// =============================================================================
// CATEGORIES ROUTES (READ-ONLY)
// =============================================================================

// GET all categories
app.get("/categories", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM categories ORDER BY name ASC")
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    })
  } catch (error) {
    console.error("Error fetching categories:", error)
    res.status(500).json({
      success: false,
      error: "Failed to fetch categories",
      message: error.message
    })
  }
})

// GET category by ID
app.get("/categories/:id", async (req, res) => {
  try {
    const { id } = req.params
    const result = await db.query("SELECT * FROM categories WHERE id = $1", [id])
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Category not found"
      })
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error("Error fetching category:", error)
    res.status(500).json({
      success: false,
      error: "Failed to fetch category",
      message: error.message
    })
  }
})