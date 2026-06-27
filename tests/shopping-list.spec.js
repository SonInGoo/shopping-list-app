const { test, expect } = require("@playwright/test");
const path = require("path");

// ─────────────────────────────────────────────────────────────────────────────
// Supabase 버전 E2E 테스트
//
// 전략: 실제 공유 Supabase DB에 직접 붙으면 (1) 테스트 격리가 불가능하고(기존
// 데이터 오염), (2) 무료 티어 일시정지·네트워크 의존으로 불안정하며, (3) 실제
// 데이터를 변경합니다. 그래서 Supabase REST(PostgREST) 엔드포인트를 Playwright
// 의 route 가로채기로 "인메모리 가짜 DB"로 모킹합니다.
//   - 각 테스트는 독립된 가짜 DB로 시작 → 완전한 격리
//   - 네트워크/실DB 불필요, 빠르고 결정적
//   - 앱이 Supabase를 "어떻게" 호출하는지(예: text 컬럼으로 insert)까지 검증
//
// 참고: supabase-js 라이브러리 자체는 esm.sh CDN에서 로드되므로 테스트 실행 시
// 인터넷 연결이 필요합니다(애플리케이션 코드를 바꾸지 않기 위한 선택).
// ─────────────────────────────────────────────────────────────────────────────

const INDEX_PATH = path.join(__dirname, "..", "index.html");
// 실제 origin이 http가 되도록 가짜 호스트로 문서를 제공한다(file://의 모듈 import 이슈 회피).
const APP_URL = "http://shopping-list.test/index.html";
// index.html 안의 Supabase URL과 일치해야 한다.
const SUPABASE_REST = "https://lrrupqysmdwrlvovddka.supabase.co/rest/v1/**";

const BASE_TIME = Date.UTC(2024, 0, 1, 0, 0, 0); // 정렬용 고정 기준 시각

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

// PostgREST 스타일 필터(예: id=eq.123, done=eq.true)를 행 배열에 적용한다.
function applyFilters(rows, params) {
  let result = rows;
  for (const [key, value] of params) {
    if (["select", "order", "columns", "on_conflict"].includes(key)) continue;
    const m = /^eq\.(.*)$/.exec(value);
    if (m) {
      const v = m[1];
      result = result.filter((r) => String(r[key]) === v);
    }
  }
  return result;
}

/**
 * 앱을 마운트하고, Supabase REST를 인메모리 가짜 DB로 모킹한다.
 * @returns {{ db: Array, inserts: Array }} db: 현재 행들, inserts: insert로 보낸 원본 페이로드들
 */
async function mountApp(page, { initialRows = [], failLoad = false } = {}) {
  let seq = 0;
  const db = initialRows.map((r) => ({
    id: String(++seq),
    text: r.text,
    done: !!r.done,
    created_at: new Date(BASE_TIME + seq * 1000).toISOString(),
  }));
  const inserts = [];

  // 1) 문서(HTML) 자체를 로컬 파일로 응답 → 실제 http origin 확보
  await page.route(APP_URL, (route) =>
    route.fulfill({ path: INDEX_PATH, contentType: "text/html; charset=utf-8" })
  );

  // 2) Supabase REST 엔드포인트를 가짜 DB로 응답
  await page.route(SUPABASE_REST, (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const params = url.searchParams;

    // CORS 프리플라이트
    if (method === "OPTIONS") {
      return route.fulfill({ status: 204, headers: CORS, body: "" });
    }

    const json = (status, data) =>
      route.fulfill({
        status,
        headers: { ...CORS, "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    const noContent = () => route.fulfill({ status: 204, headers: CORS, body: "" });

    if (method === "GET") {
      if (failLoad) return json(500, { message: "강제 실패(테스트)" });
      let rows = [...db];
      const order = params.get("order"); // 예: created_at.asc
      if (order) {
        const [col, dir] = order.split(".");
        rows.sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0));
        if (dir === "desc") rows.reverse();
      }
      return json(200, rows);
    }

    if (method === "POST") {
      const body = JSON.parse(request.postData() || "{}");
      const payload = Array.isArray(body) ? body : [body];
      const created = payload.map((r) => ({
        id: String(++seq),
        text: r.text ?? null,
        done: r.done ?? false,
        created_at: new Date(BASE_TIME + seq * 1000).toISOString(),
      }));
      db.push(...created);
      inserts.push(...payload);
      const accept = request.headers()["accept"] || "";
      const single = accept.includes("vnd.pgrst.object"); // .single()
      return json(201, single ? created[0] : created);
    }

    if (method === "PATCH") {
      const body = JSON.parse(request.postData() || "{}");
      const targets = applyFilters(db, params);
      targets.forEach((r) => Object.assign(r, body));
      return noContent();
    }

    if (method === "DELETE") {
      const targets = applyFilters(db, params);
      for (const r of targets) {
        const i = db.indexOf(r);
        if (i > -1) db.splice(i, 1);
      }
      return noContent();
    }

    return json(400, { message: "지원하지 않는 메서드: " + method });
  });

  await page.goto(APP_URL);
  return { db, inserts };
}

test.describe("쇼핑 리스트 (Supabase 버전)", () => {
  test("초기 상태: 항목이 없으면 안내 문구가 보인다", async ({ page }) => {
    await mountApp(page, { initialRows: [] });

    await expect(page.locator("#empty")).toBeVisible();
    await expect(page.locator("#empty")).toHaveText(/첫 항목을 추가/);
    await expect(page.locator("#list li")).toHaveCount(0);
  });

  test("초기 로드: DB에 있던 항목이 화면에 표시된다", async ({ page }) => {
    await mountApp(page, { initialRows: [{ text: "사과" }, { text: "우유" }] });

    await expect(page.locator("#list li")).toHaveCount(2);
    await expect(page.locator("#list li .name").nth(0)).toHaveText("사과");
    await expect(page.locator("#list li .name").nth(1)).toHaveText("우유");
    await expect(page.locator("#empty")).toBeHidden();
  });

  test("아이템 추가: 추가 버튼을 누르면 목록에 나타난다", async ({ page }) => {
    await mountApp(page, { initialRows: [] });

    await page.fill("#itemInput", "우유");
    await page.click("#addForm button[type=submit]");

    await expect(page.locator("#list li")).toHaveCount(1);
    await expect(page.locator("#list li .name")).toHaveText("우유");
    await expect(page.locator("#empty")).toBeHidden();
  });

  test("아이템 추가: Enter 키로도 추가되고 입력창이 비워진다", async ({ page }) => {
    await mountApp(page, { initialRows: [] });

    await page.fill("#itemInput", "계란");
    await page.press("#itemInput", "Enter");

    await expect(page.locator("#list li .name")).toHaveText("계란");
    await expect(page.locator("#itemInput")).toHaveValue("");
  });

  test("Supabase 연동: 추가 시 text 컬럼으로 insert 된다", async ({ page }) => {
    const { inserts } = await mountApp(page, { initialRows: [] });

    await page.fill("#itemInput", "바나나");
    await page.press("#itemInput", "Enter");
    await expect(page.locator("#list li .name")).toHaveText("바나나");

    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toHaveProperty("text", "바나나");
    expect(inserts[0]).not.toHaveProperty("name"); // 컬럼명은 name이 아니라 text
  });

  test("아이템 추가: 빈 문자열/공백은 추가되지 않는다", async ({ page }) => {
    const { inserts } = await mountApp(page, { initialRows: [] });

    await page.fill("#itemInput", "   ");
    await page.click("#addForm button[type=submit]");

    await expect(page.locator("#list li")).toHaveCount(0);
    expect(inserts).toHaveLength(0); // 네트워크 요청 자체가 나가지 않아야 한다
  });

  test("여러 아이템 추가 후 카운터가 정확하다", async ({ page }) => {
    await mountApp(page, { initialRows: [] });

    for (const item of ["우유", "계란", "빵"]) {
      await page.fill("#itemInput", item);
      await page.press("#itemInput", "Enter");
    }

    await expect(page.locator("#list li")).toHaveCount(3);
    await expect(page.locator("#counter")).toHaveText("남은 항목 3개 / 전체 3개");
  });

  test("체크 기능: 체크하면 완료 표시되고 카운터가 줄어든다", async ({ page }) => {
    await mountApp(page, { initialRows: [{ text: "우유" }] });

    const item = page.locator("#list li").first();
    await item.locator("input[type=checkbox]").check();

    await expect(item).toHaveClass(/done/);
    await expect(item.locator("input[type=checkbox]")).toBeChecked();
    await expect(page.locator("#counter")).toHaveText("남은 항목 0개 / 전체 1개");
  });

  test("체크 해제: 다시 누르면 완료 표시가 사라진다", async ({ page }) => {
    await mountApp(page, { initialRows: [{ text: "우유", done: true }] });

    const checkbox = page.locator("#list li").first().locator("input[type=checkbox]");
    await expect(checkbox).toBeChecked();
    await checkbox.uncheck();

    await expect(page.locator("#list li").first()).not.toHaveClass(/done/);
    await expect(page.locator("#counter")).toHaveText("남은 항목 1개 / 전체 1개");
  });

  test("삭제 기능: ✕ 버튼을 누르면 해당 아이템이 사라진다", async ({ page }) => {
    await mountApp(page, { initialRows: [{ text: "우유" }, { text: "계란" }] });

    // 첫 번째 아이템(우유) 삭제
    await page.locator("#list li").first().locator(".delete").click();

    await expect(page.locator("#list li")).toHaveCount(1);
    await expect(page.locator("#list li .name")).toHaveText("계란");
  });

  test("완료 항목 비우기: 체크된 항목만 일괄 삭제된다", async ({ page }) => {
    await mountApp(page, { initialRows: [{ text: "우유" }, { text: "계란" }, { text: "빵" }] });

    // 우유, 빵 체크
    await page.locator("#list li").nth(0).locator("input[type=checkbox]").check();
    await page.locator("#list li").nth(2).locator("input[type=checkbox]").check();

    await page.click("#clearDone");

    await expect(page.locator("#list li")).toHaveCount(1);
    await expect(page.locator("#list li .name")).toHaveText("계란");
  });

  test("영속성: 새로고침 후에도 목록과 체크 상태가 유지된다", async ({ page }) => {
    await mountApp(page, { initialRows: [] });

    await page.fill("#itemInput", "우유");
    await page.press("#itemInput", "Enter");
    await page.fill("#itemInput", "계란");
    await page.press("#itemInput", "Enter");
    await expect(page.locator("#list li")).toHaveCount(2);

    await page.locator("#list li").first().locator("input[type=checkbox]").check();
    await expect(page.locator("#list li").first()).toHaveClass(/done/);

    // 새로고침 → 가짜 DB에서 다시 로드된다
    await page.reload();

    await expect(page.locator("#list li")).toHaveCount(2);
    await expect(page.locator("#list li").first()).toHaveClass(/done/);
    await expect(
      page.locator("#list li").first().locator("input[type=checkbox]")
    ).toBeChecked();
  });

  test("에러 처리: 목록 로드 실패 시 에러 메시지를 보여준다", async ({ page }) => {
    await mountApp(page, { initialRows: [], failLoad: true });

    await expect(page.locator("#empty")).toBeVisible();
    await expect(page.locator("#empty")).toHaveText(/불러오지 못했습니다/);
  });
});
