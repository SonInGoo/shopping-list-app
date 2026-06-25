# 🛒 쇼핑 리스트 앱

바닐라 JavaScript로 만든 간단한 쇼핑 리스트 웹 앱입니다. 외부 프레임워크 없이 단일 `index.html` 파일로 동작하며, `localStorage`를 사용해 새로고침 후에도 목록이 유지됩니다.

## ✨ 기능

- 항목 추가 (추가 버튼 또는 Enter 키)
- 체크박스로 완료 표시 / 해제 (완료 시 취소선)
- 항목 개별 삭제
- 완료된 항목 일괄 비우기
- 남은 항목 / 전체 항목 카운터
- `localStorage` 기반 영속성
- 공백만 입력 시 추가 방지

## 🚀 실행 방법

별도 빌드나 서버 없이 `index.html`을 브라우저에서 열기만 하면 됩니다.

```bash
# 저장소 클론
git clone https://github.com/SonInGoo/shopping-list-app.git
cd shopping-list-app

# index.html 을 브라우저로 열기
```

## 🧪 테스트

[Playwright](https://playwright.dev/) 기반 E2E 테스트가 포함되어 있습니다.

```bash
npm install
npx playwright install
npm test
```

## 📁 구조

```
.
├── index.html                    # 앱 전체 (HTML + CSS + JS)
├── tests/
│   └── shopping-list.spec.js     # Playwright E2E 테스트
├── playwright.config.js
└── package.json
```
