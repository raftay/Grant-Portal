import { CreateBucketCommand, HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";

const { R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
if (!R2_ENDPOINT || !R2_BUCKET || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) throw new Error("Storage settings are required");
if (!["127.0.0.1", "localhost"].includes(new URL(R2_ENDPOINT).hostname)) throw new Error("This script is for local storage only");

const client = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  forcePathStyle: true,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});
const exists = await client.send(new HeadBucketCommand({ Bucket: R2_BUCKET })).then(
  () => true,
  () => false,
);
if (!exists) await client.send(new CreateBucketCommand({ Bucket: R2_BUCKET }));
console.log(`Bucket ${R2_BUCKET} is ready`);
