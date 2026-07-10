import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Object storage — Cloudflare R2 via the S3-compatible API.
 *
 * The bucket is PRIVATE. Browsers never get credentials: the API mints
 * short-lived presigned URLs for exactly one object at a time (PUT for
 * uploads, GET for playback/screenshots). Large binaries never transit
 * our servers.
 *
 * The consumer is responsible for loading env before importing.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set — configure Cloudflare R2 credentials in .env`
    );
  }
  return value;
}

let client: S3Client | null = null;
let bucketName: string | null = null;

function getClient(): { client: S3Client; bucket: string } {
  if (!client || !bucketName) {
    const accountId = required("R2_ACCOUNT_ID");
    bucketName = required("R2_BUCKET");
    client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: required("R2_ACCESS_KEY_ID"),
        secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
      },
      // R2 compatibility (per Cloudflare docs): newer AWS SDKs default to
      // embedding request checksums, which poisons presigned PUT URLs with
      // an empty-body CRC and breaks browser uploads.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return { client, bucket: bucketName };
}

/** Presigned upload URL — browser PUTs the object directly to R2. */
export async function presignPut(
  key: string,
  contentType: string,
  expiresInSeconds = 600
): Promise<string> {
  const { client, bucket } = getClient();
  return getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
    { expiresIn: expiresInSeconds }
  );
}

/** Presigned read URL — for serving screenshots/video to signed-in users. */
export async function presignGet(
  key: string,
  expiresInSeconds = 86_400
): Promise<string> {
  const { client, bucket } = getClient();
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: expiresInSeconds }
  );
}

/** Server-side upload (worker: extracted frames). */
export async function putObject(
  key: string,
  body: Uint8Array,
  contentType: string
): Promise<void> {
  const { client, bucket } = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

/** Server-side download (worker: fetch the recorded video). */
export async function getObjectBytes(key: string): Promise<Uint8Array> {
  const { client, bucket } = getClient();
  const response = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key })
  );
  if (!response.Body) {
    throw new Error(`Object ${key} has no body`);
  }
  return response.Body.transformToByteArray();
}
