// Copy every file (photos, uploads, display media) from Replit Object Storage
// to an S3-compatible bucket, keeping content types and access policies.
//
// Run INSIDE the Replit Shell, from the repository root, so it can reach
// Replit storage:
//
//   TARGET_S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com \
//   TARGET_S3_ACCESS_KEY_ID=... TARGET_S3_SECRET_ACCESS_KEY=... \
//   TARGET_BUCKET=cityofdavid-shepherd \
//   node deploy/migrate-from-replit/copy-files.mjs
//
// Files keep the same paths under the bucket, so set the new church.env to
//   PRIVATE_OBJECT_DIR=/<TARGET_BUCKET>/<same prefix as Replit's PRIVATE_OBJECT_DIR>
// The script prints the exact values to use. It is safe to run again: files
// already copied with the same size are skipped.
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(path.resolve("artifacts/api-server/package.json"));
const { Storage } = require("@google-cloud/storage");
const { S3Client, PutObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");

const need = name => process.env[name] || (console.error(`Missing ${name}`), process.exit(1));
const targetBucket = need("TARGET_BUCKET");
const s3 = new S3Client({
  endpoint: need("TARGET_S3_ENDPOINT"),
  region: process.env.TARGET_S3_REGION || "auto",
  forcePathStyle: true,
  credentials: { accessKeyId: need("TARGET_S3_ACCESS_KEY_ID"), secretAccessKey: need("TARGET_S3_SECRET_ACCESS_KEY") },
});
const SIDECAR = "http://127.0.0.1:1106";
const gcs = new Storage({
  credentials: {
    audience: "replit", subject_token_type: "access_token", token_url: `${SIDECAR}/token`, type: "external_account",
    credential_source: { url: `${SIDECAR}/credential`, format: { type: "json", subject_token_field_name: "access_token" } },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

const dirs = [process.env.PRIVATE_OBJECT_DIR, ...(process.env.PUBLIC_OBJECT_SEARCH_PATHS || "").split(",")]
  .map(d => (d || "").trim()).filter(Boolean);
if (!dirs.length) { console.error("PRIVATE_OBJECT_DIR / PUBLIC_OBJECT_SEARCH_PATHS are not set in this Repl"); process.exit(1); }

const s3MetaKey = key => key.toLowerCase().replace(/[^a-z0-9-]/g, "-");
let copied = 0, skipped = 0, failed = 0;

for (const dir of dirs) {
  const [, bucketName, ...rest] = dir.split("/");
  const prefix = rest.join("/");
  const [files] = await gcs.bucket(bucketName).getFiles({ prefix: prefix ? `${prefix}/` : "" });
  console.log(`${dir}: ${files.length} file(s)`);
  for (const file of files) {
    const key = file.name;
    try {
      const [meta] = await file.getMetadata();
      try {
        const head = await s3.send(new HeadObjectCommand({ Bucket: targetBucket, Key: key }));
        if (String(head.ContentLength) === String(meta.size)) { skipped++; continue; }
      } catch { /* not there yet */ }
      const [body] = await file.download();
      const metadata = Object.fromEntries(Object.entries(meta.metadata || {}).map(([k, v]) => [s3MetaKey(k), String(v)]));
      await s3.send(new PutObjectCommand({
        Bucket: targetBucket, Key: key, Body: body, ContentType: meta.contentType || "application/octet-stream", Metadata: metadata,
      }));
      copied++;
      if (copied % 50 === 0) console.log(`  copied ${copied}…`);
    } catch (err) {
      failed++; console.error(`  FAILED ${key}: ${err.message}`);
    }
  }
}

console.log(`\nDone: ${copied} copied, ${skipped} already there, ${failed} failed.`);
const map = d => { const [, , ...rest] = d.split("/"); return `/${targetBucket}/${rest.join("/")}`; };
console.log("\nUse these in the church's church.env on the new server:");
console.log(`PRIVATE_OBJECT_DIR=${map(process.env.PRIVATE_OBJECT_DIR || dirs[0])}`);
if (process.env.PUBLIC_OBJECT_SEARCH_PATHS) {
  console.log(`PUBLIC_OBJECT_SEARCH_PATHS=${process.env.PUBLIC_OBJECT_SEARCH_PATHS.split(",").map(d => map(d.trim())).join(",")}`);
}
process.exit(failed ? 1 : 0);
