import { open } from "../database";

type Stored = { bytes: Uint8Array<ArrayBuffer>; mime_type: string };

async function find(key: string): Promise<Stored> {
  const { client } = await open();
  const [row] = (await client.query<Stored>("select bytes, mime_type from demo.objects where key = $1", [key])).rows;
  if (!row) throw new Error("That object is not stored");
  return row;
}

export async function signUpload(key: string): Promise<string> {
  return `demo:${key}`;
}

export async function signDownload(key: string): Promise<string> {
  const { bytes, mime_type } = await find(key);
  return URL.createObjectURL(new Blob([bytes], { type: mime_type }));
}

export async function objectSize(key: string): Promise<number> {
  return (await find(key)).bytes.byteLength;
}

export async function readObject(key: string): Promise<Uint8Array> {
  return (await find(key)).bytes;
}

export async function writeObject(key: string, bytes: Uint8Array, mimeType: string): Promise<void> {
  const { client } = await open();
  await client.query("insert into demo.objects (key, bytes, mime_type) values ($1, $2, $3) on conflict (key) do update set bytes = excluded.bytes", [key, bytes, mimeType]);
}

export async function removeObject(key: string): Promise<void> {
  const { client } = await open();
  await client.query("delete from demo.objects where key = $1", [key]);
}
