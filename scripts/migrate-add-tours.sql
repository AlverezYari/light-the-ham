-- Migration: Add Tours Feature
-- Run this on production SQLite database to add tours tables

-- Tours table
CREATE TABLE IF NOT EXISTS tours (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  creator_id TEXT REFERENCES users(id),
  creator_name TEXT,
  is_public INTEGER DEFAULT 1,
  is_featured INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER
);

-- Tour stops junction table
CREATE TABLE IF NOT EXISTS tour_stops (
  id TEXT PRIMARY KEY,
  tour_id TEXT NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  note TEXT,
  created_at INTEGER
);

-- Indexes for tours
CREATE INDEX IF NOT EXISTS idx_tours_slug ON tours(slug);
CREATE INDEX IF NOT EXISTS idx_tours_public ON tours(is_public);
CREATE INDEX IF NOT EXISTS idx_tours_featured ON tours(is_featured);
CREATE INDEX IF NOT EXISTS idx_tours_creator ON tours(creator_id);

-- Indexes for tour_stops
CREATE INDEX IF NOT EXISTS idx_tour_stops_tour ON tour_stops(tour_id);
CREATE INDEX IF NOT EXISTS idx_tour_stops_property ON tour_stops(property_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tour_stops_unique ON tour_stops(tour_id, property_id);
