-- WhatsApp (Baileys) login state and single-instance lease.
-- The API also creates these automatically on startup (CREATE TABLE IF NOT
-- EXISTS), so running this by hand is optional.
CREATE TABLE IF NOT EXISTS "whatsapp_auth_state" (
  "key" text PRIMARY KEY,
  "value" text NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "whatsapp_leader_lease" (
  "id" integer PRIMARY KEY,
  "holder" text NOT NULL,
  "expires_at" timestamptz NOT NULL
);
