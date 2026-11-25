import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireUser } from "./auth/session";
import { AppError } from "./errors";
import type { Identity } from "./services/identity";

export type FormState =
  | { status: "idle" }
  | { status: "error"; message: string; fields: Record<string, string> }
  | { status: "done"; message: string };

export async function actor(): Promise<Identity> {
  const user = await requireUser();
  return { userId: user.id, requestId: randomUUID() };
}

export function describeError(error: unknown): { message: string; fields: Record<string, string> } {
  if (error instanceof AppError) return { message: error.message, fields: {} };
  if (error instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of error.issues) fields[String(issue.path.at(-1))] = issue.message;
    return { message: error.issues.map((issue) => issue.message).join(" "), fields };
  }
  throw error;
}

export async function submit(work: () => Promise<string>): Promise<FormState> {
  try {
    const message = await work();
    revalidatePath("/", "layout");
    return { status: "done", message };
  } catch (error) {
    return { status: "error", ...describeError(error) };
  }
}

export type Outcome<T> = { ok: true; value: T } | { ok: false; message: string };

export async function attempt<T>(work: () => Promise<T>): Promise<Outcome<T>> {
  try {
    return { ok: true, value: await work() };
  } catch (error) {
    return { ok: false, message: describeError(error).message };
  }
}

export function field(form: FormData, name: string): string {
  const value = form.get(name);
  if (typeof value !== "string") throw new Error(`The form is missing ${name}`);
  return value;
}

export const ticked = (form: FormData, name: string) => form.get(name) === "on";
