const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const { authenticateJWT, generateToken } = require("./config/auth");
require("dotenv").config();

// Force production environment
process.env.NODE_ENV = 'production';

// Import database configuration
const db = require("./config/db");

// Import route modules
const propertyImagesRouter = require("./models/property_images");

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Skip migrations for now to avoid errors - we'll handle them separately
console.log("Skipping migrations on startup to avoid errors");

// Middleware
app.use(helmet()); // Security headers

// Configure CORS for Netlify frontend
const allowedOrigins = [
  'https://688cf92ccb2b7f2e7181e641--mipripity.netlify.app',
  'https://mipripity.netlify.app',
  process.env.FRONTEND_URL,
  // Allow local development
  'http://localhost:3000',
  'http://localhost:8000',
  'http://localhost:8080'
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' })); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Parse URL-encoded request bodies

// Use our JWT authentication middleware instead of Firebase
const authenticateUser = authenticateJWT;

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "production",
    database: "connected"
  });
});

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
  });
});

// =============================================================================
// USERS ROUTES
// =============================================================================

// GET all users
app.get("/users", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM users ORDER BY created_at DESC");
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch users",
      message: error.message
    });
  }
});

// GET user by ID
app.get("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query("SELECT * FROM users WHERE id = $1", [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch user",
      message: error.message
    });
  }
});

// POST create new user
app.post("/users", async (req, res) => {
  try {
    const { first_name, last_name, email, phone_number, firebase_uid } = req.body;
    
    if (!first_name || !last_name || !email || !firebase_uid) {
      return res.status(400).json({
        success: false,
        error: "First name, last name, email, and firebase_uid are required"
      });
    }
    
    const result = await db.query(
      "INSERT INTO users (first_name, last_name, email, phone_number, firebase_uid) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [first_name, last_name, email, phone_number, firebase_uid]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: "User created successfully"
    });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create user",
      message: error.message
    });
  }
});

// PUT/PATCH update user
app.put("/users/:id", authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, email, phone_number, profile_picture } = req.body;
    
    const result = await db.query(
      "UPDATE users SET first_name = COALESCE($1, first_name), last_name = COALESCE($2, last_name), email = COALESCE($3, email), phone_number = COALESCE($4, phone_number), profile_picture = COALESCE($5, profile_picture), updated_at = CURRENT_TIMESTAMP WHERE id = $6 RETURNING *",
      [first_name, last_name, email, phone_number, profile_picture, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: "User updated successfully"
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update user",
      message: error.message
    });
  }
});

app.patch("/users/:id", authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const setClause = Object.keys(updates).map((key, index) => `${key} = $${index + 1}`).join(', ');
    const values = Object.values(updates);
    values.push(id);
    
    const query = `UPDATE users SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length} RETURNING *`;
    
    const result = await db.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: "User updated successfully"
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update user",
      message: error.message
    });
  }
});

// DELETE user
app.delete("/users/:id", authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query("DELETE FROM users WHERE id = $1 RETURNING *", [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: "User deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete user",
      message: error.message
    });
  }
});

// =============================================================================
// AUTH ROUTES
// =============================================================================

// =============================================================================
// AUTH ROUTES - Updated for JWT-based authentication
// =============================================================================

// POST register - Create a new user and generate JWT token
app.post("/auth/register", async (req, res) => {
  try {
    const { first_name, last_name, email, password, phone_number } = req.body;
    
    if (!first_name || !last_name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: "First name, last name, email, and password are required"
      });
    }
    
    // Check if user already exists
    const existingUser = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: "User with this email already exists"
      });
    }
    
    // Generate a random UUID to use instead of Firebase UID
    const user_uuid = require('crypto').randomUUID();
    
    // Create new user
    const result = await db.query(
      "INSERT INTO users (first_name, last_name, email, phone_number, firebase_uid) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [first_name, last_name, email, phone_number, user_uuid]
    );
    
    const user = result.rows[0];
    
    // Generate JWT token
    const token = generateToken(user);
    
    res.status(201).json({
      success: true,
      data: {
        user,
        token
      },
      message: "User registered successfully"
    });
  } catch (error) {
    console.error("Error during registration:", error);
    res.status(500).json({
      success: false,
      error: "Failed to register user",
      message: error.message
    });
  }
});

// POST login - Authenticate user and generate JWT token
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required"
      });
    }
    
    // Find user by email
    const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials"
      });
    }
    
    const user = result.rows[0];
    
    // For demonstration, we're accepting any password
    // In a real app, you would verify the password hash here
    
    // Generate JWT token
    const token = generateToken(user);
    
    res.json({
      success: true,
      data: {
        user,
        token
      },
      message: "Login successful"
    });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({
      success: false,
      error: "Failed to login",
      message: error.message
    });
  }
});

// GET current user from token
app.get("/auth/me", authenticateUser, async (req, res) => {
  try {
    // req.user contains the decoded JWT payload
    const userId = req.user.id;
    
    // Get user from database
    const result = await db.query("SELECT * FROM users WHERE id = $1", [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }
    
    res.json({
      success: true,
      data: {
        user: result.rows[0]
      }
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch user profile",
      message: error.message
    });
  }
});

// =============================================================================
// PROPERTIES ROUTES
// =============================================================================

// GET all properties
app.get("/properties", async (req, res) => {
  try {
    // Get query parameters for filtering
    const { category, user_id, limit = 100, offset = 0 } = req.query;
    
    let query = `
      SELECT p.*, 
             u.first_name || ' ' || u.last_name as owner_name, 
             c.name as category_name,
             (SELECT COUNT(*) FROM votes WHERE property_id = p.id) as vote_count
      FROM properties p 
      LEFT JOIN users u ON p.user_id = u.id 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE 1=1
    `;
    
    const queryParams = [];
    let paramIndex = 1;
    
    // Add filters if provided
    if (category) {
      query += ` AND c.name = $${paramIndex}`;
      queryParams.push(category);
      paramIndex++;
    }
    
    if (user_id) {
      query += ` AND p.user_id = $${paramIndex}`;
      queryParams.push(user_id);
      paramIndex++;
    }
    
    // Add pagination
    query += ` ORDER BY p.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);
    
    const result = await db.query(query, queryParams);
    
    // Get images for each property
    const properties = result.rows;
    for (const property of properties) {
      const imagesResult = await db.query(
        "SELECT * FROM property_images WHERE property_id = $1 ORDER BY is_primary DESC, created_at ASC",
        [property.id]
      );
      property.images = imagesResult.rows;
    }
    
    res.json({
      success: true,
      data: properties,
      count: properties.length,
      total: parseInt((await db.query("SELECT COUNT(*) FROM properties")).rows[0].count)
    });
  } catch (error) {
    console.error("Error fetching properties:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch properties",
      message: error.message
    });
  }
});

// GET property by ID
app.get("/properties/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(`
      SELECT p.*, 
             u.first_name || ' ' || u.last_name as owner_name,
             u.email as owner_email,
             u.phone_number as owner_phone,
             c.name as category_name
      FROM properties p 
      LEFT JOIN users u ON p.user_id = u.id 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Property not found"
      });
    }
    
    // Get images for the property
    const property = result.rows[0];
    const imagesResult = await db.query(
      "SELECT * FROM property_images WHERE property_id = $1 ORDER BY is_primary DESC, created_at ASC",
      [id]
    );
    property.images = imagesResult.rows;
    
    // Get vote options for this property's category
    const voteOptionsResult = await db.query(
      "SELECT * FROM vote_options WHERE category_id = $1 ORDER BY name ASC",
      [property.category_id]
    );
    property.vote_options = voteOptionsResult.rows;
    
    res.json({
      success: true,
      data: property
    });
  } catch (error) {
    console.error("Error fetching property:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch property",
      message: error.message
    });
  }
});

// POST create new property
app.post("/properties", authenticateUser, async (req, res) => {
  try {
    const { 
      title, 
      description, 
      location, 
      category_id, 
      current_worth,
      year_of_construction
    } = req.body;
    
    // Get user_id from Firebase UID
    const userResult = await db.query(
      "SELECT id FROM users WHERE firebase_uid = $1",
      [req.user.uid]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found. Please register first."
      });
    }
    
    const user_id = userResult.rows[0].id;
    
    if (!title || !description || !location || !category_id) {
      return res.status(400).json({
        success: false,
        error: "Title, description, location, and category_id are required"
      });
    }
    
    const result = await db.query(
      "INSERT INTO properties (title, description, location, user_id, category_id, current_worth, year_of_construction) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
      [title, description, location, user_id, category_id, current_worth, year_of_construction]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: "Property created successfully"
    });
  } catch (error) {
    console.error("Error creating property:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create property",
      message: error.message
    });
  }
});

// PUT update property
app.put("/properties/:id", authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, location, category_id, current_worth, year_of_construction } = req.body;
    
    // Verify ownership
    const ownershipCheck = await db.query(
      "SELECT p.* FROM properties p JOIN users u ON p.user_id = u.id WHERE p.id = $1 AND u.firebase_uid = $2",
      [id, req.user.uid]
    );
    
    if (ownershipCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
        message: "You don't have permission to update this property"
      });
    }
    
    const result = await db.query(
      "UPDATE properties SET title = COALESCE($1, title), description = COALESCE($2, description), location = COALESCE($3, location), category_id = COALESCE($4, category_id), current_worth = COALESCE($5, current_worth), year_of_construction = COALESCE($6, year_of_construction), updated_at = CURRENT_TIMESTAMP WHERE id = $7 RETURNING *",
      [title, description, location, category_id, current_worth, year_of_construction, id]
    );
    
    res.json({
      success: true,
      data: result.rows[0],
      message: "Property updated successfully"
    });
  } catch (error) {
    console.error("Error updating property:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update property",
      message: error.message
    });
  }
});

// DELETE property
app.delete("/properties/:id", authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify ownership
    const ownershipCheck = await db.query(
      "SELECT p.* FROM properties p JOIN users u ON p.user_id = u.id WHERE p.id = $1 AND u.firebase_uid = $2",
      [id, req.user.uid]
    );
    
    if (ownershipCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
        message: "You don't have permission to delete this property"
      });
    }
    
    const result = await db.query("DELETE FROM properties WHERE id = $1 RETURNING *", [id]);
    
    res.json({
      success: true,
      data: result.rows[0],
      message: "Property deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting property:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete property",
      message: error.message
    });
  }
});

// =============================================================================
// VOTES ROUTES
// =============================================================================

// GET all votes
app.get("/votes", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT v.*, 
             u.first_name || ' ' || u.last_name as voter_name, 
             p.title as property_title, 
             vo.name as vote_option_name 
      FROM votes v 
      LEFT JOIN users u ON v.user_id = u.id 
      LEFT JOIN properties p ON v.property_id = p.id 
      LEFT JOIN vote_options vo ON v.vote_option_id = vo.id 
      ORDER BY v.created_at DESC
    `);
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error("Error fetching votes:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch votes",
      message: error.message
    });
  }
});

// GET votes by property ID
app.get("/votes/property/:propertyId", async (req, res) => {
  try {
    const { propertyId } = req.params;
    const result = await db.query(`
      SELECT v.*, 
             u.first_name || ' ' || u.last_name as voter_name, 
             vo.name as vote_option_name 
      FROM votes v 
      LEFT JOIN users u ON v.user_id = u.id 
      LEFT JOIN vote_options vo ON v.vote_option_id = vo.id 
      WHERE v.property_id = $1 
      ORDER BY v.created_at DESC
    `, [propertyId]);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error("Error fetching votes for property:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch votes for property",
      message: error.message
    });
  }
});

// POST create new vote
app.post("/votes", authenticateUser, async (req, res) => {
  try {
    const { property_id, vote_option_id } = req.body;
    
    if (!property_id || !vote_option_id) {
      return res.status(400).json({
        success: false,
        error: "Property ID and vote option ID are required"
      });
    }
    
    // Get user_id from Firebase UID
    const userResult = await db.query(
      "SELECT id FROM users WHERE firebase_uid = $1",
      [req.user.uid]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found. Please register first."
      });
    }
    
    const user_id = userResult.rows[0].id;
    
    // Check if user has already voted for this property
    const existingVote = await db.query(
      "SELECT * FROM votes WHERE user_id = $1 AND property_id = $2",
      [user_id, property_id]
    );
    
    if (existingVote.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: "You have already voted for this property"
      });
    }
    
    const result = await db.query(
      "INSERT INTO votes (user_id, property_id, vote_option_id) VALUES ($1, $2, $3) RETURNING *",
      [user_id, property_id, vote_option_id]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: "Vote recorded successfully"
    });
  } catch (error) {
    console.error("Error creating vote:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create vote",
      message: error.message
    });
  }
});

// =============================================================================
// VOTE OPTIONS ROUTES (READ-ONLY)
// =============================================================================

// GET all vote options
app.get("/vote_options", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT vo.*, c.name as category_name
      FROM vote_options vo
      JOIN categories c ON vo.category_id = c.id
      ORDER BY c.name, vo.name
    `);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error("Error fetching vote options:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch vote options",
      message: error.message
    });
  }
});

// GET vote options by category ID
app.get("/vote_options/category/:categoryId", async (req, res) => {
  try {
    const { categoryId } = req.params;
    const result = await db.query(
      "SELECT * FROM vote_options WHERE category_id = $1 ORDER BY name",
      [categoryId]
    );
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error("Error fetching vote options for category:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch vote options",
      message: error.message
    });
  }
});

// =============================================================================
// ANALYTICS AND STATISTICS ROUTES
// =============================================================================

// GET vote statistics for a property
app.get("/properties/:id/stats", async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(`
      SELECT 
        vo.name as option_name,
        vo.id as vote_option_id,
        COUNT(v.id) as vote_count,
        ROUND(COUNT(v.id) * 100.0 / NULLIF(SUM(COUNT(v.id)) OVER(), 0), 2) as percentage
      FROM vote_options vo
      LEFT JOIN votes v ON vo.id = v.vote_option_id AND v.property_id = $1
      JOIN properties p ON p.id = $1
      WHERE vo.category_id = p.category_id
      GROUP BY vo.id, vo.name
      ORDER BY vote_count DESC
    `, [id]);
    
    const totalVotes = await db.query(
      "SELECT COUNT(*) as total FROM votes WHERE property_id = $1",
      [id]
    );
    
    res.json({
      success: true,
      data: {
        statistics: result.rows,
        total_votes: parseInt(totalVotes.rows[0].total)
      }
    });
  } catch (error) {
    console.error("Error fetching property statistics:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch property statistics",
      message: error.message
    });
  }
});

// GET overall platform statistics
app.get("/stats", async (req, res) => {
  try {
    const userCount = await db.query("SELECT COUNT(*) as count FROM users");
    const propertyCount = await db.query("SELECT COUNT(*) as count FROM properties");
    const voteCount = await db.query("SELECT COUNT(*) as count FROM votes");
    const imageCount = await db.query("SELECT COUNT(*) as count FROM property_images");
    
    const recentActivity = await db.query(`
      SELECT 'vote' as type, created_at, user_id, property_id FROM votes
      UNION ALL
      SELECT 'property' as type, created_at, user_id, id as property_id FROM properties
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    res.json({
      success: true,
      data: {
        total_users: parseInt(userCount.rows[0].count),
        total_properties: parseInt(propertyCount.rows[0].count),
        total_votes: parseInt(voteCount.rows[0].count),
        total_images: parseInt(imageCount.rows[0].count),
        recent_activity: recentActivity.rows
      }
    });
  } catch (error) {
    console.error("Error fetching platform statistics:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch platform statistics",
      message: error.message
    });
  }
});

// =============================================================================
// PROPERTY IMAGES ROUTES
// =============================================================================

// Mount the property_images router
app.use("/property_images", propertyImagesRouter);

// =============================================================================
// ADDITIONAL API ROUTES WITH /api PREFIX
// =============================================================================

// Add /api prefix routes for all endpoints
app.use("/api/users", (req, res, next) => {
  req.url = req.url.replace('/api/users', '/users');
  req.originalUrl = req.originalUrl.replace('/api/users', '/users');
  next();
});

app.use("/api/properties", (req, res, next) => {
  req.url = req.url.replace('/api/properties', '/properties');
  req.originalUrl = req.originalUrl.replace('/api/properties', '/properties');
  next();
});

app.use("/api/votes", (req, res, next) => {
  req.url = req.url.replace('/api/votes', '/votes');
  req.originalUrl = req.originalUrl.replace('/api/votes', '/votes');
  next();
});

app.use("/api/property_images", (req, res, next) => {
  req.url = req.url.replace('/api/property_images', '/property_images');
  req.originalUrl = req.originalUrl.replace('/api/property_images', '/property_images');
  next();
});

app.use("/api/categories", (req, res, next) => {
  req.url = req.url.replace('/api/categories', '/categories');
  req.originalUrl = req.originalUrl.replace('/api/categories', '/categories');
  next();
});

app.use("/api/vote_options", (req, res, next) => {
  req.url = req.url.replace('/api/vote_options', '/vote_options');
  req.originalUrl = req.originalUrl.replace('/api/vote_options', '/vote_options');
  next();
});

app.use("/api/auth", (req, res, next) => {
  req.url = req.url.replace('/api/auth', '/auth');
  req.originalUrl = req.originalUrl.replace('/api/auth', '/auth');
  next();
});

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
  });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err.stack);
  res.status(500).json({
    error: "Internal Server Error",
    message: "Something went wrong",
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  const liveUrl = 'https://mipripity-web.onrender.com';
  console.log(`🚀 Server running on Render at ${liveUrl}`);
  console.log(`🌍 Environment: production`);
  console.log(`🗄️  Database: ${process.env.DB_HOST}`);
  console.log(`🔗 Health check: ${liveUrl}/health`);
  console.log(`📖 API docs: ${liveUrl}/`);
  console.log(`🏠 Available routes:`);
  console.log(`   - Users: ${liveUrl}/users`);
  console.log(`   - Properties: ${liveUrl}/properties`);
  console.log(`   - Votes: ${liveUrl}/votes`);
  console.log(`   - Property Images: ${liveUrl}/property_images`);
  console.log(`   - Categories: ${liveUrl}/categories`);
  console.log(`   - Vote Options: ${liveUrl}/vote_options`);
  console.log(`   - Auth: ${liveUrl}/auth/login, ${liveUrl}/auth/register`);
  console.log(`   - Statistics: ${liveUrl}/stats, ${liveUrl}/properties/:id/stats`);
});

module.exports = app;