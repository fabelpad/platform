CREATE TABLE `family_documents` (
	`parent_id` text PRIMARY KEY NOT NULL,
	`document` text NOT NULL,
	`revision` integer NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `parent_accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "family_document_valid_json" CHECK(json_valid("family_documents"."document")),
	CONSTRAINT "family_document_positive_revision" CHECK("family_documents"."revision" >= 1)
);
--> statement-breakpoint
CREATE TABLE `parent_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
