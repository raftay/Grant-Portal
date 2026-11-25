import { loadSession } from "./auth-config";
import { openFile } from "@/server/services/files";

export async function fileUrl(fileId: string, mode: "view" | "download"): Promise<string> {
  const session = loadSession();
  if (!session) throw new Error("Sign in to open this file");
  return openFile({ userId: session.user.id }, fileId, mode);
}
