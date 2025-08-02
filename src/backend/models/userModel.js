const db = require('../config/db');

/**
 * User model for handling user-related database operations
 */
const UserModel = {
  /**
   * Create a new user in the database
   * @param {Object} userData - User data (firebase_uid, email, first_name, last_name, phone_number)
   * @returns {Promise<Object>} Created user
   */
  async createUser(userData) {
    const { firebase_uid, email, first_name, last_name, phone_number = null } = userData;
    
    try {
      const result = await db.query(
        `INSERT INTO users (firebase_uid, email, first_name, last_name, phone_number)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [firebase_uid, email, first_name, last_name, phone_number]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  },
  
  /**
   * Get user by Firebase UID
   * @param {string} firebaseUid - Firebase UID
   * @returns {Promise<Object|null>} User object or null if not found
   */
  async getUserByFirebaseUid(firebaseUid) {
    try {
      const result = await db.query(
        'SELECT * FROM users WHERE firebase_uid = $1',
        [firebaseUid]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting user by Firebase UID:', error);
      throw error;
    }
  },
  
  /**
   * Get user by ID
   * @param {number} userId - User ID
   * @returns {Promise<Object|null>} User object or null if not found
   */
  async getUserById(userId) {
    try {
      const result = await db.query(
        'SELECT * FROM users WHERE id = $1',
        [userId]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting user by ID:', error);
      throw error;
    }
  },
  
  /**
   * Update user details
   * @param {number} userId - User ID
   * @param {Object} updateData - Fields to update
   * @returns {Promise<Object|null>} Updated user or null if not found
   */
  async updateUser(userId, updateData) {
    try {
      // Create SET clause and values for dynamic updates
      const keys = Object.keys(updateData);
      const values = Object.values(updateData);
      
      if (keys.length === 0) {
        return await this.getUserById(userId);
      }
      
      const setClause = keys
        .map((key, index) => `${key} = $${index + 2}`)
        .join(', ');
      
      const result = await db.query(
        `UPDATE users
         SET ${setClause}, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [userId, ...values]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  },
  
  /**
   * Get all users (with optional pagination)
   * @param {number} limit - Number of users to return (default: 100)
   * @param {number} offset - Offset for pagination (default: 0)
   * @returns {Promise<Array>} Array of users
   */
  async getAllUsers(limit = 100, offset = 0) {
    try {
      const result = await db.query(
        'SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
      );
      
      return result.rows;
    } catch (error) {
      console.error('Error getting all users:', error);
      throw error;
    }
  },
  
  /**
   * Generate display picture initials from first and last name
   * @param {string} firstName - User's first name
   * @param {string} lastName - User's last name
   * @returns {string} Initials (e.g., "JD" for "John Doe")
   */
  generateInitials(firstName, lastName) {
    const firstInitial = firstName.charAt(0).toUpperCase();
    const lastInitial = lastName.charAt(0).toUpperCase();
    return `${firstInitial}${lastInitial}`;
  }
};

module.exports = UserModel;