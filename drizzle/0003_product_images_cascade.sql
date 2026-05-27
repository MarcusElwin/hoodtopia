-- Custom: rebuild product_images so variant_id carries ON DELETE CASCADE.
-- 0002's ALTER TABLE ADD COLUMN couldn't attach the cascade action (SQLite
-- limitation), so foreign-key cleanup wouldn't happen if a variant is ever
-- deleted. Rebuild via SQLite's standard 12-step pattern.
--
-- Safe to run against the existing Turso table (which has rows): every row
-- now has variant_id populated, so the SELECT carries them across.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_product_images` (
  `id` text PRIMARY KEY NOT NULL,
  `product_id` text NOT NULL REFERENCES `products`(`id`) ON DELETE CASCADE,
  `variant_id` text NOT NULL REFERENCES `product_variants`(`id`) ON DELETE CASCADE,
  `url` text NOT NULL,
  `position` integer NOT NULL DEFAULT 1,
  `alt` text,
  `created_at` integer NOT NULL
);--> statement-breakpoint
INSERT INTO `__new_product_images` (`id`, `product_id`, `variant_id`, `url`, `position`, `alt`, `created_at`)
  SELECT `id`, `product_id`, `variant_id`, `url`, `position`, `alt`, `created_at`
  FROM `product_images`
  WHERE `variant_id` IS NOT NULL;--> statement-breakpoint
DROP TABLE `product_images`;--> statement-breakpoint
ALTER TABLE `__new_product_images` RENAME TO `product_images`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
