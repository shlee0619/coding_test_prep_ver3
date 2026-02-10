ALTER TABLE `recommendations` ADD `stats` json;--> statement-breakpoint
ALTER TABLE `user_tag_stats` ADD `avgLevelSolved` float DEFAULT 0;--> statement-breakpoint
ALTER TABLE `user_tag_stats` ADD `maxLevelSolved` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `user_tag_stats` ADD `levelDistribution` json;--> statement-breakpoint
ALTER TABLE `user_tag_stats` ADD `totalProblemsInTag` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `user_tag_stats` ADD `coverageRate` float DEFAULT 0;--> statement-breakpoint
ALTER TABLE `user_tag_stats` ADD `lastSolvedAt` timestamp;--> statement-breakpoint
ALTER TABLE `user_tag_stats` ADD `daysSinceLastSolved` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `user_tag_stats` ADD `recentSolvedCount60d` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `user_tag_stats` ADD `recentSolvedCount90d` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `user_tag_stats` ADD `weakScoreDetails` json;