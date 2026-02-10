CREATE TABLE `goals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`type` enum('problem_count','tag_focus') NOT NULL DEFAULT 'problem_count',
	`targetValue` int NOT NULL,
	`currentValue` int NOT NULL DEFAULT 0,
	`targetTags` json,
	`startDate` timestamp NOT NULL,
	`endDate` timestamp NOT NULL,
	`status` enum('active','completed','failed') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `goals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `linked_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`provider` varchar(32) NOT NULL DEFAULT 'BOJ',
	`handle` varchar(64) NOT NULL,
	`verified` boolean NOT NULL DEFAULT false,
	`solvedCount` int DEFAULT 0,
	`tier` int DEFAULT 0,
	`rating` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `linked_accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `problem_catalog` (
	`problemId` int NOT NULL,
	`title` varchar(512) NOT NULL,
	`level` int NOT NULL DEFAULT 0,
	`tags` json DEFAULT ('[]'),
	`acceptedUserCount` int DEFAULT 0,
	`averageTries` float DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `problem_catalog_problemId` PRIMARY KEY(`problemId`)
);
--> statement-breakpoint
CREATE TABLE `recommendations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`criteria` json,
	`items` json DEFAULT ('[]'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `recommendations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sync_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`status` enum('QUEUED','RUNNING','SUCCESS','FAILED') NOT NULL DEFAULT 'QUEUED',
	`progress` int NOT NULL DEFAULT 0,
	`message` text,
	`startedAt` timestamp,
	`endedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sync_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_problem_status` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`problemId` int NOT NULL,
	`status` enum('UNSOLVED','SOLVED','ATTEMPTED') NOT NULL DEFAULT 'UNSOLVED',
	`isBookmarked` boolean NOT NULL DEFAULT false,
	`solvedAt` timestamp,
	`lastSeenAt` timestamp,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_problem_status_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_tag_stats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`snapshotDate` timestamp NOT NULL DEFAULT (now()),
	`tag` varchar(64) NOT NULL,
	`attemptedCount` int NOT NULL DEFAULT 0,
	`solvedCount` int NOT NULL DEFAULT 0,
	`recentSolvedCount30d` int NOT NULL DEFAULT 0,
	`weakScore` float NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_tag_stats_id` PRIMARY KEY(`id`)
);
