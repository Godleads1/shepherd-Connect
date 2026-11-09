-- The class waitlist feature has been removed from Shepherd Connect.
-- Run this once against each database after deploying the code change.
-- WARNING: permanently deletes all class waitlist entries.
DROP TABLE IF EXISTS "class_waitlist";
DROP TYPE IF EXISTS "waitlist_status";
