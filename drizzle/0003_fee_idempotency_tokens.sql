PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_verification_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`email` text DEFAULT '' NOT NULL,
	`purpose` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_verification_tokens`("id", "user_id", "email", "purpose", "expires_at", "used_at") SELECT "id", "user_id", '', "purpose", "expires_at", "used_at" FROM `verification_tokens`;--> statement-breakpoint
DROP TABLE `verification_tokens`;--> statement-breakpoint
ALTER TABLE `__new_verification_tokens` RENAME TO `verification_tokens`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `hotels` ADD `last_fee_source` text;