export type ErrorCode = "forbidden" | "not_found" | "invalid" | "conflict" | "throttled" | "unavailable";

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const forbidden = () => new AppError("forbidden", "You do not have permission to do that.");
export const notFound = (what: string) => new AppError("not_found", `${what} was not found.`);

const constraints: Record<string, [ErrorCode, string]> = {
  users_seat_limit: ["conflict", "All 5 accounts are in use. Deactivate someone before adding another person."],
  users_last_admin: ["conflict", "At least one active admin is required."],
  users_email_lower_key: ["conflict", "Someone with that email address already has an account."],
  documents_one_live_contract: ["conflict", "This grant already has an executed contract. Replace it or archive it first."],
  documents_contract_has_grant: ["invalid", "An executed contract must belong to a grant."],
  document_versions_file_id_unique: ["conflict", "That file is already attached to a document."],
  organization_profile_ein_format: ["invalid", "Enter the EIN as 12-3456789."],
};

type DatabaseError = { code: string; constraint?: string };

function findDatabaseError(error: unknown): DatabaseError | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current instanceof Error; depth += 1) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return current as unknown as DatabaseError;
    current = current.cause;
  }
  return undefined;
}

export function toAppError(error: unknown): unknown {
  if (error instanceof AppError) return error;
  const found = findDatabaseError(error);
  if (!found) return error;
  if (found.code === "42501") return forbidden();
  const known = found.constraint ? constraints[found.constraint] : undefined;
  if (known) return new AppError(...known);
  if (found.code === "23503") return new AppError("invalid", "A linked record no longer exists.");
  if (found.code === "23505") return new AppError("conflict", "That already exists.");
  if (found.code === "23514" || found.code === "22P02") return new AppError("invalid", "Some of the details are not valid.");
  return error;
}

export async function guarded<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw toAppError(error);
  }
}
