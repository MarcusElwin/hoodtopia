DROP INDEX "orders_kustom_order_id_unique";--> statement-breakpoint
DROP INDEX "product_variants_sku_unique";--> statement-breakpoint
DROP INDEX "products_slug_unique";--> statement-breakpoint
ALTER TABLE `product_images` ALTER COLUMN "position" TO "position" integer NOT NULL DEFAULT 1;--> statement-breakpoint
CREATE UNIQUE INDEX `orders_kustom_order_id_unique` ON `orders` (`kustom_order_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `product_variants_sku_unique` ON `product_variants` (`sku`);--> statement-breakpoint
CREATE UNIQUE INDEX `products_slug_unique` ON `products` (`slug`);--> statement-breakpoint
ALTER TABLE `product_images` ADD `variant_id` text NOT NULL REFERENCES product_variants(id);