import { beforeAll, describe, expect, it } from "vitest";
import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * Runs against a real S3-compatible server when S3_TEST_ENDPOINT is set
 * (e.g. MinIO or `python -m moto.server -p 5555`). Skipped otherwise.
 */
const endpoint = process.env.S3_TEST_ENDPOINT;
const s3Describe = endpoint ? describe : describe.skip;
const BUCKET = `shepherd-test-${Date.now()}`;

let service: import("../lib/objectStorage").ObjectStorageService;
let acl: typeof import("../lib/objectAcl");

beforeAll(async () => {
  if (!endpoint) return;
  Object.assign(process.env, {
    STORAGE_DRIVER: "s3", S3_ENDPOINT: endpoint, S3_REGION: "us-east-1",
    S3_ACCESS_KEY_ID: "test", S3_SECRET_ACCESS_KEY: "test",
    PRIVATE_OBJECT_DIR: `/${BUCKET}/private`, PUBLIC_OBJECT_SEARCH_PATHS: `/${BUCKET}/public`,
  });
  const raw = new S3Client({ endpoint, region: "us-east-1", forcePathStyle: true, credentials: { accessKeyId: "test", secretAccessKey: "test" } });
  await raw.send(new CreateBucketCommand({ Bucket: BUCKET }));
  const mod = await import("../lib/objectStorage");
  service = new mod.ObjectStorageService();
  acl = await import("../lib/objectAcl");
});

s3Describe("S3-compatible file storage", () => {
  it("handles the browser upload flow: signed PUT, normalise path, set owner, read back", async () => {
    const uploadUrl = await service.getObjectEntityUploadURL();
    const put = await fetch(uploadUrl, { method: "PUT", body: "hello photo", headers: { "Content-Type": "image/jpeg" } });
    expect(put.ok).toBe(true);

    const objectPath = service.normalizeObjectEntityPath(uploadUrl);
    expect(objectPath).toMatch(/^\/objects\/uploads\/[0-9a-f-]{36}$/);

    await service.trySetObjectEntityAclPolicy(uploadUrl, { owner: "42", visibility: "private" });
    const file = await service.getObjectEntityFile(objectPath);
    expect(await acl.getObjectAclPolicy(file)).toEqual({ owner: "42", visibility: "private" });
    expect(await service.canAccessObjectEntity({ userId: "42", objectFile: file })).toBe(true);
    expect(await service.canAccessObjectEntity({ userId: "7", objectFile: file })).toBe(false);

    // Updating the access policy must not lose the content type or content.
    const [meta] = await file.getMetadata();
    expect(meta.contentType).toBe("image/jpeg");
    const response = await service.downloadObject(file, 0);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=0");
    expect(await response.text()).toBe("hello photo");
  });

  it("stores server-generated files and signs direct download links", async () => {
    const objectPath = await service.uploadObjectEntityFromBuffer(Buffer.from("%PDF-1.4 test"), "application/pdf");
    const file = await service.getObjectEntityFile(objectPath);
    const [bytes] = await file.download();
    expect(bytes.toString()).toBe("%PDF-1.4 test");

    const link = await service.getObjectEntityDownloadURL(objectPath, 60);
    const fetched = await fetch(link);
    expect(fetched.ok).toBe(true);
    expect(await fetched.text()).toBe("%PDF-1.4 test");
  });

  it("reports missing files as not found", async () => {
    const { ObjectNotFoundError } = await import("../lib/objectStorage");
    await expect(service.getObjectEntityFile("/objects/uploads/does-not-exist")).rejects.toBeInstanceOf(ObjectNotFoundError);
    expect(await service.searchPublicObject("nothing-here.png")).toBeNull();
  });

  it("serves public files", async () => {
    const { objectStorageClient } = await import("../lib/objectStorage");
    await objectStorageClient.bucket(BUCKET).file("public/logo.png").save(Buffer.from("png"), { contentType: "image/png" });
    const file = await service.searchPublicObject("logo.png");
    expect(file).not.toBeNull();
    expect(await (await service.downloadObject(file!)).text()).toBe("png");
  });
});
