require('dotenv').config({ path: './vault.env' });
const pool = require('./config/db');

const initSchema = async () => {
  const queryText = `
    -- Enable pgvector extension for AI semantic search on itineraries & services
    CREATE EXTENSION IF NOT EXISTS vector;

    -- 1. Users Table
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(150) UNIQUE NOT NULL,
      role VARCHAR(20) DEFAULT 'user',
      avatar_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. Services / Places Table (Hotels, Tours, Restaurants)
    CREATE TABLE IF NOT EXISTS services (
      id SERIAL PRIMARY KEY,
      provider_id INT REFERENCES users(id) ON DELETE SET NULL,
      title VARCHAR(150) NOT NULL,
      description TEXT,
      category VARCHAR(50) NOT NULL, -- 'hotel', 'restaurant', 'activity', 'stay'
      location VARCHAR(150) NOT NULL,
      price_per_unit DECIMAL(10, 2) DEFAULT 0.00,
      unit_type VARCHAR(20) DEFAULT 'xxx',
      embedding VECTOR(1536)
    );

    -- 3. Directly Booked Services
    CREATE TABLE IF NOT EXISTS bookings (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      service_id INT REFERENCES services(id) ON DELETE CASCADE,
      check_in TIMESTAMP NOT NULL,
      check_out TIMESTAMP NOT NULL,
      total_price DECIMAL(10, 2) NOT NULL,
      status VARCHAR(20) DEFAULT 'confirmed',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- 4. Shared Public Itineraries
    CREATE TABLE IF NOT EXISTS itineraries (
      id SERIAL PRIMARY KEY,
      author_id INT REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(200) NOT NULL, -- e.g., "7-Day Tokyo & Kyoto Adventure"
      destination VARCHAR(100) NOT NULL, -- e.g., "Japan", "Barcelona"
      total_days INT NOT NULL,
      description TEXT,
      likes_count INT DEFAULT 0,
      embedding VECTOR(1536), -- Powers AI travel query matching
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- 5. Stops / Schedule Items within an Itinerary
    CREATE TABLE IF NOT EXISTS itinerary_items (
      id SERIAL PRIMARY KEY,
      itinerary_id INT REFERENCES itineraries(id) ON DELETE CASCADE,
      day_number INT NOT NULL, -- Day 1, Day 2, etc.
      order_in_day INT NOT NULL, -- Stop 1, Stop 2, etc.
      service_id INT REFERENCES services(id) ON DELETE SET NULL, -- Static reference to a listing
      custom_title VARCHAR(150) NOT NULL, -- e.g., "Lunch at Ichiran Ramen"
      custom_notes TEXT, -- User tips & recommendations
      estimated_cost DECIMAL(10, 2) DEFAULT 0.00
    );

    -- 6. Likes / Saves Tracking
    CREATE TABLE IF NOT EXISTS itinerary_likes (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      itinerary_id INT REFERENCES itineraries(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, itinerary_id) -- Prevents duplicate likes from same user
    );
  `;

  try {
    console.log('⏳ Updating database schema for community travel itineraries...');
    await pool.query(queryText);
    console.log(' Database schema, likes system, and pgvector initialized successfully!');
  } catch (err) {
    console.error(' Error initializing database schema:', err);
  } finally {
    await pool.end();
  }
};

initSchema();