const fs = require('fs');
const path = require('path');
const db = require("../config/db");

/**
 * Database migration utility
 * Runs SQL migrations from the migrations directory ONLY when needed
 */

/**
 * Check if migrations table exists and create it if not
 */
const createMigrationsTable = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

/**
 * Check if a specific migration has already been run
 */
const isMigrationExecuted = async (client, filename) => {
  const result = await client.query(
    'SELECT id FROM migrations WHERE filename = $1',
    [filename]
  );
  return result.rows.length > 0;
};

/**
 * Record that a migration has been executed
 */
const recordMigration = async (client, filename) => {
  await client.query(
    'INSERT INTO migrations (filename) VALUES ($1)',
    [filename]
  );
};

/**
 * Check if migrations are needed
 */
const checkMigrationsNeeded = async () => {
  try {
    const client = await db.pool.connect(); // Use db.pool.connect() instead
    
    try {
      // Create migrations table if it doesn't exist
      await createMigrationsTable(client);
      
      // Check if our main migration has been run
      const migrationFile = '001_initial_schema.sql';
      const hasRun = await isMigrationExecuted(client, migrationFile);
      
      return !hasRun;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error checking migrations:", error);
    // If we can't check, assume migrations are needed (safer option)
    return true;
  }
};

/**
 * Run database migrations ONLY if they haven't been run before
 */
const runMigrations = async () => {
  try {
    console.log("Starting database migration check...");
    
    // Path to migration files
    const migrationsDir = path.join(__dirname, '../migrations');
    const migrationFile = '001_initial_schema.sql';
    const sqlFilePath = path.join(migrationsDir, migrationFile);
    
    // Check if migration file exists
    if (!fs.existsSync(sqlFilePath)) {
      console.log("No migration file found, skipping migrations");
      return;
    }
    
    // Get a client for transaction
    const client = await db.pool.connect(); // Use db.pool.connect() instead
    
    try {
      // Start transaction
      await client.query('BEGIN');
      
      // Create migrations table if it doesn't exist
      await createMigrationsTable(client);
      
      // Check if this migration has already been run
      const hasRun = await isMigrationExecuted(client, migrationFile);
      
      if (hasRun) {
        console.log("Migration already executed, skipping");
        await client.query('COMMIT');
        return;
      }
      
      // Read and execute the migration
      console.log(`Executing migration: ${migrationFile}`);
      const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
      
      // Split SQL into individual statements, ignoring comments
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
      
      // Record that this migration has been executed
      await recordMigration(client, migrationFile);
      
      // Commit transaction
      await client.query('COMMIT');
      console.log(`Migration ${migrationFile} completed successfully`);
      
    } catch (error) {
      // Rollback on error
      await client.query('ROLLBACK');
      console.error("Migration failed, rolling back:", error);
      throw error;
    } finally {
      // Release client
      client.release();
    }
  } catch (error) {
    console.error("Database migration error:", error);
    throw error;
  }
};

/**
 * Force run migrations (useful for development)
 */
const forceRunMigrations = async () => {
  try {
    console.log("Force running migrations...");
    
    const migrationsDir = path.join(__dirname, '../migrations');
    const migrationFile = '001_initial_schema.sql';
    const sqlFilePath = path.join(migrationsDir, migrationFile);
    
    if (!fs.existsSync(sqlFilePath)) {
      throw new Error("Migration file not found");
    }
    
    const client = await db.pool.connect(); // Use db.pool.connect() instead
    
    try {
      await client.query('BEGIN');
      
      const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
      
      const statements = sqlContent
        .replace(/--.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);
      
      for (const statement of statements) {
        await client.query(statement);
      }
      
      await client.query('COMMIT');
      console.log("Force migration completed successfully");
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Force migration error:", error);
    throw error;
  }
};

module.exports = {
  runMigrations,
  checkMigrationsNeeded,
  forceRunMigrations,
}