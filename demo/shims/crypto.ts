import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

export const randomUUID = () => crypto.randomUUID();

const toBytes = (value: string | Uint8Array) => (typeof value === "string" ? utf8ToBytes(value) : value);

export function randomBytes(length: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return {
    toString(encoding: "base64url" | "hex"): string {
      if (encoding === "hex") return bytesToHex(bytes);
      return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
    },
  };
}

function encode(bytes: Uint8Array, encoding: string): string {
  if (encoding !== "hex") throw new Error(`Unsupported encoding ${encoding}`);
  return bytesToHex(bytes);
}

function requireSha256(name: string): void {
  if (name !== "sha256") throw new Error(`Unsupported hash ${name}`);
}

export function createHash(name: string) {
  requireSha256(name);
  const hash = sha256.create();
  const chain = {
    update(value: string | Uint8Array) {
      hash.update(toBytes(value));
      return chain;
    },
    digest: (...encoding: ["hex"]) => encode(hash.digest(), encoding[0]),
  };
  return chain;
}

export function createHmac(name: string, key: string) {
  requireSha256(name);
  const mac = hmac.create(sha256, toBytes(key));
  const chain = {
    update(value: string | Uint8Array) {
      mac.update(toBytes(value));
      return chain;
    },
    digest: (...encoding: ["hex"]) => encode(mac.digest(), encoding[0]),
  };
  return chain;
}
