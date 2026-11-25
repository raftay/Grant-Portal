import { createContext, use } from "react";

export class Redirect extends Error {
  constructor(readonly to: string) {
    super(`Redirect to ${to}`);
  }
}

export class NotFound extends Error {}

export function redirect(to: string): never {
  throw new Redirect(to);
}

export function notFound(): never {
  throw new NotFound("Not found");
}

export const navigate = (to: string) => {
  location.hash = to;
};

export const refresh = () => window.dispatchEvent(new Event("demo:refresh"));

export const Path = createContext("/");
export const usePathname = () => use(Path);
const router = { push: navigate, refresh };
export const useRouter = () => router;
