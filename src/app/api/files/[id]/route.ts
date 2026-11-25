import { z } from "zod";
import { currentUser } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { openFile } from "@/server/services/files";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const user = await currentUser();
  if (!user) return new Response("Sign in to open this file.", { status: 401 });
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return new Response("That file was not found.", { status: 404 });
  const mode = new URL(request.url).searchParams.get("mode") === "view" ? "view" : "download";
  try {
    const url = await openFile({ userId: user.id, requestId: crypto.randomUUID() }, id.data, mode);
    return new Response(null, { status: 302, headers: { location: url, "cache-control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AppError) return new Response(error.message, { status: error.code === "forbidden" ? 403 : 404 });
    throw error;
  }
}
