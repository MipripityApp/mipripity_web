const express = require("express")
const db = require("../config/db")
const { authenticate, optionalAuth } = require("../middleware/authMiddleware")

const router = express.Router()

// Test route
router.get("/test", (req, res) => {
  res.json({
    message: "Properties routes working",
    timestamp: new Date().toISOString(),
  })
})

// Get all properties (public)
router.get("/", optionalAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10, category, location, minPrice, maxPrice } = req.query

    let query = `
      SELECT p.*, u.first_name, u.last_name,
             COUNT(v.id) as vote_count
      FROM properties p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN votes v ON p.id = v.property_id
      WHERE 1=1
    `
    const queryParams = []
    let paramCount = 0

    // Add filters
    if (category) {
      paramCount++
      query += ` AND p.category = $${paramCount}`
      queryParams.push(category)
    }

    if (location) {
      paramCount++
      query += ` AND p.location ILIKE $${paramCount}`
      queryParams.push(`%${location}%`)
    }

    if (minPrice) {
      paramCount++
      query += ` AND p.price >= $${paramCount}`
      queryParams.push(minPrice)
    }

    if (maxPrice) {
      paramCount++
      query += ` AND p.price <= $${paramCount}`
      queryParams.push(maxPrice)
    }

    query += `
      GROUP BY p.id, u.first_name, u.last_name
      ORDER BY p.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `

    queryParams.push(limit, (page - 1) * limit)

    const result = await db.query(query, queryParams)

    // Get total count for pagination
    let countQuery = "SELECT COUNT(*) FROM properties WHERE 1=1"
    const countParams = []
    let countParamCount = 0

    if (category) {
      countParamCount++
      countQuery += ` AND category = $${countParamCount}`
      countParams.push(category)
    }

    if (location) {
      countParamCount++
      countQuery += ` AND location ILIKE $${countParamCount}`
      countParams.push(`%${location}%`)
    }

    if (minPrice) {
      countParamCount++
      countQuery += ` AND price >= $${countParamCount}`
      countParams.push(minPrice)
    }

    if (maxPrice) {
      countParamCount++
      countQuery += ` AND price <= $${countParamCount}`
      countParams.push(maxPrice)
    }

    const countResult = await db.query(countQuery, countParams)
    const totalCount = Number.parseInt(countResult.rows[0].count)

    res.json({
      properties: result.rows,
      pagination: {
        currentPage: Number.parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNext: page * limit < totalCount,
        hasPrev: page > 1,
      },
    })
  } catch (error) {
    console.error("Error fetching properties:", error)
    res.status(500).json({
      error: "Failed to fetch properties",
      message: error.message,
    })
  }
})

// Get single property by ID (public)
router.get("/:id", optionalAuth, async (req, res) => {
  try {
    const { id } = req.params

    const result = await db.query(
      `SELECT p.*, u.first_name, u.last_name, u.email,
              COUNT(v.id) as vote_count,
              AVG(CASE WHEN v.vote_type = 'up' THEN 1 WHEN v.vote_type = 'down' THEN -1 ELSE 0 END) as avg_rating
       FROM properties p
       LEFT JOIN users u ON p.user_id = u.id
       LEFT JOIN votes v ON p.id = v.property_id
       WHERE p.id = $1
       GROUP BY p.id, u.first_name, u.last_name, u.email`,
      [id],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Property not found",
      })
    }

    const property = result.rows[0]

    // Get user's vote if authenticated
    let userVote = null
    if (req.user) {
      const voteResult = await db.query("SELECT vote_type FROM votes WHERE property_id = $1 AND user_id = $2", [
        id,
        req.user.userId,
      ])

      if (voteResult.rows.length > 0) {
        userVote = voteResult.rows[0].vote_type
      }
    }

    res.json({
      property,
      userVote,
    })
  } catch (error) {
    console.error("Error fetching property:", error)
    res.status(500).json({
      error: "Failed to fetch property",
      message: error.message,
    })
  }
})

// Create new property (protected)
router.post("/", authenticate, async (req, res) => {
  try {
    const { title, description, price, location, category, images = [] } = req.body

    // Validate required fields
    if (!title || !description || !price || !location || !category) {
      return res.status(400).json({
        error: "All fields are required",
      })
    }

    const result = await db.query(
      `INSERT INTO properties (user_id, title, description, price, location, category, images, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING *`,
      [req.user.userId, title, description, price, location, category, JSON.stringify(images)],
    )

    res.status(201).json({
      message: "Property created successfully",
      property: result.rows[0],
    })
  } catch (error) {
    console.error("Error creating property:", error)
    res.status(500).json({
      error: "Failed to create property",
      message: error.message,
    })
  }
})

// Update property (protected)
router.put("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params
    const { title, description, price, location, category, images } = req.body

    // Check if property exists and belongs to user
    const existingProperty = await db.query("SELECT * FROM properties WHERE id = $1 AND user_id = $2", [
      id,
      req.user.userId,
    ])

    if (existingProperty.rows.length === 0) {
      return res.status(404).json({
        error: "Property not found or you don't have permission to edit it",
      })
    }

    // Build update query dynamically
    const updates = []
    const values = [id, req.user.userId]
    let paramCount = 2

    if (title) {
      paramCount++
      updates.push(`title = $${paramCount}`)
      values.push(title)
    }

    if (description) {
      paramCount++
      updates.push(`description = $${paramCount}`)
      values.push(description)
    }

    if (price) {
      paramCount++
      updates.push(`price = $${paramCount}`)
      values.push(price)
    }

    if (location) {
      paramCount++
      updates.push(`location = $${paramCount}`)
      values.push(location)
    }

    if (category) {
      paramCount++
      updates.push(`category = $${paramCount}`)
      values.push(category)
    }

    if (images) {
      paramCount++
      updates.push(`images = $${paramCount}`)
      values.push(JSON.stringify(images))
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: "No fields to update",
      })
    }

    updates.push("updated_at = NOW()")

    const result = await db.query(
      `UPDATE properties SET ${updates.join(", ")} WHERE id = $1 AND user_id = $2 RETURNING *`,
      values,
    )

    res.json({
      message: "Property updated successfully",
      property: result.rows[0],
    })
  } catch (error) {
    console.error("Error updating property:", error)
    res.status(500).json({
      error: "Failed to update property",
      message: error.message,
    })
  }
})

// Delete property (protected)
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params

    // Check if property exists and belongs to user
    const result = await db.query("DELETE FROM properties WHERE id = $1 AND user_id = $2 RETURNING *", [
      id,
      req.user.userId,
    ])

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Property not found or you don't have permission to delete it",
      })
    }

    res.json({
      message: "Property deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting property:", error)
    res.status(500).json({
      error: "Failed to delete property",
      message: error.message,
    })
  }
})

// Get properties by user (protected)
router.get("/user/my-properties", authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT p.*, COUNT(v.id) as vote_count
       FROM properties p
       LEFT JOIN votes v ON p.id = v.property_id
       WHERE p.user_id = $1
       GROUP BY p.id
       ORDER BY p.created_at DESC`,
      [req.user.userId],
    )

    res.json({
      properties: result.rows,
    })
  } catch (error) {
    console.error("Error fetching user properties:", error)
    res.status(500).json({
      error: "Failed to fetch your properties",
      message: error.message,
    })
  }
})

module.exports = router
