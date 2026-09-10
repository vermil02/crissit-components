# 컴포넌트 — 폴더 안내

> 공개 주소 · <https://vermil02.github.io/crissit-components/>
> 저장소 · <https://github.com/vermil02/crissit-components>

피그마 「자사 홈페이지 v2」의 **컴포넌트 페이지**와 **가이드 문서**를 바닐라 HTML/CSS로 미리
옮겨 둔 것이다. **이 폴더가 정본이다** — 화면(`03. 페이지 소스화/_소스/`)은 여기서 내려받는다. 실제 개발 스택이 정해지기 전에 준비해 두는 것이므로, 개발사가 React를 쓰든
퍼블리싱을 하든 **토큰과 치수는 그대로 옮겨 쓸 수 있게** 만들었다.

## 라이브러리와 실사용 목록은 다르다 (2026-09-10)

이 폴더는 피그마에 있는 것을 **전부** 옮긴 **라이브러리**다. 우리 웹사이트가 실제로 붙인
것은 그보다 적다 — 첫 조사에서 카탈로그가 보여주는 것 중 **109개가 어느 화면에도 없었다**
(아이콘 47 · 버튼·칩·아이콘버튼 변형 20여 · 배지 · 드롭다운 전체).

**그래서 카탈로그 맨 위에 「쓰는 것만 / 전부」 토글이 있고, 기본이 「쓰는 것만」이다.**
안 쓰는 것은 지우지 않고 접는다 — 값을 실측해 둔 근거이고, 「준비는 끝났고 화면에서만
뺀 것」(`pgn--single` 이 그렇다)도 섞여 있다.

| 파일 | 몫 |
|---|---|
| `쓰임-조사.py` | `_소스` 의 화면 마크업과 그 화면이 불러오는 JS 를 훑어 무엇을 쓰는지 센다 |
| `쓰임.json` | 그 결과. **생성물이라 손으로 고치지 않는다** |
| `js/use.js` | 카탈로그가 그 표를 읽어 접고, 절마다 「쓰는 곳」을 붙인다 |

```
python3 쓰임-조사.py          # 화면을 고친 뒤 돌린다
python3 쓰임-조사.py --확인    # 결과만 본다
python3 쓰임-조사.py --감사    # 어느 머리에도 안 걸리는 CSS 클래스를 알린다
```

**판정 규칙 둘** — ① 그 변형 클래스를 쓰는 화면이 하나도 없으면 안 쓴다.
② 클래스는 쓰이는데 **화면이 늘 더 구체적인 판을 쓰면** 안 쓴다
(카탈로그의 `.bl-h` 사진 176×122 는 보도자료 목록이 늘 `.bl-h--wide` 300×180 을 쓰므로 접힌다).

**절마다 두 가지를 마크업에 적는다** — 이건 썩지 않는 값이라 손으로 적는다.

| 속성 | 무엇 | 왜 손으로 |
|---|---|---|
| `data-use-family` | 그 절의 주 가족 (`btn` · `ibtn` · `bl` · `drawer` …) | 빈도로 추정했더니 계속 틀렸다 — 토큰 절이 `btn`, GNB 가 안쪽 아이콘 때문에 `icon` 으로 잡혔다. 절의 정체는 안 바뀐다 |
| `data-use-ignore` | 카탈로그가 데모를 세우려고 붙인 클래스 | `.drawer--inline` 은 fixed 드로어를 액자에 세우려고 쓴 것이라 화면에 없는 게 당연하다. 판정에 넣으면 드로어 데모 4개가 통째로 「안 씀」이 된다 |

⚠ **절을 새로 만들면 `data-use-family` 를 함께 적는다.** 없으면 콘솔에 경고가 나오고 그 절은 판정하지 않는다.

## 지금 쓰는 것 / 안 쓰는 것 — 파일 수준

**이 표를 먼저 읽는다.** 사람도, AI 도 여기서 무엇이 살아 있는지 정한다.

| 상태 | 무엇 | |
|---|---|---|
| **쓴다 · 손으로 고친다** | `css/` 의 15개 — `tokens` `base` `button` `icon-button` `chip` `dropdown` `filter` `heading` `drawer` `pagination` `gnb` `gnb-site` `hero` `cue` `footer` `boardlist` | 여기를 고친다 |
| **쓴다 · 생성물** | `css/icons.css` | ⚠ **손으로 고치지 않는다.** `assets/*.svg` 를 고치고 `python3 아이콘-내장하기.py` |
| **쓴다 · 원본** | `assets/` — SVG 69개(아이콘 64·로고 5) + LNB 그림 2장 | 아이콘 모양의 원본 |
| **쓴다** | `카탈로그.html` — 정본 화면. 변형 전부와 실측값 | |
| **쓴다** | `js/` — `boardlist-main` `gnb-lang` `gnb` `hero` (동작) · `kit` · `use` (카탈로그 화면 기능이라 키트에 안 담긴다) | |
| **쓴다 · 생성물** | `쓰임.json` | ⚠ 손으로 고치지 않는다. `python3 쓰임-조사.py` |
| **쓴다 · 복사본** | `componote/` — 검사·메모 도구. 정본은 `업무도구/componote/` | 여기서 고치지 않는다 |
| **안 쓴다** | `_변경기록.md` | 개발에 넘길 때 읽을 필요 없다. 왜 그 값인지 되짚을 때만 |

### 카탈로그 화면에 걸지 않는 CSS·JS 가 셋 있다

`gnb-site.css` · `hero.css`/`hero.js` · `cue.css` 는 **걸면 카탈로그 자체가 망가진다**
(스크롤을 가져가거나, GNB 시연을 투명 상태로 바꾸거나, 화살표가 늘 떠 있게 된다).
그래서 `<link>` 로 안 걸고 **`js/kit.js` 의 `EXTRA` 목록**으로 키트에 담는다.
무엇이고 어디서 살아 움직이는지는 카탈로그의 **「화면 조립용」** 절에 적어 두었다.
⚠ 이 셋이 늘면 `EXTRA` 도 함께 늘려야 한다 — 자동으로 안 잡힌다.

### 고치는 순서 — 한 방향으로만 흐른다

```
assets/*.svg  →  이 폴더 css  →  아이콘-내장하기.py  →  _소스/css  →  화면
   그림 원본        손으로 고친다        icons.css 생성          내려받기만       조립
```

화면 쪽(`_소스/css/`)에서 컴포넌트 CSS 를 고치면 **다음 내려받기에 덮인다.**
2026-09-09 에 그렇게 16곳이 갈라져 있었고, 그날 전부 이 폴더로 올렸다.

## 처음 보는 사람은

**`카탈로그.html`을 브라우저로 연다.** 컴포넌트 21종의 모든 변형이 한 페이지에 다 있고,
각 항목 아래 실측값(여백·글자·색)이 적혀 있다. 여기만 봐도 현황이 다 나온다.
마지막 절에 **확인 필요 4건**과 **덤프로 바로잡은 7건**이 표로 정리되어 있다.

> ⚠️ 파일을 그냥 더블클릭하면 열리지만, 크롬 확장 등 일부 환경에서는 `file://`이 막힌다.
> 그럴 때는 이 폴더에서 아래 한 줄을 실행하고 `http://127.0.0.1:8765/카탈로그.html`을 연다.
> `python3 -m http.server 8765 --bind 127.0.0.1`

## 출처

| 항목 | 값 |
|---|---|
| 피그마 파일 | 자사 홈페이지 v2 (`kBysZq3IEMqD884Ala7PHD`) |
| 페이지 | 컴포넌트 (`1008:4618`) |
| 가이드 | 가이드 (`1010:24317`) — `[Media_Web_Desktop]` · `[GNB_Reponsible]` 기능 및 정책 정의서 |
| 실측 방식 | ① Figma MCP `get_variable_defs` · `get_design_context` → ② 로컬 f2h 덤프로 전수 재검증 |
| 재검증 근거 | `~/Downloads/{가이드,Content,Navigation,Action}.f2h.json` — 피그마 REST 문서 전체(색·여백·효과·변형) |
| Navigation 재내보냄 | 2026-09-07 08:16 UTC — **섹션이 재구성되어 노드 ID가 `1008:` → `1019:` 로 바뀌었다** |
| 실측일 | 2026-09-07 |

## 파일 구성

```
컴포넌트/
  카탈로그.html        ← 정본. 전 변형을 눈으로 보는 페이지
  css/
    tokens.css        ← 색·타이포·라운드·레이아웃 변수. 여기가 단일 출처
    base.css          ← 리셋 · 타이포 유틸 · 아이콘 슬롯 · hover 오버레이
    icons.css         ← **생성물.** 아이콘 64 + 로고 4 + 칩 화살표의 SVG 가 CSS 안에 박혀 있다
                         (`assets/` 를 가리키는 유일한 파일이라, 나머지는 손으로 읽는 판으로 남는다)
    button.css        ← Solid · Outlined · Text
    icon-button.css   ← Normal · Outlined · Solid · Background
    chip.css          ← Filter · Filter/Active · Content Badge
    dropdown.css      ← Chip 을 펼쳤을 때 뜨는 목록 패널
    filter.css        ← 필터 줄(연도·월 + 초기화) · Empty data
    heading.css       ← 섹션·페이지 제목 블록
    drawer.css        ← 모바일·태블릿 GNB 드로어
    pagination.css
    gnb.css           ← 바 · 언어선택 · 메가메뉴(LNB) · 모바일 햄버거 (모양)
    gnb-site.css      ← GNB 를 화면에 붙였을 때의 동작. 카탈로그에는 안 건다
    hero.css          ← 머리(히어로) — 회사소개·파트너사. 카탈로그에는 안 건다
    cue.css           ← 아래로 유도하는 화살표 — 회사소개·파트너사·연혁. 카탈로그에는 안 건다
    footer.css        ← 푸터 · CTA 블록(Section_Contact)
    boardlist.css     ← Main · Common(가로·세로) · Recommand
  js/
    boardlist-main.js ← 대표 기사 자동 전환 + Progress 동작
    gnb-lang.js       ← 언어 선택 드롭다운 여닫기 (실제 사이트에 들어간다)
    gnb.js            ← GNB 전환·섹션 톤·판 열림·드로어. 카탈로그에는 안 건다
    hero.js           ← 머리 스크롤 동작. 관성 스크롤(Lenis)은 있으면 쓰고 없으면 기본 스크롤
    kit.js            ← 「개발용 키트 받기」. **카탈로그 화면 기능**이라 키트에는 안 담긴다
  아이콘-내장하기.py     ← assets/*.svg → icons.css. **아이콘을 고친 뒤 이것을 돌린다**
  쓰임-조사.py          ← 화면이 실제로 쓰는 것을 세어 쓰임.json 을 만든다
  쓰임.json            ← 생성물. js/use.js 가 읽어 「쓰는 것만」을 판정한다
  assets/             ← 피그마에서 내린 SVG (아이콘 64 · 로고 5) + LNB 판 그림 2장(PNG)
  componote/          ← 검사기·메모·설명 도구. **복사본**이다
    componote.css     ← 정본은 `업무도구/componote/`
    componote.js      ← 같음
    README.md         ← 어디가 정본이고 무엇을 맞춰 줬는지
  index.html          ← 깃허브 Pages 진입점. 카탈로그로 넘긴다
```

CSS 는 전부 모양만 담당한다. **동작이 있는 컴포넌트는 대표 기사 하나뿐**이고
그 JS 도 시각을 세는 일만 한다 — 나머지(드로어 여닫기, 드롭다운 펼침, 칩 필터
연동)는 상태 클래스(`.is-open` 등)만 정의해 뒀고 여닫는 코드는 개발 몫이다.

## 컴포넌트 목록 — 피그마 노드와 변형 수

| 그룹 | 컴포넌트 | 피그마 노드 | 변형 | CSS |
|---|---|---|---|---|
| Action | Button / Solid | `1008:5233` | 30 | `button.css` |
| Action | Button / Outlined | `1008:5587` | 36 | `button.css` |
| Action | Button / Text | `1008:5957` | 18 | `button.css` |
| Action | Icon Button / Normal | `1008:6123` | 6 | `icon-button.css` |
| Action | Icon Button / Outlined | `1008:6189` | 12 | `icon-button.css` |
| Action | Icon Button / Solid | `1008:6308` | 32 | `icon-button.css` |
| Action | Icon Button / Background | `1008:6479` | 24 | `icon-button.css` |
| Action | Chip / Filter | `1008:6628` | 9 | `chip.css` |
| Action | Chip / Filter / Active | `1008:6674` | 4 | `chip.css` |
| Action | Dropdown list | `1010:17342` | — | `dropdown.css` |
| Action | Filter bar · Empty data | `1010:17244` | — | `filter.css` |
| 기반 | Section Heading | `1010:15042` | — | `heading.css` |
| Navigation | GNB | `1019:15724` | 28 | `gnb.css` |
| Navigation | GNB / LNB (메가메뉴) | `1019:15506` | 2 | `gnb.css` |
| Navigation | Navigation / LNB / List | `1019:16302` | 10 | `gnb.css` |
| Navigation | GNB 드로어 (모바일·태블릿) | `1010:18163`~`18175` | — | `drawer.css` |
| Navigation | Footer | `1019:16386` | 8 | `footer.css` |
| Navigation | Section_Contact (푸터 CTA) | `1019:15595` | 6 | `footer.css` |
| Navigation | Pagination | `1019:16728` | 2 | `pagination.css` |
| Navigation | Icon Button / Num | `1019:16745` | 4 | `pagination.css` |
| Content | Board list / Main | `1008:7744` | 6 | `boardlist.css` |
| Content | Board list / Common | `1008:7915` | 8 | `boardlist.css` |
| Content | Board list / Recommand | `1008:8040` | 2 | `boardlist.css` |

## 값을 어떻게 확정했나

MCP 로 한 번 읽고, 피그마 REST 덤프(f2h)로 전수 대조해 확정했다.
무엇이 언제 왜 바뀌었는지는 `_변경기록.md` 에 있다 — 개발에 넘길 때 읽을 필요는 없다.

## 가이드 문서에서 가져온 정책

컴포넌트 페이지에는 **모양**만 있고, 언제 무엇이 보이는지는 가이드 문서에 있다.
아래는 CSS 주석과 카탈로그에 함께 적어 둔 것들이다 — 개발이 이걸 몰라서 다시 물어보는 일을
줄이는 게 목적이다.

**미디어(보도자료) 페이지** — `[Media_Web_Desktop] 기능 및 정책 정의서`

- 대표 기사(Board list / Main)는 **최대 5건**, **8초마다** 다음 건으로 자동 전환된다
- 남은 시간은 일시정지 버튼의 **테두리가 상단 중앙에서 시계방향으로 연속으로
  차오르며** 표시된다 — 한 바퀴가 8초다 (`.bl-prog`). 피그마 목업이 4장인 것은
  피그마가 움직임을 못 그려서 쓴 표현 방식이지 컴포넌트의 상태가 아니라,
  코드에는 프레임을 남기지 않았다 — 각도가 그냥 연속으로 돈다
- 일시정지를 누르면 아이콘이 `i-pause` → `i-play` 로 바뀐다
- 이 동작은 `js/boardlist-main.js` 가 실제로 돌린다. 카드를 `[data-bl-rotator]` 로
  감싸고 각 장에 `data-bl-slide` 를 붙이면 끝이고, 버튼은 `data-bl-prev` /
  `data-bl-next` / `data-bl-toggle` 로 표시한다. 넘기는 방식을 직접 짜고 싶으면
  `data-bl-slide` 를 빼면 `bl:next` 이벤트만 올라온다
- 대표 기사 제목은 **2줄**, 요약은 **1줄**에서 자른다
- **마우스를 올리면 그 동안 멈추고, 치우면 이어서 돈다** (2026-09-08 디자이너 요청).
  일시정지 버튼으로 멈춘 것과는 별개라, 버튼으로 멈춘 것은 마우스를 치워도 계속 멈춰 있다
- 대표 기사가 **1건뿐이면 이전·다음 버튼을 감춘다** → `.bl-main--single`
- 목록(Board list / Common)은 **한 번에 10건**, 넘으면 페이지네이션이 생긴다
- 추천 소식(Recommand)은 **최대 5건**
- 연도·월 필터는 서로 묶여 있다 — 연도를 고르지 않으면 월을 고를 수 없고,
  연도를 고르면 월과 [초기화]가 함께 활성화된다
- **올해는 현재 달까지만** 고를 수 있다 (9월이면 1~9월). 지난해는 12개월 전부
- 드롭다운 목록이 **5개를 넘으면 스크롤바**가 생긴다
- 필터 결과가 없으면 목록 자리에 `검색 결과가 없습니다.`(Empty data)가 들어간다

**GNB 반응형** — `[GNB_Reponsible] 기능 및 정책 정의서`

- 데스크톱은 바 아래로 펼쳐지는 **메가메뉴**(`gnb.css` 의 `.gnb__lnb`)
- 태블릿·모바일은 **드로어**(`drawer.css`) — 다른 컴포넌트다
  - 모바일(sm) 전체 폭, 스크림 없음 / 태블릿(md) 우측 384px + 스크림
  - 1차 메뉴가 아코디언으로 열리고, 하위 항목은 **한 줄에 2칸**
  - 외부 링크는 라벨 뒤에 `blank` 아이콘(↗)이 붙는다
  - 하단에 언어 선택과 [문의하기]가 고정된다
- 스크롤한 상태(`Scroll=True`)에서는 바 아래에 1px 선이 생긴다

## 옮기면서 정한 것 — 왜 그렇게 했나

몇 가지는 피그마 구조를 CSS로 1:1로 옮기면 깨진다. 그래서 결과가 같아지는 다른 방법을 썼다.
개발에 넘길 때 이 여덟 개만 설명하면 된다.

**1. hover는 색이 아니라 반투명 막이다.**
피그마의 `Element/Interaction` 레이어를 `::after` 오버레이로 옮겼다. 밝은 면에는 검정 8%,
어두운 면에는 흰색 8%(`.has-overlay--light`). 색을 변형별로 따로 정의하지 않아도 되고,
버튼 색이 바뀌어도 hover 규칙은 그대로다.

**2. 테두리는 `border`가 아니라 `inset box-shadow`다.**
피그마 선은 면 안쪽에 그려져 크기를 늘리지 않는다. CSS `border`를 쓰면 위아래로 2px 커져
lg 버튼이 48이 아니라 50이 된다. 버린 대안 — `box-sizing`으로 맞추기는 여백까지 어긋난다.

**3. `Round=Brand`는 라운드가 아니라 `clip-path`다.**
좌상·우하를 6px 사선으로 자른 모양이다(피그마 path `M126 42L120 48H0V6L6 0H126V42Z`).
피그마는 이걸 SVG 배경 이미지로 내보내지만, 그러면 크기마다 파일이 따로 필요하다.
`clip-path: polygon(...)`으로 하면 크기와 무관하게 한 규칙으로 끝난다.

**4. 아이콘은 `<img>`가 아니라 CSS `mask`다.**
`background:currentColor` + `mask:url(...)` 조합이라 **아이콘 색이 글자색을 따라간다.**
밝은 배경·어두운 배경·비활성에 같은 파일 하나를 쓴다. 그래서 `assets/*.svg` 안의 `fill`
값은 의미가 없다.
아이콘 이름은 `css/icons.css`의 `.i-*` 클래스로 부른다 — HTML에 `style="--icon:url(...)"`을
직접 쓰면 상대 경로가 HTML 기준이 아니라 그 변수를 쓴 CSS 파일 기준으로 풀려 404가 난다.

**5. 아이콘은 시안이 아니라 라이브러리에서 받는다.**
시안에서 아이콘 슬롯을 비워 둔 채 내보내면 `Icon/Normal/-`(점선 사각형)이 그대로 받아진다.
그래서 아이콘 라이브러리(`Crissit_Main` Icon 페이지 `38:4019`)를 통째로 받아
`assets/` 에 넣고 `css/icons.css` 에 `.i-*` 64개를 만들어 뒀다 — 이제 시안에서 받을 일이 없다.

이름은 **그려진 모양대로** 붙였다. 피그마 세트 이름과 그림이 어긋난 곳이 셋 있기 때문이다
(`Arrow Down` 인데 `+`, `Soft` 가 두 종류, `Roket` 의 변형 이름이 `reset`).
`-thick` = `Thick=True` · `-sm` = `Small=True` · `-fill` = `Fill=True` 이고,
기본 이름이 각 축의 False 쪽이다.

**파일은 전부 24×24 틀로 맞춘다.** 피그마 아이콘 컴포넌트가 전부 24×24 이고 그 안의
그림 크기는 제각각이다(`blank` 12×12 · `close` 16×16 · `menu` 24×24). 그림 덩어리만
잘라 내면 `mask ... contain` 이 그걸 상자에 꽉 채워서 아이콘마다 크기가 어긋난다.

**6. `[hidden]` 을 `!important` 로 못박았다.**
브라우저 기본 규칙은 `[hidden]{display:none}` 인데 컴포넌트가 `display:flex` 를 주면
명시도가 같아서 나중에 온 쪽이 이긴다 — 숨긴 줄 알았는데 그대로 보인다.
대표 기사 슬라이드가 실제로 이 문제에 걸렸다. 스크립트로 여닫는 것이 전부 걸리므로
`base.css` 에서 한 번만 못박았다.

**7. 브레이크포인트마다 크기가 달라지는 것은 마크업에 크기 클래스를 붙이지 않는다.**
GNB 햄버거가 태블릿 24 · 모바일 20 인데, 마크업에 `.ibtn--md` 를 붙여 두면
미디어쿼리로 못 바꾼다 — `icon-button.css` 의 `.ibtn--normal.ibtn--md .icon`(클래스 3개)이
`.gnb__toggle .icon`(2개)을 이기기 때문이다. 그래서 크기 클래스를 떼고 `gnb.css` 가
`.gnb .gnb__toggle .icon` 로 정한다. 파일 순서에 기대지 않으려고 앞에 `.gnb` 를 붙였다.

**8. 버튼 높이를 고정하지 않았다.**
`height:48px`이 아니라 여백 + 글자 줄높이로 만든다. 피그마 치수(32/40/48)와 결과가 같고,
글자가 길어지거나 번역으로 줄이 늘어나도 안 깨진다.

## 통짜로 넘기기 — 개발용 키트

카탈로그 목차 맨 아래 **「개발용 키트 받기」**. zip 한 개(86개 파일 · 199KB)에
`css/` · `assets/` · `js/` · 자동 생성 `README.md` 가 담긴다. 카탈로그 화면과
검토 도구(componote), 작업 문서는 **담기지 않는다**.

컴포넌트를 실제로 쓰려면 통짜가 필요하다 — 세트 하나만 잘라 줘도 `tokens.css` 와
`base.css` 는 그대로 있어야 하므로 조각으로 나누는 것이 의미가 없다.

담을 목록은 **`js/kit.js` 가 이 페이지가 불러온 것에서 뽑는다.** 코드에 박아 두면
컴포넌트가 늘 때마다 여기도 고쳐야 하고, 잊으면 빠진 채로 나간다. 그래서
`카탈로그.html` 에 `<link href="css/새것.css">` 를 한 줄 넣으면 키트에도 들어간다.

### 갱신 시점은 `kit.js` 의 `UPDATED` 하나가 정한다

`"2026-09-08 15:10"` 처럼 **분까지** 적는다(KST). 버튼 옆 표기 · 키트 README 표 ·
zip 파일명(`crissit-components-20260908-1510.zip`)이 모두 이 값을 쓴다.
**컴포넌트를 고칠 때 `?v=` 와 함께 올린다** — 받은 시각이 아니라 내용이 바뀐
시각이어야 받는 쪽이 새로 받을지 판단할 수 있고, 날짜만으로는 같은 날 두 번
고쳤을 때 구분이 안 된다.

```
grep -n 'var UPDATED' js/kit.js
```

## 검사기·메모·설명 — 도구는 밖에 있다

카탈로그 위에 얹혀 **값을 토큰 이름으로 읽어 주고, 고칠 곳에 핀을 꽂는** 도구다.
오른쪽 아래 세 버튼(**설명 · 검사 · 메모**)이 그것이다.

**정본은 이 폴더가 아니다** — `업무도구/componote/` 에 있고, `componote/` 의 두
파일은 거기서 복사해 온 것이다. 사용법·저장 형태·서버 만드는 법은 전부 그 폴더의
문서에 있다(`README.md` · `REQUIREMENTS.md` · `docs/SERVER.md`).

| 무엇 | 어디 |
|---|---|
| 도구를 고칠 때 | `업무도구/componote/src/` → `python3 build.py` → 복사 |
| 이 프로젝트가 맞춰 준 것 | `componote/README.md` |

이 프로젝트에 붙은 서버(디자이너 메모가 모이는 곳)는 Cloudflare Worker + D1 이다.
주소와 열쇠는 **저장소에 넣지 않는다** — 공개 저장소라 넣으면 아무나 글을 넣을 수
있다. 링크로 넘긴다.

### 파일을 고치면 `?v=` 를 바꾼다

`카탈로그.html` 의 css·js 주소에 `?v=20260908b` 가 붙어 있다. 정적 호스팅이
css·js 를 캐시해서, 고쳐 올려도 이미 열어 본 브라우저는 옛 파일을 계속 쓴다.
**파일을 바꿀 때마다 이 값을 바꾼다** — 이 한 가지로 세 번 막혔다.

```
grep -o '?v=[0-9a-z]*' 카탈로그.html | sort -u
```

## 아직 확정 안 된 것 — 6건

f2h 덤프로 재검증한 뒤 남은 것들이다. 셋은 **피그마에 설계가 없다는 것을 확인한** 항목이라,
값을 못 읽은 게 아니라 **디자인 결정이 필요한** 상태다.

- **배지 면이 낡은 토큰에 묶여 있다** — 피그마에서 배지 면은
  `Semantic/Background/Normal/Alternative` 를 물고 있는데 그 확정값은 `#fafafa` 이고,
  배지가 물고 있는 건 같은 이름의 낡은 라이브러리 스타일(`#f5f6f7`)이다.
  낡은 참조를 확정값으로 바꾸면 배지가 흰 배경에서 안 보인다 —
  `Background/Normal/Assistive`(`#e4e6e8`, Main 이 이미 쓰는 값)로 다시 묶는 게 자연스러워 보인다.
  그때까지 `.badge` 는 `#f5f6f7` 을 직접 쓴다
- **배지 면 색이 컴포넌트별로 다르다** — Common 은 `#f5f6f7`, Main 은 덮개 사각형이
  하나 더 있어 `#e4e6e8`. `.badge` / `.badge--strong` 로 갈라 뒀다.
  Main 쪽이 실수로 남은 레이어처럼 보인다 — 의도라면 배지 컴포넌트에 변형으로 넣는 게 맞다
- **활자 정의서와 텍스트 스타일이 다르다 (2건)** — `Typography / Definition (5:3334)` 대조 결과
  `Display` 는 정의서 800 · 64/125% 인데 스타일 `Display 1` 은 700 · 32/130%,
  `Body 1/Reading` 은 정의서 18/175% 인데 스타일은 16/175% 다.
  토큰은 **정의서**를 따랐다 — 스타일 쪽 정리가 필요하다
- **Section Heading 태블릿·모바일** — 컴포넌트 세트에 `Breakpoint=Desktop (lg)` 변형 하나뿐이다.
  지금 48 → 36 → 28px 로 축소해 뒀지만 이쪽에서 정한 값이다
- **Section Heading 어두운 배경** — 같은 이유로 변형이 없다. `.sh--inverse`는 이쪽에서 정한 것
- **Button/Text hover 폭 밀림** — 굵기가 Medium→Bold로 바뀌는 피그마 설계 그대로 뒀다.
  나란히 놓으면 옆 요소가 밀린다. 그대로 갈지 폭을 미리 확보할지(`.btn--stable`)는 디자인 판단이다

## 피그마 쪽에서 고쳐야 할 것 — 6건

값을 못 읽은 게 아니라 **파일이 어긋나 있는** 경우다. 이쪽 코드는 다수 쪽을 따랐다.

- **GNB CTA 버튼이 한 변형만 다르다** — 28개 변형 중 `Desktop(xl), Mode=Black, Scroll=False,
  Expand=False, Background=True` 하나만 `Round=Brand`고 나머지 15개(+가이드 목업 13개,
  드로어 4개)는 전부 `Round=Normal` 이다. 이쪽은 Normal 로 구현했다
- **`Navigation/LNB/List` 의 `Mode` 이름이 반대다** — GNB·Footer 는 `Mode=White` 가 밝은
  배경인데 이 컴포넌트는 `Mode=White` 가 어두운 배경용(밝은 글자)이다. 실제 조립을 보면
  `GNB/LNB Mode=White`(흰 배경) 안에 `List Mode=Black` 이 들어간다.
  이쪽은 헷갈리지 않게 **배경 기준**으로 갈랐다(`.gnb--black` 안이면 어두운 배경)

- **아이콘 세트 이름과 그림이 어긋난다 (3건)** — `Icon/Normal/Arrow Down` 이 두 세트인데
  `38:4115` 의 그림은 `+` 다. `Icon/Normal/Soft` 도 두 세트인데 하나는 분자, 하나는 반도체 칩이다.
  `Icon/Normal/Roket` 은 변형 이름이 `Name=reset` 으로 붙어 있다.
  이쪽은 그린 모양대로 `i-plus` · `i-soft` / `i-chip` · `i-rocket` 로 갈랐다
- **중복 세트가 있다** — `Icon/Guide/Desktop`·`Icon/Guide/Mobile`·`Icon/color/-`·
  `Logo Horizontal`·`Logo/Resource` 가 각각 두 벌씩이고 그림이 같다.
  `Logo/Resource` 사본(`138:20289`)은 `Type=Symbol`·`Type=Title` 이 비어 있다
- **`Icon/Normal/play` 의 축이 반대로 읽힌다** — `Auto On=False` 가 일시정지 막대,
  `Auto On=True` 가 재생 삼각형이다. 자동 전환이 켜져 있을 때 일시정지가 보여야 자연스럽다.
  이쪽은 그린 모양대로 `i-pause` · `i-play` 로 갈랐다
- **`Icon/Normal/Heart` 의 축 둘이 항상 같이 움직인다** — `Name` 과 `Fill` 이 붙어 다닌다.
  다른 아이콘처럼 `Fill` 하나면 충분하다

## 이 폴더 밖과의 관계

- `../와이어프레임/` — 회색 래더 와이어프레임. **색·타이포 체계가 다르다.** 저쪽은 "무엇이
  들어가는가"를 정하는 단계의 산출물이고, 이 폴더는 확정된 디자인 시스템을 코드로 옮긴 것이다.
  두 폴더의 토큰 이름을 섞지 않는다.
- `../크리스아이티-사실대장.md` — 문구는 여기서만 꺼내 쓴다. 카탈로그에 들어간 회사 정보
  (사업자 등록 번호·대표·주소)는 피그마 푸터에 적혀 있던 값을 그대로 옮긴 것이므로,
  실제 사용 전에 사실대장과 대조한다.
- `../효과-데모/안전하게-컴포넌트.html` — 모션 컴포넌트. 이 폴더의 정적 컴포넌트와 별개다.
