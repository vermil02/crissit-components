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
  var panel, body, hint, detail, hl, hlPad, dock, toggle, probe;
  /* 열마다 따로 켜고 끈다 — 값만 보고 싶을 때가 있고, 메모만 볼 때가 있다.
     둘 중 하나라도 켜져 있으면 요소 고르기(마우스 따라다니기·클릭 고정)는 돈다 */
  var showMain = false, showMemo = false;
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

  function ours(el) { return !!(el && el.closest && el.closest(".insp-panel,.insp-dock")); }

  /* ── 켜고 끄기 ─────────────────────────────────────────── */
  function setShow(which, v) {
    if (which === "main") showMain = v; else showMemo = v;
    apply();
  }
  function apply() {
    on = showMain || showMemo;
    var c = document.documentElement.classList;
    c.toggle("insp-on", on);
    c.toggle("insp-show-main", showMain);
    c.toggle("insp-show-memo", showMemo);
    c.toggle("insp-two", showMain && showMemo);   // 둘 다면 패널이 넓어진다
    toggle.setAttribute("aria-pressed", showMain ? "true" : "false");
    for (var i = 0; i < showListeners.length; i++) {
      try { showListeners[i](showMain, showMemo); } catch (e) { /* 메모 쪽 오류가 검사기를 멈추면 안 된다 */ }
    }
    if (!on) { pinned = hovered = null; hl.style.display = "none"; body.innerHTML = ""; closeDetail(); }
    setHint();
  }
  function setOn(v) { setShow("main", v); }
  function setHint() {
    hint.innerHTML = pinned
      ? '<span class="insp-pin">고정됨</span> ↑ ↓ 로 부모·자식 이동 · Esc 로 풀기'
      : "요소 위에 마우스를 올리면 값이 나옵니다. 클릭하면 고정됩니다";
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

    toggle = document.createElement("button");
    toggle.className = "insp-toggle";
    toggle.type = "button";
    toggle.setAttribute("aria-pressed", "false");
    toggle.title = "요소의 글꼴·색·여백을 오른쪽에 보여줍니다 (마우스가 올라간 상태의 값이라 hover 값이 나옵니다)";
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

    hl = document.createElement("div");
    hl.className = "insp-hl";
    hlPad = document.createElement("div");
    hlPad.className = "insp-hl__pad";
    hl.appendChild(hlPad);

    dock.appendChild(toggle);
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
    toggle.addEventListener("click", function (e) { e.stopPropagation(); setShow("main", !showMain); });

    document.addEventListener("mousemove", function (e) {
      if (!on || pinned) return;
      var el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || ours(el) || el === hovered) return;
      hovered = el;
      render(el);
      queue();
    });

    // 검사 중에는 클릭을 고정에 쓴다 — 링크가 눌리면 페이지가 바뀌어 버린다
    document.addEventListener("click", function (e) {
      if (!on || ours(e.target)) return;
      e.preventDefault(); e.stopPropagation();
      pinned = (pinned === e.target) ? null : e.target;
      if (pinned) render(pinned);
      setHint();
      queue();
    }, true);

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
        if (pinned) { pinned = null; setHint(); queue(); } else setOn(false);
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
    isOn: function () { return on; },
    /* 열을 켜고 끈다 — 메모 버튼이 이걸 쓴다 */
    show: function (which, v) { setShow(which, v); },
    isShown: function (which) { return which === "main" ? showMain : showMemo; },
    onShow: function (fn) { showListeners.push(fn); },
    dock: function () { return dock; },
    pin: function (el) { if (!on) setOn(true); pinned = el; render(el); setHint(); queue(); },
    getPinned: function () { return pinned; },
    /* 요소가 고정될 때마다 알린다 — 메모 창이 대상을 따라가야 하므로 */
    onPin: function (fn) { pinListeners.push(fn); },
    panel: function () { return panel; }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else build();
})();
