const express = require('express');
const db = require('../config/db');

const router = express.Router();

/**
 * @route   GET /api/categories
 * @desc    Get all categories
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    
    const result = await db.query(`
      SELECT id, name, description, created_at, updated_at
      FROM categories
      ORDER BY name
      LIMIT $1 OFFSET $2
    `, [parseInt(limit), parseInt(offset)]);
    
    // Get count of properties per category
    const categoriesWithCounts = await Promise.all(
      result.rows.map(async (category) => {
        const countResult = await db.query(
          'SELECT COUNT(*) as property_count FROM properties WHERE category_id = $1',
          [category.id]
        );
        return {
          ...category,
          property_count: parseInt(countResult.rows[0].property_count)
        };
      })
    );
    
    res.status(200).json({
      categories: categoriesWithCounts,
      count: categoriesWithCounts.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error getting categories:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Error retrieving categories'
    });
  }
});

/**
 * @route   GET /api/categories/:id
 * @desc    Get category by ID
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);
    
    const result = await db.query(`
      SELECT id, name, description, created_at, updated_at
      FROM categories
      WHERE id = $1
    `, [categoryId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Category not found'
      });
    }
    
    // Get count of properties in this category
    const countResult = await db.query(
      'SELECT COUNT(*) as property_count FROM properties WHERE category_id = $1',
      [categoryId]
    );
    
    const category = {
      ...result.rows[0],
      property_count: parseInt(countResult.rows[0].property_count)
    };
    
    res.status(200).json({
      category
    });
  } catch (error) {
    console.error('Error getting category by ID:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Error retrieving category'
    });
  }
});

/**
 * @route   GET /api/categories/:id/properties
 * @desc    Get all properties in a category
 * @access  Public
 */
router.get('/:id/properties', async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);
    const { limit = 20, offset = 0 } = req.query;
    
    // Check if category exists
    const categoryCheck = await db.query('SELECT id, name FROM categories WHERE id = $1', [categoryId]);
    if (categoryCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Category not found'
      });
    }
    
    const result = await db.query(`
      SELECT p.id, p.title, p.description, p.price, p.location, p.status, 
             p.created_at, p.updated_at,
             u.first_name, u.last_name, u.email as owner_email,
             c.name as category_name
      FROM properties p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.category_id = $1
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3
    `, [categoryId, parseInt(limit), parseInt(offset)]);
    
    res.status(200).json({
      category: categoryCheck.rows[0],
      properties: result.rows,
      count: result.rows.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error getting properties by category:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Error retrieving properties for category'
    });
  }
});

module.exports = router;