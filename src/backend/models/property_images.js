const express = require('express');
const db = require('../config/db');

const router = express.Router();

/**
 * @route   GET /api/property_images
 * @desc    Get all property images with pagination
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const { limit = 100, offset = 0, property_id } = req.query;
    
    let query = `
      SELECT pi.id, pi.property_id, pi.image_url, pi.alt_text, pi.is_primary, 
             pi.display_order, pi.created_at, pi.updated_at,
             p.title as property_title
      FROM property_images pi
      LEFT JOIN properties p ON pi.property_id = p.id
    `;
    
    const params = [];
    
    if (property_id) {
      query += ` WHERE pi.property_id = $1`;
      params.push(property_id);
    }
    
    query += ` ORDER BY pi.property_id, pi.display_order, pi.created_at LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await db.query(query, params);
    
    res.status(200).json({
      property_images: result.rows,
      count: result.rows.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error getting property images:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Error retrieving property images'
    });
  }
});

/**
 * @route   GET /api/property_images/:id
 * @desc    Get property image by ID
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  try {
    const imageId = parseInt(req.params.id);
    
    const result = await db.query(`
      SELECT pi.id, pi.property_id, pi.image_url, pi.alt_text, pi.is_primary, 
             pi.display_order, pi.created_at, pi.updated_at,
             p.title as property_title
      FROM property_images pi
      LEFT JOIN properties p ON pi.property_id = p.id
      WHERE pi.id = $1
    `, [imageId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Property image not found'
      });
    }
    
    res.status(200).json({
      property_image: result.rows[0]
    });
  } catch (error) {
    console.error('Error getting property image by ID:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Error retrieving property image'
    });
  }
});

/**
 * @route   POST /api/property_images
 * @desc    Create a new property image
 * @access  Private
 */
router.post('/', async (req, res) => {
  try {
    const { property_id, image_url, alt_text, is_primary = false, display_order = 0 } = req.body;
    
    // Validate required fields
    if (!property_id || !image_url) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'property_id and image_url are required'
      });
    }
    
    // If this is set as primary, unset other primary images for this property
    if (is_primary) {
      await db.query(
        'UPDATE property_images SET is_primary = false WHERE property_id = $1',
        [property_id]
      );
    }
    
    const result = await db.query(`
      INSERT INTO property_images (property_id, image_url, alt_text, is_primary, display_order, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, property_id, image_url, alt_text, is_primary, display_order, created_at, updated_at
    `, [property_id, image_url, alt_text, is_primary, display_order]);
    
    res.status(201).json({
      message: 'Property image created successfully',
      property_image: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating property image:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Error creating property image'
    });
  }
});

/**
 * @route   PATCH/PUT /api/property_images/:id
 * @desc    Update property image by ID
 * @access  Private
 */
router.patch('/:id', updatePropertyImage);
router.put('/:id', updatePropertyImage);

async function updatePropertyImage(req, res) {
  try {
    const imageId = parseInt(req.params.id);
    const { image_url, alt_text, is_primary, display_order } = req.body;
    
    // Build dynamic update query
    const updates = [];
    const params = [];
    let paramCount = 1;
    
    if (image_url !== undefined) {
      updates.push(`image_url = $${paramCount}`);
      params.push(image_url);
      paramCount++;
    }
    
    if (alt_text !== undefined) {
      updates.push(`alt_text = $${paramCount}`);
      params.push(alt_text);
      paramCount++;
    }
    
    if (is_primary !== undefined) {
      updates.push(`is_primary = $${paramCount}`);
      params.push(is_primary);
      paramCount++;
      
      // If setting as primary, unset other primary images for this property
      if (is_primary) {
        const propertyResult = await db.query('SELECT property_id FROM property_images WHERE id = $1', [imageId]);
        if (propertyResult.rows.length > 0) {
          await db.query(
            'UPDATE property_images SET is_primary = false WHERE property_id = $1 AND id != $2',
            [propertyResult.rows[0].property_id, imageId]
          );
        }
      }
    }
    
    if (display_order !== undefined) {
      updates.push(`display_order = $${paramCount}`);
      params.push(display_order);
      paramCount++;
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'No fields to update provided'
      });
    }
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(imageId);
    
    const query = `
      UPDATE property_images 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, property_id, image_url, alt_text, is_primary, display_order, created_at, updated_at
    `;
    
    const result = await db.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Property image not found'
      });
    }
    
    res.status(200).json({
      message: 'Property image updated successfully',
      property_image: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating property image:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Error updating property image'
    });
  }
}

/**
 * @route   DELETE /api/property_images/:id
 * @desc    Delete property image by ID
 * @access  Private
 */
router.delete('/:id', async (req, res) => {
  try {
    const imageId = parseInt(req.params.id);
    
    const result = await db.query(
      'DELETE FROM property_images WHERE id = $1 RETURNING id, property_id',
      [imageId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Property image not found'
      });
    }
    
    res.status(200).json({
      message: 'Property image deleted successfully',
      deleted_id: imageId
    });
  } catch (error) {
    console.error('Error deleting property image:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Error deleting property image'
    });
  }
});

module.exports = router;