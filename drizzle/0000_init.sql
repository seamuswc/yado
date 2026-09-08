CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`target` text DEFAULT '' NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`ref` text NOT NULL,
	`hotel_id` text NOT NULL,
	`room_id` text NOT NULL,
	`user_id` text,
	`check_in` text NOT NULL,
	`check_out` text NOT NULL,
	`guests` integer NOT NULL,
	`nights` integer NOT NULL,
	`total` integer NOT NULL,
	`currency` text DEFAULT 'jpy' NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`requests` text DEFAULT '' NOT NULL,
	`locale` text DEFAULT 'en' NOT NULL,
	`status` text DEFAULT 'pending_payment' NOT NULL,
	`payment_mode` text DEFAULT 'demo' NOT NULL,
	`stripe_session_id` text,
	`stripe_payment_intent_id` text,
	`paid_at` text,
	`cancelled_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_ref_unique` ON `bookings` (`ref`);--> statement-breakpoint
CREATE INDEX `bookings_hotel_idx` ON `bookings` (`hotel_id`);--> statement-breakpoint
CREATE INDEX `bookings_room_dates_idx` ON `bookings` (`room_id`,`check_in`,`check_out`);--> statement-breakpoint
CREATE INDEX `bookings_created_idx` ON `bookings` (`created_at`);--> statement-breakpoint
CREATE INDEX `bookings_email_idx` ON `bookings` (`email`);--> statement-breakpoint
CREATE TABLE `emails` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`to` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`provider` text DEFAULT 'console' NOT NULL,
	`status` text DEFAULT 'logged' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`path` text DEFAULT '' NOT NULL,
	`locale` text DEFAULT '' NOT NULL,
	`visitor_id` text DEFAULT '' NOT NULL,
	`meta` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `events_created_idx` ON `events` (`created_at`);--> statement-breakpoint
CREATE INDEX `events_type_idx` ON `events` (`type`);--> statement-breakpoint
CREATE TABLE `hotels` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`owner_id` text,
	`name_en` text NOT NULL,
	`name_ja` text NOT NULL,
	`city` text NOT NULL,
	`area_en` text DEFAULT '' NOT NULL,
	`area_ja` text DEFAULT '' NOT NULL,
	`type` text DEFAULT 'hotel' NOT NULL,
	`description_en` text DEFAULT '' NOT NULL,
	`description_ja` text DEFAULT '' NOT NULL,
	`access_en` text DEFAULT '' NOT NULL,
	`access_ja` text DEFAULT '' NOT NULL,
	`amenities` text DEFAULT '[]' NOT NULL,
	`images` text DEFAULT '[]' NOT NULL,
	`check_in_time` text DEFAULT '15:00' NOT NULL,
	`check_out_time` text DEFAULT '11:00' NOT NULL,
	`rating` real DEFAULT 0 NOT NULL,
	`review_count` integer DEFAULT 0 NOT NULL,
	`legal_name` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`license_number` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`paid_until` text,
	`stripe_customer_id` text,
	`stripe_subscription_id` text,
	`review_note` text DEFAULT '' NOT NULL,
	`reviewed_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hotels_slug_unique` ON `hotels` (`slug`);--> statement-breakpoint
CREATE INDEX `hotels_status_idx` ON `hotels` (`status`);--> statement-breakpoint
CREATE INDEX `hotels_owner_idx` ON `hotels` (`owner_id`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`hotel_id` text NOT NULL,
	`name_en` text NOT NULL,
	`name_ja` text NOT NULL,
	`description_en` text DEFAULT '' NOT NULL,
	`description_ja` text DEFAULT '' NOT NULL,
	`sleeps` integer DEFAULT 2 NOT NULL,
	`price_per_night` integer NOT NULL,
	`breakfast` integer DEFAULT false NOT NULL,
	`refundable` integer DEFAULT true NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`image` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `rooms_hotel_idx` ON `rooms` (`hotel_id`);--> statement-breakpoint
CREATE TABLE `server_samples` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`rss_mb` real NOT NULL,
	`heap_used_mb` real NOT NULL,
	`total_mem_mb` real NOT NULL,
	`load1` real NOT NULL,
	`cpus` integer NOT NULL,
	`event_loop_lag_ms` real NOT NULL,
	`db_size_mb` real NOT NULL,
	`requests_last_minute` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `samples_created_idx` ON `server_samples` (`created_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text,
	`name` text DEFAULT '' NOT NULL,
	`role` text DEFAULT 'guest' NOT NULL,
	`email_verified_at` text,
	`locale` text DEFAULT 'en' NOT NULL,
	`disabled_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `verification_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`purpose` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
