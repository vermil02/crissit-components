# componote — 복사본

이 폴더는 **도구의 배포본**이다. 직접 고치지 않는다 — 다음 복사 때 덮어써진다.

| | 어디 |
|---|---|
| 정본 | `업무도구/componote/` (OneDrive) — `src/` 를 고치고 `build.py` 로 만든다 |
| 사용법·스펙 | 그 폴더의 `README.md` · `REQUIREMENTS.md` |
| 메모 서버 만드는 법 | 그 폴더의 `docs/SERVER.md` |

복사 시점 2026-09-08 (`componote.css` · `componote.js` 두 파일).

## 이 프로젝트가 도구에 맞춰 준 것

`카탈로그.html` 안에 있다.

- `window.componote = { section: "section.sec", sectionTitle: "h2" }` —
  메모에 적힐 구역 이름을 어디서 읽을지
- `.hide-notes .sec > .src` · `.hide-notes .aside` — 「설명」 버튼이 감출 것
- `.frame:has([data-lang].is-open){overflow:visible}` — 데모 액자가 드롭다운을
  자르지 않게 (도구와 무관하게 이 페이지에만 필요한 것)

## 고칠 일이 생기면

정본 폴더의 `src/` 를 고치고 `python3 build.py` 를 돌린 뒤, 여기 두 파일을 다시
복사하고 **`카탈로그.html` 의 `?v=` 값을 바꾼다.** 안 바꾸면 브라우저가 옛 파일을 쓴다.
