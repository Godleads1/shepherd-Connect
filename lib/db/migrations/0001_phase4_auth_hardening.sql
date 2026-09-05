ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "session_version" integer NOT NULL DEFAULT 1;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_token_attempts" integer NOT NULL DEFAULT 0;
ALTER TABLE "sse_tickets" ADD COLUMN IF NOT EXISTS "session_version" integer NOT NULL DEFAULT 1;
ALTER TABLE "otp_sessions" ADD COLUMN IF NOT EXISTS "purpose" text NOT NULL DEFAULT 'registration';
ALTER TABLE "otp_sessions" ADD COLUMN IF NOT EXISTS "channel" text;