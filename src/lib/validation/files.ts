import { z } from "zod";
import { text } from "./common";

export const maxFileBytes = 15 * 1024 * 1024;

export const fileTypes = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
} as const;

export type FileType = keyof typeof fileTypes;

export const createUploadInput = z.object({
  name: text(200),
  mimeType: z.enum(Object.keys(fileTypes) as [FileType, ...FileType[]], { error: "Upload a PDF, PNG, JPEG, Word or Excel file." }),
  sizeBytes: z.number().int().positive().max(maxFileBytes, "Files can be up to 15 MB."),
  sensitivity: z.enum(["general", "payroll"]).default("general"),
});
