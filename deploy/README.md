# Running Shepherd Connect for several churches on one server

This folder runs any number of churches on one Linux server that IntelYtics
manages. Each church gets its own app, database, file storage, WhatsApp number
and web address. Churches cannot see each other's data: each has its own
database and its own login secrets, and its database user cannot connect to
another church's database.

```
                 Internet (HTTPS, automatic certificates)
                                 │
                     ┌───────────┴───────────┐
                     │  web (Caddy)          │  grace.example.org → api-grace
                     │  web app + /branding  │  hope.example.org  → api-hope
                     └──┬────────┬────────┬──┘
                api-grace   api-hope   api-…      one container per church
                     │          │          │
                     └──── postgres ───────┘      one database per church
          (photos and uploads: one S3-compatible bucket per church, e.g. Cloudflare R2)
```

| File | What it is |
|---|---|
| `docker-compose.yml` | Shared services: web server and database |
| `church.env.example` | Template for one church's settings |
| `.env.example` | Server-wide settings (passwords, backup bucket) |
| `bin/add-church` | Add a church |
| `bin/create-admin` | Create a church's first Super Admin |
| `bin/update` | Deploy a new version to every church, one at a time |
| `bin/backup` / `bin/restore` | Nightly backups and restoring one church |
| `bin/status` | Health of every church |
| `bin/compose` | `docker compose` for this server (logs, restart, …) |
| `migrate-from-replit/` | Move an existing church off Replit |

---

## 1. What you need

**Server.** Ubuntu 24.04 with 4 vCPU and 8 GB RAM, in a Europe region
(London, Frankfurt or Amsterdam usually work well from Lagos). Three churches
use about 1.5 GB of memory at idle; the rest is headroom for Sunday mornings
and for building new versions. Hetzner, DigitalOcean or Contabo are all fine.

**For each church:**
- A web address, e.g. `grace.shepherdconnect.app` (a DNS **A record** pointing at the server).
- An S3-compatible **bucket** and access keys for photos and uploads. Cloudflare R2 is the cheapest for this (no download fees).
- **Termii** API key, and ideally the church's own registered SMS sender ID.
- **Resend** API key with the church's email domain verified (for emails).
- An **OpenAI** API key for the WhatsApp assistant (optional; without it the bot still works from fixed menus).
- A **dedicated WhatsApp number** on its own SIM/phone. Never share one number between churches.
- The church **logo** (PNG, square, about 512×512).

**For the server:** one more bucket, at a different provider or account from
the churches' files, for offsite backups.

---

## 2. One-time server setup

```bash
# Docker
curl -fsSL https://get.docker.com | sh
# Firewall: SSH and web only (the database is never exposed)
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
# Automatic security updates
apt-get install -y unattended-upgrades

# The code
git clone https://github.com/Godleads1/shepherd-Connect.git /opt/shepherd-connect
cd /opt/shepherd-connect
cp deploy/.env.example deploy/.env
nano deploy/.env        # set ACME_EMAIL, POSTGRES_PASSWORD (openssl rand -hex 24), backup bucket
chmod 600 deploy/.env

# Build the images and start the shared services
deploy/bin/update
```

Schedule the nightly backup:

```bash
crontab -e
# add:
15 2 * * * /opt/shepherd-connect/deploy/bin/backup >> /var/log/shepherd-backup.log 2>&1
```

---

## 3. Add a church

```bash
cd /opt/shepherd-connect
deploy/bin/add-church grace grace.shepherdconnect.app
```

This creates `deploy/churches/grace/church.env` with fresh secrets, an empty
database with all tables, and starts the church. Then:

1. **Fill in the settings**: `nano deploy/churches/grace/church.env`
   - church name, address, colours, service times and labels
   - S3 bucket keys (`S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`,
     and the bucket name in `PRIVATE_OBJECT_DIR`/`PUBLIC_OBJECT_SEARCH_PATHS`)
   - Termii, Resend and OpenAI keys

   Apply the changes: `deploy/bin/compose up -d api-grace`
2. **Logo**: copy it to `deploy/churches/grace/branding/logo.png`.
3. **Bucket CORS** (so parents' phones can upload photos directly). In the R2
   (or S3) bucket settings, add:
   ```json
   [{ "AllowedOrigins": ["https://grace.shepherdconnect.app"],
      "AllowedMethods": ["GET", "PUT"], "AllowedHeaders": ["*"], "MaxAgeSeconds": 3600 }]
   ```
4. **DNS**: point `grace.shepherdconnect.app` at the server. HTTPS starts
   working within a minute of DNS updating.
5. **First Super Admin**:
   ```bash
   deploy/bin/create-admin grace pastor@grace.org Ada Okafor
   ```
   It prints a one-time password. Ask them to sign in, change it and turn on
   two-step login.
6. **WhatsApp**: the Super Admin signs in, opens **Settings → WhatsApp** and
   pairs the church's own WhatsApp number.
7. **Service times**: the Super Admin can fine-tune service names and the church
   address in **Settings**. Start times used for reminders come from
   `SERVICE_1_START` / `SERVICE_2_START`.

Each church supports up to two Sunday services.

---

## 4. Move City of David off Replit

Do this on a weekday evening, never close to a Sunday. Rehearse it once with a
throwaway domain first.

1. **Prepare the server** (any time before):
   ```bash
   deploy/bin/add-church cityofdavid cityofdavid.example.org --empty
   ```
   In `deploy/churches/cityofdavid/church.env`, set City of David's values.
   The original values (also the app's built-in defaults) are:
   `CHURCH_NAME=RCCG City of David`, `CHURCH_SHORT_NAME=City of David`,
   `CHURCH_DENOMINATION=THE REDEEMED CHRISTIAN CHURCH OF GOD`,
   `CHURCH_MINISTRY_NAME=Junior Church`, `CHURCH_LOCALITY=Victoria Island`,
   `CHURCH_LOGO_URL=/rccg-logo-new.png`, services `07:00` and `10:30`.
   Copy the Termii, Resend and VAPID keys from Replit's Secrets so existing
   push notifications keep working.
2. **Copy the files** (photos, uploads), from the **Replit Shell**:
   ```bash
   TARGET_S3_ENDPOINT=https://ACCOUNT_ID.r2.cloudflarestorage.com \
   TARGET_S3_ACCESS_KEY_ID=... TARGET_S3_SECRET_ACCESS_KEY=... \
   TARGET_BUCKET=cityofdavid-shepherd \
   node deploy/migrate-from-replit/copy-files.mjs
   ```
   It prints the `PRIVATE_OBJECT_DIR` / `PUBLIC_OBJECT_SEARCH_PATHS` values to
   put in `church.env`. It can be run again; already-copied files are skipped.
3. **Cut over**:
   1. **Stop the Replit deployment.** This matters: the WhatsApp login moves
      with the database, and two servers using one WhatsApp login knock each
      other off.
   2. In the Replit Shell: `bash deploy/migrate-from-replit/export-db.sh`, then
      download `shepherd-replit.dump` and delete it from the Repl.
   3. Run `copy-files.mjs` once more to catch the last uploads.
   4. On the server:
      ```bash
      deploy/bin/restore cityofdavid shepherd-replit.dump
      deploy/bin/update          # applies any schema differences
      ```
   5. Point the City of David domain's DNS at the new server.
   6. Check: sign in as parent and admin, scan a check-in QR, message the bot.
4. Keep the Replit project (stopped, not deleted) for a week in case you need to
   go back.

---

## 5. Updating

```bash
cd /opt/shepherd-connect
git pull
deploy/bin/update
```

`update` builds the new version, updates each church's database tables, then
restarts the churches one at a time and checks each is healthy before moving
on. If a database change could delete data, it stops and asks before
restarting anything.

**Roll back:** the last line of `update` prints the previous version, e.g.
`deploy/bin/update --release 1d56945`.

---

## 6. Backups

`bin/backup` (nightly, from cron) saves every church's database on the server
for 30 days and, if the backup bucket is set in `deploy/.env`, copies the
database dumps and every church's files offsite.

```bash
deploy/bin/backup                                        # run now
ls deploy/backups/grace/                                 # local copies
deploy/bin/restore grace deploy/backups/grace/grace-20261109-0215.dump
```

`restore` replaces only that church's data and asks you to type the church's
name first. **Test a restore once a month**, for example by restoring into a
throwaway church: `deploy/bin/add-church restoretest restoretest.example.org --empty`.

---

## 7. Day to day

```bash
deploy/bin/status                       # every church: running? database OK?
deploy/bin/compose logs -f api-grace    # one church's logs
deploy/bin/compose restart api-grace    # restart one church
```

Point an uptime monitor (e.g. UptimeRobot) at `https://<church-domain>/api/readyz`
for each church; it reports when a church cannot reach its database.

**Keep private:** `deploy/.env` and `deploy/churches/*/church.env` hold
passwords and keys. They are excluded from git; keep them `chmod 600` and back
them up somewhere safe (e.g. a password manager). Without them, backups cannot
be restored to a working church.

---

## Troubleshooting

| Symptom | Check |
|---|---|
| Site shows a certificate error | DNS must point at this server; `deploy/bin/compose logs web` |
| A church shows "Bad Gateway" | `deploy/bin/compose logs api-<slug>` — usually a typo in `church.env` |
| Photos won't upload | Bucket keys in `church.env`, and the bucket CORS rule (step 3.3) |
| No SMS or emails | Termii / Resend keys; Resend domain verified |
| WhatsApp bot silent | Settings → WhatsApp shows the connection; re-pair if it says disconnected |
| `update` stops at "schema update needs attention" | A database change would delete data. Read the prompt; ask a developer if unsure |
