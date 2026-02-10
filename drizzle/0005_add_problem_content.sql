CREATE TABLE `problem_content` (
	`problemId` int NOT NULL,
	`descriptionHtml` text,
	`sampleInput` text,
	`sampleOutput` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `problem_content_problemId` PRIMARY KEY(`problemId`)
);
