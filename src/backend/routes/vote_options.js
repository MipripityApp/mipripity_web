const express = require('express');
const db = require('../config/db');

const router = express.Router();

/**
 * @route   GET /api/vote_options
 * @desc    Get all vote options
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    
    const result = await db.query(`
      SELECT id, name, description, created_at, updated_at
      FROM vote_options
      ORDER BY name
      LIMIT $1 OFFSET $2
    `, [parseInt(limit), parseInt(offset)]);
    
    // Get count of votes per option
    const optionsWithCounts = await Promise.all(
      result.rows.map(async (option) => {
        const countResult = await db.query(
          'SELECT COUNT(*) as vote_count FROM votes WHERE vote_option_id = $1',
          [option.id]
        );
        return {
          ...option,
          vote_count: parseInt(countResult.rows[0].vote_count)
        };
      })
    );
    
    res.status(200).json({
      vote_options: optionsWithCounts,
      count: optionsWithCounts.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error getting vote options:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Error retrieving vote options'
    });
  }
});

/**
 * @route   GET /api/vote_options/:id
 * @desc    Get vote option by ID
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  try {
    const optionId = parseInt(req.params.id);
    
    const result = await db.query(`
      SELECT id, name, description, created_at, updated_at
      FROM vote_options
      WHERE id = $1
    `, [optionId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Vote option not found'
      });
    }
    
    // Get count of votes for this option
    const countResult = await db.query(
      'SELECT COUNT(*) as vote_count FROM votes WHERE vote_option_id = $1',
      [optionId]
    );
    
    const option = {
      ...result.rows[0],
      vote_count: parseInt(countResult.rows[0].vote_count)
    };
    
    res.status(200).json({
      vote_option: option
    });
  } catch (error) {
    console.error('Error getting vote option by ID:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Error retrieving vote option'
    });
  }
});

/**
 * @route   GET /api/vote_options/:id/votes
 * @desc    Get all votes for a specific vote option
 * @access  Public
 */
router.get('/:id/votes', async (req, res) => {
  try {
    const optionId = parseInt(req.params.id);
    const { limit = 50, offset = 0 } = req.query;
    
    // Check if vote option exists
    const optionCheck = await db.query('SELECT id, name FROM vote_options WHERE id = $1', [optionId]);
    if (optionCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Vote option not found'
      });
    }
    
    const result = await db.query(`
      SELECT v.id, v.user_id, v.property_id, v.created_at, v.updated_at,
             u.first_name, u.last_name, u.email,
             p.title as property_title
      FROM votes v
      LEFT JOIN users u ON v.user_id = u.id
      LEFT JOIN properties p ON v.property_id = p.id
      WHERE v.vote_option_id = $1
      ORDER BY v.created_at DESC
      LIMIT $2 OFFSET $3
    `, [optionId, parseInt(limit), parseInt(offset)]);
    
    res.status(200).json({
      vote_option: optionCheck.rows[0],
      votes: result.rows,
      count: result.rows.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error getting votes by option:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Error retrieving votes for option'
    });
  }
});

/**
 * @route   GET /api/vote_options/stats
 * @desc    Get voting statistics across all options
 * @access  Public
 */
router.get('/stats/summary', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT vo.id, vo.name, vo.description,
             COUNT(v.id) as vote_count,
             COUNT(DISTINCT v.user_id) as unique_voters,
             COUNT(DISTINCT v.property_id) as properties_voted_on
      FROM vote_options vo
      LEFT JOIN votes v ON vo.id = v.vote_option_id
      GROUP BY vo.id, vo.name, vo.description
      ORDER BY vote_count DESC
    `);
    
    const totalVotes = await db.query('SELECT COUNT(*) as total FROM votes');
    const totalUsers = await db.query('SELECT COUNT(*) as total FROM users');
    const totalProperties = await db.query('SELECT COUNT(*) as total FROM properties');
    
    res.status(200).json({
      vote_options_stats: result.rows,
      summary: {
        total_votes: parseInt(totalVotes.rows[0].total),
        total_users: parseInt(totalUsers.rows[0].total),
        total_properties: parseInt(totalProperties.rows[0].total),
        total_vote_options: result.rows.length
      }
    });
  } catch (error) {
    console.error('Error getting vote statistics:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Error retrieving vote statistics'
    });
  }
});

module.exports = router;