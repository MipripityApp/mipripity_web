/**
 * Main entry point for Mipripity Web Backend API
 *
 * This file imports the Express server configuration from src/backend/server.js
 * and starts the server.
 */

// Import server configuration
const app = require("./backend/server")

// Server is already configured to listen on the specified port in server.js
console.log("Server is configured and imported from src/backend/server.js")
console.log("Environment:", process.env.NODE_ENV || "production")
console.log("Port:", process.env.PORT || 3000)