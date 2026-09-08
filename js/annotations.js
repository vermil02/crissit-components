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

   숨기지 않는 것 — 절 제목(h2)·카드 제목(h3)·표(.tk)·행 이름(.lbl).
   그건 설명이 아니라 내용이다.
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
