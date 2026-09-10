/* ============================================================
   들어오기 문 — 이름과 닉네임을 넣기 전에는 화면을 안 보여준다

   componote 가 **메모를 쓸 때** 묻던 로그인을 **페이지 앞으로 당긴** 것이다
   (2026-09-10 사용자 요청). 그래야 남긴 메모에 누가 남겼는지가 반드시 붙는다.

   ── 왜 componote 를 안 고치고 여기서 하나 ────────────────────
   componote 는 밖에서 부를 수 있는 API 가 없고, 정본이 이 저장소가 아니라
   `업무도구/componote/` 에 있다(여기 것은 복사본). 그래서 **문은 페이지가 갖는다.**
   처음에는 componote 의 메모 버튼을 대신 눌러 그쪽 로그인 화면을 띄우려 했는데,
   그 버튼은 **핀 모드 토글**이라 로그인이 아니라 패널이 열렸다(2026-09-10 실측).
   그래서 로그인 요청을 이 문이 직접 보낸다 — 보내는 모양은 componote 와 똑같다.

       POST {memoServer}/?do=login   {name, pass}
       ← {name, token}   →  localStorage["crissit-catalog-memo-who"]

   componote 가 읽는 키와 값 모양을 **그대로** 쓰기 때문에, 문을 지나면 componote 는
   이미 들어와 있는 것으로 본다. 두 곳에서 따로 로그인하지 않는다.

   ⚠ **이건 잠금이 아니라 이름표다.** 이 페이지는 GitHub Pages 정적 공개다 —
      주소만 알면 HTML·css·json 을 그대로 받을 수 있고, 자바스크립트 문은 화면만 가린다.
      지금 내용은 공개해도 되는 것이라 문제가 없다. 실제로 가려야 할 것이 생기면
      비공개 저장소와 접근 제어가 따로 필요하다.
   ⚠ 서버 주소가 페이지에 없으면(로컬에서 열었을 때 등) 문을 세우지 않는다 —
      들어갈 방법이 없는데 막으면 아무것도 볼 수 없다.
   ============================================================ */
(function () {
  var WHO = "crissit-catalog-memo-who";        // componote 가 쓰는 것과 **같은 키**
  var gate = document.getElementById("gate");
  if (!gate) return;

  var form = gate.querySelector("[data-gate-form]");
  var nameEl = gate.querySelector("[data-gate-name]");
  var passEl = gate.querySelector("[data-gate-pass]");
  var msgEl = gate.querySelector("[data-gate-msg]");
  var goEl = gate.querySelector("[data-gate-go]");

  function read(k) {
    try { return localStorage.getItem(k); } catch (e) { return null; }   // 저장이 막힌 브라우저
  }
  function known() {
    var raw = read(WHO);
    if (!raw) return false;
    try {
      var me = JSON.parse(raw);
      return !!(me && me.name && me.token);    // componote 도 이 둘을 함께 본다
    } catch (e) { return false; }
  }
  function server() {
    var c = window.componote;
    var u = c && c.memoServer;
    return (typeof u === "string" && /^https:\/\//.test(u))
      ? u.replace(/[?#].*$/, "").replace(/\/+$/, "") : "";
  }

  function open() {
    document.documentElement.removeAttribute("data-gate");   // <head> 에서 붙인 것
    document.body.removeAttribute("data-gate");
    gate.hidden = true;
  }
  function shut() {
    document.documentElement.setAttribute("data-gate", "closed");
    document.body.setAttribute("data-gate", "closed");
    gate.hidden = false;
    if (nameEl) nameEl.focus();
  }

  if (known() || !server()) { open(); return; }
  shut();

  function say(t, bad) {
    if (!msgEl) return;
    msgEl.textContent = t || "";
    msgEl.className = "gate__msg" + (bad ? " is-bad" : "");
  }
  function busy(on) {
    if (!goEl) return;
    goEl.disabled = on;
    goEl.textContent = on ? "확인하는 중…" : "들어가기";
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = (nameEl.value || "").trim();
    var pass = (passEl.value || "").trim();
    if (!name || !pass) { say("이름과 닉네임을 모두 넣어 주세요", true); return; }

    busy(true); say("");
    fetch(server() + "/?do=login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name, pass: pass })
    }).then(function (r) {
      return r.json().then(function (d) { return { ok: r.ok, d: d }; });
    }).then(function (o) {
      if (!o.ok || !o.d || !o.d.token) {
        busy(false);
        /* 무엇을 보냈는지 되돌려 보여 준다 — 한글 조합이 덜 됐거나 빈칸이 섞인 것을
           본인이 봐야 고칠 수 있다. 서버는 이름·닉네임 중 무엇이 틀렸는지 알려주지 않는다
           (componote 도 같은 이유로 같은 문구를 쓴다) */
        say(((o.d && o.d.error) || "들어가지 못했습니다") +
            " — 보낸 값: 이름 「" + name + "」 · 닉네임 「" + pass + "」", true);
        return;
      }
      try {
        localStorage.setItem(WHO, JSON.stringify({
          name: o.d.name || name, token: o.d.token
        }));
      } catch (err) { /* 저장이 막혔어도 이번 방문은 들여보낸다 */ }
      open();
      /* componote 는 이미 `loadSrv()` 를 끝냈으니 방금 넣은 신원을 모른다.
         새로 고치지 않고 알려 줄 방법이 없어서 **한 번 다시 읽는다** —
         메모 목록·핀이 처음부터 내 것으로 보이게 하려는 것이다 */
      location.reload();
    }).catch(function (e2) {
      busy(false);
      say("서버에 닿지 못했습니다 — " + (e2 && e2.message ? e2.message : "네트워크"), true);
    });
  });
})();
