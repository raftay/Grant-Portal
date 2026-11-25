import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "@/server/env";
import { runDaily } from "@/server/jobs/daily";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const digest = (value: string) => createHash("sha256").update(value).digest();

export async function GET(request: Request): Promise<Response> {
  const supplied = request.headers.get("authorization");
  if (!supplied || !timingSafeEqual(digest(supplied), digest(`Bearer ${env().CRON_SECRET}`))) {
    return new Response("Not allowed", { status: 401 });
  }
  return Response.json(await runDaily());
}
