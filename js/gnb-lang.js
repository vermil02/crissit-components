/* ============================================================
   언어 선택 — 여닫기
   컴포넌트 `Dropdown_list` (2053:58997) 의 동작.
   모양은 css/dropdown.css 의 `.dd-lang` 이 담당한다.

   ⚠️ 이 동작은 피그마에 그려져 있지 않다. 컴포넌트는 있는데 **어느 화면에도
      배치돼 있지 않아서**, 무엇으로 열고 언제 닫는지가 설계에 없다.
      아래는 이쪽에서 정한 것이다 — 「확인 필요」에 올려 두었다.
        · 버튼을 누르면 열리고, 다시 누르면 닫힌다
        · 바깥을 누르면 닫힌다
        · Esc 로 닫고 버튼으로 초점을 되돌린다
        · 항목을 고르면 버튼의 글자가 그 언어로 바뀌고 닫힌다
        · 한 화면에 여럿 있으면(GNB + 드로어) 하나만 열려 있다

   ── 붙이는 법 ──────────────────────────────────────────────
   `data-lang` 을 감싸개에 붙이면 끝이다. 마크업은 css/dropdown.css 참고.

   ▸ 실제 사이트에서는 항목을 고를 때 **페이지를 그 언어로 옮겨야** 한다.
     여기서는 표시만 바꾼다 — 주소 규칙이 정해지면 `lang:change` 를 받아
     처리하면 된다.  el.addEventListener('lang:change', e => e.detail.code)
   ============================================================ */
(function () {
  "use strict";

  function close(wrap) {
    if (!wrap.classList.contains("is-open")) return;
    wrap.classList.remove("is-open");
    var b = wrap.querySelector("button[aria-expanded]");
    if (b) b.setAttribute("aria-expanded", "false");
  }
  function closeAll(except) {
    var all = document.querySelectorAll("[data-lang].is-open");
    for (var i = 0; i < all.length; i++) if (all[i] !== except) close(all[i]);
  }

  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t.closest) return;

    // 항목을 골랐다
    var opt = t.closest("[data-lang] .dd-lang > button");
    if (opt) {
      var wrap = opt.closest("[data-lang]");
      var code = opt.textContent.trim();
      var label = wrap.querySelector(".gnb__lang-code, .drawer__lang-code");
      if (label) label.textContent = code;
      var opts = wrap.querySelectorAll(".dd-lang > button");
      for (var i = 0; i < opts.length; i++) {
        opts[i].setAttribute("aria-selected", opts[i] === opt ? "true" : "false");
      }
      close(wrap);
      wrap.dispatchEvent(new CustomEvent("lang:change", { bubbles: true, detail: { code: code } }));
      return;
    }

    // 버튼을 눌렀다
    var btn = t.closest("[data-lang] > button");
    if (btn) {
      var w = btn.closest("[data-lang]");
      var open = !w.classList.contains("is-open");
      closeAll(w);
      w.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      return;
    }

    // 바깥을 눌렀다
    closeAll(null);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var open = document.querySelector("[data-lang].is-open");
    if (!open) return;
    close(open);
    var b = open.querySelector("button[aria-expanded]");
    if (b) b.focus();
  });
})();
