/**
 * Database migration utility script
 * 
 * This standalone script runs database migrations independently
 * of the main application. It's used for the 'npm run migrate' command.
 */

// Import migration utility
const { runMigrations } = require('./dbMigrate');

// Run migrations
console.log('Starting database migrations...');

runMigrations()
  .then(() => {
    console.log('Database migrations completed successfully.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Migration error:', error);
    process.exit(1);
  });