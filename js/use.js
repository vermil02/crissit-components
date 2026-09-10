/* ============================================================
   쓰임 — 「우리 웹사이트가 실제로 붙인 것」만 보이게 한다

   이 카탈로그는 피그마에 있는 것을 **전부** 옮겨 놓은 라이브러리다.
   라이브러리와 실사용 목록은 다르다 — 2026-09-09 첫 조사에서 보여주는 것 중
   **38%가 어느 화면에도 없었다**(아이콘 47 · 배지 4 · 버튼·칩 변형 20여).

   무엇을 쓰는지는 `쓰임.json` 이 정하고, 그 파일은 `쓰임-조사.py` 가 화면 마크업에서
   세어 만든다. **여기에 목록을 박아 두지 않는다** — 화면이 늘고 줄면 곧바로 썩는다.
   클래스를 가리는 규칙(머리·제외)도 그 파일에서 받는다. 양쪽에 따로 적었다가
   어긋나서 `has-overlay` 가 미사용으로 잡힌 일이 있다(2026-09-10).

   ── 무엇을 근거로 판정하나 ─────────────────────────────────
   절마다 **주 가족**을 자동으로 정한다 — 그 절의 데모에 가장 많이 나오는 클래스 머리다
   (Icon Button 절이면 `ibtn`, 아이콘 절이면 `i-`, Board list 면 `bl`).
   그리고 **주 가족 클래스만** 보고 판정한다.

     <button class="ibtn ibtn--outlined ibtn--lg has-overlay">
       → 볼 것은 `ibtn ibtn--outlined ibtn--lg` 뿐이다.
         `has-overlay` 나 `icon--24` 같은 곁 클래스는 판정에 넣지 않는다 —
         카탈로그가 데모를 세우려고 붙인 것이라 화면과 다를 수 있다.

   규칙 둘

     ① 주 가족 클래스 중 **어느 화면에도 없는 것이 하나라도 있으면** 안 쓴다.
        예) `btn--lg` 는 어느 화면도 안 쓴다 → 그 버튼 데모는 안 쓰는 것이다.

     ② 클래스는 다 쓰이는데 **화면이 늘 더 구체적인 판을 쓰면** 안 쓴다.
        예) 카탈로그의 `bl bl-h`(사진 176×122)는 피그마에서 채용해 온 판이고,
            보도자료 목록은 늘 `bl bl-h bl-h--wide`(사진 300×180)를 쓴다.
            클래스만 보면 `bl-h` 가 쓰이니 ①로는 안 걸린다 — 그래서 ②가 필요하다.

   ⚠ 「안 쓴다」와 「아직 안 만들었다」를 가른다. 화면 등급이 `확정아님`
      (파트너사·연혁)인 곳에서만 쓰이면 노란 「예정」 배지가 붙고 접히지 않는다.
   ⚠ 접을 때 **개수를 말해 준다.** 조용히 사라지면 빠뜨린 것처럼 보인다.
   ⚠ 데모는 `.card` 와 **`.frame`** 안에 있다. 처음에 `.card` 만 보다가 푸터·GNB·드로어가
      통째로 판정에서 빠져 「어느 화면도 안 씀」으로 나왔다(2026-09-10).
   ============================================================ */
(function () {
  var bar = document.getElementById("use-bar");
  if (!bar) return;

  /* `cache:"no-store"` 로 받는다 — 이 파일은 화면이 늘 때마다 바뀌는 **데이터**다.
     `?v=` 를 붙이는 방식이면 조사기를 돌린 뒤 여기 숫자도 같이 바꿔야 하고,
     잊으면 브라우저가 옛 표를 계속 쓴다(2026-09-10 에 실제로 겪었다 — 규칙이 안 와서
     아무것도 판정되지 않았다). css·js 와 달리 이 파일은 작아서 매번 받아도 된다. */
  Promise.all([
    fetch("쓰임.json", { cache: "no-store" }).then(ok),
    /* 상태 선언 — 「이전판(v1) → 후속(v2)」 처럼 **측정으로 알 수 없는 판단**이 여기 있다.
       없어도 돌아간다(측정만으로 접는다) */
    fetch("상태.json", { cache: "no-store" }).then(ok).catch(function () { return {}; })
  ])
    .then(function (a) { run(a[0], a[1]); })
    .catch(function (e) {
      // 표가 없으면 아무것도 숨기지 않는다 — 카탈로그는 그대로 다 보인다
      console.warn("[쓰임] 쓰임.json 을 못 읽었다:", e.message, "— 전부 보이는 상태로 둔다");
    });

  function ok(r) { if (!r.ok) throw new Error(r.status); return r.json(); }

  function run(data, decl) {
    var declared = (decl && decl["변형"]) || {};
    var uses    = data["쓰임"]  || {};
    var screens = data["화면"]  || {};
    var rule    = data["규칙"]  || {};
    var runtime = data["런타임"] || {};      // 스크립트가 붙였다 떼는 클래스
    var stems   = (rule["머리"] || []).slice().sort(function (a, b) { return b.length - a.length; });
    var skips   = rule["제외"] || [];

    /* 조사기와 **같은 규칙**으로 컴포넌트 클래스를 가린다.
       카탈로그 화면 자체의 클래스(.card·.sec·.demo-* 등)는 여기서 더 뺀다 */
    var CAT_ONLY = /^(demo-|use-|frame|card$|sec$|toc|cat__|on-dark$|on-img$|sw$|tk$|desc$|note$|spec$|src$|aside$|when$|what$|grp$|row$)/;
    function stemOf(c) {
      for (var i = 0; i < stems.length; i++) {
        var s = stems[i];
        if (c === s || c.indexOf(s) === 0) return s;
      }
      return null;
    }
    function isComponent(c) {
      for (var i = 0; i < skips.length; i++) if (c.indexOf(skips[i]) === 0) return false;
      if (CAT_ONLY.test(c)) return false;
      return !!stemOf(c);
    }
    function compClasses(el) {
      var out = [];
      for (var i = 0; i < el.classList.length; i++) {
        if (isComponent(el.classList[i])) out.push(el.classList[i]);
      }
      return out;
    }

    /* 화면 쪽 가족 서명 — "가족 안에서 함께 붙은 클래스"를 정렬해 이은 것.
       **스크립트가 붙였다 떼는 클래스는 뺀다.** 그것까지 넣으면 서명이 실행 중 상태에
       묶여서, 카탈로그가 보여주는 정지 상태와 안 맞는다 — `gnb gnb--black` 데모가
       화면의 `gnb gnb--black gnb--transparent` 에 밀려 잘못 접혔다(2026-09-10). */
    function stripRuntime(list) {
      return list.filter(function (c) { return !runtime[c]; });
    }
    var screenSig = {};                       // 가족 → { 서명: true }
    Object.keys(data["조합"] || {}).forEach(function (k) {
      var byFam = {};
      stripRuntime(k.split(" ")).forEach(function (c) {
        var f = stemOf(c);
        if (!f) return;
        (byFam[f] = byFam[f] || []).push(c);
      });
      Object.keys(byFam).forEach(function (f) {
        (screenSig[f] = screenSig[f] || {})[byFam[f].sort().join(" ")] = true;
      });
    });

    function grade(names) {                   // 쓰는 화면 중 가장 센 등급
      var g = null;
      (names || []).forEach(function (n) {
        var m = screens[n];
        if (!m) return;
        if (m["등급"] === "정식") g = "정식";
        else if (g !== "정식") g = "확정아님";
      });
      return g;
    }

    /* 절의 주 가족 — **카탈로그.html 의 `data-use-family` 가 정한다.**
       처음에는 「데모에 가장 많이 나오는 머리」로 추정했는데 계속 틀렸다(2026-09-10 실측) —
       「디자인 토큰」 절이 `btn`, GNB·드로어가 안쪽 아이콘 때문에 `icon`, Pagination 이
       화살표 때문에 `ibtn` 으로 잡혔다. 절의 정체는 **안 바뀌는 것**이라 한 번 적는 편이 맞다.
       (썩는 것은 「무엇을 쓰는가」이고 그건 여전히 조사기가 센다.)
       빈 값은 「판정하지 않는다」 — 토큰·타이포·화면 조립용·확인 필요 절이 그렇다. */
    function mainFamily(sec) {
      var f = sec.getAttribute("data-use-family");
      if (f === null) {
        console.warn("[쓰임] data-use-family 가 없는 절:", sec.id, "— 판정하지 않는다");
        return null;
      }
      return f || null;
    }

    /* 요소 하나 → "정식" | "확정아님" | {off, 이유} | null(판정 안 함) */
    function judge(el, fam, ignore) {
      var own = compClasses(el).filter(function (c) {
        return stemOf(c) === fam && ignore.indexOf(c) === -1;
      });
      if (!own.length) return null;
      own.sort();

      /* ⓪ 손으로 선언한 상태가 있으면 그것이 먼저다 — 측정으로는 「이전판」을 알 수 없다.
            다만 **후속이 함께 붙어 있으면 현행**이다(`bl bl-h bl-h--wide`). */
      for (var d = 0; d < own.length; d++) {
        var dc = declared[own[d]];
        if (!dc) continue;
        var st = dc["상태"];
        if (st === "현행") continue;
        var nxt = dc["후속"];
        if (nxt && own.indexOf(nxt) > -1) continue;
        if (st === "이전판") {
          return { off: true, 상태: "이전판", 후속: nxt,
                   이유: "이전 판입니다 — 대신 <code>." + nxt + "</code> 를 씁니다"
                        + (dc["왜"] ? ". " + dc["왜"] : "") };
        }
        if (st === "예정") return { 상태: "예정", 이유: dc["왜"] || "" };
        if (st === "폐기예정") {
          return { 상태: "폐기예정", 후속: nxt, 이유: dc["왜"] || "" };
        }
        return { off: true, 상태: st, 이유: dc["왜"] || (st + " 이다") };
      }

      var best = "정식";
      for (var i = 0; i < own.length; i++) {                 // ① 클래스가 어디에도 없나
        var g = grade(uses[own[i]]);
        if (!g) return { off: true, 상태: "라이브러리에만",
                         이유: "<code>." + own[i] + "</code> 를 쓰는 화면이 없습니다" };
        if (g === "확정아님") best = "확정아님";
      }

      var core = stripRuntime(own);                           // ② 더 구체적인 판만 쓰나
      if (!core.length) return best;
      var sig = core.join(" ");
      var known = screenSig[fam] || {};
      if (!known[sig]) {
        var sup = Object.keys(known).find(function (k) {
          var b = k.split(" ");
          return core.every(function (x) { return b.indexOf(x) > -1; }) && b.length > core.length;
        });
        if (sup) return { off: true, 상태: "이전판", 후속: sup.split(" ").pop(),
                          이유: "이전 판입니다 — 화면은 늘 <code>." + sup.split(" ").pop()
                                + "</code> 를 함께 씁니다" };
      }
      return best;
    }

    var tally = { on: 0, soon: 0, off: 0 };

    document.querySelectorAll("section.sec").forEach(function (sec) {
      var fam = mainFamily(sec);
      if (!fam) return;                                      // 데모가 없는 절(토큰·타이포·확인 필요)은 건드리지 않는다
      /* 카탈로그가 데모를 세우려고 붙인 클래스는 판정에서 뺀다 — 절의 `data-use-ignore`.
         예) `.drawer--inline` 은 fixed 드로어를 액자 안에 세우려고 쓴 것이라
             화면에 없는 것이 당연하다 */
      var ignore = (sec.getAttribute("data-use-ignore") || "").split(/\s+/).filter(Boolean);

      /* ① 개별 데모 요소 */
      sec.querySelectorAll(".card *, .frame *, .iconset *").forEach(function (el) {
        if (el.closest("[data-use-judged]")) return;         // 부모가 이미 판정됐다
        var v = judge(el, fam, ignore);
        if (!v) return;
        if (typeof v === "string") {
          el.setAttribute("data-use-judged", v);
          tally[v === "정식" ? "on" : "soon"]++;
          return;
        }
        if (v.off) {
          el.setAttribute("data-use-judged", "off");
          el.setAttribute("data-use-off", "");
          el.setAttribute("data-use-why", v["이유"]);
          if (v["상태"]) el.setAttribute("data-use-state", v["상태"]);
          tally.off++;
        } else {
          // 예정·폐기예정은 **접지 않는다** — 「안 쓴다」와 다른 뜻이다
          el.setAttribute("data-use-judged", "확정아님");
          if (v["상태"]) el.setAttribute("data-use-state", v["상태"]);
          if (v["이유"]) el.setAttribute("data-use-why", v["이유"]);
          tally.soon++;
        }
      });

      /* 아이콘 타일은 `<span>` 껍데기째 접는다 */
      sec.querySelectorAll(".iconset > span").forEach(function (span) {
        var ic = span.querySelector("[data-use-judged]");
        if (!ic) return;
        var v = ic.getAttribute("data-use-judged");
        span.setAttribute("data-use-judged", v);
        var why = ic.getAttribute("data-use-why");
        if (why) span.setAttribute("data-use-why", why);      // 이유·상태도 같이 옮긴다
        var stt = ic.getAttribute("data-use-state");
        if (stt) span.setAttribute("data-use-state", stt);
        if (v === "off") { span.setAttribute("data-use-off", ""); ic.removeAttribute("data-use-off"); }
      });

      /* ② 데모 묶음 — `.card` 와 `.frame` 둘 다다 (푸터·GNB·드로어는 액자만 쓴다).
            머리는 카드면 `> h3`, 액자면 `.frame__cap` 이다 */
      sec.querySelectorAll(".card, .frame").forEach(function (card) {
        var on   = card.querySelectorAll('[data-use-judged="정식"]').length;
        var soon = card.querySelectorAll('[data-use-judged="확정아님"]').length;
        var off  = card.querySelectorAll('[data-use-judged="off"]').length;
        if (!(on + soon + off)) return;                      // 판정할 실물이 없는 카드(표·설명)는 그대로
        var h3 = card.querySelector(":scope > h3") || card.querySelector(":scope > .frame__cap");
        if (!on && !soon) {
          card.setAttribute("data-use-off", "");
          var src = card.querySelector("[data-use-why]");
          var why = src ? src.getAttribute("data-use-why") : "";
          var state = src ? src.getAttribute("data-use-state") : null;
          /* 라벨을 상태별로 갈라 적는다 — 「안 씀」 하나로는 성질이 다른 셋이 같아 보인다.
             `이전판`(우리가 갈아탄 v1) · `라이브러리에만`(피그마에 있고 안 고른 것) */
          if (h3) h3.appendChild(tag("off",
            state === "이전판" ? "v1 · 이전 판" :
            state === "라이브러리에만" ? "라이브러리에만" : "안 씀"));
          /* 이유는 `.use-why` — 접힘 안내(`.use-hidden`)와 달리 「전부」 모드에서도 보인다.
             흐려진 판을 보고 있는 사람에게 필요한 것은 「왜」이기 때문이다 */
          if (h3 && why) h3.insertAdjacentHTML("afterend",
            '<p class="use-why">' +
            (state === "이전판" ? "" :
             state === "라이브러리에만" ? "피그마에 있고 우리 시안에는 없습니다 — " :
             "어느 화면도 안 씁니다 — ") + why + '.</p>');
          return;
        }
        if (off) {
          var prev = card.querySelectorAll('[data-use-state="이전판"]').length;
          if (h3) h3.appendChild(tag("off",
            prev ? ("이전 판 " + prev + "개" + (off > prev ? " · 안 쓰는 변형 " + (off - prev) + "개" : ""))
                 : ("안 쓰는 변형 " + off + "개")));
          var p = document.createElement("p");
          p.className = "use-hidden";
          p.innerHTML = (prev ? "이전 판 <b>" + prev + "개</b>" +
                                 (off > prev ? " · 안 쓰는 변형 <b>" + (off - prev) + "개</b>" : "")
                              : "안 쓰는 변형 <b>" + off + "개</b>") +
            "를 접었습니다. " + '<button type="button" data-use-mode="all">전부 보기</button>';
          card.appendChild(p);
        }
      });

      /* ③ 절 머리 — 주 가족만 보고 쓰는 화면을 적는다 */
      var names = {};
      sec.querySelectorAll('[data-use-judged="정식"], [data-use-judged="확정아님"]').forEach(function (el) {
        compClasses(el).forEach(function (c) {
          if (stemOf(c) !== fam) return;
          (uses[c] || []).forEach(function (n) { names[n] = 1; });
        });
      });
      var list = Object.keys(names).sort();
      var h2 = sec.querySelector(":scope > h2");
      if (!h2) return;
      if (!list.length) {
        sec.setAttribute("data-use-off", "");
        h2.appendChild(tag("off", "어느 화면도 안 씀"));
        return;
      }
      var onlySoon = list.every(function (n) {
        return screens[n] && screens[n]["등급"] === "확정아님";
      });
      h2.appendChild(tag(onlySoon ? "soon" : "on",
        (onlySoon ? "예정 · " : "") + list.join(" · ")));
    });

    function tag(kind, text) {
      var el = document.createElement("span");
      el.className = "use-tag use-tag--" + kind;
      el.textContent = text;
      return el;
    }

    /* ④ 토글 */
    bar.hidden = false;
    var prevAll = document.querySelectorAll('[data-use-state="이전판"]').length;
    bar.querySelector("[data-use-count]").innerHTML =
      "현행 <b>" + tally.on + "</b>" +
      " · 예정 <b>" + tally.soon + "</b>" +
      " · 이전 판 <b>" + prevAll + "</b>" +
      " · 라이브러리에만 <b>" + (tally.off - prevAll) + "</b>" +
      " — 조사 " + (data["조사일"] || "") + " · 화면 " + Object.keys(screens).length + "장" +
      " (정식 " + Object.keys(screens).filter(function (n) {
        return screens[n]["등급"] === "정식"; }).length + ")";

    function setMode(m) {
      document.body.setAttribute("data-use", m);
      bar.querySelectorAll("[data-use-mode]").forEach(function (b) {
        b.setAttribute("aria-pressed", String(b.getAttribute("data-use-mode") === m));
      });
      try { localStorage.setItem("crissit-use-mode", m); } catch (e) {}
    }
    document.addEventListener("click", function (e) {
      var b = e.target.closest("[data-use-mode]");
      if (b) setMode(b.getAttribute("data-use-mode"));
    });
    var saved = null;
    try { saved = localStorage.getItem("crissit-use-mode"); } catch (e) {}
    setMode(saved === "all" ? "all" : "only");
  }
})();
