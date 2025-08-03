const express = require('express');
const db = require('../config/db');

const router = express.Router();

/**
 * @route   GET /api/votes
 * @desc    Get all votes with pagination
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const { limit = 100, offset = 0, user_id, property_id } = req.query;
    
    let query = `
      SELECT v.id, v.user_id, v.property_id, v.vote_option_id, v.created_at, v.updated_at,
             u.first_name, u.last_name, u.email,
             p.title as property_title,
             vo.name as vote_option_name
      FROM votes v
      LEFT JOIN users u ON v.user_id = u.id
      LEFT JOIN properties p ON v.property_id = p.id
      LEFT JOIN vote_options vo ON v.vote_option_id = vo.id
    `;
    
    const params = [];
    const conditions = [];
    
    if (user_id) {
      conditions.push(`v.user_id = $${params.length + 1}`);
      params.push(user_id);
    }
    
    if (property_id) {
      conditions.push(`v.property_id = $${params.length + 1}`);
      params.push(property_id);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` ORDER BY v.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await db.query(query, params);
    
    res.status(200).json({
      votes: result.rows,
      count: result.rows.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error getting votes:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Error retrieving votes'
    });
  }
});

/**
 * @route   GET /api/votes/:id
 * @desc    Get vote by ID
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  try {
    const voteId = parseInt(req.params.id);
    
    const result = await db.query(`
      SELECT v.id, v.user_id, v.property_id, v.vote_option_id, v.created_at, v.updated_at,
             u.first_name, u.last_name, u.email,
             p.title as property_title,
             vo.name as vote_option_name
      FROM votes v
      LEFT JOIN users u ON v.user_id = u.id
      LEFT JOIN properties p ON v.property_id = p.id
      LEFT JOIN vote_options vo ON v.vote_option_id = vo.id
      WHERE v.id = $1
    `, [voteId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Vote not found'
      });
    }
    
    res.status(200).json({
      vote: result.rows[0]
    });
  } catch (error) {
    console.error('Error getting vote by ID:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Error retrieving vote'
    });
  }
});

/**
 * @route   POST /api/votes
 * @desc    Create a new vote
 * @access  Private (should require authentication)
 */
router.post('/', async (req, res) => {
  try {
    const { user_id, property_id, vote_option_id } = req.body;
    
    // Validate required fields
    if (!user_id || !property_id || !vote_option_id) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'user_id, property_id, and vote_option_id are required'
      });
    }
    
    // Check if user has already voted for this property
    const existingVote = await db.query(
      'SELECT id FROM votes WHERE user_id = $1 AND property_id = $2',
      [user_id, property_id]
    );
    
    if (existingVote.rows.length > 0) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'User has already voted for this property'
      });
    }
    
    // Create the vote
    const result = await db.query(`
      INSERT INTO votes (user_id, property_id, vote_option_id, created_at, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, user_id, property_id, vote_option_id, created_at, updated_at
    `, [user_id, property_id, vote_option_id]);
    
    res.status(201).json({
      message: 'Vote created successfully',
      vote: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating vote:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Error creating vote'
    });
  }
});

/**
 * @route   PATCH/PUT /api/votes/:id
 * @desc    Update vote by ID
 * @access  Private
 */
router.patch('/:id', updateVote);
router.put('/:id', updateVote);

async function updateVote(req, res) {
  try {
    const voteId = parseInt(req.params.id);
    const { vote_option_id } = req.body;
    
    if (!vote_option_id) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'vote_option_id is required'
      });
    }
    
    const result = await db.query(`
      UPDATE votes 
      SET vote_option_id = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, user_id, property_id, vote_option_id, created_at, updated_at
    `, [vote_option_id, voteId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Vote not found'
      });
    }
    
    res.status(200).json({
      message: 'Vote updated successfully',
      vote: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating vote:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Error updating vote'
    });
  }
}

/**
 * @route   DELETE /api/votes/:id
 * @desc    Delete vote by ID
 * @access  Private
 */
router.delete('/:id', async (req, res) => {
  try {
    const voteId = parseInt(req.params.id);
    
    const result = await db.query(
      'DELETE FROM votes WHERE id = $1 RETURNING id',
      [voteId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Vote not found'
      });
    }
    
    res.status(200).json({
      message: 'Vote deleted successfully',
      deleted_id: voteId
    });
  } catch (error) {
    console.error('Error deleting vote:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Error deleting vote'
    });
  }
});

module.exports = router;