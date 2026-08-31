CREATE TABLE `a2a_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`agent` text NOT NULL,
	`scope` text NOT NULL,
	`context_id` text NOT NULL,
	`state` text NOT NULL,
	`payload` text NOT NULL,
	`status_at` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `a2a_tasks_agent_scope_idx` ON `a2a_tasks` (`agent`,`scope`);
--> statement-breakpoint
CREATE INDEX `a2a_tasks_context_idx` ON `a2a_tasks` (`agent`,`scope`,`context_id`);
--> statement-breakpoint
CREATE INDEX `a2a_tasks_updated_idx` ON `a2a_tasks` (`updated_at`);
