const express = require("express")
const db = require("../config/db")
const PropertyModel = require("../models/propertyModel")
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
    const { page = 1, limit = 10, category_id, location, minPrice, maxPrice } = req.query
    
    const offset = (page - 1) * limit;
    
    // Build options for PropertyModel.getProperties
    const options = {
      limit: parseInt(limit),
      offset: offset,
      category_id: category_id ? parseInt(category_id) : null,
      search: location || null,
      sort_by: 'created_at',
      sort_order: 'DESC'
    }
    
    // Add price filters if provided
    if (minPrice) {
      options.min_worth = parseFloat(minPrice);
    }
    
    if (maxPrice) {
      options.max_worth = parseFloat(maxPrice);
    }
    
    const result = await PropertyModel.getProperties(options);
    
    res.json({
      properties: result.properties,
      pagination: {
        currentPage: result.page,
        totalPages: result.pages,
        totalCount: result.total,
        hasNext: result.page < result.pages,
        hasPrev: result.page > 1,
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
    
    // Get property with all related data
    const property = await PropertyModel.getPropertyById(parseInt(id));
    
    if (!property) {
      return res.status(404).json({
        error: "Property not found",
      })
    }

    // Get user's vote if authenticated
    let userVote = null
    if (req.user) {
      const voteResult = await db.query(
        `SELECT vo.name FROM votes v
         JOIN vote_options vo ON v.vote_option_id = vo.id
         WHERE v.property_id = $1 AND v.user_id = $2`,
        [id, req.user.userId]
      );

      if (voteResult.rows.length > 0) {
        userVote = voteResult.rows[0].name;
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
    const { 
      title, 
      description, 
      location, 
      category_id, 
      current_worth, 
      year_of_construction,
      images = [] 
    } = req.body

    // Validate required fields
    if (!title || !description || !location || !category_id) {
      return res.status(400).json({
        error: "Required fields: title, description, location, and category_id",
      })
    }

    // Create property using the model
    const propertyData = {
      title,
      description,
      location,
      category_id: parseInt(category_id),
      user_id: req.user.userId,
      current_worth: current_worth ? parseFloat(current_worth) : null,
      year_of_construction: year_of_construction ? parseInt(year_of_construction) : null,
      images
    };
    
    const property = await PropertyModel.createProperty(propertyData);

    res.status(201).json({
      message: "Property created successfully",
      property,
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
    const { 
      title, 
      description, 
      location, 
      category_id, 
      current_worth, 
      year_of_construction,
      images 
    } = req.body

    // Check if property exists and belongs to user
    const existingProperty = await db.query(
      "SELECT * FROM properties WHERE id = $1 AND user_id = $2", 
      [id, req.user.userId]
    );

    if (existingProperty.rows.length === 0) {
      return res.status(404).json({
        error: "Property not found or you don't have permission to edit it",
      })
    }

    // Build update data
    const updateData = {};
    
    if (title) updateData.title = title;
    if (description) updateData.description = description;
    if (location) updateData.location = location;
    if (category_id) updateData.category_id = parseInt(category_id);
    if (current_worth !== undefined) updateData.current_worth = current_worth ? parseFloat(current_worth) : null;
    if (year_of_construction !== undefined) updateData.year_of_construction = year_of_construction ? parseInt(year_of_construction) : null;
    if (images) updateData.images = images;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        error: "No fields to update",
      })
    }

    // Update property
    const property = await PropertyModel.updateProperty(parseInt(id), updateData);

    res.json({
      message: "Property updated successfully",
      property,
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

    // Delete property and check if it existed and belonged to user
    const deleted = await PropertyModel.deleteProperty(parseInt(id));
    
    if (!deleted) {
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
    const options = {
      user_id: req.user.userId,
      limit: 100, // Higher limit for user's own properties
      offset: 0
    };
    
    const result = await PropertyModel.getProperties(options);

    res.json({
      properties: result.properties,
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
