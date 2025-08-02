const db = require('../config/db');

/**
 * Vote model for handling voting-related database operations
 */
const VoteModel = {
  /**
   * Create a new vote or update existing vote
   * @param {Object} voteData - Vote data
   * @returns {Promise<Object>} Created/updated vote
   */
  async createOrUpdateVote(voteData) {
    const { property_id, user_id, vote_option_id } = voteData;
    
    const client = await db.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if user has already voted for this property
      const existingVote = await client.query(
        'SELECT * FROM votes WHERE property_id = $1 AND user_id = $2',
        [property_id, user_id]
      );
      
      let result;
      
      if (existingVote.rows.length > 0) {
        // Update existing vote
        result = await client.query(
          `UPDATE votes
           SET vote_option_id = $1, created_at = CURRENT_TIMESTAMP
           WHERE property_id = $2 AND user_id = $3
           RETURNING *`,
          [vote_option_id, property_id, user_id]
        );
      } else {
        // Create new vote
        result = await client.query(
          `INSERT INTO votes (property_id, user_id, vote_option_id)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [property_id, user_id, vote_option_id]
        );
      }
      
      await client.query('COMMIT');
      
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating/updating vote:', error);
      throw error;
    } finally {
      client.release();
    }
  },
  
  /**
   * Get vote by user and property
   * @param {number} propertyId - Property ID
   * @param {number} userId - User ID
   * @returns {Promise<Object|null>} Vote object or null if not found
   */
  async getVoteByUserAndProperty(propertyId, userId) {
    try {
      const result = await db.query(
        `SELECT v.*, vo.name AS vote_option_name
         FROM votes v
         JOIN vote_options vo ON v.vote_option_id = vo.id
         WHERE v.property_id = $1 AND v.user_id = $2`,
        [propertyId, userId]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting vote by user and property:', error);
      throw error;
    }
  },
  
  /**
   * Delete a vote
   * @param {number} propertyId - Property ID
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deleteVote(propertyId, userId) {
    try {
      const result = await db.query(
        'DELETE FROM votes WHERE property_id = $1 AND user_id = $2 RETURNING id',
        [propertyId, userId]
      );
      
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error deleting vote:', error);
      throw error;
    }
  },
  
  /**
   * Get vote counts for a property
   * @param {number} propertyId - Property ID
   * @returns {Promise<Array>} Array of vote options with counts
   */
  async getVoteCountsByProperty(propertyId) {
    try {
      const result = await db.query(
        `SELECT vo.id, vo.name, COUNT(*) as count
         FROM votes v
         JOIN vote_options vo ON v.vote_option_id = vo.id
         WHERE v.property_id = $1
         GROUP BY vo.id, vo.name
         ORDER BY count DESC`,
        [propertyId]
      );
      
      return result.rows;
    } catch (error) {
      console.error('Error getting vote counts by property:', error);
      throw error;
    }
  },
  
  /**
   * Get vote options by category
   * @param {number} categoryId - Category ID
   * @returns {Promise<Array>} Array of vote options for the category
   */
  async getVoteOptionsByCategory(categoryId) {
    try {
      const result = await db.query(
        `SELECT * FROM vote_options
         WHERE category_id = $1
         ORDER BY name`,
        [categoryId]
      );
      
      return result.rows;
    } catch (error) {
      console.error('Error getting vote options by category:', error);
      throw error;
    }
  },
  
  /**
   * Get all vote options
   * @returns {Promise<Array>} Array of all vote options
   */
  async getAllVoteOptions() {
    try {
      const result = await db.query(
        `SELECT vo.*, c.name AS category_name
         FROM vote_options vo
         JOIN categories c ON vo.category_id = c.id
         ORDER BY c.name, vo.name`
      );
      
      return result.rows;
    } catch (error) {
      console.error('Error getting all vote options:', error);
      throw error;
    }
  }
};

module.exports = VoteModel;