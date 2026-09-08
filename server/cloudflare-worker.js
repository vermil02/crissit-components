/* ============================================================
   메모 수집기 — Cloudflare Worker (저장은 D1)
   카탈로그(https://vermil02.github.io/crissit-components/)의 메모를 받아
   저장하고 돌려준다. **이 파일은 사이트에 들어가지 않는다** —
   Cloudflare 대시보드에 붙여넣는 코드다.

   무엇이 저장되나
     메모 한 건 = 문구 + 그 요소의 선택자 · 구역 이름 · 그때의 값(색·글꼴·크기).
     카탈로그 소스나 피그마 파일은 여기로 오지 않는다.

   왜 KV 가 아니라 D1 인가
     처음에는 KV 로 만들었는데, **쓴 메모가 목록에 뜨기까지 20초쯤** 걸렸다
     (실측: 1·3·5·10초에는 안 보이고 20초에 보임). KV 는 읽기 속도를 위해
     쓴 내용을 곧바로 반영하지 않는다. D1 은 SQL 저장소라 **쓰면 바로 읽힌다.**

   왜 열쇠를 두나
     주소만 알면 누구나 글을 넣을 수 있기 때문이다. 열쇠(MEMO_KEY)를
     아는 요청만 받는다. 열쇠는 코드가 아니라 Cloudflare 의 **Secret** 에
     넣으므로 이 파일에는 남지 않는다.

   붙일 것 두 개 (Worker 의 Bindings·Settings)
     D1 database  변수 이름 `DB`
     Secret       이름 `MEMO_KEY`

   주고받는 방식
     GET    ?key=…            → { v:1, notes:[…] }   모두 읽기
     POST   ?key=…  본문 메모  → { ok:true }          한 건 저장(같은 id 면 덮어씀)
     DELETE ?key=…&id=…       → { ok:true }          한 건 지우기

   표는 첫 요청 때 스스로 만들어진다 — 따로 SQL 을 칠 필요가 없다.
   ============================================================ */

const MAX_TEXT = 2000;      // 메모 한 건의 글자 수 상한
const MAX_BYTES = 20000;    // 메모 한 건의 크기 상한

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      // 카탈로그가 어디에 올라가든 읽히게 열어 둔다. 열쇠로 막으므로 이걸로
      // 새는 것은 없다 — 열쇠 없는 요청은 아래에서 바로 잘린다
      "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
      "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    };
    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { ...cors, "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
      });

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    if (!env.MEMO_KEY) return json({ error: "서버에 MEMO_KEY 가 설정되지 않았습니다" }, 500);
    if (!env.DB) return json({ error: "서버에 DB(D1) 가 연결되지 않았습니다" }, 500);
    if (url.searchParams.get("key") !== env.MEMO_KEY) return json({ error: "열쇠가 맞지 않습니다" }, 401);

    // 표가 없으면 만든다. 있으면 아무 일도 안 한다
    await env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, at TEXT, body TEXT NOT NULL)"
    ).run();

    /* ── 모두 읽기 ── */
    if (request.method === "GET") {
      const rows = await env.DB.prepare("SELECT body FROM notes ORDER BY at").all();
      const notes = [];
      for (const r of rows.results || []) {
        try { notes.push(JSON.parse(r.body)); } catch (e) { /* 깨진 줄은 건너뛴다 */ }
      }
      return json({ v: 1, notes });
    }

    /* ── 한 건 저장 ── */
    if (request.method === "POST") {
      const body = await request.text();
      if (body.length > MAX_BYTES) return json({ error: "메모가 너무 큽니다" }, 413);
      let n;
      try { n = JSON.parse(body); } catch (e) { return json({ error: "JSON 이 아닙니다" }, 400); }
      if (!n || typeof n.id !== "string" || typeof n.text !== "string" || !n.text.trim())
        return json({ error: "메모 형식이 아닙니다" }, 400);
      if (n.text.length > MAX_TEXT) return json({ error: "메모가 너무 깁니다" }, 400);
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(n.id)) return json({ error: "id 형식이 아닙니다" }, 400);

      await env.DB.prepare(
        "INSERT INTO notes (id, at, body) VALUES (?1, ?2, ?3) " +
        "ON CONFLICT(id) DO UPDATE SET at = excluded.at, body = excluded.body"
      ).bind(n.id, String(n.at || ""), JSON.stringify(n)).run();
      return json({ ok: true });
    }

    /* ── 한 건 지우기 ── */
    if (request.method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return json({ error: "id 가 필요합니다" }, 400);
      await env.DB.prepare("DELETE FROM notes WHERE id = ?1").bind(id).run();
      return json({ ok: true });
    }

    return json({ error: "지원하지 않는 방식입니다" }, 405);
  },
};
