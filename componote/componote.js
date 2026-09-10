/* ============================================================
   componote 20260910 — 합친 파일 (build.py 가 만든다. 직접 고치지 말 것)
   원본은 src/inspector.js · memo.js · annotations.js
   컴포넌트 카탈로그 위에 얹어 값을 읽고 메모를 남기는 도구.
   사용법 · 붙이는 법: README.md
   ============================================================ */


/* ─── src/inspector.js ─────────────────────────────── */
/* ============================================================
   검사기 — 카탈로그 전용 문서 UI
   컴포넌트가 아니다. 실제 사이트에는 들어가지 않는다.

   하는 일
     · 마우스가 가리키는 요소의 **브라우저가 실제로 계산한 값**을 읽어
       오른쪽 패널에 보여준다 (글꼴·색·여백·모서리·그림자·아이콘)
     · 그 값이 `tokens.css` 의 **어떤 토큰과 같은지** 찾아 이름을 붙인다.
       "이 회색이 무슨 색이더라" 를 매번 CSS 뒤지지 않게 하려는 것이다

   조작
     오른쪽 아래 돋보기 버튼   켜기 / 끄기
     요소를 클릭              그 요소에 고정 (마우스를 움직여도 안 바뀐다)
     Esc                      고정 해제 → 한 번 더 누르면 검사기 끄기

   ▸ 검사 중에는 링크·버튼이 눌리지 않는다. 클릭을 고정에 쓰기 때문이다.

   ── 토큰 이름을 어떻게 찾나 ────────────────────────────────
   `tokens.css` 의 `:root` 규칙에서 `--` 로 시작하는 이름을 전부 모은 뒤,
   그 값을 브라우저에게 다시 물어본다(`getComputedStyle(:root)`).
   이렇게 하면 `--primary-normal: var(--semantic-primary-normal)` 같은
   별칭도 최종 색까지 풀린 값으로 돌아오고, 미디어쿼리로 크기가 바뀌는
   `--fs-*` 도 **지금 화면 폭 기준의 값**으로 잡힌다.

   색은 표기법이 제각각이라(`#151617` · `rgb(...)` · `rgba(...)`)
   숨은 요소에 한 번 칠해 보고 브라우저가 돌려주는 표기로 통일해서 비교한다.
   ============================================================ */
(function () {
  "use strict";

  var ACCENT = "#543efa";
  var panel, body, hint, detail, hl, hlPad, hlTag, dock, panelBtn, toggle, probe, catcher;
  /* ── 여닫기와 모드를 갈랐다 ─────────────────────────────────
     처음에는 「검사」·「메모」 버튼이 **창 열기**와 **무엇을 하겠다**를 같이
     맡고 있었다. 그래서 메모를 쓰려면 검사를 먼저 켜야 했다. 둘로 나눴다.

       open   패널을 열까 닫을까. 열리면 두 열이 늘 다 보인다 —
              메모를 쓰는 순간 필요한 것이 그 값이라, 갈라 두면 매번 오가야 한다.
       mode   **무엇을 하겠다** — "" (아무것도) | "main"(검사) | "memo"(메모).
              같은 버튼을 다시 누르면 "" 로 꺼진다.

     둘의 곱이 「고르기」다 — `open && mode` 일 때만 화면을 덮는 판이 생긴다.
     그래서 **패널은 열어 두고 고르기만 끌 수 있다** — 값과 메모 목록을 읽으면서
     페이지를 그냥 쓰는 상태다. 화면 클래스도 그렇게 갈라 두었다.

       insp-open  패널이 보인다 · 본문이 밀린다
       insp-pick  고르기 판이 있다 · 커서가 십자다 (open && mode)
     ──────────────────────────────────────────────────────── */
  var open = false;
  var mode = "";
  var on = false, pinned = null, hovered = null, rafId = 0;
  var pinListeners = [], showListeners = [];

  var tokens = {};      // 이름 → 지금 값 (var() 가 다 풀린 최종값)
  var raw = {};         // 이름 → tokens.css 에 적힌 그대로 (별칭이면 var(--…) 인 채)
  var rawMedia = {};    // 이름 → [{조건, 값}]  미디어쿼리 안에서 다시 정해진 것
  var colorIndex = {};  // 통일된 색 표기 → [이름…]
  var fontIndex = {};   // "굵기|크기|행간" → [이름…]
  var lenIndex = {};    // "8px" → [이름…]  (라운드·여백류)

  /* ── 토큰 모으기 ───────────────────────────────────────── */
  function collectNames() {
    var names = {};
    for (var i = 0; i < document.styleSheets.length; i++) {
      var rules;
      try { rules = document.styleSheets[i].cssRules; } catch (e) { continue; } // 외부 CSS 는 못 읽는다
      scan(rules, names, "");
    }
    return Object.keys(names);
  }
  /* ▸ `cssRules` 가 있으면 @media 라고 판단하면 안 된다. 요즘 크롬은 CSS
       중첩을 지원해서 **보통 규칙도 빈 cssRules 를 가진다** — 그걸 보고
       건너뛰면 :root 를 하나도 못 읽는다. 먼저 읽고, 그 다음에 내려간다 */
  function scan(rules, names, cond) {
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      if (r.style && r.selectorText && r.selectorText.indexOf(":root") !== -1) {
        for (var j = 0; j < r.style.length; j++) {
          var p = r.style[j];
          // `--insp-…` 는 검사기 자신의 변수다. 디자인 토큰이 아니라 제외한다
          if (p.slice(0, 2) !== "--" || p.indexOf("--insp-") === 0) continue;
          names[p] = 1;
          var v = r.style.getPropertyValue(p).trim();
          if (cond) (rawMedia[p] = rawMedia[p] || []).push({ cond: cond, value: v });
          else raw[p] = v;
        }
      }
      if (r.cssRules && r.cssRules.length) {
        // @media 안쪽 — 조건을 물고 내려간다 (--fs-* 가 여기서 다시 정해진다)
        scan(r.cssRules, names, r.conditionText || (r.media && r.media.mediaText) || cond);
      }
    }
  }

  function normColor(v) {
    if (!v) return "";
    probe.style.color = "rgb(1, 2, 3)";           // 잘못된 값이면 이게 남는다
    probe.style.color = v;
    var c = getComputedStyle(probe).color;
    return c === "rgb(1, 2, 3)" && v.replace(/\s/g, "") !== "rgb(1,2,3)" ? "" : c;
  }

  function buildIndex() {
    var root = getComputedStyle(document.documentElement);
    var names = collectNames();
    for (var i = 0; i < names.length; i++) {
      var n = names[i];
      var v = root.getPropertyValue(n).trim();
      if (!v) continue;
      tokens[n] = v;

      // 색
      if (/^(#|rgb|hsl)/i.test(v)) {
        var c = normColor(v);
        if (c) (colorIndex[c] = colorIndex[c] || []).push(n);
      }
      // 글꼴 축약형 — "700 40px/1.25 …"
      var m = v.match(/^(\d{3})\s+([\d.]+)px\s*\/\s*([\d.]+)/);
      if (m) {
        var k = m[1] + "|" + m[2] + "|" + (+m[3]).toFixed(2);
        (fontIndex[k] = fontIndex[k] || []).push(n);
      }
      // 길이 하나짜리 — 라운드 등
      if (/^[\d.]+px$/.test(v)) (lenIndex[v] = lenIndex[v] || []).push(n);
    }
  }

  /* 같은 색에 이름이 여럿 붙는다 — `#fafafa` 는 배경 이름이기도 하고
     어두운 바탕의 글자 이름이기도 하다. 그래서 **지금 보고 있는 자리**에
     맞는 이름을 앞에 올린다. 글자색이면 `--label-…`, 배경이면 `--bg-…`.
     그 다음이 짧은 별칭, 그 다음이 원시 변수, 마지막이 긴 정식 이름이다 */
  var ROLE_PREFIX = { text: "--label-", bg: "--bg-", line: "--line-" };
  function rank(n, role) {
    var want = ROLE_PREFIX[role];
    if (want && n.indexOf(want) === 0) return 0;               // 자리에 맞는 이름
    if (n.indexOf("--semantic-") === 0) return 3;              // 정식 이름(길다)
    if (/^--(neutral|purple|common)-/.test(n)) return 2;       // 원시 변수
    return 1;                                                  // 그 밖의 별칭
  }
  function sortNames(list, role) {
    return list.slice().sort(function (a, b) {
      var d = rank(a, role) - rank(b, role);
      return d || a.length - b.length;
    });
  }

  /* ── 값 → 화면 ─────────────────────────────────────────── */
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  /* 이름이 여럿이면 셋만 펴 두고 나머지는 `+2` 로 접는다.
     이름을 누르면 아래 정보창에 그 토큰이 열린다 */
  var TOK_MAX = 3;
  function tokLine(list, role) {
    if (!list || !list.length) return '<span class="insp-tok insp-none">토큰 없음</span>';
    var sorted = sortNames(list, role);
    var out = sorted.map(function (n, i) {
      return '<button type="button" class="insp-tok' + (i >= TOK_MAX ? " insp-tok--extra" : "") +
             '" data-tok="' + esc(n) + '">' + esc(n) + "</button>";
    }).join("");
    if (sorted.length > TOK_MAX)
      out += '<button type="button" class="insp-more">+' + (sorted.length - TOK_MAX) + "</button>";
    return '<span class="insp-toks">' + out + "</span>";
  }
  function toHex(rgb) {
    var m = rgb.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
    if (!m) return rgb;
    var h = "#" + [1, 2, 3].map(function (i) {
      return ("0" + Math.round(+m[i]).toString(16)).slice(-2);
    }).join("");
    return m[4] !== undefined && +m[4] < 1 ? h + " · 투명도 " + (+m[4]) : h;
  }
  function colorRow(label, rgb, role) {
    if (!rgb || rgb === "rgba(0, 0, 0, 0)" || rgb === "transparent") return "";
    return '<div class="insp-row"><dt>' + label + "</dt><dd>" +
      '<span class="insp-sw insp-copy" style="background:' + esc(rgb) + '" title="' +
      esc(toHex(rgb)) + '"></span>' + esc(toHex(rgb)) +
      "<br>" + tokLine(colorIndex[rgb], role) + "</dd></div>";
  }
  function row(label, value, extra) {
    if (value === "" || value == null) return "";
    return '<div class="insp-row"><dt>' + label + "</dt><dd>" + esc(value) +
      (extra ? "<br>" + extra : "") + "</dd></div>";
  }
  function grp(title, inner) {
    return inner ? '<section class="insp-grp"><h3>' + title + "</h3>" + inner + "</section>" : "";
  }

  function selectorOf(el) {
    var s = el.tagName.toLowerCase();
    if (el.id) s += "#" + el.id;
    var cls = (el.getAttribute("class") || "").trim().split(/\s+/).filter(Boolean);
    if (cls.length) s += "." + cls.join(".");
    return s;
  }

  /* 마우스는 가장 안쪽 요소를 잡는다 — 버튼을 가리켜도 안의 <span> 이 잡힌다.
     그래서 조상 사슬을 같이 보여주고, 눌러서 위로 올라갈 수 있게 한다.
     키보드 ↑ ↓ 로도 오르내린다 */
  function chain(el) {
    var list = [], n = el.parentElement, depth = 0;
    while (n && n !== document.documentElement && depth < 4) {
      list.unshift(n); n = n.parentElement; depth++;
    }
    if (!list.length) return "";
    return '<p class="insp-path">' + list.map(function (a, i) {
      return '<button type="button" class="insp-up" data-up="' + (list.length - i) + '">' +
             esc(selectorOf(a).split(".")[0] + (a.className ? "." + String(a.className).trim().split(/\s+/)[0] : "")) +
             "</button>";
    }).join('<span class="insp-arw">›</span>') + "</p>";
  }

  function render(el) {
    if (!el) { body.innerHTML = ""; return; }
    var cs = getComputedStyle(el), r = el.getBoundingClientRect();
    var out = '<section class="insp-grp">' + chain(el) +
              '<p class="insp-sel">' + esc(selectorOf(el)) + "</p></section>";

    /* 크기 · 여백 */
    var box = row("크기", Math.round(r.width * 10) / 10 + " × " + Math.round(r.height * 10) / 10);
    var pad = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft];
    if (pad.some(function (v) { return parseFloat(v) > 0; }))
      box += row("안쪽", pad.map(px).join(" "));
    var mar = [cs.marginTop, cs.marginRight, cs.marginBottom, cs.marginLeft];
    if (mar.some(function (v) { return parseFloat(v) !== 0; }))
      box += row("바깥", mar.map(px).join(" "));
    if (/flex|grid/.test(cs.display) && parseFloat(cs.gap) > 0)
      box += row("간격", px(cs.rowGap) + (cs.rowGap !== cs.columnGap ? " / " + px(cs.columnGap) : ""));
    if (parseFloat(cs.borderTopLeftRadius) > 0)
      box += row("모서리", px(cs.borderTopLeftRadius), tokLine(lenIndex[cs.borderTopLeftRadius]));
    out += grp("박스", box);

    /* 글꼴 — 껍데기 요소라도 상속된 값이 궁금할 때가 있어서 항상 보여준다 */
    if (el.textContent.trim()) {
      var size = parseFloat(cs.fontSize);
      var lh = cs.lineHeight === "normal" ? null : parseFloat(cs.lineHeight) / size;
      var key = cs.fontWeight + "|" + size + "|" + (lh == null ? "" : lh.toFixed(2));
      var t = "";
      t += row("서체", cs.fontFamily.split(",")[0].replace(/["']/g, ""));
      t += row("크기", px(cs.fontSize) + " · 굵기 " + cs.fontWeight);
      t += row("행간", cs.lineHeight === "normal" ? "normal"
        : px(cs.lineHeight) + " (" + lh.toFixed(2) + ")");
      if (cs.letterSpacing !== "normal")
        t += row("자간", px(cs.letterSpacing) + " (" + (parseFloat(cs.letterSpacing) / size * 100).toFixed(1) + "%)");
      t += '<div class="insp-row"><dt>토큰</dt><dd>' + tokLine(fontIndex[key]) + "</dd></div>";
      out += grp("글꼴", t);
    }

    /* 색 */
    var col = colorRow("글자", cs.color, "text");
    col += colorRow("배경", cs.backgroundColor, "bg");
    if (parseFloat(cs.borderTopWidth) > 0)
      col += colorRow("테두리", cs.borderTopColor, "line");
    out += grp("색", col);

    /* 그 외 */
    var etc = "";
    if (cs.boxShadow && cs.boxShadow !== "none") etc += row("그림자", cs.boxShadow);
    if (parseFloat(cs.borderTopWidth) > 0) etc += row("선", px(cs.borderTopWidth) + " " + cs.borderTopStyle);
    if (cs.opacity !== "1") etc += row("투명도", cs.opacity);
    var ico = (el.getAttribute("class") || "").split(/\s+/).filter(function (c) { return /^i-/.test(c); });
    if (ico.length) etc += row("아이콘", ico.join(" "), esc((cs.getPropertyValue("--icon") || "").trim()));
    out += grp("그 외", etc);

    body.innerHTML = out;
  }
  function px(v) { var n = parseFloat(v); return (Math.round(n * 100) / 100) + "px"; }

  /* ── 토큰 정보창 (패널 아래) ────────────────────────────
     한 번에 하나만 연다. 여러 개를 펼치면 오히려 못 읽는다.

     여기서 제일 쓸모 있는 건 **별칭 사슬**이다.
       --primary-normal → --semantic-primary-normal → #543efa
     `tokens.css` 가 피그마의 3층(원시 변수 → 의미 스타일 → 노드)을 그대로
     옮겨 놨기 때문에, 이 사슬이 곧 "피그마에서 어느 층의 이름인가" 다.
     ──────────────────────────────────────────────────────── */
  function aliasChain(name) {
    var out = [name], seen = {}, cur = name;
    while (out.length < 8) {
      seen[cur] = 1;
      var v = raw[cur];
      var m = v && v.match(/^var\(\s*(--[A-Za-z0-9-]+)/);
      if (!m || seen[m[1]]) break;
      cur = m[1];
      out.push(cur);
    }
    return out;
  }

  /* 값이 똑같은 다른 토큰들 — 이름이 여러 개인 이유를 보여준다 */
  function twins(name) {
    var v = tokens[name], out = [];
    for (var n in tokens) if (n !== name && tokens[n] === v) out.push(n);
    return sortNames(out);
  }

  /* 선언 안에 박힌 `var(--…)` 도 눌러서 들어갈 수 있게 한다.
     `--display-extrabold: 800 var(--fs-display)/1.25 …` 처럼 값 일부만
     다른 토큰인 경우가 있는데, 반응형 크기는 그쪽에 들어 있다 */
  function linkifyVars(str) {
    return esc(str).replace(/var\(\s*(--[A-Za-z0-9-]+)\s*\)/g, function (m, n) {
      if (!(n in tokens)) return m;
      return 'var(<button type="button" class="insp-tok insp-tok--inline" data-tok="' +
             n + '">' + n + "</button>)";
    });
  }

  function preview(name) {
    var v = tokens[name] || "";
    if (/^(#|rgb|hsl)/i.test(v))
      return '<div class="insp-prev insp-prev--color" style="background:' + esc(v) + '"></div>';
    if (/^\d{3}\s+[\d.]+px\s*\//.test(v))
      // 실제 크기 그대로 보여준다 — 그래서 표본을 짧게 잡는다(64px 도 한 줄에 들어가게)
      return '<div class="insp-prev insp-prev--type" style="font:var(' + esc(name) + ')">가Ag1</div>';
    return "";
  }

  function renderToken(name) {
    if (!name || !(name in tokens)) { closeDetail(); return; }
    var chain = aliasChain(name), tw = twins(name), med = rawMedia[name];
    var h = '<div class="insp-detail__head">' +
            '<b>' + esc(name) + "</b>" +
            '<button type="button" class="insp-x" aria-label="닫기">✕</button></div>' +
            '<div class="insp-detail__body">';
    h += preview(name);
    h += row("지금 값", tokens[name]);

    if (chain.length > 1) {
      h += '<div class="insp-row"><dt>거쳐 온 길</dt><dd>' +
           chain.map(function (n, i) {
             return i === 0 ? '<span class="insp-cur">' + esc(n) + "</span>"
                            : '<button type="button" class="insp-tok" data-tok="' + esc(n) + '">' + esc(n) + "</button>";
           }).join('<span class="insp-arw">→</span>') +
           '<span class="insp-arw">→</span><span class="insp-val">' + esc(tokens[name]) + "</span></dd></div>";
    } else {
      h += '<div class="insp-row"><dt>선언</dt><dd>' +
           linkifyVars(raw[name] || "(미디어쿼리 안에서만 정해집니다)") + "</dd></div>";
    }

    if (med && med.length) {
      h += '<div class="insp-row"><dt>화면 폭</dt><dd>' +
           '<span class="insp-bp">기본</span> ' + linkifyVars(raw[name] || "-") + "<br>" +
           med.map(function (m) {
             return '<span class="insp-bp">' + esc(m.cond.replace(/[()]/g, "")) + "</span> " +
                    linkifyVars(m.value);
           }).join("<br>") + "</dd></div>";
    }

    if (tw.length) {
      h += '<div class="insp-row"><dt>같은 값</dt><dd>' +
           tw.slice(0, 8).map(function (n) {
             return '<button type="button" class="insp-tok" data-tok="' + esc(n) + '">' + esc(n) + "</button>";
           }).join("") +
           (tw.length > 8 ? '<span class="insp-tok insp-none">외 ' + (tw.length - 8) + "개</span>" : "") +
           "</dd></div>";
    }
    detail.innerHTML = h + "</div>";
    detail.style.display = "block";
  }
  function closeDetail() { detail.style.display = "none"; detail.innerHTML = ""; }

  /* 정보창이 열리면 위쪽 목록이 그만큼 짧아진다. 방금 누른 이름이 아래쪽에
     있었다면 정보창에 가려 버리므로, 가려진 만큼만 목록을 밀어 올린다.
     `scrollIntoView` 를 쓰지 않는 이유 — 그건 바깥 스크롤(본문)까지 같이
     움직여서 보고 있던 자리를 잃는다 */
  function keepVisible(el) {
    if (!el || !body.contains(el)) return;
    requestAnimationFrame(function () {
      var c = body.getBoundingClientRect(), e = el.getBoundingClientRect(), m = 12;
      if (e.bottom > c.bottom - m) body.scrollTop += e.bottom - (c.bottom - m);
      else if (e.top < c.top + m) body.scrollTop -= (c.top + m) - e.top;
    });
  }

  /* ── 가리키는 표시 ─────────────────────────────────────── */
  function drawHL(el) {
    if (!el) { hl.style.display = "none"; return; }
    var r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    hl.style.display = "block";
    hl.style.left = r.left + "px"; hl.style.top = r.top + "px";
    hl.style.width = r.width + "px"; hl.style.height = r.height + "px";
    hl.classList.toggle("is-low", r.top < 24);   // 위에 라벨 자리가 없으면 아래로
    var pt = parseFloat(cs.paddingTop), pr = parseFloat(cs.paddingRight),
        pb = parseFloat(cs.paddingBottom), pl = parseFloat(cs.paddingLeft);
    if (pt || pr || pb || pl) {
      hlPad.style.display = "block";
      hlPad.style.inset = pt + "px " + pr + "px " + pb + "px " + pl + "px";
    } else hlPad.style.display = "none";
  }

  function follow() {
    rafId = 0;
    var el = pinned || hovered;
    if (el && el.isConnected) drawHL(el); else hl.style.display = "none";
  }
  function queue() { if (!rafId) rafId = requestAnimationFrame(follow); }

  var OURS = ".insp-panel,.insp-dock,.insp-catch,.insp-hl,.memo-layer";
  function ours(el) { return !!(el && el.closest && el.closest(OURS)); }

  /* 덮개 아래에서 진짜 페이지 요소를 찾는다. 위에서부터 훑어
     우리 UI 를 건너뛴 첫 번째가 사용자가 가리킨 것이다 */
  function pageElementAt(x, y) {
    var list = document.elementsFromPoint(x, y);
    for (var i = 0; i < list.length; i++) {
      if (!ours(list[i])) return list[i];
    }
    return null;
  }

  /* ── 켜고 끄기 ─────────────────────────────────────────── */
  /* 패널을 열거나 닫는다 — 이것이 도구의 on/off 다 */
  function setOpen(v) { open = !!v; apply(); }

  /* 무엇을 하겠다를 고른다.
     ▸ 같은 것을 다시 누르면 **끈다** — 판이 없어져 페이지를 그냥 쓸 수 있고,
       패널은 그대로 남아 값과 메모 목록이 읽힌다
     ▸ 닫혀 있으면 **열면서** 그 모드로 — 닫힌 채로 모드만 바꿔 두면
       눌러도 아무 일이 없는 것처럼 보인다 */
  function setMode(m) {
    mode = (mode === m && open) ? "" : m;
    if (!open) open = true;
    apply();
  }

  function apply() {
    on = open && !!mode;              // 고르기가 도는가
    var c = document.documentElement.classList;
    c.toggle("insp-open", open);      // 패널이 보인다
    c.toggle("insp-pick", on);        // 고르기 판이 있다
    c.toggle("insp-on", on);          // 옛 이름 — 페이지가 쓰고 있을 수 있어 남긴다
    c.toggle("insp-mode-main", open && mode === "main");
    c.toggle("insp-mode-memo", open && mode === "memo");
    if (panelBtn) {
      panelBtn.setAttribute("aria-expanded", open ? "true" : "false");
      panelBtn.querySelector("span").textContent = open ? "패널 닫기" : "패널 열기";
      panelBtn.title = open ? "오른쪽 패널을 닫습니다 (페이지를 그냥 쓸 수 있습니다)"
                            : "오른쪽 패널을 엽니다";
    }
    toggle.setAttribute("aria-pressed", open && mode === "main" ? "true" : "false");
    if (hlTag) hlTag.textContent = mode === "memo" ? "메모" : "검사";
    for (var i = 0; i < showListeners.length; i++) {
      try { showListeners[i](open ? mode : ""); } catch (e) { /* 메모 쪽 오류가 검사기를 멈추면 안 된다 */ }
    }
    // 고르기를 끈 것만으로는 읽던 값을 지우지 않는다 — 그게 끄는 이유다
    if (!on) { hovered = null; hl.style.display = "none"; }
    if (!open) { pinned = null; body.innerHTML = ""; closeDetail(); }
    setHint();
  }
  function setOn(v) { setOpen(v); }
  function setHint() {
    if (!on) {
      hint.innerHTML = "고르기가 꺼져 있습니다 — <b>검사</b>나 <b>메모</b>를 누르면 다시 고를 수 있습니다";
    } else if (pinned) {
      hint.innerHTML = '<span class="insp-pin">고정됨</span> ↑ ↓ 로 부모·자식 이동 · Esc 로 풀기';
    } else if (mode === "memo") {
      hint.innerHTML = '<span class="insp-pin is-memo">메모</span> 고칠 곳을 클릭하면 바로 쓸 수 있습니다';
    } else {
      hint.innerHTML = "요소 위에 마우스를 올리면 값이 나옵니다. 클릭하면 고정됩니다 (비활성 버튼도 고를 수 있습니다)";
    }
    // ▸ 알림은 반드시 innerHTML 을 쓴 **뒤에** — 메모가 여기에 버튼을 끼워 넣는데,
    //   먼저 부르면 그 버튼이 innerHTML 로 지워진다
    for (var i = 0; i < pinListeners.length; i++) {
      try { pinListeners[i](pinned); } catch (e) { /* 메모 쪽 오류가 검사기를 멈추면 안 된다 */ }
    }
  }

  /* ── 만들기 ────────────────────────────────────────────── */
  function build() {
    probe = document.createElement("span");
    probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none";
    document.body.appendChild(probe);

    dock = document.createElement("div");
    dock.className = "insp-dock";

    /* 패널 여닫기 — 도구의 on/off. 부두 맨 앞에 둔다 */
    panelBtn = document.createElement("button");
    panelBtn.type = "button";
    panelBtn.className = "insp-panelbtn";
    panelBtn.setAttribute("aria-expanded", "false");
    panelBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" stroke-width="2"/>' +
      '<path d="M15 4v16" stroke="currentColor" stroke-width="2"/></svg><span>패널 열기</span>';
    dock.appendChild(panelBtn);

    toggle = document.createElement("button");
    toggle.className = "insp-toggle";
    toggle.type = "button";
    toggle.setAttribute("aria-pressed", "false");
    toggle.title = "요소의 글꼴·색·여백과 토큰 이름을 오른쪽에 보여줍니다";
    toggle.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="2"/>' +
      '<path d="M15.5 15.5L21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
      "</svg><span>검사</span>";

    panel = document.createElement("aside");
    panel.className = "insp-panel";
    /* 패널은 열(column) 두 개까지 담는다 — 왼쪽이 검사, 오른쪽은 메모가 붙인다.
       화면이 좁으면 CSS 가 위아래로 쌓는다 */
    panel.innerHTML =
      '<div class="insp-col insp-col--main">' +
        '<div class="insp-panel__head"><h2>검사</h2></div>' +
        '<div class="insp-panel__hint"></div>' +
        '<div class="insp-panel__body"></div>' +
      "</div>";

    detail = document.createElement("div");
    detail.className = "insp-detail";
    detail.style.display = "none";

    /* 화면 전체를 덮는 투명한 판. 검사 중에는 이 판이 마우스를 받는다.
       ▸ 왜 필요한가 — `disabled` 버튼은 브라우저가 **클릭 이벤트를 아예
         만들지 않는다.** 그래서 페이지에서 클릭을 가로채는 방식으로는
         비활성 버튼을 고를 수가 없었다. 판을 덮고 그 아래 무엇이 있는지
         좌표로 찾으면(`elementsFromPoint`) 비활성이든 뭐든 다 고를 수 있다.
       ▸ 덤으로 두 가지가 같이 풀린다 — 페이지의 버튼·링크가 눌리지 않고,
         마우스가 요소에 닿지 않으니 hover 가 아닌 **평소 값**이 보인다.
       ▸ 핀(9995)·테두리(9996)·패널(9997)·버튼(9998)은 이 판(9994) 위에 있어
         그대로 눌린다. 휠은 판이 스크롤 대상이 아니라서 페이지가 굴러간다 */
    catcher = document.createElement("div");
    catcher.className = "insp-catch";

    hl = document.createElement("div");
    hl.className = "insp-hl";
    hlPad = document.createElement("div");
    hlPad.className = "insp-hl__pad";
    hl.appendChild(hlPad);
    /* 무엇을 하는 중인지 테두리에 붙여 준다 — 색만으로는 헷갈린다 */
    hlTag = document.createElement("span");
    hlTag.className = "insp-hl__tag";
    hlTag.textContent = "검사";
    hl.appendChild(hlTag);

    dock.appendChild(toggle);
    document.body.appendChild(catcher);
    document.body.appendChild(dock);
    document.body.appendChild(panel);
    document.body.appendChild(hl);

    hint = panel.querySelector(".insp-panel__hint");
    body = panel.querySelector(".insp-panel__body");
    panel.querySelector(".insp-col--main").appendChild(detail);
    setHint();

    buildIndex();
    bind();
  }

  function bind() {
    panelBtn.addEventListener("click", function (e) { e.stopPropagation(); setOpen(!open); });
    toggle.addEventListener("click", function (e) { e.stopPropagation(); setMode("main"); });

    catcher.addEventListener("mousemove", function (e) {
      if (!on || pinned) return;
      var el = pageElementAt(e.clientX, e.clientY);
      if (!el || el === hovered) return;
      hovered = el;
      render(el);
      queue();
    });

    /* 덮개를 클릭하면 그 아래 요소를 고정한다. 페이지 쪽으로는 클릭이
       가지 않으므로 버튼·링크가 눌릴 일이 없다 */
    catcher.addEventListener("click", function (e) {
      if (!on) return;
      var el = pageElementAt(e.clientX, e.clientY);
      if (!el) return;
      pinned = (pinned === el) ? null : el;
      if (pinned) render(pinned);
      setHint();
      queue();
    });

    /* 패널 안 클릭 — 조상 이동 · 토큰 열기 · 접힌 이름 펴기 · 정보창 닫기.
       패널을 건드렸다는 건 이제 읽겠다는 뜻이라, 자동으로 고정한다.
       안 그러면 마우스를 옮기는 순간 내용이 갈려서 읽을 수가 없다 */
    panel.addEventListener("click", function (e) {
      var t = e.target;
      if (!t.closest) return;

      if (t.closest(".insp-x")) { closeDetail(); return; }

      var up = t.closest(".insp-up");
      if (up) {
        var n = +up.getAttribute("data-up"), el = pinned || hovered;
        while (el && n-- > 0) el = el.parentElement;
        if (!el) return;
        pinned = el; render(el); setHint(); queue(); return;
      }

      var more = t.closest(".insp-more");
      if (more) {
        pinIfNeeded();
        var box = more.parentNode;
        box.classList.add("is-open");
        keepVisible(box.lastElementChild);   // 펴진 마지막 이름까지 보이게
        return;
      }

      var tok = t.closest(".insp-tok[data-tok]");
      if (tok) {
        pinIfNeeded();
        renderToken(tok.getAttribute("data-tok"));
        detail.scrollTop = 0;
        keepVisible(tok);                    // 방금 누른 이름이 안 가리게
      }
    });

    function pinIfNeeded() {
      if (pinned || !hovered) return;
      pinned = hovered; setHint(); queue();
    }

    document.addEventListener("keydown", function (e) {
      if (!on) return;
      if (e.key === "Escape") {
        // 한 단계씩 물러난다 — 고정 해제 → 고르기 끄기 → 패널 닫기
        if (pinned) { pinned = null; setHint(); queue(); }
        else if (mode) { mode = ""; apply(); }
        else setOpen(false);
        return;
      }
      var cur = pinned || hovered;
      if (!cur) return;
      if (e.key === "ArrowUp" && cur.parentElement && cur.parentElement !== document.documentElement) {
        e.preventDefault(); pinned = cur.parentElement; render(pinned); setHint(); queue();
      } else if (e.key === "ArrowDown" && cur.firstElementChild) {
        e.preventDefault(); pinned = cur.firstElementChild; render(pinned); setHint(); queue();
      }
    });

    // 고정해 둔 요소가 스크롤·창 크기 변화로 움직이면 테두리도 따라간다
    addEventListener("scroll", queue, true);
    addEventListener("resize", function () { queue(); rebuildOnResize(); });
  }

  /* 미디어쿼리로 --fs-* 가 바뀌므로 폭이 달라지면 색인을 다시 만든다 */
  var rt = 0;
  function rebuildOnResize() {
    clearTimeout(rt);
    rt = setTimeout(function () {
      tokens = {}; colorIndex = {}; fontIndex = {}; lenIndex = {};
      buildIndex();
      if (pinned || hovered) render(pinned || hovered);
    }, 200);
  }

  /* ── 밖으로 여는 것 ────────────────────────────────────────
     메모 기능(js/memo.js)이 쓴다. 검사기 없이도 페이지는 돌아가야 하므로
     메모 쪽에서 이 객체가 없으면 조용히 빠지도록 되어 있다 */
  window.catInspect = {
    /* 새로고침해도 같은 요소를 다시 찾을 수 있는 선택자.
       id 를 만나면 거기서 멈추고, 없으면 body 부터 nth-of-type 으로 내려간다 */
    selectorPath: function (el) {
      var parts = [], n = el, byId = false;
      while (n && n.nodeType === 1 && n !== document.body) {
        if (n.id) { parts.unshift("#" + (window.CSS && CSS.escape ? CSS.escape(n.id) : n.id)); byId = true; break; }
        var i = 1, sib = n;
        while ((sib = sib.previousElementSibling)) if (sib.tagName === n.tagName) i++;
        parts.unshift(n.tagName.toLowerCase() + ":nth-of-type(" + i + ")");
        n = n.parentElement;
      }
      return (byId ? "" : "body > ") + parts.join(" > ");
    },
    resolve: function (path) {
      try { return document.querySelector(path); } catch (e) { return null; }
    },
    label: function (el) { return selectorOf(el); },
    /* 메모에 같이 남길 값 요약 — 나중에 "무슨 색이었더라" 를 안 되묻게 */
    summary: function (el) {
      var cs = getComputedStyle(el), r = el.getBoundingClientRect();
      var o = {
        크기: Math.round(r.width * 10) / 10 + "×" + Math.round(r.height * 10) / 10,
        글꼴: cs.fontSize + " / " + cs.fontWeight,
        글자색: toHex(cs.color)
      };
      if (cs.backgroundColor && cs.backgroundColor !== "rgba(0, 0, 0, 0)")
        o.배경색 = toHex(cs.backgroundColor);
      var ft = fontIndex[cs.fontWeight + "|" + parseFloat(cs.fontSize) + "|" +
               (parseFloat(cs.lineHeight) / parseFloat(cs.fontSize)).toFixed(2)];
      if (ft) o.글꼴토큰 = sortNames(ft)[0];
      var ct = colorIndex[cs.color];
      if (ct) o.글자색토큰 = sortNames(ct, "text")[0];
      var bt = colorIndex[cs.backgroundColor];
      if (bt) o.배경색토큰 = sortNames(bt, "bg")[0];
      return o;
    },
    isOn: function () { return open; },
    isOpen: function () { return open; },
    setOpen: function (v) { setOpen(v); },
    /* 무엇을 하겠다를 고른다 (라디오). 닫혀 있으면 열면서 그 모드로 */
    setMode: function (m) { setMode(m); },
    getMode: function () { return open ? mode : ""; },
    onMode: function (fn) { showListeners.push(fn); },
    dock: function () { return dock; },
    pin: function (el) {
      if (!open) { open = true; if (!mode) mode = "main"; apply(); }
      pinned = el; render(el); setHint(); queue();
    },
    getPinned: function () { return pinned; },
    /* 요소가 고정될 때마다 알린다 — 메모 창이 대상을 따라가야 하므로 */
    onPin: function (fn) { pinListeners.push(fn); },
    panel: function () { return panel; }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else build();
})();


/* ─── src/memo.js ─────────────────────────────── */
/* ============================================================
   메모 — 카탈로그 전용 문서 UI
   컴포넌트가 아니다. 실제 사이트에는 들어가지 않는다.

   무엇을 푸는가
     디자이너가 "여기 이거 고쳐 주세요" 를 말로 전하면 **어디를 말하는지**
     가 늘 애매하다. 그래서 화면의 그 요소에 직접 핀을 꽂아 남기게 했다.
     핀 하나에 그 요소의 선택자·위치·그때의 값(색·글꼴·크기)이 같이 저장된다.

   메모는 두 갈래다
     ① **내 메모** — 내가 쓴 것. 이 브라우저(localStorage)에만 쌓인다.
        다른 사람에게 보이려면 「JSON 내보내기」로 파일을 보내야 한다.
     ② **공유 메모** — 서버(Cloudflare Worker)에 올라간 것.
        카탈로그를 여는 **모든 사람에게 보인다**. 읽기만 되고 고칠 수는 없다.
        서버를 안 붙였으면 저장소의 `memos.json` 을 대신 읽는다.

     서버를 붙이면(메모 열 아래 「서버 붙이기」) 내가 저장하는 즉시 ②가 되어
     다른 사람에게도 보인다. 주소는 **저장소에 넣지 않고** 각자 브라우저에만
     둔다.

   누가 썼는지 — 이름 + 닉네임으로 들어온다
     서버 명단에 이름↔닉네임이 있고, 맞으면 토큰을 받아 온다. 쓴 메모의
     작성자는 **서버가 그 토큰에서 꺼내 찍는다** — 화면이 보낸 이름을 믿지
     않으므로 남의 이름으로 쓸 수 없다.
     ▸ 왜 열쇠 문자열이 아닌가 — 사람이 외울 수 있어야 하고, 링크가 새어도
       글을 넣을 수 없어야 한다. 예전에는 링크에 열쇠가 실려 **링크 하나가
       곧 통과증**이었다.
     ▸ 닉네임은 약한 암호다. 그래서 매 요청에는 닉네임이 아니라 토큰이
       실리고, 서버가 로그인 실패 횟수를 세어 찍어 맞히기를 막는다.
     ▸ 명단에서 한 줄을 지우면 **그 사람 토큰만** 바로 무효가 된다.

   쓰는 법
     오른쪽 아래 「메모」 버튼 → 화면에서 고칠 곳을 클릭 → **바로 쓰기 창**
     핀을 누르면 그 메모가 열린다
     메모 열 아래 — 새로 받기 · JSON 내보내기 · 불러오기 · 내 메모 비우기 · 휴지통

   ▸ 지우기는 **휴지통**으로 간다. 「휴지통 N」에서 되살릴 수 있다.
     서버에 붙어 있으면 되살릴 때 서버에도 다시 올라간다.
   ▸ 서버에 붙어 있으면 **30초마다, 그리고 이 탭으로 돌아올 때마다**
     남이 쓴 메모를 알아서 받아 온다 — 새로고침하지 않아도 된다.

   ▸ 「검사」와 **라디오처럼 하나만** 켜진다. 메모 모드에서는 값도 같이
     봐야 하므로 검사 열이 함께 열린다 — 넓은 화면이면 좌우로 나란히.
   ▸ 고른 영역의 테두리 색과 라벨이 모드마다 다르다(검사=보라, 메모=빨강).

   저장 형태 (내보내기 파일)
     {
       "v": 1,
       "page": "카탈로그.html",
       "saved": "2026-09-08T…",
       "notes": [
         { "id": "…", "at": "…", "text": "여기 여백이 좁아요",
           "done": true, "reply": "12 → 16 으로 고쳤습니다",
           "sel": "#btn-solid > div:nth-of-type(1) > …",
           "label": "button.btn.btn--solid.btn--primary",
           "section": "Button / Solid",
           "values": { "크기": "60.3×40.3", "배경색": "#543efa", … } }
       ]
     }
   ============================================================ */
(function () {
  "use strict";

  var KEY = "crissit-catalog-memo-v1";
  var SRV = "crissit-catalog-memo-server";   // 주소·열쇠를 이 브라우저에 저장한다
  var TRASH = "crissit-catalog-memo-trash";  // 지운 메모를 담아 두는 곳
  var WHO = "crissit-catalog-memo-who";      // 로그인해 둔 이름과 토큰
  var SHOWDONE = "crissit-catalog-memo-showdone";  // 처리된 메모를 볼 것인가
  var api = null;                 // window.catInspect — 검사기가 없으면 null
  var notes = [];      // 내 메모 (localStorage)
  var shared = [];     // 남이 쓴 메모 — 서버나 memos.json 에서 온다. 읽기만 된다
  var trash = [];      // 지운 메모 — 되살릴 수 있게 남겨 둔다
  var srv = null;      // { url, key } — 서버를 안 붙였으면 null. key 는 옛 링크용
  /* 누구로 들어와 있나 — { name, token } 또는 null.
     이름 + 닉네임을 서버 명단과 맞춰 받아 온 토큰이다. 메모의 작성자는
     **서버가 이 토큰에서 꺼내 찍는다** — 화면이 보낸 이름은 믿지 않으므로
     남의 이름으로 쓸 수 없다.
     닉네임은 동료가 추측할 수 있는 약한 암호다. 그래서 여기 담기는 것이
     닉네임이 아니라 토큰이고, 서버는 로그인 실패 횟수를 세어 막는다 */
  var me = null;
  var srvState = "";   // 방금 일어난 일을 알리는 **한 번짜리** 문구
  /* 연동 상태 — 이쪽은 **늘 보인다.** srvState 는 떴다 사라지므로
     평소에 연동 여부를 알 수 없었다(2026-09-08 사용자 지적) */
  var linkState = "off";  // off(이 브라우저만) | busy(확인 중) | ok(연동됨) | bad(끊김)
  var linkAt = 0;      // 마지막으로 서버를 읽어낸 시각
  var linkWhy = "";    // bad 일 때 왜인지
  var pendingReset = false;  // `?memo-reset=1` 로 열렸다
  var layer, col, bodyEl, footEl, countBtn, toggleBtn, badgeEl;
  var editing = null;             // 지금 쓰고 있는 메모 id (새 메모면 null)
  var view = "list";              // list | edit | srv | trash — 지금 보고 있는 화면
  var target = null;              // 새 메모를 붙일 요소

  /* ── 저장 ──────────────────────────────────────────────── */
  var TRASH_MAX = 100;   // 이 이상 쌓이면 오래된 것부터 밀어낸다

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      notes = raw ? (JSON.parse(raw).notes || []) : [];
    } catch (e) { notes = []; }
    try {
      trash = JSON.parse(localStorage.getItem(TRASH) || "[]") || [];
    } catch (e) { trash = []; }
  }

  /* 지운 메모를 휴지통에 담는다 — 지우기가 되돌릴 수 없는 일이 되면
     사람들이 지우기를 아예 안 쓴다. 언제 지웠는지도 같이 남긴다 */
  function toTrash(list) {
    var now = new Date().toISOString();
    for (var i = 0; i < list.length; i++) {
      var c = JSON.parse(JSON.stringify(list[i]));
      c.__trashedAt = now;
      trash.push(c);
    }
    if (trash.length > TRASH_MAX) trash = trash.slice(trash.length - TRASH_MAX);
    try { localStorage.setItem(TRASH, JSON.stringify(trash)); } catch (e) { /* 저장 공간 */ }
  }
  function saveTrash() {
    try { localStorage.setItem(TRASH, JSON.stringify(trash)); } catch (e) { /* 저장 공간 */ }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(pack())); } catch (e) { /* 저장 공간이 막힌 경우 */ }
    renderPins(); renderCount();
  }
  function pack() {
    return {
      v: 1,
      page: decodeURIComponent(location.pathname.split("/").pop() || "") || "카탈로그.html",
      saved: new Date().toISOString(),
      notes: notes
    };
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  /* 화면에 그릴 목록 — 공유 메모가 먼저, 그 다음이 내 메모.
     같은 id 가 양쪽에 있으면 **내 쪽이 이긴다**(내가 고쳐 둔 것이므로) */
  function all() {
    var mine = {};
    for (var i = 0; i < notes.length; i++) mine[notes[i].id] = 1;
    var out = [];
    for (var j = 0; j < shared.length; j++) if (!mine[shared[j].id]) out.push(shared[j]);
    return out.concat(notes);
  }
  /* 처리된(`done`) 메모를 볼 것인가. 기본은 **안 본다** —
     고친 것이 목록에 계속 남으면 남은 일이 몇 개인지 알 수 없다.
     `done` 은 서버가 실어 보낸다(화면에서 찍는 수단은 아직 없다 · docs/BACKLOG.md).
     선택은 이 브라우저에만 기억한다 */
  var showDone = false;
  try { showDone = localStorage.getItem(SHOWDONE) === "yes"; } catch (e) {}
  function setShowDone(v) {
    showDone = !!v;
    try {
      if (v) localStorage.setItem(SHOWDONE, "yes");
      else localStorage.removeItem(SHOWDONE);
    } catch (e) {}
  }
  /* 화면에 실제로 그릴 목록. **핀과 목록이 같은 것을 써야** 번호가 어긋나지 않는다 */
  function visible() {
    if (showDone) return all();
    return all().filter(function (n) { return !n.done; });
  }
  function doneCount() {
    return all().filter(function (n) { return !!n.done; }).length;
  }

  /* 남이 쓴 메모의 꼬리표. 이름이 있으면 이름을, 없으면 「공유」.
     이름이 비는 경우 — 옛 공용 열쇠로 올린 메모다(서버가 누구인지 모른다) */
  function tagOf(n) {
    return '<span class="memo-tag">' + esc((n && n.by) || "공유") + "</span>";
  }
  function isMine(n) {
    for (var i = 0; i < notes.length; i++) if (notes[i].id === n.id) return true;
    return false;
  }

  /* ── 서버 (Cloudflare Worker) ─────────────────────────────
     붙여 두면 메모가 **쓰는 즉시 서버로 올라가고**, 페이지를 열 때 남이 쓴
     것까지 같이 내려온다. 안 붙이면 내 브라우저에만 쌓인다.

     주소와 열쇠는 **저장소에 넣지 않는다** — 공개 저장소라 그러면 누구나
     글을 넣을 수 있다. 각자 브라우저에 한 번 넣어 두는 방식이다.
     ──────────────────────────────────────────────────────── */
  /* 페이지가 알려 준 기본 서버 주소.
     `window.componote.memoServer` 로 설정한다 — 이러면 **그냥 링크만 열어도**
     로그인 화면이 뜬다. 예전에는 주소가 `?memo=…` 로 실려 와야 했다.

     ▸ 주소를 페이지에 박아도 되는 이유 — 막는 것이 **로그인**이기 때문이다.
       주소를 알아도 통과증 없이는 401 이고, 닉네임 찍어 맞히기는 서버가
       10분에 10번으로 제한한다. 열쇠가 유일한 자물쇠였을 때는 주소를 아는
       것만으로 글을 넣을 수 있어 숨겨야 했다. */
  function pageSrv() {
    var c = window.componote;
    var u = c && c.memoServer;
    return (typeof u === "string" && /^https:\/\//.test(u)) ? u : "";
  }

  function loadSrv() {
    try { srv = JSON.parse(localStorage.getItem(SRV) || "null"); } catch (e) { srv = null; }
    // 이제 **주소만 있으면 된다** — 들어가는 것은 로그인이 맡는다.
    // `key` 는 옛 링크로 들어온 사람에게만 남아 있다
    if (srv && !srv.url) srv = null;
    // 저장된 것이 없으면 페이지 기본값. 저장된 것이 있으면 그쪽을 존중한다
    // — 옛 링크로 다른 서버에 붙여 둔 사람을 끊지 않으려는 것이다
    if (!srv && pageSrv()) srv = { url: pageSrv() };
    try { me = JSON.parse(localStorage.getItem(WHO) || "null"); } catch (e) { me = null; }
    if (me && (!me.name || !me.token)) me = null;
    fromLink();
  }
  function saveMe(v) {
    me = v;
    try {
      if (v) localStorage.setItem(WHO, JSON.stringify(v));
      else localStorage.removeItem(WHO);
    } catch (e) { /* 저장이 막힌 경우 */ }
  }

  /* 요청에 실을 통과증. 로그인해 두면 토큰, 옛 링크로 들어왔으면 공용 열쇠.
     ▸ **주소가 아니라 헤더로 보낸다** — 주소에 실으면 Cloudflare 접속
       기록에 그대로 남는다 */
  function bearer() {
    if (me && me.token) return me.token;
    return (srv && srv.key) || "";
  }
  function authHead(extra) {
    var h = extra || {};
    var t = bearer();
    if (t) h.Authorization = "Bearer " + t;
    return h;
  }

  /* 링크에 담아 온 설정 — `?memo=<주소>|<열쇠>`
     디자이너에게 주소와 열쇠를 따로 설명하지 않아도 되게 하려는 것이다.
     링크 하나만 보내면 그 사람 브라우저에 저장되고, 다음부터는 그냥 열면 된다.

     ▸ 읽은 뒤 주소창에서 `?memo=…` 를 **바로 지운다** — 화면 공유나
       북마크로 열쇠가 흘러가지 않게 하려는 것이다(주소는 이미 브라우저에
       저장됐으니 지워도 연결은 유지된다).
     ▸ 저장소에는 여전히 넣지 않는다. 링크를 받은 사람만 쓴다. */
  function fromLink() {
    // `?memo-reset=1` — 열기만 하면 그 브라우저의 **내 메모**가 비워진다.
    // 서버는 건드리지 않는다. 상대방에게 "정리해 주세요" 를 말로 전하지
    // 않아도 되게 하려는 것이다
    if (/[?&]memo-reset=1/.test(location.search)) pendingReset = true;

    var m = /[?&]memo=([^&#]+)/.exec(location.search);
    if (!m) { cleanUrl(); return; }
    var parts = decodeURIComponent(m[1]).split("|");
    var url = (parts[0] || "").trim(), key = (parts[1] || "").trim();
    // 열쇠는 이제 **안 담는다.** 링크에는 주소만 있고, 받은 사람은 자기
    // 이름·닉네임으로 들어온다. `|열쇠` 가 붙은 옛 링크도 아직 받는다
    if (/^https:\/\//.test(url)) saveSrv(key ? { url: url, key: key } : { url: url });

    cleanUrl();
  }

  /* 주소창에서 `memo=` · `memo-reset=` 를 지운다 — 화면 공유나 북마크로
     열쇠가 흘러가지 않게, 그리고 새로고침 때 또 비워지지 않게 */
  function cleanUrl() {
    try {
      var q = location.search
        .replace(/([?&])memo=[^&#]*&?/, "$1")
        .replace(/([?&])memo-reset=[^&#]*&?/, "$1")
        .replace(/[?&]$/, "");
      if (q !== location.search) history.replaceState(null, "", location.pathname + q + location.hash);
    } catch (e) { /* 오래된 브라우저 */ }
  }
  function saveSrv(v) {
    srv = v;
    try {
      if (v) localStorage.setItem(SRV, JSON.stringify(v));
      else localStorage.removeItem(SRV);
    } catch (e) { /* 저장이 막힌 경우 */ }
  }
  function srvUrl(extra) {
    var u = srv.url.replace(/[?#].*$/, "").replace(/\/+$/, "");
    return u + (extra ? "?" + extra : "");
  }

  /* 서버 → 화면. 서버가 없으면 저장소의 memos.json 을 대신 읽는다 */
  function pull(done) {
    if (!srv) {
      var url = "memos.json?t=" + Date.now();   // Pages 가 캐시하므로 매번 새로 받는다
      try {
        fetch(url).then(function (r) { return r.ok ? r.json() : null; })
          .then(function (d) {
            shared = (d && d.notes) || [];
            srvState = ""; linkState = "off"; renderLink(); done();
          })
          .catch(function () { done(); });
      } catch (e) { done(); }
      return;
    }
    // 통과증이 없으면 서버를 부를 이유가 없다 — 401 만 받는다
    if (!bearer()) { linkState = "out"; renderLink(); done(); return; }
    srvState = "불러오는 중…";
    linkState = "busy"; renderLink();
    fetch(srvUrl(), { headers: authHead() }).then(function (r) {
      // 401 은 "고장" 이 아니라 **아직 안 들어왔다** 는 뜻이다. 그래서 오류로
      // 다루지 않고 로그인 화면으로 보낸다
      if (r.status === 401) { r.noAuth = true; throw r; }
      if (!r.ok) throw new Error("서버가 " + r.status + " 로 답했습니다");
      return r.json();
    }).then(function (d) {
      shared = (d && d.notes) || [];
      // 서버가 "너는 누구다" 를 같이 보내 준다 — 이쪽 저장값이 낡았을 때
      // (명단에서 이름이 바뀐 경우 등) 서버 말을 따른다
      if (me && d && d.you && d.you !== me.name) saveMe({ name: d.you, token: me.token });
      srvState = "";                      // 상태는 머리말 표시가 늘 보여 준다
      linkState = "ok"; linkAt = Date.now(); linkWhy = "";
      renderLink();
      done();
    }).catch(function (e) {
      srvState = "";
      if (e && e.noAuth) {
        saveMe(null);                     // 낡은 토큰이면 버린다
        linkState = "out"; linkWhy = "";
      } else {
        linkState = "bad"; linkWhy = why(e);
      }
      renderLink();
      done();
    });
  }

  /* 실패한 이유를 사람이 읽을 말로. `fetch` 는 주소가 틀렸든 인터넷이
     끊겼든 CORS 에 막혔든 똑같이 "Failed to fetch" 만 던진다 — 브라우저가
     구분해서 알려주지 않기 때문이라 여기서도 셋을 묶어 적을 수밖에 없다 */
  function why(e) {
    var m = (e && e.message) || "";
    if (/failed to fetch|networkerror|load failed/i.test(m)) {
      return "서버에 닿지 못했습니다 — 주소가 맞는지, 인터넷이 되는지 확인해 주세요";
    }
    return m || "알 수 없는 오류";
  }

  /* 화면 → 서버. 실패해도 내 브라우저에는 이미 저장돼 있으니 잃지 않는다 */
  function push(note) {
    if (!srv) return;
    fetch(srvUrl(), {
      method: "POST",
      headers: authHead({ "content-type": "application/json" }),
      body: JSON.stringify(note)
    }).then(function (r) {
      srvState = r.ok ? "올렸습니다" : "올리지 못했습니다 (" + r.status + ")";
      // 올리기가 막혔으면 연동이 끊긴 것이다 — 머리말 표시도 같이 바꾼다
      if (r.ok) { linkState = "ok"; linkAt = Date.now(); linkWhy = ""; }
      else if (r.status === 401) { saveMe(null); linkState = "out"; linkWhy = ""; }
      else { linkState = "bad"; linkWhy = "서버가 " + r.status + " 로 답했습니다"; }
      renderLink(); renderFootState();
    }).catch(function () {
      srvState = "올리지 못했습니다 — 인터넷이나 주소를 확인해 주세요";
      linkState = "bad"; linkWhy = "서버에 닿지 못했습니다";
      renderLink(); renderFootState();
    });
  }
  function drop(id) {
    if (!srv) return;
    fetch(srvUrl("id=" + encodeURIComponent(id)), {
      method: "DELETE", headers: authHead()
    }).catch(function () {});
  }

  /* ── 핀 ───────────────────────────────────────────────── */
  /* 메모에 적어 둘 「구역 이름」을 페이지에서 읽는다.
     페이지마다 구역을 나누는 방식이 달라서 설정으로 뺐다 —
     안 주면 `section` 안의 첫 제목을 쓴다.

       <script>window.componote = {
         section: "section.sec",   // 구역을 감싸는 것
         sectionTitle: "h2"        // 그 안에서 이름으로 쓸 것
       };</script>  ← componote.js 보다 먼저 */
  function cfg(k, d) {
    var c = window.componote || {};
    return c[k] === undefined ? d : c[k];
  }
  function sectionOf(el) {
    var sel = cfg("section", "section, article, [data-section]");
    var s = el.closest && el.closest(sel);
    var h = s && s.querySelector(cfg("sectionTitle", "h1, h2, h3, [data-section-title]"));
    return h ? h.textContent.trim() : "";
  }

  function renderPins() {
    layer.innerHTML = "";
    visible().forEach(function (n, i) {
      var el = api && api.resolve(n.sel);
      if (!el) return;                        // 마크업이 바뀌어 못 찾는 경우
      var r = el.getBoundingClientRect();
      var b = document.createElement("button");
      b.type = "button";
      b.className = "memo-pin" + (isMine(n) ? "" : " is-shared") + (n.done ? " is-done" : "");
      b.textContent = i + 1;
      b.title = n.text.slice(0, 60);
      b.style.left = (r.left + scrollX + r.width - 9) + "px";
      b.style.top = (r.top + scrollY - 9) + "px";
      b.setAttribute("data-id", n.id);
      layer.appendChild(b);
    });
  }
  function renderCount() {
    var n = visible().length;      // 남은 일의 개수다 — 처리된 것은 세지 않는다
    countBtn.textContent = n;
    countBtn.classList.toggle("is-some", n > 0);
    // 열지 않아도 메모가 있는지 보이게 버튼에도 개수를 붙입니다
    if (badgeEl) badgeEl.textContent = n ? String(n) : "";
  }

  /* ── 메모 쓰기 ─────────────────────────────────────────── */
  function openEditor(note, el) {
    // 공유 메모는 남이 쓴 것이라 여기서 고치지 않는다 — memos.json 에서 고친다
    var readonly = !!(note && !isMine(note));
    editing = note ? note.id : null;
    target = el || (note && api && api.resolve(note.sel)) || null;
    var label = note ? note.label : (target && api ? api.label(target) : "");
    if (readonly) {
      bodyEl.innerHTML =
        '<p class="memo-target">' + esc(label || "(대상 없음)") + "</p>" +
        '<p class="memo-ro">' + tagOf(note) + " " + esc(note.text) + "</p>" +
        (note.reply ? '<p class="memo-ro is-reply"><b>' + (note.done ? "처리했습니다" : "답글") + "</b><br>" + esc(note.reply) + "</p>" : "") +
        '<p class="memo-hint">저장소의 <code>memos.json</code> 에 들어 있는 메모라 여기서는 고칠 수 없습니다. 내용을 바꾸려면 그 파일을 고쳐 커밋하세요.</p>';
      footEl.innerHTML = '<div class="memo-btns"><button type="button" class="memo-cancel">목록으로</button></div>';
      return;
    }
    bodyEl.innerHTML =
      '<p class="memo-target">' + esc(label || "(대상 없음)") + "</p>" +
      '<textarea class="memo-text" rows="5" placeholder="무엇을 어떻게 고쳤으면 하는지 적어 주세요">' +
      esc(note ? note.text : "") + "</textarea>";
    footEl.innerHTML =
      '<div class="memo-btns">' +
      '<button type="button" class="memo-save">저장</button>' +
      '<button type="button" class="memo-cancel">취소</button>' +
      (note ? '<button type="button" class="memo-del">삭제</button>' : "") +
      "</div>";
    view = "edit";
    var ta = bodyEl.querySelector(".memo-text");
    ta.focus();
    ta.selectionStart = ta.value.length;
  }

  function commit() {
    var ta = bodyEl.querySelector(".memo-text");
    if (!ta) return;
    var text = ta.value.trim();
    if (!text) { openList(); return; }
    if (editing) {
      for (var i = 0; i < notes.length; i++) {
        if (notes[i].id === editing) { notes[i].text = text; notes[i].at = new Date().toISOString(); break; }
      }
    } else {
      if (!target || !api) { openList(); return; }
      notes.push({
        id: uid(),
        at: new Date().toISOString(),
        text: text,
        sel: api.selectorPath(target),
        label: api.label(target),
        section: sectionOf(target),
        values: api.summary(target)
      });
    }
    save();
    push(editing ? found(editing) : notes[notes.length - 1]);
    openList();
  }
  function found(id) {
    for (var i = 0; i < notes.length; i++) if (notes[i].id === id) return notes[i];
    return null;
  }

  /* 서버가 붙어 있는데 아직 안 들어왔으면 **로그인 화면을 먼저** 보여 준다.
     빈 목록을 보여 주면 "메모가 없구나" 로 읽힌다 — 실제로는 못 읽고 있는
     것이다. 안 들어와도 이 브라우저에만 쓰는 것은 되므로 「나중에」가 있다 */
  function openListOrLogin() {
    if (srv && !bearer()) {
      // 이미 로그인 화면이면 **아무것도 하지 않는다.** 다시 그리면 넣고
      // 있던 이름이 날아가고, 목록으로 넘기면 로그인 화면이 덮인다
      if (view !== "login") openLogin("");
      return;
    }
    openList();
  }

  /* ── 목록 ─────────────────────────────────────────────── */
  function openList() {
    var list = visible();
    var rows = list.length
      ? list.map(function (n, i) {
          var mine = isMine(n);
          return '<li class="memo-item' + (n.done ? " is-done" : "") + '" data-id="' + n.id + '">' +
            '<span class="memo-no' + (mine ? "" : " is-shared") + (n.done ? " is-done" : "") + '">' +
            (n.done ? "✓" : (i + 1)) + "</span>" +
            "<div><b>" + esc(n.text) + "</b>" +
            (n.reply ? '<span class="memo-reply">' + esc(n.reply) + "</span>" : "") +
            '<span class="memo-meta">' + (mine ? "" : tagOf(n) + " ") +
            esc(n.section ? n.section + " · " : "") + esc(n.label) + "</span></div>" +
            '<button type="button" class="memo-go" data-id="' + n.id + '">보기</button></li>';
        }).join("")
      /* 「없다」와 「다 처리했다」는 다르다 — 처리된 것을 숨겨서 0개가 된 것을
         「아직 메모가 없습니다」로 적으면 지워진 줄 안다 (2026-09-10) */
      : (!showDone && doneCount()
          ? '<li class="memo-empty"><b>열린 메모가 없습니다.</b><br>' +
            doneCount() + "개 모두 처리됐습니다.</li>"
          : '<li class="memo-empty">아직 메모가 없습니다.<br>화면에서 고칠 곳을 <b>클릭해 고른 뒤</b> 위의 <b>「＋ 메모」</b>를 누르세요.</li>');

    /* 처리된 것이 몇 개 숨었는지 **말해 준다** — 조용히 사라지면 지워진 줄 안다 */
    var hid = doneCount();
    var bar = (hid || showDone)
      ? '<div class="memo-filter">' +
        "<span>" + (showDone
          ? "처리된 것까지 <b>" + all().length + "개</b>를 모두 보고 있습니다"
          : "열린 메모 <b>" + list.length + "개</b> · 처리된 <b>" + hid + "개</b>는 숨김") +
        "</span>" +
        '<button type="button" class="memo-showdone">' +
        (showDone ? "처리된 것 숨기기" : "처리된 것도 보기") + "</button></div>"
      : "";

    view = "list";
    bodyEl.innerHTML = bar + '<ul class="memo-list">' + rows + "</ul>";
    footEl.innerHTML =
      '<div class="memo-btns">' +
      (srv ? '<button type="button" class="memo-refresh">새로 받기</button>' : "") +
      '<button type="button" class="memo-export">JSON 내보내기</button>' +
      '<label class="memo-import">불러오기<input type="file" accept="application/json,.json" hidden></label>' +
      (notes.length ? '<button type="button" class="memo-clear">내 메모 비우기</button>' : "") +
      (trash.length ? '<button type="button" class="memo-trash">휴지통 ' + trash.length + "</button>" : "") +
      '<button type="button" class="memo-srv">' + (srv ? "서버 설정" : "서버 붙이기") + "</button>" +
      "</div>" +
      '<p class="memo-hint">' + hintText() + "</p>";
    editing = null;
    renderFootState();
  }

  function hintText() {
    if (srv && me && me.name) {
      return "메모를 저장하면 <b>바로 서버로 올라가</b> 다른 사람에게도 보입니다. " +
             "쓴 메모에는 <b>" + esc(me.name) + "</b> 이름이 붙습니다. " +
             "남이 쓴 것은 그 사람 이름으로 표시되고 여기서는 고칠 수 없습니다.";
    }
    if (srv) {
      return "서버는 붙어 있는데 <b>아직 들어오지 않았습니다.</b> " +
             "머리말의 <b>로그인 필요</b> 를 눌러 이름과 닉네임을 넣으면 메모가 함께 모입니다.";
    }
    return "<b>내가 쓴 메모는 이 브라우저에만 저장됩니다</b> — 다른 사람에게는 보이지 않습니다. " +
           "「JSON 내보내기」로 파일을 만들어 전달하거나, <b>「서버 붙이기」</b>로 자동으로 모이게 하세요.";
  }
  /* 연동 상태 표시 — **늘 보인다.** 눌러서 서버 설정으로 바로 들어갈 수 있다.
     넷 중 하나다
       off   이 브라우저만 — 서버를 안 붙였다. 내 메모는 남에게 안 보인다
       busy  확인 중 — 서버를 읽고 있다
       ok    연동됨 — 마지막으로 읽어낸 시각을 함께 적는다
       bad   끊김 — 왜인지를 함께 적는다 (열쇠 · 서버 응답 · 인터넷) */
  var LINK_TEXT = {
    off: "이 브라우저만",   // 서버를 안 붙였다
    out: "로그인 필요",     // 서버는 있는데 아직 안 들어왔다
    busy: "확인 중",
    ok: "연동됨",
    bad: "연동 끊김"
  };
  function renderLink() {
    if (!col) return;
    var b = col.querySelector(".memo-link-state");
    if (!b) return;
    b.className = "memo-link-state is-" + linkState;
    // 들어와 있으면 상태 대신 **이름**을 보여 준다 — 누구로 쓰고 있는지가
    // 연동 여부보다 더 알고 싶은 것이다
    b.textContent = (linkState === "ok" && me && me.name) ? me.name : LINK_TEXT[linkState];
    b.title =
      linkState === "ok"   ? (me && me.name ? me.name + " 으로 들어와 있습니다" : "서버와 연동되어 있습니다") +
                             " (" + ago(linkAt) + " 확인) · 눌러서 바꾸기" :
      linkState === "out"  ? "메모를 남기려면 이름과 닉네임으로 들어와 주세요 · 눌러서 로그인" :
      linkState === "bad"  ? linkWhy + " · 눌러서 설정" :
      linkState === "busy" ? "서버를 읽고 있습니다" :
                        "서버를 붙이지 않았습니다 — 내 메모는 이 브라우저에만 있습니다 · 눌러서 붙이기";
    // ok 일 때만 언제 확인했는지 옆에 적는다. 나머지는 상태 이름이 이미 답이다
    var when = col.querySelector(".memo-link-when");
    if (linkState === "ok" && linkAt) {
      if (!when) {
        when = document.createElement("span");
        when.className = "memo-link-when";
        b.parentNode.insertBefore(when, b.nextSibling);
      }
      when.textContent = ago(linkAt);
    } else if (when) when.remove();
  }

  /* "방금" · "3분 전" · "2시간 전" — 초 단위까지 적을 이유가 없다 */
  function ago(t) {
    if (!t) return "";
    var s = Math.floor((Date.now() - t) / 1000);
    if (s < 45) return "방금";
    if (s < 3600) return Math.round(s / 60) + "분 전";
    if (s < 86400) return Math.round(s / 3600) + "시간 전";
    return Math.round(s / 86400) + "일 전";
  }

  function renderFootState() {
    var p = footEl.querySelector(".memo-state");
    if (!srvState) { if (p) p.remove(); return; }
    if (!p) { p = document.createElement("p"); p.className = "memo-state"; footEl.appendChild(p); }
    p.textContent = srvState;
    p.classList.toggle("is-bad", /실패|못했/.test(srvState));
  }

  /* ── 로그인 ───────────────────────────────────────────────
     이름과 닉네임을 서버 명단과 맞춰 토큰을 받아 온다.
     ▸ 왜 닉네임인가 — 열쇠 문자열을 사람이 다룰 일을 없애려는 것이다.
       외울 수 있는 것이어야 하고, 그 대신 서버가 찍어 맞히기를 막는다.
     ▸ 이름을 고를 목록으로 주지 않는다 — 누가 명단에 있는지가 그대로
       드러난다. 서버도 "이름이 틀렸다/닉네임이 틀렸다" 를 구분해 주지 않는다 */
  function openLogin(msg, keep) {
    view = "login";
    bodyEl.innerHTML =
      '<p class="memo-target">메모를 남기려면 들어와 주세요</p>' +
      '<label class="memo-field">이름<input type="text" class="memo-in-name" autocomplete="off" ' +
        'placeholder="예: 홍길동" value="' +
        esc(keep ? keep.name : (me ? me.name : "")) + '"></label>' +
      /* 닉네임은 **가리지 않는다.** password 칸에 한글을 넣으면 IME(한글 조합)이
         온전히 안 들어가는 경우가 있고, 무엇보다 본인이 뭘 쳤는지 못 봐서
         틀려도 못 잡는다(2026-09-08 실제로 막혔다). 닉네임은 애초에 동료가
         추측할 수 있는 약한 값이라 가려서 얻는 것이 없다 */
      '<label class="memo-field">닉네임<input type="text" class="memo-in-pass" ' +
        'autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" ' +
        'placeholder="정해 받은 닉네임" value="' + esc(keep ? keep.pass : "") + '"></label>' +
      (msg ? '<p class="memo-state is-bad">' + esc(msg) + "</p>" : "") +
      /* 버튼을 칸 바로 밑에 둔다. 다른 화면처럼 아래(footEl)에 두면 패널이
         길어서 칸에서 600px 쯤 떨어진다 — 두 칸 채우고 나서 한참 내려가
         눌러야 한다 */
      '<div class="memo-btns memo-btns--inline">' +
      '<button type="button" class="memo-in-go">들어가기</button>' +
      '<button type="button" class="memo-cancel">나중에</button>' +
      "</div>" +
      '<p class="memo-hint">쓴 메모에 <b>이름이 자동으로 붙습니다.</b> ' +
      "닉네임을 모르면 관리하는 사람에게 물어보세요.</p>";
    footEl.innerHTML = "";
    editing = null;
    bindLoginKeys();
    var f = bodyEl.querySelector(".memo-in-" + ((keep || (me && me.name)) ? "pass" : "name"));
    if (f) { f.focus(); if (f.select) f.select(); }
  }

  function login() {
    var nameEl = bodyEl.querySelector(".memo-in-name");
    var passEl = bodyEl.querySelector(".memo-in-pass");
    if (!nameEl || !passEl) return;
    var name = nameEl.value.trim(), pass = passEl.value.trim();
    if (!name || !pass) { openLogin("이름과 닉네임을 모두 넣어 주세요"); return; }
    if (!srv) { openSrv(); return; }

    linkState = "busy"; renderLink();
    fetch(srvUrl("do=login"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name, pass: pass })
    }).then(function (r) {
      return r.json().then(function (d) { return { ok: r.ok, d: d }; });
    }).then(function (o) {
      if (!o.ok || !o.d || !o.d.token) {
        linkState = "out"; renderLink();
        /* 무엇을 보냈는지 되돌려 보여 준다 — 한글 조합이 덜 됐거나 빈칸이
           섞인 것을 본인이 볼 수 있어야 고칠 수 있다. 서버는 이름·닉네임 중
           무엇이 틀렸는지 알려주지 않으므로 이쪽에서 단서를 준다 */
        openLogin(((o.d && o.d.error) || "들어가지 못했습니다") +
                  " (보낸 값 — 이름 「" + name + "」 · 닉네임 「" + pass + "」)",
                  { name: name, pass: pass });
        return;
      }
      saveMe({ name: o.d.name || name, token: o.d.token });
      pull(function () { renderCount(); renderPins(); openList(); });
      startWatching();
    }).catch(function (e) {
      linkState = "out"; renderLink();
      openLogin(why(e));
    });
  }

  function logout() {
    saveMe(null);
    shared = [];
    linkState = srv ? "out" : "off"; linkAt = 0; linkWhy = "";
    renderLink(); renderCount(); renderPins();
    openLogin("");
  }

  /* 닉네임 칸에서 엔터를 누르면 들어간다 — 로그인 화면에서 마우스로
     버튼을 찾아 누르게 하는 것은 번거롭다 */
  function bindLoginKeys() {
    var f = bodyEl.querySelectorAll(".memo-in-name,.memo-in-pass");
    for (var i = 0; i < f.length; i++) {
      f[i].addEventListener("keydown", function (e) {
        // 한글을 조합하는 중(`한` 을 만들다 만 상태)의 엔터는 조합을 끝내려는
        // 것이지 보내려는 것이 아니다. 여기서 보내면 덜 만들어진 글자가 간다
        if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); login(); }
      });
    }
  }

  function openSrv() {
    bodyEl.innerHTML =
      '<p class="memo-target">메모를 모을 서버</p>' +
      '<label class="memo-field">주소<input type="url" class="memo-srv-url" placeholder="https://…workers.dev" value="' +
      esc(srv ? srv.url : "") + '"></label>' +
      (me && me.name ? '<p class="memo-hint"><b>' + esc(me.name) + '</b> 으로 들어와 있습니다. 쓰는 메모에 이 이름이 붙습니다.</p>' : "") +
      '<p class="memo-hint">주소는 <b>이 브라우저에만</b> 저장됩니다. 저장소에는 넣지 않습니다. ' +
      '들어가는 것은 <b>이름과 닉네임</b>이 맡습니다 — 열쇠를 다룰 일은 없습니다.</p>';
    footEl.innerHTML =
      '<div class="memo-btns">' +
      '<button type="button" class="memo-srv-save">연결</button>' +
      '<button type="button" class="memo-cancel">취소</button>' +
      (srv ? '<button type="button" class="memo-srv-link">보낼 링크 복사</button>' : "") +
      (me ? '<button type="button" class="memo-out">나가기</button>' : "") +
      (srv ? '<button type="button" class="memo-srv-off">끊기</button>' : "") +
      "</div>";
    editing = null;
    view = "srv";
  }

  /* 보낼 링크 — **주소만** 담는다. 받은 사람은 열고 자기 이름·닉네임으로
     들어온다. 열쇠를 담지 않으므로 이 링크가 새어도 글을 넣을 수 없다
     (예전에는 `주소|열쇠` 였다 — 링크 하나가 곧 통과증이었다) */
  function shareLink() {
    if (!srv) return;
    var base = location.origin + location.pathname;
    // 페이지에 이미 그 주소가 박혀 있으면 **주소만 담을 이유가 없다** —
    // 그냥 페이지 링크를 준다. 받은 사람은 열고 로그인만 하면 된다
    if (pageSrv() === srv.url) return base;
    return base + "?memo=" + encodeURIComponent(srv.url);
  }

  /* 내 메모를 **이 브라우저에서만** 비운다. 서버 것은 건드리지 않는다.
     ▸ 왜 서버를 안 지우나 — 이미 올라간 메모는 다른 사람도 보고 있는 것이라,
       한 사람이 자기 브라우저를 정리하려다 남의 화면까지 비우면 안 된다.
       한 건을 정말 취소하려면 그 메모를 열어 「삭제」를 누른다(그건 서버에서도 지운다).
     ▸ 서버에 붙어 있으면 비운 뒤에도 그 메모들이 「공유」로 다시 내려온다 —
       내 것에서 남의 것으로 자리만 바뀌는 셈이다 */
  function clearMine(silent) {
    if (!notes.length) return;
    if (!silent) {
      var msg = "내가 쓴 메모 " + notes.length + "개를 이 브라우저에서 비웁니다.\n\n" +
        "휴지통에 들어가니 되살릴 수 있습니다." +
        (srv ? "\n서버에 올라간 것은 지워지지 않고 「공유」 메모로 다시 보입니다." : "");
      if (!confirm(msg)) return;
    }
    toTrash(notes);
    notes = [];
    save();
    openList();
  }

  /* 휴지통 — 지운 메모를 되살리는 곳 */
  function openTrash() {
    var rows = trash.length
      ? trash.slice().reverse().map(function (n) {
          return '<li class="memo-item" data-id="' + n.id + '">' +
            '<span class="memo-no is-trash">·</span>' +
            "<div><b>" + esc(n.text) + "</b>" +
            '<span class="memo-meta">' + esc((n.__trashedAt || "").slice(0, 16).replace("T", " ")) +
            " 지움 · " + esc(n.section ? n.section + " · " : "") + esc(n.label) + "</span></div>" +
            '<button type="button" class="memo-undo" data-id="' + n.id + '">되살리기</button></li>';
        }).join("")
      : '<li class="memo-empty">휴지통이 비어 있습니다.</li>';
    bodyEl.innerHTML = '<ul class="memo-list">' + rows + "</ul>";
    footEl.innerHTML =
      '<div class="memo-btns">' +
      '<button type="button" class="memo-cancel">목록으로</button>' +
      (trash.length ? '<button type="button" class="memo-trash-empty">휴지통 비우기</button>' : "") +
      "</div>" +
      '<p class="memo-hint">지운 메모는 여기에 최대 ' + TRASH_MAX + '개까지 남습니다. ' +
      '되살리면 내 메모로 돌아가고, 서버에 붙어 있으면 다시 올라갑니다.</p>';
    view = "trash";
  }

  function exportJson() {
    var data = JSON.stringify(pack(), null, 2);
    var d = new Date(), p = function (v) { return ("0" + v).slice(-2); };
    var name = "컴포넌트-메모-" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + ".json";
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function importJson(file) {
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var d = JSON.parse(fr.result);
        if (!d || !d.notes) throw 0;
        // 같은 id 는 덮어쓰고 나머지는 뒤에 붙입니다 — 두 사람 것을 합칠 수 있게
        d.notes.forEach(function (n) {
          var i = -1;
          for (var k = 0; k < notes.length; k++) if (notes[k].id === n.id) { i = k; break; }
          if (i >= 0) notes[i] = n; else notes.push(n);
        });
        for (var q = 0; q < d.notes.length; q++) push(d.notes[q]);
        save(); openList();
      } catch (e) {
        alert("메모 파일이 아닌 것 같습니다. 「JSON 내보내기」로 만든 파일을 넣어 주세요.");
      }
    };
    fr.readAsText(file);
  }

  /* ── 껍데기 ────────────────────────────────────────────── */
  /* 없는 값을 `String()` 에 넣으면 화면에 "undefined" 가 그대로 찍힌다.
     서버에서 온 메모는 어떤 화면이 만든 것인지 모르니 칸이 빌 수 있다 */
  function esc(s) {
    if (s === null || s === undefined) return "";
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function build() {
    api = window.catInspect || null;

    layer = document.createElement("div");
    layer.className = "memo-layer";
    document.body.appendChild(layer);

    var panel = api && api.panel();
    if (!panel) return;                     // 검사기가 없으면 메모도 안 붙입니다

    /* 검사 패널의 **오른쪽 열**로 들어갑니다. 넓은 화면이면 나란히,
       좁으면 CSS 가 아래로 내려 쌓습니다 */
    col = document.createElement("div");
    col.className = "insp-col insp-col--memo";
    col.innerHTML =
      '<div class="memo-head"><h2>메모</h2><span class="memo-count"></span>' +
        '<button type="button" class="memo-link-state"></button></div>' +
      '<div class="memo-body"></div>' +
      '<div class="memo-foot"></div>';
    panel.appendChild(col);

    countBtn = col.querySelector(".memo-count");
    bodyEl = col.querySelector(".memo-body");
    footEl = col.querySelector(".memo-foot");

    /* 여는 버튼 — 검사 버튼 옆에 나란히 선다 */
    toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "memo-toggle";
    toggleBtn.setAttribute("aria-pressed", "false");
    toggleBtn.title = "고칠 곳에 핀을 꽂아 메모를 남깁니다";
    toggleBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M12 3c-3.6 0-6.5 2.5-6.5 5.6 0 3.4 3.6 6.9 5.8 8.8a1 1 0 0 0 1.4 0c2.2-1.9 5.8-5.4 5.8-8.8C18.5 5.5 15.6 3 12 3Z" ' +
      'stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' +
      '<circle cx="12" cy="8.6" r="2.2" fill="currentColor"/></svg>' +
      "<span>메모</span><span class=\"memo-badge\"></span>";
    api.dock().appendChild(toggleBtn);
    badgeEl = toggleBtn.querySelector(".memo-badge");

    load(); loadSrv();
    if (pendingReset) {
      var had = notes.length;
      clearMine(true);                       // 물어보지 않는다 — 링크가 이미 뜻을 담고 있다
      srvState = had ? "이 브라우저의 내 메모 " + had + "개를 비웠습니다" : "비울 메모가 없었습니다";
    }
    renderCount(); renderPins(); openListOrLogin();
    bind(panel);
    // 남이 쓴 메모는 네트워크라 늦게 온다. 오면 다시 그린다
    pull(function () { renderCount(); renderPins(); openListOrLogin(); });
  }

  function bind(panel) {
    toggleBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      api.setMode("memo");
    });
    api.onMode(function (m) {
      toggleBtn.setAttribute("aria-pressed", m === "memo" ? "true" : "false");
    });

    /* 고정된 요소가 바뀌면 —
       ▸ 메모 모드면 **바로 쓰기로 들어간다.** 고르고 나서 「＋ 메모」를 또
         누르게 하면 두 번 일하는 것이 된다. 다만 쓰던 글이 있으면 덮지 않는다
       ▸ 검사 모드면 「＋ 메모」 버튼만 끼워 넣는다 — 값을 보다가 메모로
         넘어갈 길은 남겨 둔다 */
    api.onPin(function (el) {
      var old = col.querySelector(".memo-add");
      if (old) old.remove();
      if (!el) return;

      if (api.getMode() === "memo") {
        // 쓰던 글이 있으면 지킨다. 빈 쓰기창은 새 대상으로 갈아 준다 —
        // 안 그러면 다른 요소를 골랐는데 이전 대상에 쓰게 된다
        var ta = bodyEl.querySelector(".memo-text");
        if (view === "edit" && ta && ta.value.trim()) return;
        openEditor(null, el);
        return;
      }
      var b = document.createElement("button");
      b.type = "button";
      b.className = "memo-add";
      b.textContent = "＋ 메모";
      col.querySelector(".memo-head").appendChild(b);
    });

    panel.addEventListener("click", function (e) {
      var t = e.target;
      if (!t.closest) return;

      if (t.closest(".memo-link-state")) {
        e.stopPropagation();
        // 로그인이 필요하면 로그인으로, 이미 들어와 있으면 설정(끊기·바꾸기)으로
        if (linkState === "out") openLogin("");
        else openSrv();
        return;
      }
      if (t.closest(".memo-in-go")) { login(); return; }
      if (t.closest(".memo-relogin")) { openLogin(""); return; }
      if (t.closest(".memo-out")) { logout(); return; }
      if (t.closest(".memo-add")) { e.stopPropagation(); openEditor(null, api.getPinned()); return; }
      if (t.closest(".memo-save")) { commit(); return; }
      // 관문을 거치지 않는다 — 「나중에」를 눌렀는데 또 로그인이 뜨면 갇힌다
      if (t.closest(".memo-cancel")) { openList(); return; }
      if (t.closest(".memo-del")) {
        var gone = notes.filter(function (x) { return x.id === editing; });
        toTrash(gone);                      // 서버에서는 지우지만 휴지통에는 남는다
        drop(editing);
        notes = notes.filter(function (x) { return x.id !== editing; });
        save(); openList(); return;
      }
      if (t.closest(".memo-srv")) { openSrv(); return; }
      if (t.closest(".memo-srv-save")) {
        var u = col.querySelector(".memo-srv-url").value.trim();
        if (!/^https:\/\//.test(u)) { alert("주소는 https:// 로 시작해야 합니다."); return; }
        saveSrv({ url: u });          // 열쇠는 받지 않는다 — 로그인이 대신한다
        renderLink();
        if (bearer()) pull(function () { renderCount(); renderPins(); openList(); });
        else openLogin("");
        startWatching();
        return;
      }
      if (t.closest(".memo-srv-link")) {
        var url = shareLink();
        var done = function (ok) {
          srvState = ok ? "링크를 복사했습니다 — 받은 사람은 열고 자기 이름·닉네임으로 들어옵니다"
                        : "복사가 막혔습니다. 아래 칸의 링크를 직접 복사해 주세요";
          renderFootState();
        };
        try {
          navigator.clipboard.writeText(url).then(function () { done(true); }, function () { done(false); });
        } catch (e) { done(false); }
        // 복사가 막히는 브라우저를 위해 화면에도 띄워 준다
        var box = col.querySelector(".memo-link");
        if (!box) {
          box = document.createElement("input");
          box.className = "memo-link";
          box.readOnly = true;
          col.querySelector(".memo-body").appendChild(box);
        }
        box.value = url;
        box.select();
        return;
      }
      if (t.closest(".memo-srv-off")) {
        saveSrv(null); saveMe(null); srvState = "";
        // 페이지에 기본 주소가 있으면 「끊기」는 로그아웃이 된다 — 주소는
        // 페이지가 알고 있으므로 없앨 수가 없다
        if (pageSrv()) { srv = { url: pageSrv() }; linkState = "out"; }
        else { linkState = "off"; }
        linkAt = 0; linkWhy = ""; shared = [];
        renderLink(); renderCount(); renderPins();
        pull(function () { renderCount(); renderPins(); openList(); });
        return;
      }
      if (t.closest(".memo-showdone")) {
        setShowDone(!showDone);
        renderCount(); renderPins(); openList();
        return;
      }
      if (t.closest(".memo-refresh")) {
        pull(function () { renderCount(); renderPins(); openList(); });
        return;
      }
      if (t.closest(".memo-export")) { exportJson(); return; }
      if (t.closest(".memo-clear")) { clearMine(); return; }
      if (t.closest(".memo-trash")) { openTrash(); return; }
      if (t.closest(".memo-trash-empty")) {
        if (confirm("휴지통의 " + trash.length + "개를 완전히 지웁니다. 이제는 되돌릴 수 없습니다.")) {
          trash = []; saveTrash(); openList();
        }
        return;
      }
      var undo = t.closest(".memo-undo");
      if (undo) {
        var uid2 = undo.getAttribute("data-id"), back = null;
        for (var z = 0; z < trash.length; z++) if (trash[z].id === uid2) { back = trash.splice(z, 1)[0]; break; }
        if (back) {
          delete back.__trashedAt;
          var dup = false;
          for (var y = 0; y < notes.length; y++) if (notes[y].id === back.id) { notes[y] = back; dup = true; break; }
          if (!dup) notes.push(back);
          saveTrash(); save(); push(back); openTrash();
        }
        return;
      }
      var go = t.closest(".memo-go");
      if (go) {
        var id = go.getAttribute("data-id"), n = null, L = all();
        for (var i = 0; i < L.length; i++) if (L[i].id === id) { n = L[i]; break; }
        var el = n && api.resolve(n.sel);
        if (!el) { alert("그 요소를 찾지 못했습니다. 마크업이 바뀐 것 같습니다."); return; }
        el.scrollIntoView({ block: "center" });
        api.pin(el);
        setTimeout(function () { openEditor(n, el); }, 60);
      }
    });

    panel.addEventListener("change", function (e) {
      var f = e.target.closest && e.target.closest(".memo-import");
      if (f && e.target.files && e.target.files[0]) importJson(e.target.files[0]);
    });

    // 핀을 누르면 그 메모가 열립니다
    layer.addEventListener("click", function (e) {
      var p = e.target.closest(".memo-pin");
      if (!p) return;
      var id = p.getAttribute("data-id"), n = null, L = all();
      for (var i = 0; i < L.length; i++) if (L[i].id === id) { n = L[i]; break; }
      if (!n) return;
      var el = api.resolve(n.sel);
      if (el) api.pin(el);
      openEditor(n, el);
    });

    // 창 크기가 바뀌면 핀도 따라갑니다
    var t = 0;
    addEventListener("resize", function () {
      clearTimeout(t); t = setTimeout(renderPins, 150);
    });
    addEventListener("load", renderPins);

    // 표시를 먼저 세운다 — pull 이 끝나기 전에도 「확인 중」이 보여야 한다
    linkState = !srv ? "off" : (bearer() ? "busy" : "out");
    renderLink();

    startWatching();
  }

  /* ── 남이 쓴 메모를 알아서 받아 온다 ─────────────────────
     서버에 붙어 있으면 30초마다, 그리고 이 탭으로 돌아올 때마다 확인한다.
     ▸ 배경 탭에서는 쉰다 — 보고 있지도 않은 화면을 위해 통신할 이유가 없다
     ▸ **메모를 쓰고 있는 중에는 화면을 갈지 않는다.** 목록을 다시 그리면
       입력 중인 글이 날아간다. 그때는 개수와 핀만 조용히 갱신한다
     ▸ 바뀐 게 없으면 아무것도 다시 그리지 않는다
     ──────────────────────────────────────────────────────── */
  var WATCH_MS = 30000;
  var watchTimer = 0;

  function fingerprint(list) {
    var out = [];
    for (var i = 0; i < list.length; i++) out.push(list[i].id + ":" + (list[i].at || "") + ":" + (list[i].text || "").length);
    return out.sort().join("|");
  }

  function refresh(opts) {
    if (!srv) return;
    var before = fingerprint(shared);
    pull(function () {
      var changed = fingerprint(shared) !== before;
      renderCount();
      if (changed) renderPins();
      // 목록·휴지통 화면일 때만 다시 그린다. 쓰던 글은 지키다
      if (changed && (view === "list")) openList();
      else renderFootState();
      if (changed && (opts && opts.tell)) {
        srvState = "새 메모가 왔습니다";
        renderFootState();
      }
    });
  }

  function startWatching() {
    clearInterval(watchTimer);
    watchTimer = setInterval(function () {
      renderLink();                        // 「3분 전」이 멈춰 있으면 오해를 준다
      if (!srv || document.hidden) return;
      refresh({ tell: true });
    }, WATCH_MS);

    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) refresh({ tell: true });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else build();
})();


/* ─── src/annotations.js ─────────────────────────────── */
/* ============================================================
   설명 켜고 끄기 — 카탈로그 전용 문서 UI
   컴포넌트가 아니다. 실제 사이트에는 들어가지 않는다.

   카탈로그에는 값의 출처·판단 근거를 적은 글이 컴포넌트마다 붙어 있다
   (`.desc` `.src` `.note` `.spec`). 개발할 때는 그게 본체지만,
   **모양만 보려는 사람에게는 방해**다. 그래서 껐다 켤 수 있게 했다.

   ▸ 기본은 **꺼짐**이다. 처음 여는 사람은 컴포넌트만 깔끔하게 본다.
   ▸ 깜빡임을 막으려고 `카탈로그.html` 의 <html> 에 `hide-notes` 를 미리
     박아 뒀다. 이 스크립트는 저장된 선택이 「켬」일 때 그것을 뗀다.
   ▸ 선택은 브라우저에 남는다(localStorage). 페이지를 옮겨도 유지된다.

   **무엇을 감출지는 페이지가 정한다.** 이 스크립트는 <html> 에
   `hide-notes` 클래스를 붙이고 떼는 일만 한다. 페이지 쪽 CSS 에 이렇게 적는다.

       .hide-notes .내가-감출-것 { display: none }

   그래서 도구는 페이지의 클래스 이름을 몰라도 되고, 페이지는 버튼을
   직접 만들지 않아도 된다.
   ============================================================ */
(function () {
  "use strict";

  var KEY = "crissit-catalog-notes";
  var root = document.documentElement;
  var btn;

  function on() { return !root.classList.contains("hide-notes"); }

  function set(v) {
    root.classList.toggle("hide-notes", !v);
    try { localStorage.setItem(KEY, v ? "on" : "off"); } catch (e) { /* 저장이 막힌 경우 */ }
    if (btn) {
      btn.setAttribute("aria-pressed", v ? "true" : "false");
      btn.classList.toggle("is-on", v);
      btn.title = v ? "설명을 감춥니다" : "값의 출처와 판단 근거를 보여줍니다";
    }
    // 메모 핀은 문서 높이를 따라 놓이므로 다시 그려야 한다
    if (window.dispatchEvent) window.dispatchEvent(new Event("resize"));
  }

  function build() {
    var api = window.catInspect;
    var dock = api && api.dock();
    if (!dock) return;                       // 검사기가 없으면 이 버튼도 안 붙인다

    btn = document.createElement("button");
    btn.type = "button";
    btn.className = "notes-toggle";
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M5 4h11l3 3v13H5V4Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M8.5 11h7M8.5 15h4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
      "</svg><span>설명</span>";
    dock.insertBefore(btn, dock.firstChild);
    btn.addEventListener("click", function (e) { e.stopPropagation(); set(!on()); });

    var saved;
    try { saved = localStorage.getItem(KEY); } catch (e) { saved = null; }
    set(saved === "on");                     // 저장된 값이 없으면 꺼짐
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else build();
})();
