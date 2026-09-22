ALTER TABLE `reviews` ADD `title_en` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `reviews` ADD `title_ja` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `reviews` ADD `body_en` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `reviews` ADD `body_ja` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `requests_en` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `requests_ja` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `reviews` SET `title_en` = `title`, `body_en` = `body` WHERE `locale` = 'en';--> statement-breakpoint
UPDATE `reviews` SET `title_ja` = `title`, `body_ja` = `body` WHERE `locale` = 'ja';--> statement-breakpoint
UPDATE `reviews` SET `title_en` = `title` WHERE `title_en` = '' AND `title` != '';--> statement-breakpoint
UPDATE `reviews` SET `body_en` = `body` WHERE `body_en` = '' AND `body` != '';--> statement-breakpoint
UPDATE `reviews` SET `title_ja` = `title` WHERE `title_ja` = '' AND `title` != '';--> statement-breakpoint
UPDATE `reviews` SET `body_ja` = `body` WHERE `body_ja` = '' AND `body` != '';--> statement-breakpoint
UPDATE `bookings` SET `requests_en` = `requests`, `requests_ja` = `requests` WHERE `requests` != '';
