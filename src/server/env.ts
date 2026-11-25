import { z } from "zod";

const schema = z
  .object({
    AUTH_SECRET: z.string().min(32),
    APP_URL: z.url(),
    EMAIL_MODE: z.enum(["resend", "outbox"]),
    EMAIL_FROM: z.string().min(3),
    SAMPLE_DATA: z.enum(["true", "false"]),
    CRON_SECRET: z.string().min(32),
    ANTHROPIC_API_KEY: z.string().min(1),
    RESEND_API_KEY: z.string().optional(),
    R2_ENDPOINT: z.url(),
    R2_BUCKET: z.string().min(1),
    R2_ACCESS_KEY_ID: z.string().min(1),
    R2_SECRET_ACCESS_KEY: z.string().min(1),
  })
  .refine((value) => value.EMAIL_MODE !== "resend" || Boolean(value.RESEND_API_KEY), {
    message: "RESEND_API_KEY is required when EMAIL_MODE is resend",
  });

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  cached ??= schema.parse(process.env);
  return cached;
}
