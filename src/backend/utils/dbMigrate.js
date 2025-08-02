const fs = require('fs');
const path = require('path');
const db = require("../config/db");

/**
 * Database migration utility
 * Runs SQL migrations from the migrations directory
 */
const runMigrations = async () => {
  try {
    console.log("Starting database migrations...");
    
    // Path to migration files
    const migrationsDir = path.join(__dirname, '../migrations');
    
    // Read the SQL file
    const sqlFilePath = path.join(migrationsDir, '001_initial_schema.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Get a client for transaction
    const client = await db.pool.connect();
    
    try {
      // Start transaction
      await client.query('BEGIN');
      
      // Split SQL into individual statements by semicolons, ignoring semicolons in comments
      const statements = sqlContent
        .replace(/--.*$/gm, '') // Remove single line comments
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0); // Remove empty statements
      
      // Execute each statement
      for (const statement of statements) {
        await client.query(statement);
      }
      
      // Commit transaction
      await client.query('COMMIT');
      console.log("Database migrations completed successfully");
    } catch (error) {
      // Rollback on error
      await client.query('ROLLBACK');
      throw error;
    } finally {
      // Release client
      client.release();
    }
  } catch (error) {
    console.error("Migration error:", error);
    throw error;
  }
}

module.exports = {
  runMigrations,
}
