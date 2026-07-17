import * as Sentry from "@sentry/nextjs";

// SENTRY_DSN이 설정된 환경에서만 활성화된다 (없으면 완전한 no-op).
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}
