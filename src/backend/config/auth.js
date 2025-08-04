const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Generate a secret key if not provided in environment variables
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';

/**
 * Generate a JWT token for a user
 * @param {Object} user - User object to encode in the token
 * @returns {String} JWT token
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
};

/**
 * Verify a JWT token
 * @param {String} token - JWT token to verify
 * @returns {Object} Decoded token payload
 */
const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

/**
 * Authentication middleware that verifies JWT tokens
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticateJWT = (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Authentication required"
      });
    }
    
    const token = authHeader.split('Bearer ')[1];
    
    // Verify token
    const decodedToken = verifyToken(token);
    
    // Add user to request object
    req.user = decodedToken;
    
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(401).json({
      success: false,
      error: "Unauthorized",
      message: "Invalid authentication credentials"
    });
  }
};

module.exports = {
  generateToken,
  verifyToken,
  authenticateJWT,
  JWT_SECRET
};