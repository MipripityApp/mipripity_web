const { admin } = require('../config/firebase');
const UserModel = require('../models/userModel');

/**
 * Middleware to check if user is authenticated
 * Verifies Firebase token and attaches user to request
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
    }
    
    const token = authHeader.split('Bearer ')[1];
    
    // Verify Firebase token
    const decodedToken = await admin.auth().verifyIdToken(token);
    const { uid: firebaseUid } = decodedToken;
    
    // Get user from database
    const user = await UserModel.getUserByFirebaseUid(firebaseUid);
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'User not found in database' 
      });
    }
    
    // Attach user to request object for use in routes
    req.user = user;
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Token expired' 
      });
    }
    
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Invalid token' 
    });
  }
};

/**
 * Optional authentication middleware
 * Tries to authenticate user but continues if token is not provided
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Continue without authentication
      return next();
    }
    
    const token = authHeader.split('Bearer ')[1];
    
    // Verify Firebase token
    const decodedToken = await admin.auth().verifyIdToken(token);
    const { uid: firebaseUid } = decodedToken;
    
    // Get user from database
    const user = await UserModel.getUserByFirebaseUid(firebaseUid);
    
    if (user) {
      // Attach user to request object
      req.user = user;
    }
    
    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    console.error('Optional authentication error:', error);
    next();
  }
};

module.exports = {
  authenticate,
  optionalAuth
};