const express = require('express');
const VoteModel = require('../models/voteModel');
const PropertyModel = require('../models/propertyModel');
const CategoryModel = require('../models/categoryModel');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * @route   POST /api/votes
 * @desc    Cast a vote for a property
 * @access  Private
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const { property_id, vote_option_id } = req.body;
    
    if (!property_id || !vote_option_id) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: property_id, vote_option_id'
      });
    }
    
    // Check if property exists
    const property = await PropertyModel.getPropertyById(property_id);
    
    if (!property) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Property not found'
      });
    }
    
    // Check if vote option exists and belongs to the property's category
    const voteOptions = await VoteModel.getVoteOptionsByCategory(property.category_id);
    const validOption = voteOptions.some(option => option.id === parseInt(vote_option_id));
    
    if (!validOption) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid vote option for this property category'
      });
    }
    
    // Create or update vote
    const vote = await VoteModel.createOrUpdateVote({
      property_id,
      user_id: req.user.id,
      vote_option_id
    });
    
    res.status(201).json({
      message: 'Vote recorded successfully',
      vote
    });
  } catch (error) {
    console.error('Error casting vote:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Error recording vote'
    });
  }
});

/**
 * @route   GET /api/votes/options
 * @desc    Get all vote options
 * @access  Public
 */
router.get('/options', async (req, res) => {
  try {
    const voteOptions = await VoteModel.getAllVoteOptions();
    
    res.status(200).json({
      vote_options: voteOptions,
      count: voteOptions.length
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
 * @route   GET /api/votes/options/category/:categoryId
 * @desc    Get vote options for a specific category
 * @access  Public
 */
router.get('/options/category/:categoryId', async (req, res) => {
  try {
    const categoryId = parseInt(req.params.categoryId);
    
    // Check if category exists
    const category = await CategoryModel.getCategoryById(categoryId);
    
    if (!category) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Category not found'
      });
    }
    
    const voteOptions = await VoteModel.getVoteOptionsByCategory(categoryId);
    
    res.status(200).json({
      category_id: categoryId,
      category_name: category.name,
      vote_options: voteOptions,
      count: voteOptions.length
    });
  } catch (error) {
    console.error('Error getting vote options by category:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Error retrieving vote options'
    });
  }
});

/**
 * @route   GET /api/votes/property/:propertyId
 * @desc    Get vote counts for a property
 * @access  Public
 */
router.get('/property/:propertyId', async (req, res) => {
  try {
    const propertyId = parseInt(req.params.propertyId);
    
    // Check if property exists
    const property = await PropertyModel.getPropertyById(propertyId);
    
    if (!property) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Property not found'
      });
    }
    
    const voteCounts = await VoteModel.getVoteCountsByProperty(propertyId);
    
    res.status(200).json({
      property_id: propertyId,
      property_title: property.title,
      votes: voteCounts,
      total: voteCounts.reduce((sum, vote) => sum + parseInt(vote.count), 0)
    });
  } catch (error) {
    console.error('Error getting vote counts for property:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Error retrieving vote counts'
    });
  }
});

/**
 * @route   GET /api/votes/my-vote/:propertyId
 * @desc    Get user's vote for a specific property
 * @access  Private
 */
router.get('/my-vote/:propertyId', authenticate, async (req, res) => {
  try {
    const propertyId = parseInt(req.params.propertyId);
    
    // Check if property exists
    const property = await PropertyModel.getPropertyById(propertyId);
    
    if (!property) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Property not found'
      });
    }
    
    const vote = await VoteModel.getVoteByUserAndProperty(propertyId, req.user.id);
    
    if (!vote) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'No vote found for this property'
      });
    }
    
    res.status(200).json({ vote });
  } catch (error) {
    console.error('Error getting user vote for property:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Error retrieving vote'
    });
  }
});

/**
 * @route   DELETE /api/votes/:propertyId
 * @desc    Delete user's vote for a property
 * @access  Private
 */
router.delete('/:propertyId', authenticate, async (req, res) => {
  try {
    const propertyId = parseInt(req.params.propertyId);
    
    // Check if property exists
    const property = await PropertyModel.getPropertyById(propertyId);
    
    if (!property) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Property not found'
      });
    }
    
    // Delete vote
    const deleted = await VoteModel.deleteVote(propertyId, req.user.id);
    
    if (!deleted) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'No vote found to delete'
      });
    }
    
    res.status(200).json({
      message: 'Vote deleted successfully'
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