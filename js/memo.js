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
     다른 사람에게도 보인다. 주소와 열쇠는 **저장소에 넣지 않고** 각자
     브라우저에만 둔다 — 공개 저장소라 넣으면 누구나 글을 넣을 수 있다.

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
  var SRV = "crissit-catalog-memo-server";   // 주소·열쇠를 이 브라우저에 저장한다
  var api = null;                 // window.catInspect — 검사기가 없으면 null
  var notes = [];      // 내 메모 (localStorage)
  var shared = [];     // 남이 쓴 메모 — 서버나 memos.json 에서 온다. 읽기만 된다
  var srv = null;      // { url, key } — 서버를 안 붙였으면 null
  var srvState = "";   // 화면에 보여줄 연결 상태
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

  /* 화면에 그릴 목록 — 공유 메모가 먼저, 그 다음이 내 메모.
     같은 id 가 양쪽에 있으면 **내 쪽이 이긴다**(내가 고쳐 둔 것이므로) */
  function all() {
    var mine = {};
    for (var i = 0; i < notes.length; i++) mine[notes[i].id] = 1;
    var out = [];
    for (var j = 0; j < shared.length; j++) if (!mine[shared[j].id]) out.push(shared[j]);
    return out.concat(notes);
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
  function loadSrv() {
    try { srv = JSON.parse(localStorage.getItem(SRV) || "null"); } catch (e) { srv = null; }
    if (srv && (!srv.url || !srv.key)) srv = null;
    fromLink();
  }

  /* 링크에 담아 온 설정 — `?memo=<주소>|<열쇠>`
     디자이너에게 주소와 열쇠를 따로 설명하지 않아도 되게 하려는 것이다.
     링크 하나만 보내면 그 사람 브라우저에 저장되고, 다음부터는 그냥 열면 된다.

     ▸ 읽은 뒤 주소창에서 `?memo=…` 를 **바로 지운다** — 화면 공유나
       북마크로 열쇠가 흘러가지 않게 하려는 것이다(주소는 이미 브라우저에
       저장됐으니 지워도 연결은 유지된다).
     ▸ 저장소에는 여전히 넣지 않는다. 링크를 받은 사람만 쓴다. */
  function fromLink() {
    var m = /[?&]memo=([^&#]+)/.exec(location.search);
    if (!m) return;
    var parts = decodeURIComponent(m[1]).split("|");
    var url = (parts[0] || "").trim(), key = (parts[1] || "").trim();
    if (/^https:\/\//.test(url) && key) saveSrv({ url: url, key: key });

    // 주소창 청소 — 뒤로가기 기록도 남기지 않는다
    try {
      var clean = location.pathname +
        location.search.replace(/([?&])memo=[^&#]*&?/, "$1").replace(/[?&]$/, "") +
        location.hash;
      history.replaceState(null, "", clean);
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
    return u + "?key=" + encodeURIComponent(srv.key) + (extra || "");
  }

  /* 서버 → 화면. 서버가 없으면 저장소의 memos.json 을 대신 읽는다 */
  function pull(done) {
    if (!srv) {
      var url = "memos.json?t=" + Date.now();   // Pages 가 캐시하므로 매번 새로 받는다
      try {
        fetch(url).then(function (r) { return r.ok ? r.json() : null; })
          .then(function (d) { shared = (d && d.notes) || []; srvState = ""; done(); })
          .catch(function () { done(); });
      } catch (e) { done(); }
      return;
    }
    srvState = "불러오는 중…";
    fetch(srvUrl()).then(function (r) {
      if (r.status === 401) throw new Error("열쇠가 맞지 않습니다");
      if (!r.ok) throw new Error("서버가 " + r.status + " 로 답했습니다");
      return r.json();
    }).then(function (d) {
      shared = (d && d.notes) || [];
      srvState = "연결됨 · " + shared.length + "건";
      done();
    }).catch(function (e) {
      srvState = "연결 실패 — " + e.message;
      done();
    });
  }

  /* 화면 → 서버. 실패해도 내 브라우저에는 이미 저장돼 있으니 잃지 않는다 */
  function push(note) {
    if (!srv) return;
    fetch(srvUrl(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(note)
    }).then(function (r) {
      srvState = r.ok ? "올렸습니다" : "올리지 못했습니다 (" + r.status + ")";
      renderFootState();
    }).catch(function () {
      srvState = "올리지 못했습니다 — 인터넷이나 주소를 확인해 주세요";
      renderFootState();
    });
  }
  function drop(id) {
    if (!srv) return;
    fetch(srvUrl("&id=" + encodeURIComponent(id)), { method: "DELETE" }).catch(function () {});
  }

  /* ── 핀 ───────────────────────────────────────────────── */
  function sectionOf(el) {
    var s = el.closest && el.closest("section.sec");
    var h = s && s.querySelector("h2");
    return h ? h.textContent.trim() : "";
  }

  function renderPins() {
    layer.innerHTML = "";
    all().forEach(function (n, i) {
      var el = api && api.resolve(n.sel);
      if (!el) return;                        // 마크업이 바뀌어 못 찾는 경우
      var r = el.getBoundingClientRect();
      var b = document.createElement("button");
      b.type = "button";
      b.className = "memo-pin" + (isMine(n) ? "" : " is-shared");
      b.textContent = i + 1;
      b.title = n.text.slice(0, 60);
      b.style.left = (r.left + scrollX + r.width - 9) + "px";
      b.style.top = (r.top + scrollY - 9) + "px";
      b.setAttribute("data-id", n.id);
      layer.appendChild(b);
    });
  }
  function renderCount() {
    var n = all().length;
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
        '<p class="memo-ro"><span class="memo-tag">공유</span> ' + esc(note.text) + "</p>" +
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

  /* ── 목록 ─────────────────────────────────────────────── */
  function openList() {
    var list = all();
    var rows = list.length
      ? list.map(function (n, i) {
          var mine = isMine(n);
          return '<li class="memo-item" data-id="' + n.id + '">' +
            '<span class="memo-no' + (mine ? "" : " is-shared") + '">' + (i + 1) + "</span>" +
            "<div><b>" + esc(n.text) + "</b>" +
            '<span class="memo-meta">' + (mine ? "" : '<span class="memo-tag">공유</span> ') +
            esc(n.section ? n.section + " · " : "") + esc(n.label) + "</span></div>" +
            '<button type="button" class="memo-go" data-id="' + n.id + '">보기</button></li>';
        }).join("")
      : '<li class="memo-empty">아직 메모가 없습니다.<br>화면에서 고칠 곳을 <b>클릭해 고른 뒤</b> 위의 <b>「＋ 메모」</b>를 누르세요.</li>';

    bodyEl.innerHTML = '<ul class="memo-list">' + rows + "</ul>";
    footEl.innerHTML =
      '<div class="memo-btns">' +
      (srv ? '<button type="button" class="memo-refresh">새로 받기</button>' : "") +
      '<button type="button" class="memo-export">JSON 내보내기</button>' +
      '<label class="memo-import">불러오기<input type="file" accept="application/json,.json" hidden></label>' +
      (notes.length ? '<button type="button" class="memo-clear">전부 지우기</button>' : "") +
      '<button type="button" class="memo-srv">' + (srv ? "서버 설정" : "서버 붙이기") + "</button>" +
      "</div>" +
      '<p class="memo-hint">' + hintText() + "</p>";
    editing = null;
    renderFootState();
  }

  function hintText() {
    if (srv) {
      return "메모를 저장하면 <b>바로 서버로 올라가</b> 다른 사람에게도 보입니다. " +
             "남이 쓴 것은 <span class=\"memo-tag\">공유</span> 로 표시되고 여기서는 고칠 수 없습니다.";
    }
    return "<b>내가 쓴 메모는 이 브라우저에만 저장됩니다</b> — 다른 사람에게는 보이지 않습니다. " +
           "「JSON 내보내기」로 파일을 만들어 전달하거나, <b>「서버 붙이기」</b>로 자동으로 모이게 하세요.";
  }
  function renderFootState() {
    var p = footEl.querySelector(".memo-state");
    if (!srvState) { if (p) p.remove(); return; }
    if (!p) { p = document.createElement("p"); p.className = "memo-state"; footEl.appendChild(p); }
    p.textContent = srvState;
    p.classList.toggle("is-bad", /실패|못했/.test(srvState));
  }

  function openSrv() {
    bodyEl.innerHTML =
      '<p class="memo-target">메모를 모을 서버</p>' +
      '<label class="memo-field">주소<input type="url" class="memo-srv-url" placeholder="https://…workers.dev" value="' +
      esc(srv ? srv.url : "") + '"></label>' +
      '<label class="memo-field">열쇠<input type="text" class="memo-srv-key" placeholder="MEMO_KEY 값" value="' +
      esc(srv ? srv.key : "") + '"></label>' +
      '<p class="memo-hint">주소와 열쇠는 <b>이 브라우저에만</b> 저장됩니다. 저장소에는 넣지 않습니다 — 공개 저장소라 그러면 누구나 글을 넣을 수 있습니다.</p>';
    footEl.innerHTML =
      '<div class="memo-btns">' +
      '<button type="button" class="memo-srv-save">연결</button>' +
      '<button type="button" class="memo-cancel">취소</button>' +
      (srv ? '<button type="button" class="memo-srv-link">보낼 링크 복사</button>' : "") +
      (srv ? '<button type="button" class="memo-srv-off">끊기</button>' : "") +
      "</div>";
    editing = null;
  }

  /* 주소·열쇠가 담긴 링크를 만들어 클립보드에 넣는다.
     이 링크를 받은 사람은 열기만 하면 연결이 끝난다 */
  function shareLink() {
    if (!srv) return;
    var base = location.origin + location.pathname;
    return base + "?memo=" + encodeURIComponent(srv.url + "|" + srv.key);
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

    load(); loadSrv();
    renderCount(); renderPins(); openList();
    bind(panel);
    // 남이 쓴 메모는 네트워크라 늦게 온다. 오면 다시 그린다
    pull(function () { renderCount(); renderPins(); openList(); });
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
        drop(editing);
        notes = notes.filter(function (x) { return x.id !== editing; });
        save(); openList(); return;
      }
      if (t.closest(".memo-srv")) { openSrv(); return; }
      if (t.closest(".memo-srv-save")) {
        var u = col.querySelector(".memo-srv-url").value.trim();
        var k = col.querySelector(".memo-srv-key").value.trim();
        if (!/^https:\/\//.test(u) || !k) { alert("주소는 https:// 로 시작해야 하고, 열쇠도 있어야 합니다."); return; }
        saveSrv({ url: u, key: k });
        pull(function () { renderCount(); renderPins(); openList(); });
        return;
      }
      if (t.closest(".memo-srv-link")) {
        var link = shareLink();
        var done = function (ok) {
          srvState = ok ? "링크를 복사했습니다 — 이 링크를 받은 사람은 열기만 하면 연결됩니다"
                        : "복사가 막혔습니다. 아래 칸의 링크를 직접 복사해 주세요";
          renderFootState();
        };
        try {
          navigator.clipboard.writeText(link).then(function () { done(true); }, function () { done(false); });
        } catch (e) { done(false); }
        // 복사가 막히는 브라우저를 위해 화면에도 띄워 준다
        var box = col.querySelector(".memo-link");
        if (!box) {
          box = document.createElement("input");
          box.className = "memo-link";
          box.readOnly = true;
          col.querySelector(".memo-body").appendChild(box);
        }
        box.value = link;
        box.select();
        return;
      }
      if (t.closest(".memo-srv-off")) {
        saveSrv(null); srvState = "";
        pull(function () { renderCount(); renderPins(); openList(); });
        return;
      }
      if (t.closest(".memo-refresh")) {
        pull(function () { renderCount(); renderPins(); openList(); });
        return;
      }
      if (t.closest(".memo-export")) { exportJson(); return; }
      if (t.closest(".memo-clear")) {
        if (confirm("내가 쓴 메모 " + notes.length + "개를 전부 지웁니다. 되돌릴 수 없습니다.")) {
          for (var k = 0; k < notes.length; k++) drop(notes[k].id);
          notes = []; save(); openList();
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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else build();
})();
