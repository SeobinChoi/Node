import { expect, test } from "@playwright/test";

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
  await page.goto("/military-ai-demo");

  await expect(page.getByRole("heading", { name: "문서지원 통합" })).toBeVisible();
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(page.getByText("AI 산출")).toBeVisible();
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
    await expect(page.getByTestId("demo-result-panel")).toBeVisible();
    await expect(page.getByTestId("saved-service-panel")).toContainText(
      "저장된 시연 항목",
    );
  }
});
