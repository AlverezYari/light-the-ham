/**
 * Database Seed Script
 *
 * Run with: pnpm db:seed
 *
 * This populates the database with:
 * 1. Feature tags (Music Sync, Animated, etc.)
 * 2. The 2025 season
 * 3. An admin user for testing
 * 4. A few sample properties (optional, for development)
 */

import { eq } from 'drizzle-orm';
import { db, featureTags, properties, propertyFeatures, seasons, users } from '../src/lib/db';

// ============================================================
// SEED DATA
// ============================================================

const featureTagsData = [
  { name: 'Music Sync', slug: 'music-sync', icon: 'music', category: 'audio', sortOrder: 1 },
  {
    name: 'Walk-Through',
    slug: 'walk-through',
    icon: 'walk',
    category: 'interactive',
    sortOrder: 2,
  },
  { name: 'Drive-By Only', slug: 'drive-by', icon: 'car', category: 'access', sortOrder: 3 },
  { name: 'Santa Visit', slug: 'santa', icon: 'gift', category: 'interactive', sortOrder: 4 },
  { name: 'Animated', slug: 'animated', icon: 'sparkles', category: 'visual', sortOrder: 5 },
  {
    name: 'Projection Show',
    slug: 'projection',
    icon: 'projector',
    category: 'visual',
    sortOrder: 6,
  },
  { name: 'Kid Friendly', slug: 'kid-friendly', icon: 'child', category: 'audience', sortOrder: 7 },
  {
    name: 'Hot Cocoa/Treats',
    slug: 'treats',
    icon: 'coffee',
    category: 'interactive',
    sortOrder: 8,
  },
  {
    name: 'Charity/Donations',
    slug: 'charity',
    icon: 'heart',
    category: 'community',
    sortOrder: 9,
  },
  {
    name: 'Award Winner',
    slug: 'award-winner',
    icon: 'trophy',
    category: 'recognition',
    sortOrder: 10,
  },
  { name: 'Classic/Traditional', slug: 'classic', icon: 'star', category: 'style', sortOrder: 11 },
  { name: 'Over The Top', slug: 'over-the-top', icon: 'flame', category: 'style', sortOrder: 12 },
  { name: 'Inflatables', slug: 'inflatables', icon: 'balloon', category: 'visual', sortOrder: 13 },
  { name: 'Religious Theme', slug: 'religious', icon: 'church', category: 'theme', sortOrder: 14 },
  {
    name: 'Winter Wonderland',
    slug: 'winter',
    icon: 'snowflake',
    category: 'theme',
    sortOrder: 15,
  },
  { name: 'Photo Op', slug: 'photo-op', icon: 'camera', category: 'interactive', sortOrder: 16 },
];

const season2025 = {
  year: 2025,
  startDate: '2025-11-28', // Thanksgiving
  endDate: '2026-01-06', // Epiphany
  status: 'active' as const,
  votingOpen: true,
};

// Sample admin user for development only
// In production, use: npx tsx scripts/make-admins.ts your@email.com
const sampleAdminUser = {
  email: 'sample-admin@example.com',
  displayName: 'Sample Admin',
  role: 'admin' as const,
};

// Sample properties for development/testing
const sampleProperties = [
  {
    address: '1 Vulcan Trail',
    city: 'Birmingham',
    zip: '35209',
    neighborhood: 'Five Points South',
    lat: 33.4912,
    lng: -86.7936,
    displayName: "Vulcan's Holiday Glow",
    description:
      'The iconic Vulcan statue area decorated with thousands of lights. A Birmingham tradition!',
    bestTimes: '5:30pm - 11pm nightly',
    status: 'approved' as const,
    avgRating: 4.8,
    ratingCount: 25,
    photoCount: 1,
    features: ['music-sync', 'animated', 'kid-friendly', 'walk-through'],
  },
  {
    address: '2000 Reverend Abraham Woods Jr Blvd',
    city: 'Birmingham',
    zip: '35203',
    neighborhood: 'Downtown',
    lat: 33.5207,
    lng: -86.8025,
    displayName: 'Railroad Park Winter Wonderland',
    description:
      "Downtown's urban park transforms into a winter wonderland with light displays throughout.",
    bestTimes: '5pm - 10pm',
    status: 'approved' as const,
    avgRating: 4.5,
    ratingCount: 18,
    photoCount: 1,
    features: ['walk-through', 'kid-friendly', 'treats', 'charity'],
  },
  {
    address: '3100 Highland Ave S',
    city: 'Birmingham',
    zip: '35205',
    neighborhood: 'Highland Park',
    lat: 33.4892,
    lng: -86.7789,
    displayName: 'Highland Park Holiday House',
    description:
      'Classic neighborhood display with animated deer, thousands of lights, and a full nativity scene.',
    bestTimes: '6pm - 10pm',
    status: 'approved' as const,
    avgRating: 4.2,
    ratingCount: 8,
    photoCount: 1,
    features: ['drive-by', 'classic', 'religious', 'inflatables'],
  },
];

// ============================================================
// SEED FUNCTION
// ============================================================

async function seed() {
  console.log('🌱 Starting database seed...\n');

  // 1. Seed feature tags
  console.log('📌 Seeding feature tags...');
  for (const tag of featureTagsData) {
    try {
      await db.insert(featureTags).values(tag).onConflictDoNothing();
    } catch (_e) {
      // Ignore duplicates
    }
  }
  console.log(`   ✓ ${featureTagsData.length} feature tags\n`);

  // 2. Seed 2025 season
  console.log('📅 Seeding 2025 season...');
  let seasonId: string;
  try {
    const result = await db.insert(seasons).values(season2025).returning({ id: seasons.id });
    seasonId = result[0].id;
    console.log(`   ✓ Season 2025 created (ID: ${seasonId})\n`);
  } catch (e) {
    // Season might already exist, fetch it
    const existing = await db.select().from(seasons).where(eq(seasons.year, 2025));
    if (existing.length > 0) {
      seasonId = existing[0].id;
      console.log(`   ℹ Season 2025 already exists (ID: ${seasonId})\n`);
    } else {
      throw e;
    }
  }

  // 3. Seed admin user
  console.log('👤 Seeding admin user...');
  try {
    await db.insert(users).values(sampleAdminUser).onConflictDoNothing();
    console.log(`   ✓ Admin user created\n`);
  } catch (_e) {
    console.log(`   ℹ Admin user already exists\n`);
  }

  // 4. Seed sample properties (only in dev)
  if (process.env.NODE_ENV !== 'production') {
    console.log('🏠 Seeding sample properties...');
    for (const prop of sampleProperties) {
      try {
        const { features, ...propData } = prop;
        const result = await db
          .insert(properties)
          .values({
            ...propData,
            seasonId,
          })
          .returning({ id: properties.id });

        const propertyId = result[0].id;

        // Add features
        if (features && features.length > 0) {
          for (const featureSlug of features) {
            const tag = await db
              .select({ id: featureTags.id })
              .from(featureTags)
              .where(eq(featureTags.slug, featureSlug))
              .limit(1);

            if (tag.length > 0) {
              await db
                .insert(propertyFeatures)
                .values({
                  propertyId,
                  featureId: tag[0].id,
                })
                .onConflictDoNothing();
            }
          }
        }

        console.log(`   ✓ ${prop.displayName} (${features?.length || 0} features)`);
      } catch (_e) {
        console.log(`   ℹ ${prop.displayName} (skipped - may exist)`);
      }
    }
    console.log('');
  }

  // Summary
  console.log('✅ Seed complete!\n');
  console.log('Database contents:');

  const seasonCount = await db.select().from(seasons);
  const tagCount = await db.select().from(featureTags);
  const userCount = await db.select().from(users);
  const propCount = await db.select().from(properties);

  console.log(`   - Seasons: ${seasonCount.length}`);
  console.log(`   - Feature Tags: ${tagCount.length}`);
  console.log(`   - Users: ${userCount.length}`);
  console.log(`   - Properties: ${propCount.length}`);
}

// Run the seed
seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  });
