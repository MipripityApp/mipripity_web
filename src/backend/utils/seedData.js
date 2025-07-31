/**
 * Database seed utility script
 * 
 * This script populates the database with sample data for development and testing.
 * It creates sample users, properties with picsum.photos images, and votes.
 */

const UserModel = require('../models/userModel');
const PropertyModel = require('../models/propertyModel');
const CategoryModel = require('../models/categoryModel');
const VoteModel = require('../models/voteModel');
const { admin } = require('../config/firebase');
const db = require('../config/db');

/**
 * Generate a random number between min and max (inclusive)
 */
function getRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Get a random item from an array
 */
function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Seed the database with sample data
 */
async function seedDatabase() {
  console.log('Starting database seeding...');
  
  try {
    // Check if we already have seed data
    const userCountResult = await db.query('SELECT COUNT(*) FROM users');
    const userCount = parseInt(userCountResult.rows[0].count);
    
    if (userCount > 0) {
      console.log('Database already has data. Skipping seed process.');
      return;
    }
    
    // Get categories
    const categoriesResult = await db.query('SELECT * FROM categories');
    const categories = categoriesResult.rows;
    
    if (categories.length === 0) {
      throw new Error('Categories not found. Run migrations first.');
    }
    
    // Get vote options
    const voteOptionsResult = await db.query('SELECT * FROM vote_options');
    const voteOptions = voteOptionsResult.rows;
    
    if (voteOptions.length === 0) {
      throw new Error('Vote options not found. Run migrations first.');
    }
    
    // Sample user data
    const users = [
      {
        firebase_uid: 'seed-user-1',
        email: 'johndoe@example.com',
        first_name: 'John',
        last_name: 'Doe',
        phone_number: '+1234567890'
      },
      {
        firebase_uid: 'seed-user-2',
        email: 'janedoe@example.com',
        first_name: 'Jane',
        last_name: 'Doe',
        phone_number: '+1987654321'
      },
      {
        firebase_uid: 'seed-user-3',
        email: 'bobsmith@example.com',
        first_name: 'Bob',
        last_name: 'Smith',
        phone_number: '+1122334455'
      }
    ];
    
    // Create users
    console.log('Creating sample users...');
    const createdUsers = [];
    
    for (const userData of users) {
      const result = await db.query(
        `INSERT INTO users (firebase_uid, email, first_name, last_name, phone_number)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          userData.firebase_uid,
          userData.email,
          userData.first_name,
          userData.last_name,
          userData.phone_number
        ]
      );
      
      createdUsers.push(result.rows[0]);
      console.log(`Created user: ${result.rows[0].first_name} ${result.rows[0].last_name}`);
    }
    
    // Sample property data
    const propertyTemplates = [
      {
        title: 'Modern Apartment in Downtown',
        description: 'Beautifully renovated apartment in the heart of downtown. Features open floor plan, high ceilings, and modern appliances.',
        location: 'New York, NY',
        category_id: categories.find(c => c.name === 'Residential').id,
        current_worth: 350000,
        year_of_construction: 2010
      },
      {
        title: 'Commercial Space in Business District',
        description: 'Prime commercial space in the business district. Ideal for office, retail, or restaurant.',
        location: 'San Francisco, CA',
        category_id: categories.find(c => c.name === 'Commercial').id,
        current_worth: 1200000,
        year_of_construction: 2005
      },
      {
        title: 'Beachfront Villa with Ocean View',
        description: 'Stunning beachfront villa with panoramic ocean views. Features private pool, garden, and direct beach access.',
        location: 'Miami, FL',
        category_id: categories.find(c => c.name === 'Residential').id,
        current_worth: 750000,
        year_of_construction: 2015
      },
      {
        title: 'Industrial Warehouse with Office Space',
        description: 'Large industrial warehouse with attached office space. High ceilings, loading docks, and ample parking.',
        location: 'Chicago, IL',
        category_id: categories.find(c => c.name === 'Commercial').id,
        current_worth: 900000,
        year_of_construction: 2000
      },
      {
        title: 'Vacant Land for Development',
        description: 'Prime vacant land for development. Zoned for mixed-use. Utilities available at site.',
        location: 'Austin, TX',
        category_id: categories.find(c => c.name === 'Land').id,
        current_worth: 500000,
        year_of_construction: null
      },
      {
        title: 'Premium Reclaimed Wood',
        description: 'High-quality reclaimed wood for construction and renovation projects. Various types and sizes available.',
        location: 'Portland, OR',
        category_id: categories.find(c => c.name === 'Material').id,
        current_worth: 10000,
        year_of_construction: null
      },
      {
        title: 'Luxury Penthouse with City Views',
        description: 'Elegant penthouse with stunning city views. Features gourmet kitchen, spa bathrooms, and private terrace.',
        location: 'Los Angeles, CA',
        category_id: categories.find(c => c.name === 'Residential').id,
        current_worth: 1500000,
        year_of_construction: 2018
      },
      {
        title: 'Retail Space in Shopping Center',
        description: 'Retail space in high-traffic shopping center. Great visibility and foot traffic.',
        location: 'Seattle, WA',
        category_id: categories.find(c => c.name === 'Commercial').id,
        current_worth: 450000,
        year_of_construction: 2012
      }
    ];
    
    // Create properties with images
    console.log('Creating sample properties...');
    const createdProperties = [];
    
    for (const propertyTemplate of propertyTemplates) {
      // Assign to a random user
      const user = getRandomItem(createdUsers);
      
      // Generate random number of images (1-5)
      const imageCount = getRandomNumber(1, 5);
      const images = [];
      
      // Create images using picsum.photos
      for (let i = 0; i < imageCount; i++) {
        // Random width and height between 500-1000
        const width = getRandomNumber(500, 1000);
        const height = getRandomNumber(500, 1000);
        const imageId = getRandomNumber(1, 1000);
        
        images.push({
          image_url: `https://picsum.photos/id/${imageId}/${width}/${height}`,
          is_primary: i === 0 // First image is primary
        });
      }
      
      // Create property
      const propertyData = {
        ...propertyTemplate,
        user_id: user.id,
        images
      };
      
      const property = await PropertyModel.createProperty(propertyData);
      createdProperties.push(property);
      console.log(`Created property: ${property.title}`);
      
      // Add random votes
      const voteCount = getRandomNumber(5, 20);
      
      for (let i = 0; i < voteCount; i++) {
        // Get random user (different from property owner)
        let voter;
        do {
          voter = getRandomItem(createdUsers);
        } while (voter.id === user.id);
        
        // Get random vote option for the property's category
        const categoryOptions = voteOptions.filter(
          option => option.category_id === property.category_id
        );
        const voteOption = getRandomItem(categoryOptions);
        
        // Create vote
        try {
          await VoteModel.createVote({
            property_id: property.id,
            user_id: voter.id,
            vote_option_id: voteOption.id
          });
        } catch (error) {
          // Skip if vote already exists (same user-property combination)
          if (!error.message.includes('duplicate key')) {
            throw error;
          }
        }
      }
      
      console.log(`Added ${voteCount} votes to property: ${property.title}`);
    }
    
    console.log('Database seeding completed successfully.');
  } catch (error) {
    console.error('Seeding error:', error);
    throw error;
  }
}

// Run seeding if script is called directly
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('Seeding process completed.');
      process.exit(0);
    })
    .catch(error => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
} else {
  // Export for use in other files
  module.exports = { seedDatabase };
}