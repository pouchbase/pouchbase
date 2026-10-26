CREATE TABLE `plugin_bundle_parts` (
	`plugin_id` text NOT NULL,
	`part` integer NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`plugin_id`, `part`)
);
--> statement-breakpoint
INSERT INTO `plugin_bundle_parts` (`plugin_id`, `part`, `data`) SELECT `id`, 0, `bundle` FROM `plugins`;
--> statement-breakpoint
ALTER TABLE `plugins` DROP COLUMN `bundle`;