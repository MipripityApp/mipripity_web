const db = require('../config/db');

/**
 * Category model for handling category-related database operations
 */
const CategoryModel = {
  /**
   * Get all categories
   * @returns {Promise<Array>} Array of categories
   */
  async getAllCategories() {
    try {
      const result = await db.query(
        'SELECT * FROM categories ORDER BY name'
      );
      
      return result.rows;
    } catch (error) {
      console.error('Error getting all categories:', error);
      throw error;
    }
  },
  
  /**
   * Get category by ID
   * @param {number} categoryId - Category ID
   * @returns {Promise<Object|null>} Category object or null if not found
   */
  async getCategoryById(categoryId) {
    try {
      const result = await db.query(
        'SELECT * FROM categories WHERE id = $1',
        [categoryId]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting category by ID:', error);
      throw error;
    }
  },
  
  /**
   * Get category with vote options
   * @param {number} categoryId - Category ID
   * @returns {Promise<Object|null>} Category with vote options or null if not found
   */
  async getCategoryWithVoteOptions(categoryId) {
    try {
      const categoryResult = await db.query(
        'SELECT * FROM categories WHERE id = $1',
        [categoryId]
      );
      
      if (categoryResult.rows.length === 0) {
        return null;
      }
      
      const category = categoryResult.rows[0];
      
      const voteOptionsResult = await db.query(
        'SELECT * FROM vote_options WHERE category_id = $1 ORDER BY name',
        [categoryId]
      );
      
      return {
        ...category,
        vote_options: voteOptionsResult.rows
      };
    } catch (error) {
      console.error('Error getting category with vote options:', error);
      throw error;
    }
  },
  
  /**
   * Get all categories with vote options
   * @returns {Promise<Array>} Array of categories with vote options
   */
  async getAllCategoriesWithVoteOptions() {
    try {
      const categoriesResult = await db.query(
        'SELECT * FROM categories ORDER BY name'
      );
      
      const categories = categoriesResult.rows;
      
      const voteOptionsResult = await db.query(
        `SELECT vo.*, c.name AS category_name
         FROM vote_options vo
         JOIN categories c ON vo.category_id = c.id
         ORDER BY c.name, vo.name`
      );
      
      // Group vote options by category
      const categoriesWithOptions = categories.map(category => {
        const options = voteOptionsResult.rows.filter(
          option => option.category_id === category.id
        );
        
        return {
          ...category,
          vote_options: options
        };
      });
      
      return categoriesWithOptions;
    } catch (error) {
      console.error('Error getting all categories with vote options:', error);
      throw error;
    }
  },
  
  /**
   * Create a new category
   * @param {Object} categoryData - Category data
   * @returns {Promise<Object>} Created category
   */
  async createCategory(categoryData) {
    const { name, description } = categoryData;
    
    try {
      const result = await db.query(
        `INSERT INTO categories (name, description)
         VALUES ($1, $2)
         RETURNING *`,
        [name, description]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  },
  
  /**
   * Create a new vote option
   * @param {Object} optionData - Vote option data
   * @returns {Promise<Object>} Created vote option
   */
  async createVoteOption(optionData) {
    const { name, category_id, description } = optionData;
    
    try {
      const result = await db.query(
        `INSERT INTO vote_options (name, category_id, description)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [name, category_id, description]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Error creating vote option:', error);
      throw error;
    }
  }
};

module.exports = CategoryModel;