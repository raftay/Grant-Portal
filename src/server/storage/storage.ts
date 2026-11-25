import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../env";

export const uploadSeconds = 300;
export const downloadSeconds = 60;

let cached: S3Client | undefined;

function client(): S3Client {
  cached ??= new S3Client({
    region: "auto",
    endpoint: env().R2_ENDPOINT,
    forcePathStyle: true,
    credentials: { accessKeyId: env().R2_ACCESS_KEY_ID, secretAccessKey: env().R2_SECRET_ACCESS_KEY },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return cached;
}

const bucket = () => env().R2_BUCKET;

export function signUpload(key: string, mimeType: string, sizeBytes: number): Promise<string> {
  return getSignedUrl(
    client(),
    new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: mimeType, ContentLength: sizeBytes }),
    { expiresIn: uploadSeconds, signableHeaders: new Set(["content-type", "content-length"]) },
  );
}

export function signDownload(key: string, disposition: string, mimeType: string): Promise<string> {
  return getSignedUrl(
    client(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ResponseContentDisposition: disposition,
      ResponseContentType: mimeType,
      ResponseCacheControl: "private, no-store",
    }),
    { expiresIn: downloadSeconds },
  );
}

export async function describeObject(key: string): Promise<{ sizeBytes: number; mimeType: string } | undefined> {
  try {
    const head = await client().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return { sizeBytes: head.ContentLength ?? 0, mimeType: head.ContentType ?? "" };
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404) return undefined;
    throw error;
  }
}

export async function readObject(key: string): Promise<Uint8Array> {
  const object = await client().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  return object.Body!.transformToByteArray();
}

export async function writeObject(key: string, bytes: Uint8Array, mimeType: string): Promise<void> {
  await client().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: bytes, ContentType: mimeType }));
}

export async function removeObject(key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}
