CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`hotel_id` text NOT NULL,
	`booking_id` text,
	`user_id` text,
	`author_name` text DEFAULT '' NOT NULL,
	`rating` integer NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`locale` text DEFAULT 'en' NOT NULL,
	`stay_month` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'visible' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `reviews_hotel_idx` ON `reviews` (`hotel_id`);--> statement-breakpoint
CREATE INDEX `reviews_booking_idx` ON `reviews` (`booking_id`);--> statement-breakpoint
ALTER TABLE `hotels` ADD `station_en` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `hotels` ADD `station_ja` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `hotels` ADD `latitude` real;--> statement-breakpoint
ALTER TABLE `hotels` ADD `longitude` real;--> statement-breakpoint
ALTER TABLE `rooms` ADD `size_sqm` integer;