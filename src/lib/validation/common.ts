import { z } from "zod";

const blank = (value: unknown) => (typeof value === "string" && value.trim() === "" ? null : value);

export const text = (max: number) => z.string().trim().min(1).max(max);
export const optionalText = (max: number) => z.preprocess(blank, z.string().trim().max(max).nullable().default(null));
export const optionalDate = z.preprocess(blank, z.iso.date().nullable().default(null));
export const optionalId = z.preprocess(blank, z.uuid().nullable().default(null));
export const email = z.string().trim().toLowerCase().pipe(z.email().max(254));
export const password = z.string().min(12, "Use at least 12 characters.").max(128);
