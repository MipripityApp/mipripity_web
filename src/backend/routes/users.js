const express = require('express');
const UserModel = require('../models/userModel');
const PropertyModel = require('../models/propertyModel');
const VoteModel = require('../models/voteModel');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * @route   GET /api/users
 * @desc    Get all users (with pagination)
 * @access  Private (should be restricted to admin in production)
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    
    const users = await UserModel.getAllUsers(
      parseInt(limit), 
      parseInt(offset)
    );
    
    // Add display initials for each user
    const usersWithInitials = users.map(user => {
      const initials = UserModel.generateInitials(user.first_name, user.last_name);
      return {
        ...user,
        display_initials: initials
      };
    });
    
    res.status(200).json({
      users: usersWithInitials,
      count: usersWithInitials.length
    });
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Error retrieving users'
    });
  }
});

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    // Check if requesting user is requesting their own profile or if they have admin rights
    if (req.user.id !== userId) {
      // In a real app, you might check for admin role here
      // For now, we'll allow any authenticated user to view other profiles
    }
    
    const user = await UserModel.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }
    
    // Generate display picture initials
    const initials = UserModel.generateInitials(user.first_name, user.last_name);
    
    res.status(200).json({
      user: {
        ...user,
        display_initials: initials
      }
    });
  } catch (error) {
    console.error('Error getting user by ID:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Error retrieving user'
    });
  }
});

/**
 * @route   GET /api/users/:id/properties
 * @desc    Get properties listed by a user
 * @access  Public
 */
router.get('/:id/properties', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { limit = 10, offset = 0 } = req.query;
    
    // Get properties for this user
    const { properties, total, page, pages } = await PropertyModel.getProperties({
      user_id: userId,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.status(200).json({
      properties,
      total,
      page,
      pages,
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Error getting user properties:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Error retrieving user properties'
    });
  }
});

/**
 * @route   GET /api/users/:id/votes
 * @desc    Get votes made by a user
 * @access  Private (only the user can see their own votes)
 */
router.get('/:id/votes', authenticate, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    // Check if requesting user is requesting their own votes
    if (req.user.id !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only view your own votes'
      });
    }
    
    // Get all votes for the user with related property and vote option details
    // Using db object to execute a more complex query that our model doesn't directly support
    const db = require('../config/db');
    
    const result = await db.query(
      `SELECT v.id, v.created_at, 
              p.id AS property_id, p.title AS property_title, 
              vo.id AS vote_option_id, vo.name AS vote_option_name
       FROM votes v
       JOIN properties p ON v.property_id = p.id
       JOIN vote_options vo ON v.vote_option_id = vo.id
       WHERE v.user_id = $1
       ORDER BY v.created_at DESC`,
      [userId]
    );
    
    res.status(200).json({
      votes: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error getting user votes:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Error retrieving user votes'
    });
  }
});

module.exports = router;