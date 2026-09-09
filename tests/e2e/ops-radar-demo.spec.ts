import { expect, test } from "@playwright/test";

test("runs the no-login Ops Radar sample flow and safely resets", async ({ page }) => {
  const errors: string[] = [];
  const apiRequests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith("/api/")) apiRequests.push(pathname);
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ops-radar-demo");

  await expect(page.getByText("비식별 샘플 데이터")).toBeVisible();
  await expect(page.getByText("운영 시스템 연동 전 시연판")).toBeVisible();
  const mobileGraphCards = page.locator('[data-testid^="ops-mobile-node-"]');
  await expect(mobileGraphCards).toHaveCount(7);
  await expect(page.locator(".react-flow__node:visible")).toHaveCount(0);
  await mobileGraphCards.last().focus();
  await page.keyboard.press("Tab");
  await expect(page.locator(".react-flow__node:focus")).toHaveCount(0);
  const firstMobileCardBox = await mobileGraphCards.first().boundingBox();
  expect(firstMobileCardBox?.width).toBeGreaterThanOrEqual(300);
  expect(Number.parseFloat(await mobileGraphCards.first().evaluate((element) => getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(12);
  await expect(page.getByTestId("ops-task-checklist")).toContainText("평가 전");
  await expect(page.locator(".react-flow__edge.animated")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "점검표 제출 완료 처리" })).toBeDisabled();
  await page.getByTestId("ops-mobile-node-vehicle").click();
  await expect(page.getByTestId("ops-radar-detail")).toContainText("업무 평가 후");
  await expect(page.getByTestId("ops-radar-detail")).not.toContainText("지연");
  await page.getByRole("button", { name: "시연 시작" }).click();
  await expect(page.getByTestId("ops-radar-detail")).toContainText("점검표 제출");
  await expect(page.getByTestId("ops-metric-highRisk")).toContainText("3");
  await expect(page.getByTestId("ops-metric-delayed")).toContainText("1");
  await expect(page.getByTestId("ops-task-checklist")).toContainText("지연");
  await expect(page.getByTestId("ops-radar-detail")).toContainText("점검표 제출");
  await expect(page.getByRole("button", { name: "안전 통제 승인 완료 처리" })).toBeDisabled();
  await page.getByTestId("ops-mobile-node-vehicle").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("ops-radar-detail")).toContainText("장비 점검 결과 확인");
  await page.getByTestId("ops-mobile-node-checklist").click();
  await expect(page.getByTestId("ops-radar-detail")).toContainText("후속 4건");
  await page.getByRole("button", { name: "점검표 제출 완료 처리" }).click();
  await expect(page.getByTestId("ops-radar-detail")).toContainText("안전 통제 승인");
  await expect(page.getByTestId("ops-task-checklist")).toContainText("완료");
  await expect(page.getByTestId("ops-task-approval")).toContainText("승인 대기");
  await expect(page.getByTestId("ops-metric-highRisk")).toContainText("2");
  await expect(page.getByTestId("ops-metric-delayed")).toContainText("0");
  await page.getByRole("button", { name: "안전 통제 승인 완료 처리" }).click();
  await expect(page.getByTestId("ops-task-approval")).toContainText("완료");
  await expect(page.getByTestId("ops-task-night")).toContainText("진행 가능");
  await page.getByRole("button", { name: "보고문 복사" }).click();
  await expect(page.getByRole("button", { name: "복사 완료" })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV 다운로드" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("ops-radar-demo.csv");
  await page.getByRole("button", { name: "시연 초기화" }).click();
  await expect(page.getByText("평가 전", { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  expect(apiRequests).toEqual([]);
});

test("offers a selectable manual report when browser copy is denied", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new DOMException("Denied", "NotAllowedError")) },
    });
    Object.defineProperty(Document.prototype, "execCommand", {
      configurable: true,
      value: () => false,
    });
  });

  await page.goto("/ops-radar-demo");
  await page.getByRole("button", { name: "업무 평가 실행" }).click();
  await page.getByRole("button", { name: "보고문 복사" }).click();

  await expect(page.getByRole("button", { name: "직접 복사 필요" })).toBeVisible();
  const manualCopy = page.getByRole("textbox", { name: "보고문 직접 복사" });
  await expect(manualCopy).toBeVisible();
  await expect(manualCopy).toHaveValue(/현재 병목/);
  expect(await manualCopy.evaluate((element) => {
    const textarea = element as HTMLTextAreaElement;
    return document.activeElement === textarea && textarea.selectionStart === 0 && textarea.selectionEnd === textarea.value.length;
  })).toBe(true);
});

test("keeps the desktop dependency graph readable and keyboard operable", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/ops-radar-demo");
  await page.getByRole("button", { name: "업무 평가 실행" }).click();

  const vehicleNode = page.getByTestId("rf__node-vehicle");
  await expect(vehicleNode).toBeVisible();
  expect((await vehicleNode.boundingBox())?.width).toBeGreaterThanOrEqual(120);
  await vehicleNode.focus();
  await page.keyboard.press("Space");
  await expect(page.getByTestId("ops-radar-detail")).toContainText("장비 점검 결과 확인");
  await expect(page.locator(".react-flow__edge[tabindex='0']")).toHaveCount(0);

  await page.setViewportSize({ width: 640, height: 900 });
  await vehicleNode.focus();
  await page.setViewportSize({ width: 639, height: 900 });
  const mobileVehicleNode = page.getByTestId("ops-mobile-node-vehicle");
  await expect(mobileVehicleNode).toBeFocused();
  await page.setViewportSize({ width: 640, height: 900 });
  await expect(vehicleNode).toBeFocused();

  await page.locator("h1").first().click();
  await expect.poll(() => page.evaluate(() => document.activeElement === document.body)).toBe(true);
  await page.setViewportSize({ width: 639, height: 900 });
  await expect(mobileVehicleNode).not.toBeFocused();

  await mobileVehicleNode.focus();
  await page.locator("h1").first().click();
  await expect.poll(() => page.evaluate(() => document.activeElement === document.body)).toBe(true);
  await page.setViewportSize({ width: 640, height: 900 });
  await expect(vehicleNode).not.toBeFocused();

  await page.setViewportSize({ width: 639, height: 900 });
  await mobileVehicleNode.focus();
  await page.setViewportSize({ width: 640, height: 900 });
  await page.locator("h1").first().click();
  await page.waitForTimeout(250);
  await expect(vehicleNode).not.toBeFocused();

  await page.setViewportSize({ width: 639, height: 900 });
  await mobileVehicleNode.focus();
  await page.setViewportSize({ width: 640, height: 900 });
  await page.keyboard.press("Tab");
  await page.waitForTimeout(250);
  await expect(vehicleNode).not.toBeFocused();

  await page.setViewportSize({ width: 639, height: 900 });
  await mobileVehicleNode.focus();
  await page.setViewportSize({ width: 640, height: 900 });
  const checklistNode = page.getByTestId("rf__node-checklist");
  await checklistNode.click();
  await page.waitForTimeout(250);
  await expect(checklistNode).toBeFocused();
  await expect(vehicleNode).not.toBeFocused();

  await page.setViewportSize({ width: 639, height: 900 });
  await mobileVehicleNode.focus();
  await page.setViewportSize({ width: 640, height: 900 });
  const fitButton = page.getByRole("button", { name: "전체 보기" });
  await fitButton.click();
  await page.waitForTimeout(250);
  await expect(fitButton).toBeFocused();
});

test("switches the situation scenario and resets the whole analysis", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/ops-radar-demo");
  await page.getByRole("button", { name: "업무 평가 실행" }).click();
  await expect(page.getByTestId("ops-metric-highRisk")).toContainText("3");
  await expect(page.getByTestId("ops-radar-detail")).toContainText("점검표 제출");
  await expect(page.getByTestId("ops-ai-report")).toBeVisible();

  await page.getByTestId("ops-scenario-select").selectOption("equipment-return");

  await expect(page.getByTestId("ops-scenario-summary")).toContainText("반납 대상 장비");
  await expect(page.getByTestId("ops-ai-report")).toHaveCount(0);
  await expect(page.getByTestId("ops-metric-highRisk")).toContainText("-");
  await expect(page.getByTestId("ops-radar-detail")).toContainText("업무 평가 후");
  await expect(page.getByTestId("ops-task-checklist")).toHaveCount(0);
  await expect(page.getByTestId("ops-task-inventory")).toContainText("반납 대상 장비 조사");
  await expect(page.getByTestId("rf__node-inventory")).toBeVisible();
  await expect(page.getByTestId("ops-action-lead")).toContainText("업무 평가를 실행하면");

  await page.getByRole("button", { name: "업무 평가 실행" }).click();
  await expect(page.getByTestId("ops-metric-highRisk")).toContainText("2");
  await expect(page.getByTestId("ops-metric-reportReady")).toContainText("1");
  await expect(page.getByTestId("ops-action-lead")).toContainText("반납 대상 장비 조사");
  await expect(page.getByTestId("ops-radar-detail")).toContainText("반납 대상 장비 조사");
  await expect(page.getByTestId("ops-radar-detail")).toContainText("후속 3건");
  await expect(page.getByRole("button", { name: "반납 대상 장비 조사 완료 처리" })).toBeEnabled();
});

test("re-evaluates the graph when the operator edits the current task", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/ops-radar-demo");
  await page.getByRole("button", { name: "업무 평가 실행" }).click();
  await expect(page.getByTestId("ops-metric-delayed")).toContainText("1");

  await page.getByTestId("ops-edit-task").selectOption("checklist");
  await page.getByTestId("ops-edit-title").fill("현장 점검표 제출");
  await page.getByTestId("ops-edit-owner").fill("현장 운영반");
  await page.getByTestId("ops-edit-due").fill("2026-09-12");

  await expect(page.getByTestId("ops-metric-delayed")).toContainText("0");
  await expect(page.getByTestId("ops-task-checklist")).toContainText("현장 점검표 제출");
  await expect(page.getByTestId("ops-task-checklist")).toContainText("현장 운영반");
  await expect(page.getByTestId("ops-task-checklist")).toContainText("2026-09-12");
  await expect(page.getByRole("button", { name: "현장 점검표 제출 완료 처리" })).toBeVisible();

  await expect(page.getByTestId("ops-edit-dependency-checklist")).toHaveCount(0);
  await page.getByTestId("ops-edit-dependency-vehicle").check();
  await expect(page.getByTestId("ops-task-checklist")).toContainText("선행업무 대기");
  await expect(page.getByTestId("ops-task-checklist")).toContainText("장비 점검 결과 확인");

  await page.getByTestId("ops-edit-risk").selectOption("low");
  await expect(page.getByTestId("ops-metric-highRisk")).toContainText("2");
  await page.getByTestId("ops-edit-state").selectOption("completed");
  await expect(page.getByTestId("ops-task-checklist")).toContainText("완료");
});

test("generates the selected report type from the current source and labels the origin", async ({ page }) => {
  const payloads: Array<Record<string, string>> = [];
  await page.route("**/api/demo/generate", async (route) => {
    payloads.push(JSON.parse(route.request().postData() ?? "{}"));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        result: {
          title: payloads.length === 1 ? "병목 조치계획 초안" : "재생성 조치계획",
          summary: "점검표 제출 지연이 후속 업무를 막고 있습니다.",
          sections: [{ label: "현재 상황", body: "점검표 제출이 기한을 경과했습니다." }],
          actions: ["점검표 회수 / 담당 운영반"],
          model: payloads.length === 1 ? "gemini-2.5-flash" : "gpt-4o-mini",
        },
      }),
    });
  });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/ops-radar-demo");
  await page.getByRole("button", { name: "업무 평가 실행" }).click();
  await expect(page.getByTestId("ops-ai-warning")).toContainText("비식별 합성 데이터");

  await page.getByTestId("ops-document-type").selectOption("action");
  await page.getByTestId("ops-generate-document").click();

  await expect(page.getByTestId("ops-ai-title")).toHaveText("병목 조치계획 초안");
  await expect(page.getByTestId("ops-ai-source")).toContainText("Gemini");
  await expect(page.getByTestId("ops-ai-sections")).toContainText("현재 상황");
  await expect(page.getByTestId("ops-ai-actions")).toContainText("점검표 회수");
  expect(payloads[0].service).toBe("opsRadar");
  expect(payloads[0].mode).toBe("action");
  expect(payloads[0].sourceText).toContain("병목 조치계획");
  expect(payloads[0].sourceText).toContain("bottlenecks");
  expect(payloads[0].sourceText).toContain("점검표 제출");
  expect(payloads[0].sourceText.length).toBeLessThanOrEqual(12000);

  await page.getByTestId("ops-ai-copy").click();
  await expect(page.getByRole("button", { name: "복사 완료 (한글·워드 붙여넣기)" })).toBeVisible();

  await page.getByTestId("ops-edit-task").selectOption("checklist");
  await expect(page.getByTestId("ops-edit-title")).toHaveAttribute("maxlength", "60");
  await expect(page.getByTestId("ops-edit-owner")).toHaveAttribute("maxlength", "30");
  await page.getByTestId("ops-edit-owner").fill("현장 대응반");
  await expect(page.getByTestId("ops-ai-title")).toHaveCount(0);
  await page.getByTestId("ops-generate-document").click();

  await expect(page.getByTestId("ops-ai-title")).toHaveText("재생성 조치계획");
  await expect(page.getByTestId("ops-ai-source")).toContainText("AI 생성 · gpt-4o-mini");
  await expect(page.getByTestId("ops-ai-source")).not.toContainText("Gemini");
  expect(payloads).toHaveLength(2);
  expect(payloads[1].sourceText).toContain("현장 대응반");
  expect(payloads[0].sourceText).not.toContain("현장 대응반");
});

test("marks deterministic fallback output and surfaces generation failures", async ({ page }) => {
  let failNext = true;
  await page.route("**/api/demo/generate", async (route) => {
    if (failNext) {
      failNext = false;
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Failed to generate demo result" }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        result: {
          title: "지휘관 상황보고 초안",
          summary: "규칙 기반으로 정리한 보고 문안입니다.",
          sections: [{ label: "현재 상황", body: "지연 과업이 후속 업무의 선행조건으로 남아 있습니다." }],
          actions: ["영향 과업이 가장 많은 병목 과업 상태 확인"],
          model: "deterministic-demo-fallback",
        },
      }),
    });
  });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/ops-radar-demo");
  await page.getByRole("button", { name: "업무 평가 실행" }).click();

  await page.getByTestId("ops-generate-document").click();
  await expect(page.getByTestId("ops-ai-error")).toContainText("보고문 생성에 실패");
  await expect(page.getByTestId("ops-ai-title")).toHaveCount(0);

  await page.getByTestId("ops-generate-document").click();
  await expect(page.getByTestId("ops-ai-title")).toHaveText("지휘관 상황보고 초안");
  await expect(page.getByTestId("ops-ai-source")).toHaveText("규칙 기반 대체문");
  await expect(page.getByTestId("ops-ai-error")).toHaveCount(0);
});

test("keeps the mobile relationship cards synchronized with scenarios and edits", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ops-radar-demo");

  const mobileCards = page.locator('[data-testid^="ops-mobile-node-"]');
  await expect(mobileCards).toHaveCount(7);
  await page.getByTestId("ops-scenario-select").selectOption("joint-exercise");
  await expect(mobileCards).toHaveCount(9);
  await expect(page.locator(".react-flow__node:visible")).toHaveCount(0);

  await page.getByRole("button", { name: "업무 평가 실행" }).click();
  await page.getByTestId("ops-mobile-node-terrain").click();
  await expect(page.getByTestId("ops-radar-detail")).toContainText("훈련장 사용 협조");

  await page.getByTestId("ops-edit-title").fill("훈련장 사용 협조 재요청");
  await expect(page.getByTestId("ops-mobile-node-terrain")).toContainText("훈련장 사용 협조 재요청");
  await expect(page.getByTestId("ops-mobile-node-terrain")).toContainText("지연");
  await page.getByTestId("ops-edit-due").fill("2026-09-12");
  await expect(page.getByTestId("ops-mobile-node-terrain")).toContainText("진행 가능");
  await page.getByTestId("ops-edit-dependency-supply").check();
  await expect(page.getByTestId("ops-mobile-node-terrain")).toContainText("보급 물자 청구");
  await expect(page.getByTestId("ops-mobile-node-terrain")).toContainText("선행업무 대기");

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await mobileCards.first().evaluate((element) => element.getBoundingClientRect().width <= window.innerWidth)).toBe(true);
});
