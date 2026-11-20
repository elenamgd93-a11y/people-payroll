CREATE TABLE `attendance` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`date` text NOT NULL,
	`check_in_at` text,
	`check_out_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_employee_date` ON `attendance` (`employee_id`,`date`);--> statement-breakpoint
CREATE TABLE `attendance_corrections` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`date` text NOT NULL,
	`check_in` text NOT NULL,
	`check_out` text,
	`reason` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`decided_by` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `attendance_corrections_employee_idx` ON `attendance_corrections` (`employee_id`);--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text,
	`type` text NOT NULL,
	`number` text DEFAULT '' NOT NULL,
	`expires_on` text,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`file_key` text NOT NULL,
	`uploaded_by` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `documents_employee_idx` ON `documents` (`employee_id`);--> statement-breakpoint
CREATE TABLE `employees` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`email` text NOT NULL,
	`full_name` text NOT NULL,
	`job_title` text DEFAULT '' NOT NULL,
	`department` text DEFAULT '' NOT NULL,
	`manager_id` text,
	`hire_date` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`base_salary` real DEFAULT 0 NOT NULL,
	`allowances` real DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `employees_email_unique` ON `employees` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `employees_user_unique` ON `employees` (`user_id`);--> statement-breakpoint
CREATE INDEX `employees_manager_idx` ON `employees` (`manager_id`);--> statement-breakpoint
CREATE TABLE `leave_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`type_id` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`days` integer NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`decided_by` text,
	`decided_at` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `leave_requests_employee_idx` ON `leave_requests` (`employee_id`);--> statement-breakpoint
CREATE TABLE `leave_types` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`allowance_days` integer,
	`carryover_cap` integer DEFAULT 0 NOT NULL,
	`paid` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payroll_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`employee_name` text NOT NULL,
	`base_salary` real NOT NULL,
	`allowances` real NOT NULL,
	`unpaid_days` integer DEFAULT 0 NOT NULL,
	`unpaid_deduction` real DEFAULT 0 NOT NULL,
	`additions` real DEFAULT 0 NOT NULL,
	`deductions` real DEFAULT 0 NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`net_pay` real NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payroll_lines_run_employee` ON `payroll_lines` (`run_id`,`employee_id`);--> statement-breakpoint
CREATE TABLE `payroll_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`period` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payroll_runs_period` ON `payroll_runs` (`period`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
