CREATE TABLE `change_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`hotel_id` text NOT NULL,
	`user_id` text NOT NULL,
	`field` text NOT NULL,
	`requested` text NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`admin_note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`resolved_at` text,
	FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `change_requests_hotel_idx` ON `change_requests` (`hotel_id`);
--> statement-breakpoint
CREATE INDEX `change_requests_status_idx` ON `change_requests` (`status`);
