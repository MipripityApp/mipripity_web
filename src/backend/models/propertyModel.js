const db = require('../config/db');

/**
 * Property model for handling property-related database operations
 */
const PropertyModel = {
  /**
   * Create a new property listing
   * @param {Object} propertyData - Property data
   * @returns {Promise<Object>} Created property
   */
  async createProperty(propertyData) {
    const {
      title,
      description,
      location,
      category_id,
      user_id,
      current_worth,
      year_of_construction,
      images = []
    } = propertyData;
    
    const client = await db.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Insert property
      const propertyResult = await client.query(
        `INSERT INTO properties 
         (title, description, location, category_id, user_id, current_worth, year_of_construction)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [title, description, location, category_id, user_id, current_worth, year_of_construction]
      );
      
      const property = propertyResult.rows[0];
      
      // Insert property images if provided
      if (images.length > 0) {
        for (let i = 0; i < images.length; i++) {
          const { image_url, is_primary = i === 0 } = images[i];
          
          await client.query(
            `INSERT INTO property_images 
             (property_id, image_url, is_primary)
             VALUES ($1, $2, $3)`,
            [property.id, image_url, is_primary]
          );
        }
      }
      
      await client.query('COMMIT');
      
      // Get the property with images
      return await this.getPropertyById(property.id);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating property:', error);
      throw error;
    } finally {
      client.release();
    }
  },
  
  /**
   * Get property by ID with images
   * @param {number} propertyId - Property ID
   * @returns {Promise<Object|null>} Property object with images or null if not found
   */
  async getPropertyById(propertyId) {
    try {
      // Get property details
      const propertyResult = await db.query(
        `SELECT p.*, 
                c.name AS category_name, 
                u.first_name, 
                u.last_name, 
                u.email,
                u.phone_number
         FROM properties p
         JOIN categories c ON p.category_id = c.id
         JOIN users u ON p.user_id = u.id
         WHERE p.id = $1`,
        [propertyId]
      );
      
      if (propertyResult.rows.length === 0) {
        return null;
      }
      
      const property = propertyResult.rows[0];
      
      // Get property images
      const imagesResult = await db.query(
        'SELECT * FROM property_images WHERE property_id = $1 ORDER BY is_primary DESC',
        [propertyId]
      );
      
      // Get vote counts for the property
      const votesResult = await db.query(
        `SELECT vo.name, COUNT(*) as count
         FROM votes v
         JOIN vote_options vo ON v.vote_option_id = vo.id
         WHERE v.property_id = $1
         GROUP BY vo.name
         ORDER BY count DESC`,
        [propertyId]
      );
      
      return {
        ...property,
        images: imagesResult.rows,
        votes: votesResult.rows
      };
    } catch (error) {
      console.error('Error getting property by ID:', error);
      throw error;
    }
  },
  
  /**
   * Update property details
   * @param {number} propertyId - Property ID
   * @param {Object} updateData - Fields to update
   * @returns {Promise<Object|null>} Updated property or null if not found
   */
  async updateProperty(propertyId, updateData) {
    try {
      // Create SET clause and values for dynamic updates
      const keys = Object.keys(updateData).filter(key => key !== 'images');
      const values = keys.map(key => updateData[key]);
      
      if (keys.length === 0 && !updateData.images) {
        return await this.getPropertyById(propertyId);
      }
      
      const client = await db.pool.connect();
      
      try {
        await client.query('BEGIN');
        
        // Update property if there are fields to update
        if (keys.length > 0) {
          const setClause = keys
            .map((key, index) => `${key} = $${index + 2}`)
            .join(', ');
          
          await client.query(
            `UPDATE properties
             SET ${setClause}, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [propertyId, ...values]
          );
        }
        
        // Update images if provided
        if (updateData.images) {
          // Delete existing images first
          await client.query(
            'DELETE FROM property_images WHERE property_id = $1',
            [propertyId]
          );
          
          // Insert new images
          for (let i = 0; i < updateData.images.length; i++) {
            const { image_url, is_primary = i === 0 } = updateData.images[i];
            
            await client.query(
              `INSERT INTO property_images 
               (property_id, image_url, is_primary)
               VALUES ($1, $2, $3)`,
              [propertyId, image_url, is_primary]
            );
          }
        }
        
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      
      // Get the updated property with images
      return await this.getPropertyById(propertyId);
    } catch (error) {
      console.error('Error updating property:', error);
      throw error;
    }
  },
  
  /**
   * Delete a property
   * @param {number} propertyId - Property ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deleteProperty(propertyId) {
    try {
      const result = await db.query(
        'DELETE FROM properties WHERE id = $1 RETURNING id',
        [propertyId]
      );
      
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error deleting property:', error);
      throw error;
    }
  },
  
  /**
   * Get all properties with pagination and optional filtering
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Object with properties array and total count
   */
  async getProperties(options = {}) {
    const {
      limit = 10,
      offset = 0,
      category_id = null,
      user_id = null,
      search = null,
      sort_by = 'created_at',
      sort_order = 'DESC'
    } = options;
    
    try {
      let query = `
        SELECT p.*, 
               c.name AS category_name, 
               u.first_name, 
               u.last_name,
               (SELECT image_url FROM property_images WHERE property_id = p.id AND is_primary = true LIMIT 1) AS primary_image,
               (SELECT COUNT(*) FROM votes WHERE property_id = p.id) AS vote_count
        FROM properties p
        JOIN categories c ON p.category_id = c.id
        JOIN users u ON p.user_id = u.id
        WHERE 1=1
      `;
      
      const queryParams = [];
      let paramCount = 1;
      
      // Add filters
      if (category_id) {
        query += ` AND p.category_id = $${paramCount++}`;
        queryParams.push(category_id);
      }
      
      if (user_id) {
        query += ` AND p.user_id = $${paramCount++}`;
        queryParams.push(user_id);
      }
      
      if (search) {
        query += ` AND (p.title ILIKE $${paramCount} OR p.description ILIKE $${paramCount} OR p.location ILIKE $${paramCount})`;
        queryParams.push(`%${search}%`);
        paramCount++;
      }
      
      // Add sorting
      const allowedSortFields = ['created_at', 'title', 'location', 'current_worth', 'vote_count'];
      const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'created_at';
      const order = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      
      query += ` ORDER BY ${sortField} ${order}`;
      
      // Add pagination
      query += ` LIMIT $${paramCount++} OFFSET $${paramCount++}`;
      queryParams.push(limit, offset);
      
      const result = await db.query(query, queryParams);
      
      // Get total count for pagination
      let countQuery = `
        SELECT COUNT(*) 
        FROM properties p
        WHERE 1=1
      `;
      
      const countParams = [];
      paramCount = 1;
      
      if (category_id) {
        countQuery += ` AND p.category_id = $${paramCount++}`;
        countParams.push(category_id);
      }
      
      if (user_id) {
        countQuery += ` AND p.user_id = $${paramCount++}`;
        countParams.push(user_id);
      }
      
      if (search) {
        countQuery += ` AND (p.title ILIKE $${paramCount} OR p.description ILIKE $${paramCount} OR p.location ILIKE $${paramCount})`;
        countParams.push(`%${search}%`);
      }
      
      const countResult = await db.query(countQuery, countParams);
      const totalCount = parseInt(countResult.rows[0].count);
      
      return {
        properties: result.rows,
        total: totalCount,
        page: Math.floor(offset / limit) + 1,
        pages: Math.ceil(totalCount / limit),
        limit
      };
    } catch (error) {
      console.error('Error getting properties:', error);
      throw error;
    }
  }
};

module.exports = PropertyModel;