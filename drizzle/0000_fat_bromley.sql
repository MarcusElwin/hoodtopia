CREATE TABLE `cart_items` (
	`id` text PRIMARY KEY NOT NULL,
	`cart_id` text NOT NULL,
	`product_id` text NOT NULL,
	`variant_id` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`price_at_add` integer NOT NULL,
	FOREIGN KEY (`cart_id`) REFERENCES `carts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `carts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`session_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `product_variants` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`color` text NOT NULL,
	`color_hex` text NOT NULL,
	`size` text NOT NULL,
	`stock` integer DEFAULT 100 NOT NULL,
	`image_url` text,
	`sku` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_variants_sku_unique` ON `product_variants` (`sku`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text NOT NULL,
	`base_price` integer NOT NULL,
	`image_url` text NOT NULL,
	`category` text NOT NULL,
	`featured` integer DEFAULT false,
	`material` text,
	`features` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_slug_unique` ON `products` (`slug`);--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`preferences` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
