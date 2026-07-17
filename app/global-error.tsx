"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// 루트 레이아웃까지 뚫고 올라온 렌더링 에러의 최종 안전망.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="ko">
      <body style={{ fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "18px", fontWeight: 600 }}>일시적인 오류가 발생했습니다</h1>
          <p style={{ fontSize: "14px", color: "#666" }}>
            잠시 후 다시 시도해 주세요. 문제가 계속되면 관리자에게 알려주세요.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "8px",
              padding: "8px 20px",
              borderRadius: "8px",
              border: "1px solid #ccc",
              background: "#fff",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}
