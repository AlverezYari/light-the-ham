CREATE TABLE `contributions` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`user_id` text,
	`contributor_type` text NOT NULL,
	`anonymous_id` text,
	`rating` integer,
	`tip` text,
	`status` text DEFAULT 'pending',
	`created_at` integer,
	`updated_at` integer,
	`moderated_at` integer,
	`moderated_by` text,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`moderated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_contributions_property` ON `contributions` (`property_id`);--> statement-breakpoint
CREATE INDEX `idx_contributions_user` ON `contributions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_contributions_status` ON `contributions` (`status`);--> statement-breakpoint
CREATE TABLE `feature_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`icon` text,
	`category` text,
	`sort_order` integer DEFAULT 0
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feature_tags_name_unique` ON `feature_tags` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `feature_tags_slug_unique` ON `feature_tags` (`slug`);--> statement-breakpoint
CREATE TABLE `moderation_log` (
	`id` text PRIMARY KEY NOT NULL,
	`moderator_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`reason` text,
	`previous_status` text,
	`new_status` text,
	`created_at` integer,
	FOREIGN KEY (`moderator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_moderation_entity` ON `moderation_log` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_moderation_moderator` ON `moderation_log` (`moderator_id`);--> statement-breakpoint
CREATE TABLE `properties` (
	`id` text PRIMARY KEY NOT NULL,
	`season_id` text NOT NULL,
	`address` text NOT NULL,
	`address_line2` text,
	`city` text NOT NULL,
	`state` text DEFAULT 'AL',
	`zip` text NOT NULL,
	`neighborhood` text,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`display_name` text,
	`description` text,
	`best_times` text,
	`parking_notes` text,
	`avg_rating` real DEFAULT 0,
	`rating_count` integer DEFAULT 0,
	`contribution_count` integer DEFAULT 0,
	`photo_count` integer DEFAULT 0,
	`status` text DEFAULT 'pending',
	`featured` integer DEFAULT false,
	`owner_id` text,
	`created_at` integer,
	`updated_at` integer,
	`approved_at` integer,
	`approved_by` text,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_properties_season` ON `properties` (`season_id`);--> statement-breakpoint
CREATE INDEX `idx_properties_status` ON `properties` (`status`);--> statement-breakpoint
CREATE INDEX `idx_properties_city` ON `properties` (`city`);--> statement-breakpoint
CREATE INDEX `idx_properties_rating` ON `properties` (`avg_rating`);--> statement-breakpoint
CREATE INDEX `idx_properties_location` ON `properties` (`lat`,`lng`);--> statement-breakpoint
CREATE INDEX `idx_properties_owner` ON `properties` (`owner_id`);--> statement-breakpoint
CREATE TABLE `property_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'pending',
	`proof_url` text,
	`proof_notes` text,
	`resolved_at` integer,
	`resolved_by` text,
	`resolution_notes` text,
	`created_at` integer,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_claims_property` ON `property_claims` (`property_id`);--> statement-breakpoint
CREATE INDEX `idx_claims_user` ON `property_claims` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_claims_status` ON `property_claims` (`status`);--> statement-breakpoint
CREATE TABLE `property_features` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`feature_id` text NOT NULL,
	`contribution_id` text,
	`confirmed_count` integer DEFAULT 1,
	`created_at` integer,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`feature_id`) REFERENCES `feature_tags`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contribution_id`) REFERENCES `contributions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_property_features_property` ON `property_features` (`property_id`);--> statement-breakpoint
CREATE INDEX `idx_property_features_feature` ON `property_features` (`feature_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_property_features_unique` ON `property_features` (`property_id`,`feature_id`);--> statement-breakpoint
CREATE TABLE `property_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`contribution_id` text,
	`url` text NOT NULL,
	`thumbnail_url` text,
	`caption` text,
	`width` integer,
	`height` integer,
	`file_size` integer,
	`sort_order` integer DEFAULT 0,
	`is_primary` integer DEFAULT false,
	`status` text DEFAULT 'pending',
	`created_at` integer,
	`moderated_at` integer,
	`moderated_by` text,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contribution_id`) REFERENCES `contributions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`moderated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_photos_property` ON `property_photos` (`property_id`);--> statement-breakpoint
CREATE INDEX `idx_photos_status` ON `property_photos` (`status`);--> statement-breakpoint
CREATE TABLE `seasons` (
	`id` text PRIMARY KEY NOT NULL,
	`year` integer NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`voting_open` integer DEFAULT false,
	`status` text DEFAULT 'upcoming',
	`created_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `seasons_year_unique` ON `seasons` (`year`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_user` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_sessions_expires` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `tour_stops` (
	`id` text PRIMARY KEY NOT NULL,
	`tour_id` text NOT NULL,
	`property_id` text NOT NULL,
	`position` integer NOT NULL,
	`note` text,
	`created_at` integer,
	FOREIGN KEY (`tour_id`) REFERENCES `tours`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_tour_stops_tour` ON `tour_stops` (`tour_id`);--> statement-breakpoint
CREATE INDEX `idx_tour_stops_property` ON `tour_stops` (`property_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tour_stops_unique` ON `tour_stops` (`tour_id`,`property_id`);--> statement-breakpoint
CREATE TABLE `tours` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`creator_id` text,
	`creator_name` text,
	`is_public` integer DEFAULT true,
	`is_featured` integer DEFAULT false,
	`view_count` integer DEFAULT 0,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`creator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tours_slug_unique` ON `tours` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_tours_slug` ON `tours` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_tours_public` ON `tours` (`is_public`);--> statement-breakpoint
CREATE INDEX `idx_tours_featured` ON `tours` (`is_featured`);--> statement-breakpoint
CREATE INDEX `idx_tours_creator` ON `tours` (`creator_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text,
	`display_name` text,
	`avatar_url` text,
	`role` text DEFAULT 'user',
	`oauth_provider` text,
	`oauth_provider_id` text,
	`is_trusted` integer DEFAULT false,
	`created_at` integer,
	`last_active` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_oauth` ON `users` (`oauth_provider`,`oauth_provider_id`);