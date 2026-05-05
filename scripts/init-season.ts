/**
 * Initialize Season & Feature Tags Script
 * Creates the current season and feature tags if they don't exist.
 * Safe to run multiple times.
 *
 * Run with: npx tsx scripts/init-season.ts
 */

import { eq } from 'drizzle-orm';
import { db, featureTags, seasons } from '../src/lib/db';

const CURRENT_SEASON = {
  year: 2025,
  startDate: '2025-11-28', // Thanksgiving
  endDate: '2026-01-06', // Epiphany
  status: 'active' as const,
  votingOpen: true,
};

// Feature tags for property categorization
const FEATURE_TAGS = [
  // Visual features
  { name: 'Animated', slug: 'animated', category: 'visual', icon: '🎬', sortOrder: 1 },
  { name: 'Projection Show', slug: 'projection-show', category: 'visual', icon: '📽️', sortOrder: 2 },
  { name: 'Inflatables', slug: 'inflatables', category: 'visual', icon: '🎈', sortOrder: 3 },

  // Audio features
  { name: 'Music Sync', slug: 'music-sync', category: 'audio', icon: '🎵', sortOrder: 1 },

  // Interactive features
  { name: 'Walk-Through', slug: 'walk-through', category: 'interactive', icon: '🚶', sortOrder: 1 },
  { name: 'Santa Visit', slug: 'santa-visit', category: 'interactive', icon: '🎅', sortOrder: 2 },
  {
    name: 'Hot Cocoa/Treats',
    slug: 'hot-cocoa-treats',
    category: 'interactive',
    icon: '☕',
    sortOrder: 3,
  },

  // Access
  { name: 'Drive-By Only', slug: 'drive-by-only', category: 'access', icon: '🚗', sortOrder: 1 },

  // Audience
  { name: 'Kid Friendly', slug: 'kid-friendly', category: 'audience', icon: '👶', sortOrder: 1 },

  // Community
  {
    name: 'Charity/Donations',
    slug: 'charity-donations',
    category: 'community',
    icon: '❤️',
    sortOrder: 1,
  },

  // Style
  {
    name: 'Classic/Traditional',
    slug: 'classic-traditional',
    category: 'style',
    icon: '🕯️',
    sortOrder: 1,
  },
  { name: 'Over The Top', slug: 'over-the-top', category: 'style', icon: '🤯', sortOrder: 2 },

  // Theme
  { name: 'Religious Theme', slug: 'religious-theme', category: 'theme', icon: '⭐', sortOrder: 1 },
  {
    name: 'Winter Wonderland',
    slug: 'winter-wonderland',
    category: 'theme',
    icon: '❄️',
    sortOrder: 2,
  },

  // Recognition
  { name: 'Award Winner', slug: 'award-winner', category: 'recognition', icon: '🏆', sortOrder: 1 },
];

async function initSeason() {
  console.log('Checking for active season...\n');

  // Check if season already exists
  const existing = await db
    .select()
    .from(seasons)
    .where(eq(seasons.year, CURRENT_SEASON.year))
    .limit(1);

  if (existing.length > 0) {
    console.log(`✓ Season ${CURRENT_SEASON.year} already exists (status: ${existing[0].status})`);

    // Make sure it's active
    if (existing[0].status !== 'active') {
      await db.update(seasons).set({ status: 'active' }).where(eq(seasons.id, existing[0].id));
      console.log(`  → Updated to active`);
    }
  } else {
    // Create the season
    await db.insert(seasons).values(CURRENT_SEASON);
    console.log(`✓ Created season ${CURRENT_SEASON.year}`);
  }

  // Show all seasons
  const allSeasons = await db.select().from(seasons);
  console.log('\nAll seasons:', allSeasons);
}

async function initFeatureTags() {
  console.log('\nChecking for feature tags...');

  // Check if any tags exist
  const existing = await db.select().from(featureTags).limit(1);

  if (existing.length > 0) {
    const count = await db.select().from(featureTags);
    console.log(`✓ Feature tags already exist (${count.length} tags)`);
    return;
  }

  // Create feature tags
  for (const tag of FEATURE_TAGS) {
    await db.insert(featureTags).values(tag);
  }
  console.log(`✓ Created ${FEATURE_TAGS.length} feature tags`);
}

async function init() {
  await initSeason();
  await initFeatureTags();
}

init()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
