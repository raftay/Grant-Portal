export function env() {
  return {
    AUTH_SECRET: "public-demo-without-real-secrets-0000",
    APP_URL: `${location.origin}${location.pathname}#`,
    EMAIL_MODE: "outbox" as const,
    EMAIL_FROM: "Grant Portal demo",
    SAMPLE_DATA: "true" as const,
    RESEND_API_KEY: undefined,
  };
}
