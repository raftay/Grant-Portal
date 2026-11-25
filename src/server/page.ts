import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "./auth/session";
import { AppError } from "./errors";

export async function pageContext() {
  const user = await requireUser();
  return { user, identity: { userId: user.id, requestId: randomUUID() }, canWrite: user.role !== "viewer", isAdmin: user.role === "admin" };
}

export async function adminContext() {
  const context = await pageContext();
  if (!context.isAdmin) notFound();
  return context;
}

export function requireId(value: string): string {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) notFound();
  return parsed.data;
}

export async function found<T>(work: Promise<T>): Promise<T> {
  try {
    return await work;
  } catch (error) {
    if (error instanceof AppError && error.code === "not_found") notFound();
    throw error;
  }
}
