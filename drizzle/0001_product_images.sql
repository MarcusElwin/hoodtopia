CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`products` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `custom_designs` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`type` text NOT NULL,
	`original_input` text NOT NULL,
	`generated_image_url` text NOT NULL,
	`prompt` text NOT NULL,
	`base_color` text DEFAULT 'Black',
	`refinement_history` text,
	`status` text DEFAULT 'generating',
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`kustom_order_id` text NOT NULL,
	`status` text NOT NULL,
	`total_amount` integer NOT NULL,
	`currency` text NOT NULL,
	`customer_email` text,
	`session_id` text,
	`snapshot_json` text NOT NULL,
	`acknowledged_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_kustom_order_id_unique` ON `orders` (`kustom_order_id`);--> statement-breakpoint
CREATE TABLE `product_images` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`url` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`alt` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
