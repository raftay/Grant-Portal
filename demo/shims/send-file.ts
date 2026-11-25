import { writeObject } from "./storage";

const pause = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function sendFile(url: string, headers: Record<string, string>, file: File, onProgress: (share: number) => void): Promise<void> {
  for (let step = 1; step <= 8; step += 1) {
    onProgress(step / 8);
    await pause(140);
  }
  const type = headers["content-type"];
  if (!type) throw new Error("The upload has no type");
  await writeObject(url.replace(/^demo:/, ""), new Uint8Array(await file.arrayBuffer()), type);
  await pause(500);
}
