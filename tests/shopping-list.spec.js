const { test, expect } = require("@playwright/test");
const path = require("path");
const { pathToFileURL } = require("url");

const APP_URL = pathToFileURL(path.join(__dirname, "..", "index.html")).href;

test.beforeEach(async ({ page }) => {
  await page.goto(APP_URL);
  // 각 테스트가 깨끗한 상태에서 시작하도록 localStorage 초기화
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("초기 상태: 빈 목록 안내 문구가 보인다", async ({ page }) => {
  await expect(page.locator("#empty")).toBeVisible();
  await expect(page.locator("#list li")).toHaveCount(0);
});

test("아이템 추가: 입력 후 추가 버튼을 누르면 목록에 나타난다", async ({ page }) => {
  await page.fill("#itemInput", "우유");
  await page.click("#addForm button[type=submit]");

  await expect(page.locator("#list li")).toHaveCount(1);
  await expect(page.locator("#list li .name")).toHaveText("우유");
  await expect(page.locator("#empty")).toBeHidden();
});

test("아이템 추가: Enter 키로도 추가된다", async ({ page }) => {
  await page.fill("#itemInput", "계란");
  await page.press("#itemInput", "Enter");

  await expect(page.locator("#list li .name")).toHaveText("계란");
  // 입력창은 비워져야 한다
  await expect(page.locator("#itemInput")).toHaveValue("");
});

test("아이템 추가: 빈 문자열/공백은 추가되지 않는다", async ({ page }) => {
  await page.fill("#itemInput", "   ");
  await page.click("#addForm button[type=submit]");

  await expect(page.locator("#list li")).toHaveCount(0);
});

test("여러 아이템 추가 후 카운터가 정확하다", async ({ page }) => {
  for (const item of ["우유", "계란", "빵"]) {
    await page.fill("#itemInput", item);
    await page.press("#itemInput", "Enter");
  }

  await expect(page.locator("#list li")).toHaveCount(3);
  await expect(page.locator("#counter")).toHaveText("남은 항목 3개 / 전체 3개");
});

test("체크 기능: 체크하면 완료 표시되고 카운터가 줄어든다", async ({ page }) => {
  await page.fill("#itemInput", "우유");
  await page.press("#itemInput", "Enter");

  const item = page.locator("#list li").first();
  await item.locator("input[type=checkbox]").check();

  await expect(item).toHaveClass(/done/);
  await expect(item.locator("input[type=checkbox]")).toBeChecked();
  await expect(page.locator("#counter")).toHaveText("남은 항목 0개 / 전체 1개");
});

test("체크 해제: 다시 누르면 완료 표시가 사라진다", async ({ page }) => {
  await page.fill("#itemInput", "우유");
  await page.press("#itemInput", "Enter");

  const checkbox = page.locator("#list li").first().locator("input[type=checkbox]");
  await checkbox.check();
  await checkbox.uncheck();

  await expect(page.locator("#list li").first()).not.toHaveClass(/done/);
  await expect(page.locator("#counter")).toHaveText("남은 항목 1개 / 전체 1개");
});

test("삭제 기능: ✕ 버튼을 누르면 해당 아이템이 사라진다", async ({ page }) => {
  for (const item of ["우유", "계란"]) {
    await page.fill("#itemInput", item);
    await page.press("#itemInput", "Enter");
  }

  // 첫 번째 아이템(우유) 삭제
  await page.locator("#list li").first().locator(".delete").click();

  await expect(page.locator("#list li")).toHaveCount(1);
  await expect(page.locator("#list li .name")).toHaveText("계란");
});

test("완료 항목 비우기: 체크된 항목만 일괄 삭제된다", async ({ page }) => {
  for (const item of ["우유", "계란", "빵"]) {
    await page.fill("#itemInput", item);
    await page.press("#itemInput", "Enter");
  }

  // 우유, 빵 체크
  await page.locator("#list li").nth(0).locator("input[type=checkbox]").check();
  await page.locator("#list li").nth(2).locator("input[type=checkbox]").check();

  await page.click("#clearDone");

  await expect(page.locator("#list li")).toHaveCount(1);
  await expect(page.locator("#list li .name")).toHaveText("계란");
});

test("영속성: 새로고침 후에도 목록과 체크 상태가 유지된다", async ({ page }) => {
  await page.fill("#itemInput", "우유");
  await page.press("#itemInput", "Enter");
  await page.fill("#itemInput", "계란");
  await page.press("#itemInput", "Enter");

  await page.locator("#list li").first().locator("input[type=checkbox]").check();

  await page.reload();

  await expect(page.locator("#list li")).toHaveCount(2);
  await expect(page.locator("#list li").first()).toHaveClass(/done/);
  await expect(page.locator("#list li").first().locator("input[type=checkbox]")).toBeChecked();
});
