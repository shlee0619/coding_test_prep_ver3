-- Performance indexes (REVIEW_REPORT 4.1)
CREATE INDEX `idx_user_status` ON `user_problem_status` (`userId`, `status`);--> statement-breakpoint
CREATE INDEX `idx_user_weak` ON `user_tag_stats` (`userId`, `weakScore`);--> statement-breakpoint
CREATE INDEX `idx_user_generated` ON `recommendations` (`userId`, `generatedAt`);--> statement-breakpoint
CREATE INDEX `idx_user_status_date` ON `goals` (`userId`, `status`, `endDate`);
