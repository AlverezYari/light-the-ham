/**
 * Database Schema for Light the Ham!
 *
 * This file defines all database tables using Drizzle ORM.
 * Think of it like SQLAlchemy models in Python.
 *
 * Drizzle will use these definitions to:
 * 1. Generate SQL migrations
 * 2. Provide TypeScript types for queries
 * 3. Enable type-safe database operations
 */

import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Creates a UUID primary key field.
 * SQLite doesn't have a native UUID type, so we use TEXT.
 * The ID is generated in JavaScript using crypto.randomUUID()
 */
const id = (name = 'id') =>
  text(name)
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

/**
 * Creates a timestamp field stored as Unix epoch (integer).
 * More efficient than storing ISO strings.
 */
const createdAt = () =>
  integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date());

// ============================================================
// SEASONS TABLE
// ============================================================

/**
 * Seasons track each Christmas season (2025, 2026, etc.)
 * Properties and ratings are associated with a specific season.
 */
export const seasons = sqliteTable('seasons', {
  id: id(),
  year: integer('year').notNull().unique(),
  startDate: text('start_date').notNull(),  // ISO date: "2025-11-28"
  endDate: text('end_date').notNull(),      // ISO date: "2026-01-06"
  votingOpen: integer('voting_open', { mode: 'boolean' }).default(false),
  status: text('status', { enum: ['upcoming', 'active', 'archived'] }).default('upcoming'),
  createdAt: createdAt(),
});

// ============================================================
// USERS TABLE
// ============================================================

/**
 * Users table - for authenticated users via OAuth.
 * Supports Google, Apple, and Facebook sign-in.
 */
export const users = sqliteTable('users', {
  id: id(),
  email: text('email').unique(),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  role: text('role', { enum: ['user', 'moderator', 'admin'] }).default('user'),

  // OAuth fields
  oauthProvider: text('oauth_provider', { enum: ['google', 'apple', 'facebook'] }),
  oauthProviderId: text('oauth_provider_id'),  // ID from the OAuth provider

  // Contribution limits/tracking
  isTrusted: integer('is_trusted', { mode: 'boolean' }).default(false),  // For power users

  createdAt: createdAt(),
  lastActive: integer('last_active', { mode: 'timestamp' }),
}, (table) => [
  uniqueIndex('idx_users_oauth').on(table.oauthProvider, table.oauthProviderId),
]);

// ============================================================
// SESSIONS TABLE
// ============================================================

/**
 * Sessions for authenticated users.
 * Simple token-based sessions stored in DB.
 */
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),  // Session token
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: createdAt(),
}, (table) => [
  index('idx_sessions_user').on(table.userId),
  index('idx_sessions_expires').on(table.expiresAt),
]);

// ============================================================
// PROPERTIES TABLE
// ============================================================

/**
 * Properties are the core entity - Christmas light displays.
 * Each property belongs to a season and can have multiple contributions.
 */
export const properties = sqliteTable('properties', {
  id: id(),
  seasonId: text('season_id').notNull().references(() => seasons.id),

  // Location fields
  address: text('address').notNull(),
  addressLine2: text('address_line2'),
  city: text('city').notNull(),
  state: text('state').default('AL'),
  zip: text('zip').notNull(),
  neighborhood: text('neighborhood'),
  lat: real('lat').notNull(),   // Latitude as floating point
  lng: real('lng').notNull(),   // Longitude as floating point

  // Display information
  displayName: text('display_name'),  // Optional creative name
  description: text('description'),
  bestTimes: text('best_times'),      // e.g., "6pm-10pm nightly"
  parkingNotes: text('parking_notes'),

  // Denormalized aggregates (updated when ratings change)
  avgRating: real('avg_rating').default(0),
  ratingCount: integer('rating_count').default(0),
  contributionCount: integer('contribution_count').default(0),
  photoCount: integer('photo_count').default(0),

  // Status and moderation
  status: text('status', {
    enum: ['pending', 'approved', 'rejected', 'removed']
  }).default('pending'),
  featured: integer('featured', { mode: 'boolean' }).default(false),

  // Ownership - user who claimed to own this property
  ownerId: text('owner_id').references(() => users.id),

  // Timestamps
  createdAt: createdAt(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
  approvedAt: integer('approved_at', { mode: 'timestamp' }),
  approvedBy: text('approved_by').references(() => users.id),
}, (table) => [
  // Indexes for common queries
  index('idx_properties_season').on(table.seasonId),
  index('idx_properties_status').on(table.status),
  index('idx_properties_city').on(table.city),
  index('idx_properties_rating').on(table.avgRating),
  index('idx_properties_location').on(table.lat, table.lng),
  index('idx_properties_owner').on(table.ownerId),
]);

// ============================================================
// CONTRIBUTIONS TABLE
// ============================================================

/**
 * Contributions track individual user interactions with properties.
 * A user can rate, leave tips, and add photos through contributions.
 */
export const contributions = sqliteTable('contributions', {
  id: id(),
  propertyId: text('property_id')
    .notNull()
    .references(() => properties.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id),

  // Contributor info
  contributorType: text('contributor_type', {
    enum: ['owner', 'neighbor', 'visitor']
  }).notNull(),
  anonymousId: text('anonymous_id'),  // IP hash or session ID for anonymous users

  // Contribution content
  rating: integer('rating'),  // 1-5, validated in application
  tip: text('tip'),           // Visitor tips like "Best parking on Oak St"

  // Status
  status: text('status', {
    enum: ['pending', 'approved', 'rejected']
  }).default('pending'),

  // Timestamps
  createdAt: createdAt(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
  moderatedAt: integer('moderated_at', { mode: 'timestamp' }),
  moderatedBy: text('moderated_by').references(() => users.id),
}, (table) => [
  index('idx_contributions_property').on(table.propertyId),
  index('idx_contributions_user').on(table.userId),
  index('idx_contributions_status').on(table.status),
]);

// ============================================================
// PROPERTY PHOTOS TABLE
// ============================================================

/**
 * Photos uploaded for properties.
 * Each photo can be associated with a contribution.
 */
export const propertyPhotos = sqliteTable('property_photos', {
  id: id(),
  propertyId: text('property_id')
    .notNull()
    .references(() => properties.id, { onDelete: 'cascade' }),
  contributionId: text('contribution_id')
    .references(() => contributions.id, { onDelete: 'set null' }),

  // Photo data
  url: text('url').notNull(),           // Path like "/uploads/abc123.jpg"
  thumbnailUrl: text('thumbnail_url'),  // Smaller version
  caption: text('caption'),

  // Metadata
  width: integer('width'),
  height: integer('height'),
  fileSize: integer('file_size'),  // Bytes

  // Display order
  sortOrder: integer('sort_order').default(0),
  isPrimary: integer('is_primary', { mode: 'boolean' }).default(false),

  // Status
  status: text('status', {
    enum: ['pending', 'approved', 'rejected']
  }).default('pending'),

  // Timestamps
  createdAt: createdAt(),
  moderatedAt: integer('moderated_at', { mode: 'timestamp' }),
  moderatedBy: text('moderated_by').references(() => users.id),
}, (table) => [
  index('idx_photos_property').on(table.propertyId),
  index('idx_photos_status').on(table.status),
]);

// ============================================================
// FEATURE TAGS TABLE
// ============================================================

/**
 * Predefined feature tags for categorizing displays.
 * Examples: "Music Sync", "Walk-Through", "Animated"
 */
export const featureTags = sqliteTable('feature_tags', {
  id: id(),
  name: text('name').notNull().unique(),   // "Music Sync"
  slug: text('slug').notNull().unique(),   // "music-sync"
  description: text('description'),
  icon: text('icon'),                       // Icon identifier for UI
  category: text('category'),               // "audio", "visual", "interactive"
  sortOrder: integer('sort_order').default(0),
});

// ============================================================
// PROPERTY FEATURES (Junction Table)
// ============================================================

/**
 * Links properties to feature tags.
 * Tracks how many users have confirmed each feature.
 */
export const propertyFeatures = sqliteTable('property_features', {
  id: id(),
  propertyId: text('property_id')
    .notNull()
    .references(() => properties.id, { onDelete: 'cascade' }),
  featureId: text('feature_id')
    .notNull()
    .references(() => featureTags.id, { onDelete: 'cascade' }),
  contributionId: text('contribution_id')
    .references(() => contributions.id),
  confirmedCount: integer('confirmed_count').default(1),
  createdAt: createdAt(),
}, (table) => [
  index('idx_property_features_property').on(table.propertyId),
  index('idx_property_features_feature').on(table.featureId),
  uniqueIndex('idx_property_features_unique').on(table.propertyId, table.featureId),
]);

// ============================================================
// MODERATION LOG TABLE
// ============================================================

/**
 * Audit trail for moderation actions.
 * Records who approved/rejected what and when.
 */
export const moderationLog = sqliteTable('moderation_log', {
  id: id(),
  moderatorId: text('moderator_id')
    .notNull()
    .references(() => users.id),
  entityType: text('entity_type').notNull(),  // "property", "contribution", "photo"
  entityId: text('entity_id').notNull(),
  action: text('action').notNull(),           // "approve", "reject", "remove", "restore"
  reason: text('reason'),
  previousStatus: text('previous_status'),
  newStatus: text('new_status'),
  createdAt: createdAt(),
}, (table) => [
  index('idx_moderation_entity').on(table.entityType, table.entityId),
  index('idx_moderation_moderator').on(table.moderatorId),
]);

// ============================================================
// PROPERTY CLAIMS TABLE
// ============================================================

/**
 * Tracks ownership claims for properties.
 * - Auto-approved if property has no current owner
 * - Goes to dispute queue if owner already exists
 * - Users limited to 3 claims, 24hr cooldown between claims
 */
export const propertyClaims = sqliteTable('property_claims', {
  id: id(),
  propertyId: text('property_id')
    .notNull()
    .references(() => properties.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  // Claim status
  status: text('status', {
    enum: ['pending', 'approved', 'rejected', 'disputed']
  }).default('pending'),

  // For disputes - proof of ownership
  proofUrl: text('proof_url'),         // Uploaded bill/document
  proofNotes: text('proof_notes'),     // User's explanation

  // Resolution
  resolvedAt: integer('resolved_at', { mode: 'timestamp' }),
  resolvedBy: text('resolved_by').references(() => users.id),
  resolutionNotes: text('resolution_notes'),

  // Timestamps
  createdAt: createdAt(),
}, (table) => [
  index('idx_claims_property').on(table.propertyId),
  index('idx_claims_user').on(table.userId),
  index('idx_claims_status').on(table.status),
]);

// ============================================================
// TOURS TABLE
// ============================================================

/**
 * Tours are shareable routes/collections of properties.
 * Users can create a tour, share the link, and others can navigate it.
 */
export const tours = sqliteTable('tours', {
  id: id(),
  slug: text('slug').notNull().unique(),  // URL-friendly ID like "smith-family-2025"
  name: text('name').notNull(),            // "Smith Family Christmas Tour 2025"
  description: text('description'),

  // Creator (optional - allow anonymous tour creation)
  creatorId: text('creator_id').references(() => users.id),
  creatorName: text('creator_name'),       // For anonymous creators

  // Visibility
  isPublic: integer('is_public', { mode: 'boolean' }).default(true),
  isFeatured: integer('is_featured', { mode: 'boolean' }).default(false),

  // Stats
  viewCount: integer('view_count').default(0),

  // Timestamps
  createdAt: createdAt(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
}, (table) => [
  index('idx_tours_slug').on(table.slug),
  index('idx_tours_public').on(table.isPublic),
  index('idx_tours_featured').on(table.isFeatured),
  index('idx_tours_creator').on(table.creatorId),
]);

// ============================================================
// TOUR STOPS TABLE (Junction)
// ============================================================

/**
 * Links tours to properties in a specific order.
 * Each stop has a position for ordered navigation.
 */
export const tourStops = sqliteTable('tour_stops', {
  id: id(),
  tourId: text('tour_id')
    .notNull()
    .references(() => tours.id, { onDelete: 'cascade' }),
  propertyId: text('property_id')
    .notNull()
    .references(() => properties.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),  // Order in the tour (0, 1, 2...)
  note: text('note'),                        // Optional note like "Don't miss the backyard!"
  createdAt: createdAt(),
}, (table) => [
  index('idx_tour_stops_tour').on(table.tourId),
  index('idx_tour_stops_property').on(table.propertyId),
  uniqueIndex('idx_tour_stops_unique').on(table.tourId, table.propertyId),
]);

// ============================================================
// RELATIONS (for Drizzle relational queries)
// ============================================================

/**
 * Relations define how tables connect to each other.
 * This enables Drizzle's relational query API:
 *
 *   db.query.properties.findFirst({
 *     with: { photos: true, contributions: true }
 *   })
 */

export const seasonsRelations = relations(seasons, ({ many }) => ({
  properties: many(properties),
}));

export const propertiesRelations = relations(properties, ({ one, many }) => ({
  season: one(seasons, {
    fields: [properties.seasonId],
    references: [seasons.id],
  }),
  photos: many(propertyPhotos),
  contributions: many(contributions),
  features: many(propertyFeatures),
  claims: many(propertyClaims),
}));

export const contributionsRelations = relations(contributions, ({ one, many }) => ({
  property: one(properties, {
    fields: [contributions.propertyId],
    references: [properties.id],
  }),
  user: one(users, {
    fields: [contributions.userId],
    references: [users.id],
  }),
  photos: many(propertyPhotos),
}));

export const propertyPhotosRelations = relations(propertyPhotos, ({ one }) => ({
  property: one(properties, {
    fields: [propertyPhotos.propertyId],
    references: [properties.id],
  }),
  contribution: one(contributions, {
    fields: [propertyPhotos.contributionId],
    references: [contributions.id],
  }),
}));

export const propertyFeaturesRelations = relations(propertyFeatures, ({ one }) => ({
  property: one(properties, {
    fields: [propertyFeatures.propertyId],
    references: [properties.id],
  }),
  feature: one(featureTags, {
    fields: [propertyFeatures.featureId],
    references: [featureTags.id],
  }),
}));

export const toursRelations = relations(tours, ({ one, many }) => ({
  creator: one(users, {
    fields: [tours.creatorId],
    references: [users.id],
  }),
  stops: many(tourStops),
}));

export const tourStopsRelations = relations(tourStops, ({ one }) => ({
  tour: one(tours, {
    fields: [tourStops.tourId],
    references: [tours.id],
  }),
  property: one(properties, {
    fields: [tourStops.propertyId],
    references: [properties.id],
  }),
}));

export const propertyClaimsRelations = relations(propertyClaims, ({ one }) => ({
  property: one(properties, {
    fields: [propertyClaims.propertyId],
    references: [properties.id],
  }),
  user: one(users, {
    fields: [propertyClaims.userId],
    references: [users.id],
  }),
}));
