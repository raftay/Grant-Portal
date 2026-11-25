import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

const cost: Required<Pick<ScryptOptions, "N" | "r" | "p" | "maxmem">> = { N: 2 ** 16, r: 8, p: 1, maxmem: 128 * 1024 * 1024 };
const keyLength = 32;

function derive(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, keyLength, options, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, cost);
  return ["scrypt", cost.N, cost.r, cost.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, N, r, p, salt, key] = stored.split("$");
  if (scheme !== "scrypt" || !N || !r || !p || !salt || !key) return false;
  const expected = Buffer.from(key, "base64");
  const actual = await derive(password, Buffer.from(salt, "base64"), { N: Number(N), r: Number(r), p: Number(p), maxmem: cost.maxmem });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

let decoy: Promise<string> | undefined;

export async function burnPasswordCheck(password: string): Promise<void> {
  decoy ??= hashPassword(randomBytes(16).toString("hex"));
  await verifyPassword(password, await decoy);
}
