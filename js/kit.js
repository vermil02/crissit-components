/* ============================================================
   개발용 키트 내려받기
   카탈로그에서 쓰는 컴포넌트를 **통짜로** 묶어 zip 한 개로 준다.

   왜 필요한가
     컴포넌트를 실제로 쓰려면 토큰·기본·아이콘·컴포넌트 CSS 가 한 벌로 있어야
     한다. 세트 하나만 잘라 내도 `tokens.css` 와 `base.css` 는 그대로 필요하다.
     그래서 조각으로 주는 것이 의미가 없고, 통짜가 맞다.

   왜 저장소 zip 이 아닌가
     저장소에는 카탈로그·메모 도구·작업 문서까지 들어 있다. 개발사가 쓸 것이
     아니라 소음이다. 여기서는 **쓸 것만** 골라 담는다.

     담는 것    css/ · assets/ · js/(동작이 있는 것만) · README.md(자동 생성)
     안 담는 것  카탈로그.html · componote/ · 작업 문서

   파일 목록을 어떻게 아는가
     **이 페이지가 실제로 불러온 것**에서 뽑는다(`<link>`·`<script>`). 목록을
     코드에 박아 두면 파일이 늘 때마다 여기도 고쳐야 하고, 잊으면 빠진 채로
     나간다. 아이콘·로고는 CSS 안의 `url(../assets/…)` 을 읽어 모은다.

   zip 을 어떻게 만드는가
     라이브러리 없이 **무압축(STORE)** zip 을 손으로 쓴다. 압축을 넣으려면
     deflate 구현이 필요한데, CSS·SVG 몇백 KB 에 그만한 코드를 들일 이유가 없다.
   ============================================================ */
(function () {
  "use strict";

  /* 컴포넌트가 마지막으로 바뀐 시점 (KST).
     **여기 한 곳만 고친다** — 버튼 옆 표기 · README · zip 파일명이 모두
     이 값을 쓴다. CSS·아이콘·스크립트를 고칠 때 `?v=` 와 함께 올린다.
     받은 시각이 아니라 **내용이 바뀐 시각**이어야 의미가 있다.
     날짜만으로는 같은 날 두 번 고쳤을 때 구분이 안 되므로 분까지 적는다 */
  var UPDATED = "2026-09-09 18:40";

  /* 파일명에 쓸 꼴 — 공백과 콜론은 파일명에서 다루기 나쁘다.
     "2026-09-08 15:10" → "20260908-1510" */
  function stamp() {
    return UPDATED.replace(/\D/g, "").replace(/^(\d{8})(\d{4})$/, "$1-$2");
  }

  /* ── CRC32 — zip 이 파일마다 요구한다 ─────────────────────── */
  var CRC = (function () {
    var t = new Uint32Array(256);
    for (var i = 0; i < 256; i++) {
      var c = i;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c >>> 0;
    }
    return t;
  })();
  function crc32(u8) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  /* ── zip 쓰기 (STORE) ─────────────────────────────────────── */
  function zip(files) {
    var enc = new TextEncoder();
    var parts = [], central = [], offset = 0;

    function u16(v) { return [v & 255, (v >> 8) & 255]; }
    function u32(v) { return [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >> 24) & 255]; }

    /* zip 은 시각을 1980 년 기준 2초 단위로 넣는다. 0 으로 두면 압축 해제
       도구가 `1980-00-00` 을 보고 경고하므로 오늘 날짜를 채운다 */
    var now = new Date();
    var dTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF;
    var dDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;

    files.forEach(function (f) {
      var name = enc.encode(f.name);
      var data = f.data;
      var sum = crc32(data);
      // 로컬 헤더 — 이름을 UTF-8 로 쓴다고 알리는 깃발이 11번째 비트다
      var lh = [].concat(u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(dTime), u16(dDate),
                         u32(sum), u32(data.length), u32(data.length), u16(name.length), u16(0));
      parts.push(new Uint8Array(lh), name, data);
      central.push({ name: name, sum: sum, len: data.length, off: offset });
      offset += lh.length + name.length + data.length;
    });

    var cdStart = offset, cd = [];
    central.forEach(function (c) {
      var h = [].concat(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(dTime), u16(dDate),
                        u32(c.sum), u32(c.len), u32(c.len), u16(c.name.length),
                        u16(0), u16(0), u16(0), u16(0), u32(0), u32(c.off));
      cd.push(new Uint8Array(h), c.name);
      offset += h.length + c.name.length;
    });
    var end = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0),
                              u16(central.length), u16(central.length),
                              u32(offset - cdStart), u32(cdStart), u16(0)));
    return new Blob(parts.concat(cd, [end]), { type: "application/zip" });
  }

  /* 카탈로그 페이지에 <link>·<script> 로 걸 수 없는데 키트에는 담아야 하는 것.
     걸면 카탈로그 화면을 망가뜨리는 것들이다 —
       gnb-site.css  GNB 를 실제 사이트처럼 투명·전환 상태로 만든다. 카탈로그의 정적 GNB 시연이 깨진다
       hero.css/js   화면 전체를 sticky 로 잡고 스크롤을 가져간다. 카탈로그는 스크롤로 훑는 페이지다
       cue.css       화면에 고정된 아래 화살표가 카탈로그 위에 늘 떠 있게 된다
     ⚠ 여기 적은 것은 **자동으로 안 잡힌다.** 파일을 늘리면 이 목록도 함께 늘린다.
        시연할 수 있는 컴포넌트라면 여기가 아니라 카탈로그.html 에 <link> 를 넣는다 */
  var EXTRA = {
    css: ["css/gnb-site.css", "css/hero.css", "css/cue.css"],
    js:  ["js/gnb.js", "js/hero.js"]
  };

  /* ── 무엇을 담을지 페이지에서 뽑는다 ─────────────────────── */
  function collect() {
    var css = [], js = [];
    document.querySelectorAll('link[rel="stylesheet"][href]').forEach(function (l) {
      var h = l.getAttribute("href").split("?")[0];
      if (h.indexOf("css/") === 0) css.push(h);          // componote/ 는 도구라 뺀다
    });
    document.querySelectorAll("script[src]").forEach(function (s) {
      var h = s.getAttribute("src").split("?")[0];
      // 동작이 있는 컴포넌트 스크립트만. 도구와 이 파일 자신은 뺀다
      if (h.indexOf("js/") === 0 && h.indexOf("kit.js") === -1) js.push(h);
    });
    EXTRA.css.forEach(function (f) { if (css.indexOf(f) === -1) css.push(f); });
    EXTRA.js.forEach(function (f) { if (js.indexOf(f) === -1) js.push(f); });
    return { css: css, js: js };
  }

  /* 아이콘·로고 파일을 모은다.
       ① CSS 머리의 `/* @assets … *\/` 줄  — **내장판 icons.css 는 이 줄로만 알 수 있다**
       ② CSS 안의 url(../assets/…)        — 아직 파일을 가리키는 판일 때
       ③ 이 문서 안의 assets/…            — 로고처럼 마크업에서 직접 쓰는 것

     ①이 필요한 이유: `icons.css` 는 SVG 를 CSS 안에 박아 넣은 생성물이라
     `url(../assets/…)` 가 한 곳도 남지 않는다. 그 줄을 안 읽으면 **키트에 SVG 가
     0개로 들어간다** (2026-09-09 · `아이콘-내장하기.py` 가 그 줄을 쓴다).
     ③이 따로 필요한 이유: `logo-crissit-color.svg` 는 CSS 가 아니라
     카탈로그 마크업의 `<img>` 에서만 쓰인다. CSS 만 보면 빠진다. */
  function assetsIn(texts) {
    var found = {};
    texts.forEach(function (t) {
      var mf = /@assets([^*]+)/g, g;
      while ((g = mf.exec(t))) {
        g[1].trim().split(/\s+/).forEach(function (f) { if (f) found[f] = 1; });
      }
      var re = /url\(\s*['"]?\.\.\/(assets\/[^'")]+)['"]?\s*\)/g, m;
      while ((m = re.exec(t))) found[m[1]] = 1;
    });
    document.querySelectorAll('[src^="assets/"]').forEach(function (el) {
      found[el.getAttribute("src").split("?")[0]] = 1;
    });
    return Object.keys(found).sort();
  }

  function readme(list) {
    // 받은 시각 — 보는 사람의 시간대 그대로 찍는다
    var n = new Date(), z = function (v) { return ("0" + v).slice(-2); };
    var d = n.getFullYear() + "-" + z(n.getMonth() + 1) + "-" + z(n.getDate()) +
            " " + z(n.getHours()) + ":" + z(n.getMinutes());
    return [
      "# crissit 컴포넌트 — 개발용 키트",
      "",
      "| | |",
      "|---|---|",
      "| **컴포넌트 갱신** | " + UPDATED + " (KST) |",
      "| 내려받은 시각 | " + d + " |",
      "",
      "카탈로그의 「개발용 키트 받기」로 만든 것. 갱신 날짜가 위와 다르면 새로 받으면 된다.",
      "",
      "## 붙이는 법",
      "",
      "순서가 중요하다. `tokens.css` 가 먼저 와야 나머지가 값을 찾는다.",
      "",
      "```html",
      '<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css">',
    ].concat(list.css.map(function (f) { return '<link rel="stylesheet" href="' + f + '">'; }))
     .concat(list.js.map(function (f) { return '<script src="' + f + '" defer></script>'; }))
     .concat([
      "```",
      "",
      "## 들어 있는 것",
      "",
      "| 폴더 | 무엇 |",
      "|---|---|",
      "| `css/tokens.css` | **여기가 단일 출처다.** 색·활자·라운드·레이아웃 변수 |",
      "| `css/base.css` | 리셋 · 활자 유틸 · 아이콘 슬롯 · 로고 · hover 막 |",
      "| `css/icons.css` | 아이콘 이름(`.i-*`) → 파일 매핑 |",
      "| `css/` 나머지 | 컴포넌트별 CSS |",
      "| `assets/` | 아이콘 " + list.icons + "개 · 로고 " + list.logos + "개 (SVG) |",
      "| `js/` | 동작이 있는 컴포넌트만 (보도자료 자동 전환 · 언어 선택) |",
      "",
      "## 알아 둘 것",
      "",
      "- **아이콘은 `<img>` 가 아니라 CSS `mask` 다.** 그래서 아이콘 색이 글자색을",
      "  따라간다 — 밝은 배경·어두운 배경에 같은 파일을 쓴다. 파일 안의 `fill` 은",
      "  `currentColor` 로 바꿔 두었다",
      "- **아이콘 파일은 전부 24×24 틀이다.** 그 안에서 그림 크기는 아이콘마다",
      "  다르다(`blank` 12 · `close` 16 · `menu` 24). 새 아이콘도 24 틀로 맞춘다",
      "- **버튼 높이를 고정하지 않았다.** 여백 + 글자 줄높이로 만들어진다",
      "- **테두리는 `border` 가 아니라 inset `box-shadow` 다.** 피그마 선은 면 안쪽에",
      "  그려져 크기를 늘리지 않는데, `border` 를 쓰면 2px 커진다",
      "- 활자는 화면 폭에 따라 제목 크기가 바뀐다(lg ≥1280 · md 768–1279 · sm <768).",
      "  **컴포넌트의 구간과 다르다** — 활자는 1280 과 768 에서만 꺾인다",
      "- **없는 아이콘 이름을 쓰면 검은 사각형이 나온다.** `mask` 가 실패하면 배경색이",
      "  그대로 보이기 때문이다. 쓸 수 있는 이름은 `css/icons.css` 에 다 있다",
      "",
      "## 여기 없는 것",
      "",
      "값의 출처, 컴포넌트마다의 판단 근거, 아직 확인이 필요한 항목은 **카탈로그**에",
      "있다 — 이 키트에는 카탈로그 화면과 검토 도구(componote)를 담지 않았다.",
      "",
      "    " + decodeURI(location.origin + location.pathname),
    ]).join("\n");
  }

  /* ── 내려받기 ─────────────────────────────────────────────── */
  function download(btn) {
    var label = btn.textContent;
    btn.disabled = true;
    btn.textContent = "모으는 중…";

    var list = collect();
    var enc = new TextEncoder();

    Promise.all(list.css.concat(list.js).map(function (f) {
      return fetch(f).then(function (r) {
        if (!r.ok) throw new Error(f + " " + r.status);
        return r.text().then(function (t) { return { name: f, text: t }; });
      });
    })).then(function (texts) {
      var cssText = texts.filter(function (t) { return /\.css$/.test(t.name); })
                         .map(function (t) { return t.text; });
      var assets = assetsIn(cssText);
      return Promise.all(assets.map(function (a) {
        return fetch(a).then(function (r) {
          if (!r.ok) throw new Error(a + " " + r.status);
          return r.arrayBuffer().then(function (b) { return { name: a, data: new Uint8Array(b) }; });
        });
      })).then(function (bin) {
        var files = texts.map(function (t) { return { name: t.name, data: enc.encode(t.text) }; })
                         .concat(bin);
        list.icons = bin.filter(function (b) { return b.name.indexOf("assets/icon-") === 0; }).length;
        list.logos = bin.length - list.icons;
        files.unshift({ name: "README.md", data: enc.encode(readme(list)) });

        // 같은 내용이면 언제 받아도 같은 이름이 나오도록 갱신 시점을 쓴다
        var name = "crissit-components-" + stamp() + ".zip";
        var a = document.createElement("a");
        a.href = URL.createObjectURL(zip(files));
        a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);

        btn.disabled = false;
        btn.textContent = files.length + "개 파일 받음";
        setTimeout(function () { btn.textContent = label; }, 3000);
      });
    }).catch(function (e) {
      btn.disabled = false;
      btn.textContent = label;
      alert("키트를 만들지 못했습니다.\n\n" + e.message);
    });
  }

  function init() {
    var btn = document.querySelector("[data-kit-download]");
    if (!btn) return;
    btn.addEventListener("click", function () { download(btn); });

    // 갱신 시점은 코드에 두고 화면에는 여기서 채운다 — 마크업에 날짜를
    // 박아 두면 UPDATED 와 어긋날 수 있다
    var stamp = document.querySelector("[data-kit-updated]");
    if (stamp) stamp.textContent = UPDATED;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
