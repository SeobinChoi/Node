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
  await expect(page.getByRole("button", { name: "안전 통제 승인 처리" })).toBeDisabled();
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
  await page.getByRole("button", { name: "안전 통제 승인 처리" }).click();
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
});
