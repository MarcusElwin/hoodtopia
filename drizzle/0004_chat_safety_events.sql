CREATE TABLE `chat_safety_events` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`kind` text NOT NULL,
	`reasons` text NOT NULL,
	`excerpt` text NOT NULL,
	`blocked` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
