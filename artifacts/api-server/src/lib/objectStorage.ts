import { Storage } from "@google-cloud/storage";
import {
  CopyObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "stream";
import { randomUUID } from "crypto";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

/**
 * File storage for photos, uploads and classroom display media.
 *
 * Two back ends behind one small interface (the subset of the Google Cloud
 * Storage `File` API the app uses):
 *  - "replit" (default): Replit Object Storage via the Replit sidecar.
 *  - "s3": any S3-compatible store (Cloudflare R2, Backblaze B2, AWS S3,
 *    MinIO, DigitalOcean Spaces) for self-hosting. Set STORAGE_DRIVER=s3 and
 *    S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY.
 *
 * In both cases PRIVATE_OBJECT_DIR / PUBLIC_OBJECT_SEARCH_PATHS are
 * "/<bucket>/<prefix>" paths.
 */

export interface StoredObjectMetadata {
  contentType?: string;
  size?: number | string;
  metadata?: Record<string, string | undefined>;
}

export interface StoredObject {
  readonly name: string;
  exists(): Promise<[boolean]>;
  getMetadata(): Promise<[StoredObjectMetadata]>;
  setMetadata(update: { metadata: Record<string, string> }): Promise<unknown>;
  createReadStream(): Readable;
  download(): Promise<[Buffer]>;
  save(data: Buffer, options: { contentType: string; resumable?: boolean }): Promise<unknown>;
}

interface StorageBackend {
  bucket(name: string): { file(objectName: string): StoredObject };
  signUrl(input: { bucketName: string; objectName: string; method: "GET" | "PUT" | "DELETE" | "HEAD"; ttlSec: number }): Promise<string>;
  /** Turn a signed upload URL back into "/<bucket>/<object>" (or null if not ours). */
  pathFromSignedUrl(url: URL): string | null;
}

const STORAGE_DRIVER = (process.env.STORAGE_DRIVER ?? "replit").trim().toLowerCase();

// ── Replit Object Storage (Google Cloud Storage through the Replit sidecar) ──
const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

function replitBackend(): StorageBackend {
  const client = new Storage({
    credentials: {
      audience: "replit",
      subject_token_type: "access_token",
      token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
      type: "external_account",
      credential_source: {
        url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
        format: {
          type: "json",
          subject_token_field_name: "access_token",
        },
      },
      universe_domain: "googleapis.com",
    },
    projectId: "",
  });
  return {
    bucket: name => client.bucket(name) as unknown as { file(objectName: string): StoredObject },
    async signUrl({ bucketName, objectName, method, ttlSec }) {
      const request = {
        bucket_name: bucketName,
        object_name: objectName,
        method,
        expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
      };
      const response = await fetch(
        `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
          signal: AbortSignal.timeout(30_000),
        }
      );
      if (!response.ok) {
        throw new Error(
          `Failed to sign object URL, errorcode: ${response.status}, ` +
            `make sure you're running on Replit (or set STORAGE_DRIVER=s3)`
        );
      }
      const data = await response.json() as { signed_url: string };
      return data.signed_url;
    },
    pathFromSignedUrl(url) {
      return url.hostname === "storage.googleapis.com" ? url.pathname : null;
    },
  };
}

// ── S3-compatible storage ────────────────────────────────────────────────────
// S3 user-metadata keys travel as HTTP headers, so "custom:aclPolicy" (the GCS
// key used by objectAcl) cannot be stored verbatim.
const toS3Key = (key: string) => key.toLowerCase().replace(/[^a-z0-9-]/g, "-");

function isNotFound(err: unknown): boolean {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.name === "NotFound" || e?.name === "NoSuchKey" || e?.$metadata?.httpStatusCode === 404;
}

class S3StoredObject implements StoredObject {
  constructor(private readonly client: S3Client, private readonly bucketName: string, readonly name: string) {}

  private async head() {
    return this.client.send(new HeadObjectCommand({ Bucket: this.bucketName, Key: this.name }));
  }

  async exists(): Promise<[boolean]> {
    try { await this.head(); return [true]; } catch (err) { if (isNotFound(err)) return [false]; throw err; }
  }

  async getMetadata(): Promise<[StoredObjectMetadata]> {
    const head = await this.head();
    const raw = head.Metadata ?? {};
    const metadata: Record<string, string | undefined> = { ...raw };
    // Expose keys under their original (GCS-style) names as well.
    for (const original of KNOWN_METADATA_KEYS) {
      const value = raw[toS3Key(original)];
      if (value !== undefined) metadata[original] = value;
    }
    return [{ contentType: head.ContentType, size: head.ContentLength, metadata }];
  }

  async setMetadata(update: { metadata: Record<string, string> }): Promise<unknown> {
    // S3 metadata is immutable: copy the object onto itself with new metadata.
    const head = await this.head();
    const metadata: Record<string, string> = { ...(head.Metadata ?? {}) };
    for (const [key, value] of Object.entries(update.metadata)) metadata[toS3Key(key)] = value;
    return this.client.send(new CopyObjectCommand({
      Bucket: this.bucketName,
      Key: this.name,
      CopySource: `${this.bucketName}/${this.name.split("/").map(encodeURIComponent).join("/")}`,
      MetadataDirective: "REPLACE",
      ContentType: head.ContentType,
      Metadata: metadata,
    }));
  }

  createReadStream(): Readable {
    const client = this.client, Bucket = this.bucketName, Key = this.name;
    return Readable.from((async function* () {
      const result = await client.send(new GetObjectCommand({ Bucket, Key }));
      for await (const chunk of result.Body as AsyncIterable<Uint8Array>) yield chunk;
    })());
  }

  async download(): Promise<[Buffer]> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucketName, Key: this.name }));
    return [Buffer.from(await result.Body!.transformToByteArray())];
  }

  save(data: Buffer, options: { contentType: string }): Promise<unknown> {
    return this.client.send(new PutObjectCommand({
      Bucket: this.bucketName, Key: this.name, Body: data, ContentType: options.contentType,
    }));
  }
}

const KNOWN_METADATA_KEYS = ["custom:aclPolicy"];

function s3Backend(): StorageBackend {
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const client = new S3Client({
    endpoint: endpoint || undefined,
    region: process.env.S3_REGION?.trim() || "auto",
    // Path-style URLs ("https://endpoint/bucket/key") work across R2, B2,
    // MinIO and AWS, and keep the bucket visible in signed upload URLs.
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    },
  });
  const endpointHost = endpoint ? new URL(endpoint).host : null;
  return {
    bucket: name => ({ file: objectName => new S3StoredObject(client, name, objectName) }),
    signUrl({ bucketName, objectName, method, ttlSec }) {
      const command = method === "PUT"
        ? new PutObjectCommand({ Bucket: bucketName, Key: objectName })
        : method === "HEAD"
          ? new HeadObjectCommand({ Bucket: bucketName, Key: objectName })
          : new GetObjectCommand({ Bucket: bucketName, Key: objectName });
      return getSignedUrl(client, command, { expiresIn: ttlSec });
    },
    pathFromSignedUrl(url) {
      if (endpointHost ? url.host !== endpointHost : !url.hostname.endsWith("amazonaws.com")) return null;
      return decodeURIComponent(url.pathname);
    },
  };
}

const backend: StorageBackend = STORAGE_DRIVER === "s3" ? s3Backend() : replitBackend();

/** Kept for compatibility with existing imports: bucket(name).file(path). */
export const objectStorageClient = { bucket: (name: string) => backend.bucket(name) };

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  constructor() {}

  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket in 'Object Storage' " +
          "tool and set PUBLIC_OBJECT_SEARCH_PATHS env var (comma-separated paths)."
      );
    }
    return paths;
  }

  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }
    return dir;
  }

  async searchPublicObject(filePath: string): Promise<StoredObject | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;

      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      const [exists] = await file.exists();
      if (exists) {
        return file;
      }
    }

    return null;
  }

  async downloadObject(file: StoredObject, cacheTtlSec: number = 3600): Promise<Response> {
    const [metadata] = await file.getMetadata();
    const aclPolicy = await getObjectAclPolicy(file);
    const isPublic = aclPolicy?.visibility === "public";

    const nodeStream = file.createReadStream();
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    const headers: Record<string, string> = {
      "Content-Type": (metadata.contentType as string) || "application/octet-stream",
      "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
    };
    if (metadata.size) {
      headers["Content-Length"] = String(metadata.size);
    }

    return new Response(webStream, { headers });
  }

  async getObjectEntityUploadURL(): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    if (!privateObjectDir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }

    const objectId = randomUUID();
    const fullPath = `${privateObjectDir}/uploads/${objectId}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);

    return signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900,
    });
  }

  async getObjectEntityFile(objectPath: string): Promise<StoredObject> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const entityId = parts.slice(1).join("/");
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }
    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const objectFile = bucket.file(objectName);
    const [exists] = await objectFile.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return objectFile;
  }

  /**
   * Signs a time-limited direct download URL for a private object entity
   * ("/objects/<id>"). Used for classroom TV displays, which authenticate via
   * display tokens (not user JWTs) and need direct, range-capable media URLs.
   */
  async getObjectEntityDownloadURL(objectPath: string, ttlSec: number = 43200): Promise<string> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }
    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }
    const entityId = parts.slice(1).join("/");
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }
    const { bucketName, objectName } = parseObjectPath(`${entityDir}${entityId}`);
    return signObjectURL({ bucketName, objectName, method: "GET", ttlSec });
  }

  /**
   * Uploads server-generated bytes (e.g. a PowerPoint converted to PDF) as a
   * new private object entity. Returns its "/objects/..." path.
   */
  async uploadObjectEntityFromBuffer(data: Buffer, contentType: string): Promise<string> {
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }
    const objectId = randomUUID();
    const { bucketName, objectName } = parseObjectPath(`${entityDir}uploads/${objectId}`);
    const file = objectStorageClient.bucket(bucketName).file(objectName);
    await file.save(data, { contentType, resumable: false });
    return `/objects/uploads/${objectId}`;
  }

  normalizeObjectEntityPath(rawPath: string): string {
    let url: URL;
    try { url = new URL(rawPath); } catch { return rawPath; }
    const rawObjectPath = backend.pathFromSignedUrl(url);
    if (!rawObjectPath) {
      return rawPath;
    }

    let objectEntityDir = this.getPrivateObjectDir();
    if (!objectEntityDir.endsWith("/")) {
      objectEntityDir = `${objectEntityDir}/`;
    }

    if (!rawObjectPath.startsWith(objectEntityDir)) {
      return rawObjectPath;
    }

    const entityId = rawObjectPath.slice(objectEntityDir.length);
    return `/objects/${entityId}`;
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) {
      return normalizedPath;
    }

    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
    return normalizedPath;
  }

  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: StoredObject;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return {
    bucketName,
    objectName,
  };
}

function signObjectURL(input: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  return backend.signUrl(input);
}
