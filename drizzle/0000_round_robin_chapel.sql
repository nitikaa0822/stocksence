CREATE TABLE `balances` (
	`product_id` text NOT NULL,
	`location_id` text NOT NULL,
	`qty` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`product_id`, `location_id`),
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "stock_nonnegative" CHECK("balances"."qty" >= 0)
);
--> statement-breakpoint
CREATE TABLE `lines` (
	`id` text PRIMARY KEY NOT NULL,
	`operation_id` text NOT NULL,
	`product_id` text NOT NULL,
	`qty` integer NOT NULL,
	`expected_qty` integer,
	FOREIGN KEY (`operation_id`) REFERENCES `operations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "quantity_nonnegative" CHECK("lines"."qty" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `line_operation_product` ON `lines` (`operation_id`,`product_id`);--> statement-breakpoint
CREATE TABLE `locations` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`warehouse` text NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `location_unique` ON `locations` (`owner`,`warehouse`,`name`);--> statement-breakpoint
CREATE TABLE `movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`operation_id` text NOT NULL,
	`product_id` text NOT NULL,
	`location_id` text NOT NULL,
	`delta` integer NOT NULL,
	`balance_after` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`operation_id`) REFERENCES `operations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `move_once` ON `movements` (`operation_id`,`product_id`,`location_id`);--> statement-breakpoint
CREATE INDEX `movement_product` ON `movements` (`product_id`);--> statement-breakpoint
CREATE TABLE `operations` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`reference` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'Draft' NOT NULL,
	`source_id` text,
	`dest_id` text,
	`partner` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`actor` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dest_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "operation_kind" CHECK("operations"."kind" IN ('receipt','delivery','transfer','adjustment')),
	CONSTRAINT "operation_status" CHECK("operations"."status" IN ('Draft','Waiting','Ready','Done','Canceled'))
);
--> statement-breakpoint
CREATE INDEX `operation_owner_time` ON `operations` (`owner`,`created_at`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`sku` text NOT NULL,
	`category` text NOT NULL,
	`unit` text NOT NULL,
	`reorder` integer DEFAULT 10000 NOT NULL,
	`target` integer DEFAULT 50000 NOT NULL,
	CONSTRAINT "valid_thresholds" CHECK("products"."reorder" >= 0 AND "products"."target" >= "products"."reorder")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_owner_sku` ON `products` (`owner`,`sku`);