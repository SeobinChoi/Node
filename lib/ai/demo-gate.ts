/**
 * Kill switch for the PUBLIC (unauthenticated) AI demo endpoints.
 *
 * `/api/demo/generate` calls a paid LLM with no session required, so anyone who
 * finds the URL can spend money on our API key. Per-IP limiting cannot fix this:
 * the limiter lives in a module-level Map, and on serverless every instance has
 * its own copy that resets on cold start, so the real ceiling is
 * (limit x instances) — effectively unbounded, and the IP header is spoofable.
 *
 * Until the demo is metered by a persistent, shared counter, public AI
 * generation is opt-in: it runs only when ENABLE_PUBLIC_AI_DEMO === "true".
 * Default-off means an unattended deployment cannot accumulate LLM spend.
 */
export const isPublicAiDemoEnabled = () =>
    process.env.ENABLE_PUBLIC_AI_DEMO === "true";

/** Shown to visitors when the demo is switched off. Intentionally generic. */
export const PUBLIC_DEMO_DISABLED_MESSAGE =
    "공개 AI 데모가 현재 비활성화되어 있습니다. 담당자에게 문의해 주세요.";

export const publicDemoDisabledResponse = () =>
    Response.json({ error: PUBLIC_DEMO_DISABLED_MESSAGE }, { status: 503 });
