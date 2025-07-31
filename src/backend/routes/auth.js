const express = require('express');
const { admin } = require('../config/firebase');
const UserModel = require('../models/userModel');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register user in database after Firebase authentication
 * @access  Public
 */
router.post('/register', async (req, res) => {
  try {
    const { firebase_uid, email, first_name, last_name, phone_number } = req.body;
    
    if (!firebase_uid || !email || !first_name || !last_name) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields'
      });
    }
    
    // Check if user already exists
    const existingUser = await UserModel.getUserByFirebaseUid(firebase_uid);
    
    if (existingUser) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'User already exists'
      });
    }
    
    // Create user in database
    const user = await UserModel.createUser({
      firebase_uid,
      email,
      first_name,
      last_name,
      phone_number
    });
    
    // Generate display picture initials
    const initials = UserModel.generateInitials(first_name, last_name);
    
    res.status(201).json({
      message: 'User registered successfully',
      user: {
        ...user,
        display_initials: initials
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Error registering user'
    });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Login user with Firebase token and get user data
 * @access  Public
 */
router.post('/login', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Token is required'
      });
    }
    
    // Verify Firebase token
    const decodedToken = await admin.auth().verifyIdToken(token);
    const { uid: firebase_uid } = decodedToken;
    
    // Get user from database
    const user = await UserModel.getUserByFirebaseUid(firebase_uid);
    
    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found in database',
        firebase_uid
      });
    }
    
    // Generate display picture initials
    const initials = UserModel.generateInitials(user.first_name, user.last_name);
    
    res.status(200).json({
      message: 'Login successful',
      user: {
        ...user,
        display_initials: initials
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token expired'
      });
    }
    
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid token'
    });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current user data
 * @access  Private
 */
router.get('/me', authenticate, (req, res) => {
  try {
    const user = req.user;
    
    // Generate display picture initials
    const initials = UserModel.generateInitials(user.first_name, user.last_name);
    
    res.status(200).json({
      user: {
        ...user,
        display_initials: initials
      }
    });
  } catch (error) {
    console.error('Error getting user data:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Error retrieving user data'
    });
  }
});

/**
 * @route   PUT /api/auth/update-profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/update-profile', authenticate, async (req, res) => {
  try {
    const { first_name, last_name, phone_number } = req.body;
    const userId = req.user.id;
    
    // Create update object with only provided fields
    const updateData = {};
    
    if (first_name !== undefined) updateData.first_name = first_name;
    if (last_name !== undefined) updateData.last_name = last_name;
    if (phone_number !== undefined) updateData.phone_number = phone_number;
    
    // Update user in database
    const updatedUser = await UserModel.updateUser(userId, updateData);
    
    if (!updatedUser) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }
    
    // Generate display picture initials
    const initials = UserModel.generateInitials(
      updatedUser.first_name, 
      updatedUser.last_name
    );
    
    res.status(200).json({
      message: 'Profile updated successfully',
      user: {
        ...updatedUser,
        display_initials: initials
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Error updating profile'
    });
  }
});

module.exports = router;