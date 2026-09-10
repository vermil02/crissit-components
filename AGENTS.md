# crissit 컴포넌트 — 먼저 읽을 것

바닐라 HTML/CSS 컴포넌트 세트다. 빌드 도구가 없고 CSS 파일을 순서대로 넣으면 끝난다.

> 공개 주소 · <https://vermil02.github.io/crissit-components/>
> 이 문서는 **규칙**만 담는다. 컴포넌트 목록·클래스·마크업은 `registry.json` 이 갖고 있다.

## 3분 안에 쓰기

```
① registry.json            어떤 컴포넌트가 있나 (4.5KB)
② registry/<id>.json       그 컴포넌트만 (1~3KB · 클래스·상태·마크업·실제 조합)
③ css 항목의 파일을 그 순서대로 넣는다
```

**전체를 읽지 않는다.** 카탈로그(`카탈로그.html`)는 148KB 이고 `css/icons.css` 는 122KB 다.
둘 다 사람이 눈으로 보거나 브라우저가 쓰는 것이고, 필요한 사실은 위 두 파일에 다 있다.

```html
<link rel="stylesheet" href="css/tokens.css">   <!-- 값. 항상 맨 처음 -->
<link rel="stylesheet" href="css/base.css">     <!-- 리셋·아이콘 슬롯·hover 막 -->
<link rel="stylesheet" href="css/icons.css">    <!-- 아이콘·로고. 생성물이라 열어 볼 필요 없다 -->
<link rel="stylesheet" href="css/button.css">   <!-- 쓰는 컴포넌트만 -->
```

`tokens.css` → `base.css` → `icons.css` → 나머지 순서다. 나머지끼리는 순서가 상관없다.

## 지켜야 할 규칙 아홉

**1. 값은 `tokens.css` 에서만 꺼낸다.** 색·글꼴·라운드·여백을 숫자로 직접 적지 않는다.

```css
color: var(--label-normal);      /* ○ */
color: #151617;                  /* ✗ 같은 값이어도 안 된다 */
font: var(--body-2-normal-medium);
```

**2. 아이콘은 `.i-*` 클래스로 부른다.** HTML 에 `style="--icon:url(...)"` 를 직접 쓰면
상대 경로가 **그 변수를 쓰는 CSS 파일 기준**으로 풀려 404 가 난다.

```html
<i class="icon icon--20 i-arrow-right" aria-hidden="true"></i>
```

아이콘은 CSS `mask` 로 그려서 **색이 글자색을 따라간다.** 밝은 면·어두운 면에 같은 것을 쓴다.
이름 목록은 `registry/아이콘.json` (6.5KB). **64종 중 17종만 실제로 쓴다.**

**3. `css/icons.css` 는 생성물이다. 손으로 고치지 않는다.**
아이콘을 고칠 것은 `assets/*.svg` 이고, 고친 뒤 `python3 아이콘-내장하기.py` 를 돌린다.
SVG 가 CSS 안에 글자로 박혀 있어서(`data:` URI) 122KB 다 — 그래서 **낱개 요청 68번이 없고**,
HTML 파일을 더블클릭해서 열어도 아이콘이 보인다(`mask` 는 `file://` 에서 CORS 로 막힌다).

**4. 테두리는 `border` 로 그린다.** 전역 `box-sizing:border-box` 라 칸 크기가 안 변한다.
`inset box-shadow` 는 **배경 위**에 그려져서 그 위에 얹는 층(사진 확대 층 등)이 덮어 버린다.

**5. hover 는 색을 바꾸지 않고 반투명 막을 얹는다.** 면을 가진 요소에 `has-overlay` 를 붙인다.
어두운 면에는 `has-overlay--light` 를 함께 붙인다(흰색 막).

```html
<button class="btn btn--solid btn--primary btn--md has-overlay">…</button>
<button class="btn btn--solid btn--assistive btn--md has-overlay has-overlay--light">…</button>
```

**6. 크기는 padding + 줄높이로 만들어져 있다.** `height` 를 덮어쓰지 않는다.
글자가 길어지거나 번역으로 줄이 늘어도 안 깨지게 만든 것이다.

**7. 여백은 감싸는 쪽이 준다.** 컴포넌트에 좌우 여백이 없다.
`.container` (최대 1280 · 좌우 20)가 그 몫이다. 컴포넌트에 또 여백을 주면 두 배가 된다.

**8. 상태 클래스는 `is-*` 다** (`is-open` · `is-active` · `is-scrolled`).
여닫는 **코드는 대부분 개발 몫**이다. CSS 는 상태별 모양만 정해 두었다.
스크립트가 실제로 도는 것은 넷뿐이다 — `boardlist-main.js`(대표 기사 자동 전환) ·
`gnb.js`(GNB 전환·판·드로어) · `gnb-lang.js`(언어 목록) · `hero.js`(머리 스크롤).

**9. `.pg-*` 는 화면 전용이다.** 컴포넌트가 아니다. 이 세트에 없다.

## 컴포넌트를 고를 때 — 상태를 본다

`registry.json` 의 컴포넌트마다, `registry/<id>.json` 의 클래스마다 `상태` 가 붙어 있다.

| 상태 | 뜻 | 어떻게 하나 |
|---|---|---|
| `현행` | 지금 쓰는 것 | **이걸 쓴다** |
| `이전판` | 우리가 다른 판으로 갈아탄 것 | `후속` 에 적힌 것을 쓴다 |
| `예정` | 준비는 끝났고 쓸 화면이 아직 없다 | 써도 된다. 곧 쓴다 |
| `라이브러리에만` | 피그마에 있고 우리가 안 고른 것 | **쓰기 전에 물어본다.** 시안에 없는 모양이다 |

`쓰는 화면` 항목이 어느 화면이 실제로 붙였는지 알려준다. **어느 판을 쓸지 헷갈리면
`실제 조합` 을 본다** — 화면이 정말로 함께 붙인 클래스 조합이라 마크업 예시보다 확실하다.

⚠ 가장 흔히 틀리는 곳: **목록 카드는 `bl bl-h bl-h--wide` 다.** `bl bl-h` 만 쓰면
피그마의 옛 판(사진 176×122)이 나온다. 우리 목록은 300×180 을 쓴다.

## 접근성 — 이미 지켜 둔 것

- 아이콘만 있는 버튼에는 `aria-label` 을 준다. 글자 옆 장식 아이콘은 `aria-hidden="true"`.
- 여닫는 것에는 `aria-expanded`, 드로어에는 `role="dialog" aria-modal="true"`.
- `prefers-reduced-motion` 이면 전환·확대·오로라가 멈춘다. 새 움직임을 넣을 때 같이 지킨다.
- `[hidden]` 은 `base.css` 가 `!important` 로 못박아 두었다 — 컴포넌트의 `display:flex` 와
  명시도가 같아서 숨긴 줄 알았는데 보이는 일이 있었다.

## 정책은 여기 없다 — 화면 쪽에 있다

**컴포넌트는 「어떻게 생겼나」만 안다.** 「몇 건 보여주나 · 몇 초마다 넘기나 · 필터가 어떻게
묶이나」는 화면 것이다. 가르는 기준 한 줄 — **다른 화면에서 그 값이 달라질 수 있나?**

| | 어디 |
|---|---|
| 대표 기사 8초마다 전환 | 화면 (카탈로그 데모는 3초로 쓴다) |
| 최대 5건 · 목록 10건 | 화면 |
| 링이 상단 중앙에서 시계방향으로 찬다 | **컴포넌트** |

컴포넌트는 **기본값**을 갖고 화면이 `data-*` 로 덮어쓴다. 한도를 넘으면 **콘솔에 경고**하고
조용히 자르지 않는다.

```html
<div data-bl-rotator data-interval="3000">   <!-- 8000 이 기본값 -->
```

CSS 주석에 값이 적혀 있는 곳이 있는데(`boardlist.css` · `dropdown.css` · `filter.css` ·
`drawer.css`) **그건 옮긴 것이다. 정본은 피그마 정의서**이고, 글로 옮긴 사본이
`03. 페이지 소스화/정책/*.md` 에 있다(노드 id 가 붙어 있다). 어긋나면 정의서가 맞다.

**화면 쪽 색인**은 `03. 페이지 소스화/_소스/화면.json` 이다 — 어느 화면이 어떤 컴포넌트를
쓰고 무엇이 아직 미확정인지가 거기 있다. 그 폴더의 `AGENTS.md` 가 이 문서의 짝이다.

## 이 세트가 갖고 있지 않은 것

- **판 그림·배경 사진** — 마케팅 사진은 화면 자료다. `gnb-site.css`(LNB 판 그림)와
  `hero.css`(머리 배경)는 그림 경로를 **화면이 넣는 것**으로 두었다.
- **라우트·링크 주소** — 링크는 `#` 으로 두었다. 개발이 라우트로 건다.
- **문구 정본** — 카탈로그의 회사 정보(사업자 번호·대표·주소)는 피그마 푸터 값을 옮긴 것이다.
  실제 사용 전에 사실대장과 대조한다.

## 파일 지도

| 무엇 | 어디 | 크기 |
|---|---|---|
| 이 문서 | `AGENTS.md` | 6KB |
| 컴포넌트 색인 | `registry.json` | 4.5KB |
| 컴포넌트 낱개 | `registry/<id>.json` | 1~3KB |
| 아이콘 이름 목록 | `registry/아이콘.json` | 6.5KB |
| 쓰임 실측 (자동) | `쓰임.json` ← `쓰임-조사.py` | 30KB |
| 상태 선언 (수동) | `상태.json` | 3KB |
| 눈으로 보는 카탈로그 | `카탈로그.html` | 148KB — 사람이 본다 |
| 통짜 zip | 카탈로그의 「개발용 키트 받기」 | 199KB |

**생성물은 손으로 고치지 않는다** — `css/icons.css` · `쓰임.json` · `registry.json` ·
`registry/*.json`. 각 파일 머리에 무엇으로 만드는지 적어 두었다.
