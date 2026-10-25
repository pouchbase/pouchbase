CREATE TABLE `plugin_modules` (
	`plugin_id` text NOT NULL,
	`path` text NOT NULL,
	`version` text NOT NULL,
	`code` text NOT NULL,
	`imports` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`plugin_id`, `path`)
);
--> statement-breakpoint
CREATE TABLE `plugin_settings` (
	`plugin_id` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`plugin_id`, `key`)
);
--> statement-breakpoint
ALTER TABLE `plugins` ADD `capabilities` text;