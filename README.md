# 🛒 쇼핑 리스트 앱

바닐라 JavaScript로 만든 쇼핑 리스트 웹 앱입니다. 데이터는 **Supabase**(PostgreSQL) 데이터베이스에 저장되어, 어느 기기에서 접속해도 동일한 목록을 볼 수 있습니다.

## ✨ 기능

- 항목 추가 (추가 버튼 또는 Enter 키)
- 체크박스로 완료 표시 / 해제 (완료 시 취소선)
- 항목 개별 삭제
- 완료된 항목 일괄 비우기
- 남은 항목 / 전체 항목 카운터
- **Supabase 데이터베이스 영속성** (낙관적 업데이트 + 실패 시 롤백)
- 기존 localStorage 데이터 자동 이관 (최초 1회)
- 공백만 입력 시 추가 방지

## 🏗️ 기술 구성

- 프론트엔드: 단일 `index.html` (HTML + CSS + 바닐라 JS, 빌드 없음)
- 데이터베이스: [Supabase](https://supabase.com/) (PostgreSQL)
- 클라이언트 SDK: [`@supabase/supabase-js`](https://github.com/supabase/supabase-js) v2 (ESM CDN)

### 🗄️ 데이터베이스 스키마 (`shopping_items`)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `uuid` (PK, `gen_random_uuid()`) | 고유 ID |
| `text` | `text` (not null) | 항목 이름 |
| `done` | `boolean` (default false) | 완료 여부 |
| `created_at` | `timestamptz` (default now()) | 생성 시각 |

Row Level Security(RLS)가 활성화되어 있으며, 클라이언트는 공개용 `publishable`(anon) 키로 접근합니다.

## 🚀 실행 방법

`index.html`은 ES 모듈 + CDN을 사용하므로 **로컬 HTTP 서버를 통해** 열어야 합니다 (`file://` 은 ES 모듈/CORS 제약으로 동작하지 않을 수 있음).

```bash
# 저장소 클론
git clone https://github.com/SonInGoo/shopping-list-app.git
cd shopping-list-app

# 간단한 정적 서버로 실행 (예: http-server)
npx http-server -p 8765
# 브라우저에서 http://127.0.0.1:8765/index.html 접속
```

## ⚙️ 설정

다른 Supabase 프로젝트로 교체하려면 `index.html` 상단의 상수를 수정하세요.

```js
const SUPABASE_URL = "https://<project-ref>.supabase.co";
const SUPABASE_KEY = "<publishable-or-anon-key>"; // 공개용 키만 사용 (service_role 금지)
```

> ⚠️ `publishable`/`anon` 키는 클라이언트 노출용으로 설계되었으며 RLS 정책으로 보호됩니다. **`service_role`/`secret` 키는 절대 프론트엔드에 넣지 마세요.**

## 🧪 테스트

`tests/shopping-list.spec.js` 의 Playwright 테스트는 localStorage 기반 이전 버전용으로 작성되었습니다. Supabase 전환 이후 테스트 격리(전용 테스트 테이블 또는 모킹)가 필요하여 현재 **skip** 처리되어 있습니다.

```bash
npm install
npx playwright install
npm test
```

## 📁 구조

```
.
├── index.html                    # 앱 전체 (HTML + CSS + JS, Supabase 연동)
├── tests/
│   └── shopping-list.spec.js     # Playwright E2E 테스트 (localStorage 버전 - 현재 skip)
├── playwright.config.js
└── package.json
```
