import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// 서버 렌더링/라우트 핸들러에서 잡히지 않은 에러를 보고한다.
// DSN이 없으면 Sentry 호출은 no-op이므로, Vercel 로그에서 찾을 수 있게
// 구조화된 로그를 항상 남긴다.
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string; headers: NodeJS.Dict<string | string[]> },
  context: { routerKind: string; routePath: string; routeType: string }
) {
  console.error(
    JSON.stringify({
      level: "error",
      source: "onRequestError",
      path: request.path,
      method: request.method,
      route: context.routePath,
      routeType: context.routeType,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.split("\n").slice(0, 6).join("\n") : undefined,
    })
  );
  Sentry.captureRequestError(error, request, context);
}
