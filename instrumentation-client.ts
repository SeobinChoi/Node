import * as Sentry from "@sentry/nextjs";

// NEXT_PUBLIC_SENTRY_DSN이 설정된 환경에서만 브라우저 리포팅 활성화.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
    tracesSampleRate: 0.05,
    replaysOnErrorSampleRate: 0,
    replaysSessionSampleRate: 0,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
