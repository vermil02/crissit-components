/* ============================================================
   메모 — 카탈로그 전용 문서 UI
   컴포넌트가 아니다. 실제 사이트에는 들어가지 않는다.

   무엇을 푸는가
     디자이너가 "여기 이거 고쳐 주세요" 를 말로 전하면 **어디를 말하는지**
     가 늘 애매하다. 그래서 화면의 그 요소에 직접 핀을 꽂아 남기게 했다.
     핀 하나에 그 요소의 선택자·위치·그때의 값(색·글꼴·크기)이 같이 저장된다.

   어디에 쌓이나
     브라우저(localStorage)에 쌓이고, **JSON 파일로 내보내서** 전달한다.
     서버가 없기 때문이다 — 이 카탈로그는 정적 파일 하나로 도는 문서다.
     받은 JSON 은 다시 불러오면 핀이 그대로 되살아난다.

   쓰는 법
     오른쪽 아래 「메모」 버튼 → 화면에서 고칠 곳을 클릭 → 「＋ 메모」
     핀을 누르면 그 메모가 열린다
     메모 열 아래 — JSON 내보내기 · 불러오기 · 전부 지우기

   ▸ 「검사」와 따로 켜진다. 값을 보면서 메모를 쓰려면 둘 다 켜면
     화면이 넓을 때 좌우로 나란히 선다.

   저장 형태 (내보내기 파일)
     {
       "v": 1,
       "page": "카탈로그.html",
       "saved": "2026-09-08T…",
       "notes": [
         { "id": "…", "at": "…", "text": "여기 여백이 좁아요",
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
  var api = null;                 // window.catInspect — 검사기가 없으면 null
  var notes = [];
  var layer, col, bodyEl, footEl, countBtn, toggleBtn, badgeEl;
  var editing = null;             // 지금 쓰고 있는 메모 id (새 메모면 null)
  var target = null;              // 새 메모를 붙일 요소

  /* ── 저장 ──────────────────────────────────────────────── */
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      notes = raw ? (JSON.parse(raw).notes || []) : [];
    } catch (e) { notes = []; }
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

  /* ── 핀 ───────────────────────────────────────────────── */
  function sectionOf(el) {
    var s = el.closest && el.closest("section.sec");
    var h = s && s.querySelector("h2");
    return h ? h.textContent.trim() : "";
  }

  function renderPins() {
    layer.innerHTML = "";
    notes.forEach(function (n, i) {
      var el = api && api.resolve(n.sel);
      if (!el) return;                        // 마크업이 바뀌어 못 찾는 경우
      var r = el.getBoundingClientRect();
      var b = document.createElement("button");
      b.type = "button";
      b.className = "memo-pin" + (n.done ? " is-done" : "");
      b.textContent = i + 1;
      b.title = n.text.slice(0, 60);
      b.style.left = (r.left + scrollX + r.width - 9) + "px";
      b.style.top = (r.top + scrollY - 9) + "px";
      b.setAttribute("data-id", n.id);
      layer.appendChild(b);
    });
  }
  function renderCount() {
    countBtn.textContent = notes.length;
    countBtn.classList.toggle("is-some", notes.length > 0);
    // 열지 않아도 메모가 있는지 보이게 버튼에도 개수를 붙입니다
    if (badgeEl) badgeEl.textContent = notes.length ? String(notes.length) : "";
  }

  /* ── 메모 쓰기 ─────────────────────────────────────────── */
  function openEditor(note, el) {
    editing = note ? note.id : null;
    target = el || (note && api && api.resolve(note.sel)) || null;
    var label = note ? note.label : (target && api ? api.label(target) : "");
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
    openList();
  }

  /* ── 목록 ─────────────────────────────────────────────── */
  function openList() {
    var rows = notes.length
      ? notes.map(function (n, i) {
          return '<li class="memo-item" data-id="' + n.id + '">' +
            '<span class="memo-no">' + (i + 1) + "</span>" +
            "<div><b>" + esc(n.text) + "</b>" +
            '<span class="memo-meta">' + esc(n.section ? n.section + " · " : "") + esc(n.label) + "</span></div>" +
            '<button type="button" class="memo-go" data-id="' + n.id + '">보기</button></li>';
        }).join("")
      : '<li class="memo-empty">아직 메모가 없습니다.<br>화면에서 고칠 곳을 <b>클릭해 고른 뒤</b> 위의 <b>「＋ 메모」</b>를 누르세요.</li>';

    bodyEl.innerHTML = '<ul class="memo-list">' + rows + "</ul>";
    footEl.innerHTML =
      '<div class="memo-btns">' +
      '<button type="button" class="memo-export">JSON 내보내기</button>' +
      '<label class="memo-import">불러오기<input type="file" accept="application/json,.json" hidden></label>' +
      (notes.length ? '<button type="button" class="memo-clear">전부 지우기</button>' : "") +
      "</div>" +
      '<p class="memo-hint">메모는 이 브라우저에만 쌓입니다. <b>JSON 으로 내보내 전달</b>하시면 받는 쪽에서 불러와 핀까지 그대로 볼 수 있습니다.</p>';
    editing = null;
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
        save(); openList();
      } catch (e) {
        alert("메모 파일이 아닌 것 같습니다. 「JSON 내보내기」로 만든 파일을 넣어 주세요.");
      }
    };
    fr.readAsText(file);
  }

  /* ── 껍데기 ────────────────────────────────────────────── */
  function esc(s) {
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
      '<div class="memo-head"><h2>메모</h2><span class="memo-count"></span></div>' +
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

    load(); renderCount(); renderPins(); openList();
    bind(panel);
  }

  function bind(panel) {
    toggleBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      api.show("memo", !api.isShown("memo"));
    });
    api.onShow(function (main, memo) {
      toggleBtn.setAttribute("aria-pressed", memo ? "true" : "false");
    });

    // 고정된 요소가 바뀌면 메모 머리에 「＋ 메모」를 끼워 넣습니다
    api.onPin(function (el) {
      var old = col.querySelector(".memo-add");
      if (old) old.remove();
      if (!el) return;
      var b = document.createElement("button");
      b.type = "button";
      b.className = "memo-add";
      b.textContent = "＋ 메모";
      col.querySelector(".memo-head").appendChild(b);
    });

    panel.addEventListener("click", function (e) {
      var t = e.target;
      if (!t.closest) return;

      if (t.closest(".memo-add")) { e.stopPropagation(); openEditor(null, api.getPinned()); return; }
      if (t.closest(".memo-save")) { commit(); return; }
      if (t.closest(".memo-cancel")) { openList(); return; }
      if (t.closest(".memo-del")) {
        notes = notes.filter(function (x) { return x.id !== editing; });
        save(); openList(); return;
      }
      if (t.closest(".memo-export")) { exportJson(); return; }
      if (t.closest(".memo-clear")) {
        if (confirm("메모 " + notes.length + "개를 전부 지웁니다. 되돌릴 수 없습니다.")) {
          notes = []; save(); openList();
        }
        return;
      }
      var go = t.closest(".memo-go");
      if (go) {
        var id = go.getAttribute("data-id"), n = null;
        for (var i = 0; i < notes.length; i++) if (notes[i].id === id) { n = notes[i]; break; }
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
      var id = p.getAttribute("data-id"), n = null;
      for (var i = 0; i < notes.length; i++) if (notes[i].id === id) { n = notes[i]; break; }
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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else build();
})();
