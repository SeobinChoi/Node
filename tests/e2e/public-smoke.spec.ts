import { expect, test } from "@playwright/test";
import { examplesForTool } from "@/lib/demo/public-document-examples";

const DISMISSED_TOUR = JSON.stringify({ status: "dismissed", pageIndex: 0, stepIndex: 0, direction: "forward" });

test.beforeEach(async ({ page }) => {
  await page.addInitScript((value) => sessionStorage.setItem("node-public-demo-tour-v1", value), DISMISSED_TOUR);
});

test("login page renders and exposes Google auth provider", async ({ page, request }) => {
  await page.goto("/login");

  await expect(page.getByText("Node")).toBeVisible();
  await expect(page.getByRole("button", { name: "Google로 로그인" })).toBeVisible();

  const providers = await request.get("/api/auth/providers");
  expect(providers.ok()).toBe(true);
  const body = await providers.json();
  expect(body.google?.callbackUrl).toContain("/api/auth/callback/google");
});

test("root redirects unauthenticated users to login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});

test("military AI project routes redirect unauthenticated users to login", async ({ page }) => {
  await page.goto("/projects/e2e-project/ai");
  await expect(page).toHaveURL(/\/login/);

  await page.goto("/org/e2e-org/projects/e2e-project/ai");
  await expect(page).toHaveURL(/\/login/);
});

test("public military AI demo generates output and saves a node", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/military-ai-demo");

  await expect(page.getByRole("heading", { name: "문서지원 통합" })).toBeVisible();
  await page.getByRole("button", { name: "문서 초안 작성" }).click();
  await expect(page.getByTestId("military-result-panel").getByText("AI 산출")).toBeVisible({ timeout: 70_000 });
  await expect(page.getByRole("heading", { name: "후속조치" })).toBeVisible();

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("saved-node-panel")).toContainText("공개 데모 저장소");
  await expect(page.getByTestId("saved-node-panel")).toContainText("DB 저장");
});

test("public service demos load and respond to sample-data actions", async ({ page }) => {
  await page.goto("/ops-radar-demo");
  await expect(page.getByRole("main").getByRole("heading", { name: "작전 과업 병목관리" })).toBeVisible();
  await page.getByRole("button", { name: "업무 평가 실행" }).click();
  await expect(page.getByTestId("ops-radar-detail")).toBeVisible();

  const demos = [
    { path: "/admin-doc-demo", heading: "행정문서 작성지원", action: "초안 작성" },
    { path: "/after-action-demo", heading: "사후조치 주간요약", action: "요약 생성" },
  ];

  for (const demo of demos) {
    await page.goto(demo.path);
    await expect(page.getByRole("heading", { name: demo.heading })).toBeVisible();
    await page.getByRole("button", { name: demo.action }).click();
    await expect(page.getByTestId("demo-result-panel")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("saved-service-panel")).toContainText(
      "저장된 시연 항목",
    );
  }
});

test("public document modes load three distinct selectable examples", async ({ page }) => {
  const demos = [
    { path: "/military-ai-demo", nextMode: "회의", textarea: "메모" },
    { path: "/admin-doc-demo", nextMode: "결재요지", textarea: "초안 작성 메모" },
    { path: "/after-action-demo", nextMode: "주간", textarea: "회의·훈련 메모" },
  ];

  for (const demo of demos) {
    await page.goto(demo.path);
    const source = page.getByLabel(demo.textarea);
    const examples = page.getByLabel("예시 입력");
    await expect(examples.locator("option")).toHaveCount(3);
    const initialSource = await source.inputValue();

    await page.getByRole("button", { name: demo.nextMode, exact: true }).click();
    await expect(source).not.toHaveValue(initialSource);
    const firstModeSource = await source.inputValue();

    await examples.selectOption({ index: 1 });
    await expect(source).not.toHaveValue(firstModeSource);
  }
});

test("document mode buttons change the actual working UI", async ({ page }) => {
  await page.goto("/military-ai-demo");
  await page.getByRole("button", { name: "회의", exact: true }).click();
  await expect(page.getByTestId("military-mode-description")).toContainText("결정");
  await expect(page.getByRole("button", { name: "회의록 요약" })).toBeVisible();
  await page.getByRole("button", { name: "보안", exact: true }).click();
  await expect(page.getByTestId("military-mode-description")).toContainText("마스킹");
  await expect(page.getByRole("button", { name: "보안 검토" })).toBeVisible();

  await page.goto("/admin-doc-demo");
  await page.getByRole("button", { name: "작성안내" }).click();
  await expect(page.getByTestId("admin-guide-panel")).toBeVisible();
  await page.getByRole("button", { name: "결재요지" }).click();
  await expect(page.getByTestId("admin-generation-panel")).toContainText("결재 요청");
  await page.getByRole("button", { name: "나의 임시문서" }).click();
  await expect(page.getByTestId("admin-drafts-panel")).toBeVisible();

  await page.goto("/after-action-demo");
  await page.getByRole("button", { name: "주간", exact: true }).click();
  await expect(page.getByTestId("after-action-mode-description")).toContainText("차주");
  await page.getByRole("button", { name: "조치", exact: true }).click();
  await expect(page.getByTestId("after-action-mode-description")).toContainText("담당");
});

test("interactive public demo controls do not overflow on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/military-ai-demo", "/ops-radar-demo", "/admin-doc-demo", "/after-action-demo"]) {
    await page.goto(path);
    const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
    await expect(page.getByRole("main")).toBeVisible();
  }
});

test("first browser session tutorial demonstrates one safe AI generation", async ({ browser }) => {
  test.setTimeout(75_000);
  const safeExample = examplesForTool("meetingSummary")[0];
  const context = await browser.newContext();
  const page = await context.newPage();
  const mutatingRequests: string[] = [];
  let generationPayload: Record<string, unknown> | undefined;
  let releaseGeneration!: () => void;
  const generationGate = new Promise<void>((resolve) => { releaseGeneration = resolve; });
  let downloads = 0;
  page.on("request", (request) => {
    if (request.method() !== "GET") mutatingRequests.push(`${request.method()} ${new URL(request.url()).pathname}`);
  });
  page.on("download", () => { downloads += 1; });
  await page.route("**/api/demo/generate", async (route) => {
    generationPayload = route.request().postDataJSON();
    await generationGate;
    await route.fulfill({
      json: {
        ok: true,
        result: {
          ...safeExample.baselineResult,
          markdown: `# ${safeExample.baselineResult.title}`,
          model: "curated-sample-fallback",
          security: [],
          metrics: [],
          workItems: [],
        },
      },
    });
  });

  await page.goto("/military-ai-demo");
  const firstAction = page.locator('[data-tour-action="meetingSummary"]');
  await expect(firstAction).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Node 공개 시연에 오신 것을 환영합니다" })).toBeVisible();
  await firstAction.evaluate((element) => element.removeAttribute("data-tour-action"));
  await page.getByRole("button", { name: "시작", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Node 공개 시연에 오신 것을 환영합니다" })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("node-public-demo-tour-v1"))).toBeNull();
  await page.reload();
  await expect(page.locator('[data-tour-action="meetingSummary"]')).toHaveCount(1);
  await page.getByRole("button", { name: "시작", exact: true }).click();
  await expect(page.getByText("화면 1/4 · 단계 1/4")).toBeVisible();
  await expect(page.getByTestId("tour-click-indicator")).toBeVisible();
  await firstAction.focus();
  await expect(firstAction).toBeFocused();
  await expect(page.getByRole("button", { name: "회의", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("화면 1/4 · 단계 2/4")).toBeVisible({ timeout: 5_000 });
  await page.locator("#demo-source").fill("사용자가 수정한 임의 입력");
  await expect(page.getByRole("button", { name: "생성 중...", exact: true })).toBeVisible({ timeout: 5_000 });
  await expect(page.getByRole("button", { name: "다음", exact: true })).toBeDisabled();
  await expect(page.getByText("화면 1/4 · 단계 3/4")).toBeVisible();
  await page.waitForTimeout(2_700);
  await expect(page.getByText("화면 1/4 · 단계 3/4")).toBeVisible();
  expect(generationPayload).toEqual({
    service: "militaryAi",
    tool: "meetingSummary",
    sourceText: safeExample.sourceText,
    exampleId: safeExample.id,
  });
  releaseGeneration();
  await expect(page.getByTestId("military-result-panel")).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId("military-result-panel")).toContainText("샘플 fallback");
  await expect(page.locator('[data-tour-action="generateAi"]')).toBeDisabled();
  await expect(page.getByRole("button", { name: "보안", exact: true })).toHaveAttribute("aria-pressed", "true", { timeout: 8_000 });
  await page.reload();
  await expect(page.getByRole("button", { name: "보안", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "보안 검토", exact: true })).toBeAttached();

  await expect(page).toHaveURL(/\/ops-radar-demo$/, { timeout: 5_000 });
  await expect(page.locator('[data-tour-action="evaluate"]')).toHaveCount(1);
  await expect(page.getByText("화면 2/4 · 단계 1/2")).toBeVisible();
  await expect(page.getByText("평가 완료 · 규칙 기반 평가")).toBeAttached({ timeout: 5_000 });
  await expect(page.getByTestId("ops-action-lead")).toContainText("우선 조치");

  await expect(page).toHaveURL(/\/admin-doc-demo$/, { timeout: 5_000 });
  await expect(page.locator('[data-tour-action="approval"]')).toHaveCount(1);
  await expect(page.locator('[data-tour-action="security"]')).toHaveCount(1);
  await expect(page.getByText("화면 3/4 · 단계 1/2")).toBeVisible();
  await expect(page.getByRole("button", { name: "결재요지", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "보안검토", exact: true })).toHaveAttribute("aria-pressed", "true", { timeout: 5_000 });

  await expect(page).toHaveURL(/\/after-action-demo$/, { timeout: 5_000 });
  await expect(page.locator('[data-tour-action="weekly"]')).toHaveCount(1);
  await expect(page.locator('[data-tour-action="actions"]')).toHaveCount(1);
  await expect(page.getByText("화면 4/4 · 단계 1/2")).toBeVisible();
  await expect(page.getByRole("button", { name: "주간", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "주간보고 생성", exact: true })).toBeAttached();
  await expect(page.getByRole("button", { name: "조치", exact: true })).toHaveAttribute("aria-pressed", "true", { timeout: 5_000 });
  await expect(page.getByRole("button", { name: "조치 목록 생성", exact: true })).toBeAttached();

  await expect(page.getByText("화면 4/4")).toHaveCount(0, { timeout: 5_000 });
  expect(mutatingRequests).toEqual(["POST /api/demo/generate"]);
  expect(downloads).toBe(0);
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem("node-public-demo-tour-v1") ?? "null")?.status)).toBe("completed");
  await page.goto("/military-ai-demo");
  await expect(page.getByRole("heading", { name: "Node 공개 시연에 오신 것을 환영합니다" })).toHaveCount(0);
  await page.getByRole("button", { name: "튜토리얼 다시 시작", exact: true }).click();
  await expect(page.getByRole("button", { name: "보안", exact: true })).toHaveAttribute("aria-pressed", "true", { timeout: 8_000 });
  expect(mutatingRequests).toEqual(["POST /api/demo/generate"]);
  await page.getByRole("button", { name: "종료", exact: true }).click();
});

test("interrupted tutorial generation never repeats automatically", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  let requests = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/demo/generate", async (route) => {
    requests += 1;
    await gate;
    await route.abort().catch(() => undefined);
  });

  await page.goto("/military-ai-demo");
  await page.getByRole("button", { name: "시작", exact: true }).click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect.poll(() => requests).toBe(1);
  await page.reload();
  await expect(page.getByText("화면 1/4 · 단계 3/4")).toBeVisible();
  await page.waitForTimeout(1_000);
  expect(requests).toBe(1);
  await expect(page.locator('[data-tour-action="generateAi"]')).toHaveAttribute("data-tour-trigger", "true");
  await expect(page.getByRole("button", { name: "다음", exact: true })).toBeDisabled();
  release();
  await context.close();
});

test("failed tutorial generation announces an exact-fixture retry", async ({ browser }) => {
  const safeExample = examplesForTool("meetingSummary")[0];
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  const payloads: Record<string, unknown>[] = [];
  await page.route("**/api/demo/generate", async (route) => {
    payloads.push(route.request().postDataJSON());
    if (payloads.length === 1) {
      await route.fulfill({ status: 500, json: { error: "일시적인 생성 오류" } });
      return;
    }
    await route.fulfill({
      json: {
        ok: true,
        result: {
          ...safeExample.baselineResult,
          markdown: `# ${safeExample.baselineResult.title}`,
          model: "curated-sample-fallback",
          security: [],
          metrics: [],
          workItems: [],
        },
      },
    });
  });

  await page.goto("/military-ai-demo");
  await page.getByRole("button", { name: "시작", exact: true }).click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(page.locator('[data-tour-ai-error="true"]')).toContainText("다시 눌러 재시도");
  await page.locator("#demo-source").fill("재시도 전에 바꾼 입력");
  await page.locator('[data-tour-action="generateAi"]').click();
  await expect(page.getByTestId("military-result-panel")).toContainText("샘플 fallback");
  await expect(page.locator('[data-tour-action="generateAi"]')).toBeDisabled();
  expect(payloads).toEqual([
    { service: "militaryAi", tool: "meetingSummary", sourceText: safeExample.sourceText, exampleId: safeExample.id },
    { service: "militaryAi", tool: "meetingSummary", sourceText: safeExample.sourceText, exampleId: safeExample.id },
  ]);
  await context.close();
});

test("automatic tutorial waits for manual navigation with reduced motion", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/military-ai-demo");
  await page.getByRole("button", { name: "시작", exact: true }).click();
  await expect(page.getByText("화면 1/4 · 단계 1/4")).toBeVisible();
  await page.waitForTimeout(2_700);
  await expect(page.getByText("화면 1/4 · 단계 1/4")).toBeVisible();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(page.getByText("화면 1/4 · 단계 2/4")).toBeVisible();
  await context.close();
});

test("military security result preserves every generated section", async ({ page }) => {
  const labels = ["위험수준", "탐지항목", "사유", "권장 대체표현", "안전한 재작성", "최종 점검"];
  await page.route("**/api/demo/generate", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ result: {
        title: "보안 검토 결과",
        summary: "전체 섹션 보존 확인",
        sections: labels.map((label) => ({ label, body: `${label} 본문` })),
        actions: ["마스킹 확인"],
        security: [{ label: "민감정보", status: "warn" }],
        metrics: [],
        workItems: [],
        markdown: "# 보안 검토",
        model: "gemini-test",
      } }),
    });
  });

  await page.goto("/military-ai-demo");
  await page.getByRole("button", { name: "보안", exact: true }).click();
  await page.getByRole("button", { name: "보안 검토", exact: true }).click();
  await page.getByRole("button", { name: "결과 바로 보기" }).click();
  for (const label of labels) await expect(page.getByRole("heading", { name: label })).toBeVisible();
});

test("Gemini output types progressively and can be revealed immediately", async ({ page }) => {
  const result = {
    title: "타이포 애니메이션 최종 제목",
    summary: "이 문장은 Gemini 결과가 순차적으로 표시되는지 확인한다. " + "확인 문장 ".repeat(80),
    sections: [{ label: "현황", body: "표시할 본문" }],
    actions: ["후속조치 확인"],
    security: [],
    metrics: [],
    workItems: [],
    markdown: "# 타이포 애니메이션 최종 제목",
    model: "gemini-test",
  };
  await page.route("**/api/demo/generate", (route) => route.fulfill({ json: { ok: true, result } }));
  await page.goto("/military-ai-demo");
  await page.getByRole("button", { name: "문서 초안 작성" }).click();
  const panel = page.getByTestId("military-result-panel");
  await expect(panel).toBeVisible();
  await expect(panel).not.toContainText(result.summary);
  await page.getByRole("button", { name: "결과 바로 보기" }).click();
  await expect(panel).toContainText(result.title);
  await expect(panel).toContainText(result.summary);
});

test("reduced motion shows Gemini output immediately", async ({ page }) => {
  const result = {
    title: "접근 가능한 결과",
    summary: "동작 줄이기 환경에서는 즉시 표시된다.",
    sections: [], actions: [], security: [], metrics: [], workItems: [],
    markdown: "# 접근 가능한 결과",
    model: "gemini-test",
  };
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/demo/generate", (route) => route.fulfill({ json: { ok: true, result } }));
  await page.goto("/military-ai-demo");
  await page.getByRole("button", { name: "문서 초안 작성" }).click();
  await expect(page.getByTestId("military-result-panel")).toContainText(result.summary);
  await expect(page.getByRole("button", { name: "결과 바로 보기" })).toHaveCount(0);
});

test("non-Gemini fallback output appears immediately without typing controls", async ({ page }) => {
  const result = {
    title: "규칙 기반 결과",
    summary: "대체문은 즉시 표시된다.",
    sections: [{ label: "현황", body: "본문" }],
    actions: [],
    security: [],
    metrics: [],
    workItems: [],
    markdown: "# 규칙 기반 결과",
    model: "curated-sample-fallback",
  };
  await page.route("**/api/demo/generate", (route) => route.fulfill({ json: { ok: true, result } }));
  await page.goto("/military-ai-demo");
  await page.getByRole("button", { name: "문서 초안 작성" }).click();
  await expect(page.getByTestId("military-result-panel")).toContainText(result.summary);
  await expect(page.getByRole("button", { name: "결과 바로 보기" })).toHaveCount(0);
});

test("invalidating input disables stale persistence and derived panels", async ({ page }) => {
  const result = {
    title: "기존 결과",
    summary: "기존 입력에서 생성됨",
    sections: [{ label: "현황", body: "기존 본문" }],
    actions: ["기존 조치"],
    security: [],
    metrics: [],
    workItems: [{ title: "STALE TASK", owner: "담당", status: "대기", risk: "low" }],
    markdown: "# 기존 결과",
    model: "curated-sample-fallback",
  };
  await page.route("**/api/demo/generate", (route) => route.fulfill({ json: { ok: true, result } }));

  await page.goto("/admin-doc-demo");
  const secondary = page.getByRole("button", { name: "요지 복사" });
  await expect(secondary).toBeDisabled();
  await page.getByRole("button", { name: "초안 작성" }).click();
  await expect(secondary).toBeEnabled();
  await expect(page.getByText("STALE TASK")).toBeVisible();
  await page.getByLabel("초안 작성 메모").fill("새 입력");
  await expect(secondary).toBeDisabled();
  await expect(page.getByText("STALE TASK")).toHaveCount(0);

  await page.goto("/military-ai-demo");
  const save = page.getByRole("button", { name: "Save" });
  await expect(save).toBeDisabled();
  await page.getByRole("button", { name: "문서 초안 작성" }).click();
  await expect(save).toBeEnabled();
  await page.getByLabel("메모").fill("새 입력");
  await expect(save).toBeDisabled();
});

test("editing source clears output and discards a stale generation response", async ({ page }) => {
  await page.route("**/api/demo/generate", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fulfill({
      json: {
        ok: true,
        result: {
          title: "늦게 도착한 결과",
          summary: "폐기되어야 하는 결과",
          sections: [{ label: "현황", body: "이전 입력" }],
          actions: ["검토"],
          security: [],
          metrics: [],
          workItems: [],
          markdown: "# 늦게 도착한 결과",
          model: "gemini-test",
        },
      },
    });
  });

  await page.goto("/admin-doc-demo");
  await expect(page.getByTestId("demo-result-panel")).toBeHidden();
  await page.getByRole("button", { name: "초안 작성" }).click();
  await page.getByLabel("초안 작성 메모").fill("새로운 사용자 입력");
  await page.waitForTimeout(250);
  await expect(page.getByTestId("demo-result-panel")).toBeHidden();
  await expect(page.getByText("늦게 도착한 결과")).toHaveCount(0);

  await page.getByRole("button", { name: "초안 작성" }).click();
  await page.getByRole("button", { name: "결재요지", exact: true }).click();
  await page.waitForTimeout(250);
  await expect(page.getByTestId("demo-result-panel")).toBeHidden();

  await page.getByRole("button", { name: "초안 작성" }).click();
  await page.getByLabel("예시 입력").selectOption({ index: 1 });
  await page.waitForTimeout(250);
  await expect(page.getByTestId("demo-result-panel")).toBeHidden();
});

test("bare auth middleware still rejects protected routes", async ({ page }) => {
  for (const path of ["/", "/projects/private", "/org/private"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
  }
});

test("public demos do not initialize an authentication session", async ({ page }) => {
  const authSessionRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/auth/session") authSessionRequests.push(request.url());
  });

  for (const path of ["/ops-radar-demo", "/military-ai-demo", "/admin-doc-demo", "/after-action-demo", "/report-mock"]) {
    const response = await page.goto(path);
    expect(response?.ok()).toBe(true);
    await page.waitForTimeout(250);
  }

  expect(authSessionRequests).toEqual([]);
});
