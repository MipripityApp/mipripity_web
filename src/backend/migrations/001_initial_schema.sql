-- Initial database schema for Mipripity Web
-- Creates tables for users, properties, categories, vote options, and votes

-- Drop tables if they exist (for clean migrations)
DROP TABLE IF EXISTS votes;
DROP TABLE IF EXISTS property_images;
DROP TABLE IF EXISTS properties;
DROP TABLE IF EXISTS vote_options;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;

-- Create users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  firebase_uid VARCHAR(128) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone_number VARCHAR(20),
  profile_picture VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create property categories table
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create vote options table (options like Rent, Buy, Lease, Develop, Partner)
CREATE TABLE vote_options (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(name, category_id)
);

-- Create properties table
CREATE TABLE properties (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  location VARCHAR(255) NOT NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  current_worth DECIMAL(15, 2),
  year_of_construction INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create property images table
CREATE TABLE property_images (
  id SERIAL PRIMARY KEY,
  property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
  image_url VARCHAR(255) NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create votes table
CREATE TABLE votes (
  id SERIAL PRIMARY KEY,
  property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  vote_option_id INTEGER REFERENCES vote_options(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(property_id, user_id) -- A user can only vote once per property
);

-- Insert default categories
INSERT INTO categories (name, description) VALUES
  ('Residential', 'Residential properties including houses, apartments, and condos'),
  ('Commercial', 'Commercial properties including offices, retail spaces, and warehouses'),
  ('Land', 'Undeveloped land plots'),
  ('Material', 'Construction materials and supplies');

-- Insert default vote options for each category
-- Residential vote options
INSERT INTO vote_options (name, category_id, description) VALUES
  ('Rent', 1, 'Interested in renting this property'),
  ('Buy', 1, 'Interested in buying this property'),
  ('Lease', 1, 'Interested in leasing this property long-term'),
  ('Partner', 1, 'Interested in partnering with the owner');

-- Commercial vote options
INSERT INTO vote_options (name, category_id, description) VALUES
  ('Rent', 2, 'Interested in renting this commercial space'),
  ('Buy', 2, 'Interested in buying this commercial property'),
  ('Lease', 2, 'Interested in leasing this commercial space long-term'),
  ('Invest', 2, 'Interested in investing in this commercial property'),
  ('Partner', 2, 'Interested in business partnership opportunity');

-- Land vote options
INSERT INTO vote_options (name, category_id, description) VALUES
  ('Buy', 3, 'Interested in buying this land'),
  ('Develop', 3, 'Interested in developing this land'),
  ('Joint Venture', 3, 'Interested in joint venture development'),
  ('Lease', 3, 'Interested in leasing this land');

-- Material vote options
INSERT INTO vote_options (name, category_id, description) VALUES
  ('Buy', 4, 'Interested in buying these materials'),
  ('Supply Contract', 4, 'Interested in ongoing supply contract'),
  ('Exchange', 4, 'Interested in exchanging for other materials'),
  ('Wholesale', 4, 'Interested in wholesale purchase');

-- Create indexes for performance
CREATE INDEX idx_properties_user_id ON properties(user_id);
CREATE INDEX idx_properties_category_id ON properties(category_id);
CREATE INDEX idx_votes_property_id ON votes(property_id);
CREATE INDEX idx_votes_user_id ON votes(user_id);
CREATE INDEX idx_votes_vote_option_id ON votes(vote_option_id);
CREATE INDEX idx_property_images_property_id ON property_images(property_id);