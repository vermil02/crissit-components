#!/usr/bin/env python3
"""
`registry.json` 과 `registry/*.json` 을 만든다 — **다른 세션·개발사에 넘기기 위한 색인**이다.

  왜 필요한가 — 지금 이 컴포넌트를 쓰려면 카탈로그 148KB + CSS 236KB + README 27KB,
  약 **410KB** 를 읽어야 무엇을 쓸지 알 수 있다. 그중 `icons.css` 122KB 는 사람도 기계도
  읽을 것이 없는 data URI 덩어리다. 필요한 것은 **작은 색인 + 필요할 때만 낱개 취득**이다.

  무엇이 들어가나 — **사실만 넣는다.** 이름·가족·CSS 의존·클래스 목록·상태·쓰는 화면·
  실제 조합·마크업 예시. 「왜 그렇게 쓰나」 같은 판단은 `AGENTS.md` 에 손으로 적는다.
  사실은 생성하고 판단은 쓴다 — 섞으면 둘 다 썩는다.

  두 재료
    `쓰임.json`  (자동) 어느 화면이 쓰는가        ← 쓰임-조사.py
    `상태.json`  (수동) 그래서 쓰라는 건가        ← 손으로 적는다. 기본값과 다른 것만

  쓰는 법
    python3 레지스트리-만들기.py            # registry.json + registry/*.json
    python3 레지스트리-만들기.py --확인      # 안 쓰고 요약만 본다
"""
import datetime, io, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
CSS = os.path.join(HERE, "css")
OUT = os.path.join(HERE, "registry")
BASE_URL = "https://vermil02.github.io/crissit-components"

# 모든 컴포넌트가 전제하는 것 — 값·리셋·아이콘
ALWAYS = ["css/tokens.css", "css/base.css", "css/icons.css"]


def die(msg):
    sys.exit("! " + msg)


# ── 재료 읽기 ────────────────────────────────────────────────
def load(name, hint):
    p = os.path.join(HERE, name)
    if not os.path.exists(p):
        die(f"{name} 이 없다. {hint}")
    return json.load(io.open(p, encoding="utf-8"))


def css_text(fname):
    return io.open(os.path.join(CSS, fname), encoding="utf-8").read()


def strip_comments(css):
    return re.sub(r"/\*.*?\*/", "", css, flags=re.S)


def owner_file(family):
    """그 가족의 base 클래스를 **그 클래스 하나로 여는 규칙**이 있는 파일.

    자손 선택자(`.gnb__util .dd-lang`)까지 세면 엉뚱한 파일이 잡힌다 —
    `ibtn` 이 boardlist.css 로, `gnb` 가 dropdown.css 로 잡힌 적이 있다(2026-09-10).
    bare 규칙만 보면 가족마다 파일이 정확히 하나로 떨어진다."""
    hits = [f for f in sorted(os.listdir(CSS)) if f.endswith(".css")
            and re.search(r"(?m)^\." + re.escape(family) + r"\s*[,{]",
                          strip_comments(css_text(f)))]
    if len(hits) == 1:
        return hits[0]
    return None


def classes_of(family, fname, scope=None, other=()):
    """가족의 클래스를 세 통에 나눈다 — 종류 · 변형 · 구조

    `scope` 는 절이 좁혀 준 머리 목록이다(카탈로그의 `data-use-scope`).
    Board list 는 Main·Common·Recommand 세 절이 **같은 가족 `bl`** 을 쓰는데,
    범위를 안 좁히면 세 절이 서로의 변형까지 다 물고 나온다 —
    Recommand 항목에 `bl-main--single` 이 들어가 버린다(2026-09-10).
    구조(`bl__img` 같은 것)는 셋이 함께 쓰므로 범위와 무관하게 남긴다.

    `other` 는 **다른 절이 선언한 가족들**이다. 더 긴 가족에 속하는 클래스는 뺀다 —
    `chip-option` 은 `chip` 으로 시작하지만 Dropdown list 절의 컴포넌트다.
    안 빼면 Chip 절이 남의 변형까지 물고 나온다(2026-09-10)."""
    css = strip_comments(css_text(fname))
    found = set(m.group(1) for m in re.finditer(r"\.([a-zA-Z][a-zA-Z0-9_-]*)", css))
    heads = scope or [family]
    kinds, mods, parts = set(), set(), set()
    for c in found:
        if c == family:
            continue
        if not c.startswith(family):
            continue
        if any(len(g) > len(family) and c.startswith(g) for g in other):
            continue                       # 다른 절이 가진 컴포넌트다
        # 가족 공용 구조(`bl__img`)는 모든 절이 함께 쓰므로 남긴다.
        # 종류별 구조(`bl-main__body`)는 그 종류의 절만 갖는다
        shared_part = c.startswith(family + "__")
        if not shared_part and not any(c.startswith(h) for h in heads):
            continue
        rest = c[len(family):]
        if rest.startswith("--"):
            mods.add(c)
        elif rest.startswith("__"):
            parts.add(c)
        elif rest.startswith("-"):
            # `bl-h` 처럼 가족 안의 종류. 그 종류의 변형·구조는 다시 갈라 담는다
            if "--" in rest:
                mods.add(c)
            elif "__" in rest:
                parts.add(c)
            else:
                kinds.add(c)
    return sorted(kinds), sorted(mods), sorted(parts)


MAX_MARKUP = 3000

def demo_markup(seg, heads, family, ok=None):
    """카탈로그 데모에서 그 절의 **실제 마크업**을 뽑는다.

    CSS 주석의 「마크업」 예시는 파일당 하나뿐인데 Board list 는 세 절이 그 파일을
    함께 쓴다 — Common 항목에 Main 의 일시정지 버튼이 들어갔다(2026-09-10).
    카탈로그 데모는 절마다 따로 있으니 그쪽이 맞다.

    뽑는 방법 — 범위 머리를 **온전한 클래스로** 가진 첫 요소를 찾아 같은 태그 이름의
    여닫이를 세어 덩이를 닫는다. 카탈로그 마크업이 정직하게 들여쓰여 있어 이 방법이 통한다.
    카탈로그 화면 전용 표시(`demo-hover` · `data-label` · `data-use-*`)는 지운다.

    ⚠ **현행 판을 고른다.** 그냥 첫 요소를 잡으면 이전 판이 나온다 — Board list Common 은
       카탈로그에 `bl bl-h`(사진 176, 이전 판)가 먼저 나오고 `bl bl-h bl-h--wide`(현행)가
       뒤에 나온다. 안 씀·이전판 클래스가 섞인 요소는 건너뛴다(2026-09-10)."""
    for h in heads + [family]:
        m = None
        for cand in re.finditer(r'<(\w+)([^>]*\bclass="([^"]*(?<![\w-])' + re.escape(h)
                                + r'(?![\w-])[^"]*)")', seg):
            if ok is None or ok(cand.group(3).split()):
                m = cand
                break
        if not m:
            continue
        tag, start = m.group(1), m.start()
        depth, i = 0, start
        while i < len(seg):
            o = seg.find("<" + tag, i)
            c = seg.find("</" + tag, i)
            if c == -1:
                return None
            if o != -1 and o < c:
                depth += 1
                i = o + 1
                continue
            depth -= 1
            i = c + 1
            if depth == 0:
                end = seg.find(">", c) + 1
                return tidy(seg[start:end])
    return None


def tidy(block):
    block = re.sub(r'\s*\bdemo-hover\b', "", block)
    block = re.sub(r'\s+data-(label|use-[a-z-]+)="[^"]*"', "", block)
    block = re.sub(r'\s+class=""', "", block)
    lines = [l for l in block.split("\n")]
    pads = [len(l) - len(l.lstrip()) for l in lines[1:] if l.strip()]
    cut = min(pads) if pads else 0
    out = [lines[0].strip()] + [l[cut:].rstrip() if len(l) > cut else l.strip() for l in lines[1:]]
    s = "\n".join(out).rstrip()
    if len(s) > MAX_MARKUP:
        s = s[:MAX_MARKUP].rsplit("\n", 1)[0] + "\n  … (이어지는 부분은 카탈로그 절을 본다)"
    return s


def scoped_markup(fname, heads):
    m = markup_of(fname)
    if not m:
        return None
    if any(h in m for h in heads):
        return m
    return None


def markup_of(fname):
    """CSS 머리 주석의 「마크업」 예시. 손으로 적은 것이라 가장 믿을 만하다.

    `마크업에서 …` 처럼 문장 속에 든 것은 잡지 않는다 — 줄이 거의 `마크업` 하나여야 한다."""
    lines = css_text(fname).split("\n")
    for i, ln in enumerate(lines):
        if not re.match(r"^\s*마크업\s*(?:$|[—\-–])", ln):
            continue
        indent = len(ln) - len(ln.lstrip())
        block, started = [], False
        for nxt in lines[i + 1:]:
            if not nxt.strip():
                if started:
                    break
                continue
            ind = len(nxt) - len(nxt.lstrip())
            if ind <= indent or nxt.strip().startswith("*/"):
                break
            if not started and not nxt.strip().startswith("<"):
                break
            started = True
            block.append(nxt[indent + 2:].rstrip() if len(nxt) > indent + 2 else nxt.strip())
        if block:
            return "\n".join(block)
    return None


# ── 카탈로그에서 절을 읽는다 ─────────────────────────────────
def sections():
    html = io.open(os.path.join(HERE, "카탈로그.html"), encoding="utf-8").read()
    out = []
    for m in re.finditer(r'<section class="sec" id="([^"]+)"([^>]*)>', html):
        sid, attrs = m.group(1), m.group(2)
        fam = re.search(r'data-use-family="([^"]*)"', attrs)
        if fam is None:
            die(f'절 #{sid} 에 data-use-family 가 없다. 카탈로그.html 에 적는다')
        end = html.index("</section>", m.end())
        seg = html[m.end():end]
        h2 = re.search(r"<h2>(.*?)</h2>", seg, re.S)
        desc = re.search(r'<p class="desc">(.*?)</p>', seg, re.S)
        src = re.search(r'<p class="src">(.*?)</p>', seg, re.S)
        out.append({
            "id": sid,
            "가족": fam.group(1),
            "제외": grab(attrs, "data-use-ignore").split(),
            "범위": grab(attrs, "data-use-scope").split() or None,
            "식별": grab(attrs, "data-use-key").split() or None,
            "제목": clean(h2.group(1)) if h2 else sid,
            "한줄": first_sentence(clean(desc.group(1))) if desc else None,
            "피그마": clean(src.group(1)) if src else None,
            "_본문": seg,
        })
    return out


def grab(attrs, name):
    m = re.search(name + r'="([^"]*)"', attrs)
    return m.group(1) if m else ""


def clean(s):
    s = re.sub(r"<br\s*/?>", " ", s)
    s = re.sub(r"<[^>]+>", "", s)
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def first_sentence(s):
    m = re.match(r"(.{10,160}?[.。])\s", s + " ")
    return (m.group(1) if m else s)[:200]


# ── 상태 판정 ────────────────────────────────────────────────
def make_status(uses, screens, declared):
    formal = {n for n, v in screens.items() if v["등급"] == "정식"}

    def of(cls):
        d = declared.get(cls)
        if d:
            return dict(d)
        who = uses.get(cls) or []
        if any(n in formal for n in who):
            return {"상태": "현행"}
        if who:
            return {"상태": "예정", "왜": "확정 아닌 화면(" + " · ".join(who) + ")만 쓴다"}
        return {"상태": "라이브러리에만"}
    return of


def main():
    dry = "--확인" in sys.argv
    use = load("쓰임.json", "먼저 `python3 쓰임-조사.py` 를 돌린다")
    st = load("상태.json", "이 파일은 손으로 적는 것이다")
    uses, screens = use["쓰임"], use["화면"]
    status_of = make_status(uses, screens, st.get("변형", {}))
    sec_status = st.get("절", {})

    secs = sections()
    families = {s["가족"] for s in secs if s["가족"]}

    def current_combo(classes, ignore=()):
        """마크업으로 쓸 조합인가 — **조합 전체**를 보고 정한다.

        클래스 하나만 보면 안 된다. `bl bl-h bl-h--wide` 는 현행인데 `bl-h` 는 이전판이다 —
        이전판 클래스라도 **후속이 같이 붙어 있으면** 그 조합은 현행이다(2026-09-10).
        곁 클래스(`has-overlay`)와 카탈로그 클래스는 판정하지 않고 통과시킨다."""
        decl = st.get("변형", {})
        for c in classes:
            if c in ignore:
                continue                      # 카탈로그가 데모를 세우려고 붙인 것(drawer--inline)
            d = decl.get(c)
            if d:
                if d.get("상태") == "현행":
                    continue
                nxt = d.get("후속")
                if nxt and nxt in classes:
                    continue                  # 갈아탄 판을 함께 쓰고 있다
                return False
            if c in uses:
                continue
            if "--" in c or c.startswith(("i-", "bl-", "btn-", "ibtn-", "chip-",
                                          "pgn-", "sh-", "ft-", "gnb-", "drawer-")):
                return False                  # 어느 화면도 안 쓰는 변형이다
        return True

    comps, skipped = [], []
    for sec in secs:
        fam = sec["가족"]
        if not fam:
            skipped.append(sec["id"])
            continue
        if fam == "i-":
            # 아이콘 절은 컴포넌트 항목이 아니라 `registry/아이콘.json` 으로 따로 낸다 —
            # 64종을 색인에 늘어놓으면 색인이 무거워진다(색인을 만든 이유가 사라진다)
            continue
        fname = owner_file(fam)
        if not fname:
            die(f'가족 `{fam}` (#{sec["id"]}) 의 base 규칙을 가진 css 파일을 하나로 못 정했다')

        kinds, mods, parts = classes_of(fam, fname, sec["범위"], families - {fam})
        ignore = set(sec["제외"])

        def entry(cls):
            e = {"클래스": cls}
            e.update(status_of(cls))
            who = uses.get(cls)
            if who:
                e["쓰는 화면"] = who
            if cls in ignore:
                e["상태"] = "카탈로그 표시용"
                e["왜"] = "데모를 액자 안에 세우려고 쓴 것이다. 화면에서는 쓰지 않는다"
            return e

        # 이 가족의 실제 조합 — 화면이 정말로 함께 붙인 클래스다. 마크업보다 확실하다
        combos = []
        heads = sec["범위"] or [fam]
        for k, who in use.get("조합", {}).items():
            own = [c for c in k.split() if c == fam or c.startswith(fam)]
            if len(own) > 1 and any(any(c.startswith(h) for h in heads) for c in own):
                combos.append({"조합": " ".join(own), "쓰는 화면": who})
        combos.sort(key=lambda x: (-len(x["쓰는 화면"]), x["조합"]))

        css_needed = ALWAYS + [f"css/{fname}"]
        # 아이콘 버튼·칩처럼 다른 컴포넌트를 안에 쓰는 경우
        if fam in ("pgn", "bl", "filter-bar", "drawer", "gnb", "ft"):
            css_needed.append("css/icon-button.css")
        if fam in ("filter-bar", "dd"):
            css_needed.append("css/chip.css")

        c = {
            "id": sec["id"],
            "이름": sec["제목"],
            "가족": fam,
            # 절의 상태는 **base 클래스**가 정한다. 변형으로 정하면 엉뚱해진다 —
            # Chip 절이 `chip-option`(남의 것) 때문에 「예정」으로 나온 적이 있다
            "상태": sec_status.get(sec["id"], {}).get("상태", status_of(fam)["상태"]),
            "한줄": sec["한줄"],
            "피그마": sec["피그마"],
            # 식별 클래스 — 가족만으로 어느 컴포넌트인지 못 가리는 절이 있다.
            # 버튼 세 절이 `btn` 을 공유해서, 화면이 버튼 하나만 써도 셋 다 걸렸다
            # (화면 색인이 컴포넌트 14종으로 부풀었다 · 2026-09-10).
            # 「이 클래스가 있으면 이 컴포넌트를 쓴 것」을 한 곳에 못박는다
            "식별 클래스": sec["식별"] or [fam],
            "css": sorted(set(css_needed), key=css_needed.index),
            "종류": [entry(c) for c in kinds],
            "변형": [entry(c) for c in mods],
            "구조": parts,
            "실제 조합": combos[:12],
            # 마크업 예시는 CSS 파일 하나에 하나뿐인데 Board list 는 세 절이 그 파일을
            # 함께 쓴다 — 범위에 안 맞는 예시를 넣으면 오히려 헷갈린다(Common 항목에
            # Main 의 일시정지 버튼이 들어갔다). 안 맞으면 비우고 「실제 조합」을 믿게 한다
            # 절이 「현행」이 아니면(예정·이전판) 현행을 고를 것이 없으니 첫 데모를 그대로 쓴다
            "마크업": demo_markup(sec["_본문"], heads, fam,
                               (lambda cs: current_combo(cs, ignore))
                               if sec_status.get(sec["id"], {}).get("상태", status_of(fam)["상태"]) == "현행"
                               else None) or scoped_markup(fname, heads),
            "카탈로그": f"{BASE_URL}/카탈로그.html#{sec['id']}",
        }
        if sec["id"] in sec_status and "왜" in sec_status[sec["id"]]:
            c["왜"] = sec_status[sec["id"]]["왜"]
        comps.append(c)

    # 아이콘은 따로 — 64종을 컴포넌트 항목에 넣으면 색인이 무거워진다
    icons = []
    for m in re.finditer(r"(?m)^\.(i-[a-z0-9-]+)\s*\{", strip_comments(css_text("icons.css"))):
        icons.append(entry_icon(m.group(1), status_of, uses))

    index = {
        "설명": "crissit 컴포넌트 색인. **생성물이라 손으로 고치지 않는다** — 레지스트리-만들기.py",
        "만든날": datetime.date.today().isoformat(),
        "먼저 읽을 것": f"{BASE_URL}/AGENTS.md",
        "쓰는 법": [
            "① AGENTS.md 를 읽는다 (규칙 · 3~5KB)",
            "② 이 색인에서 필요한 컴포넌트의 id 를 찾는다",
            f"③ {BASE_URL}/registry/<id>.json 으로 그 컴포넌트만 가져간다",
            "④ css 항목의 파일을 그 순서대로 넣는다. icons.css 는 생성물이라 열어 볼 필요가 없다",
        ],
        "상태값": st.get("상태값", {}),
        "화면": screens,
        "컴포넌트": [{k: c[k] for k in ("id", "이름", "가족", "상태", "식별 클래스", "한줄")}
                    for c in comps],
        "아이콘": {"전체": len(icons), "현행": sum(1 for i in icons if i["상태"] == "현행"),
                  "낱개": f"{BASE_URL}/registry/아이콘.json"},
    }

    print(f"컴포넌트 {len(comps)}개 · 아이콘 {len(icons)}종 "
          f"(현행 {index['아이콘']['현행']}) · 판정 안 하는 절 {len(skipped)}개")
    for c in comps:
        n = sum(1 for e in c["종류"] + c["변형"] if e["상태"] == "현행")
        t = len(c["종류"]) + len(c["변형"])
        print(f"  {c['id']:<12} {c['상태']:<8} 종류·변형 {n}/{t} 현행"
              f"{'' if c['마크업'] else '   (마크업 예시 없음)'}")

    if dry:
        return
    os.makedirs(OUT, exist_ok=True)
    w(os.path.join(HERE, "registry.json"), index)
    for c in comps:
        w(os.path.join(OUT, c["id"] + ".json"), c)
    w(os.path.join(OUT, "아이콘.json"), {
        "설명": "아이콘 이름 목록. `icons.css` 는 SVG 가 박힌 생성물이라 열어 볼 필요가 없다",
        "쓰는 법": '<i class="icon icon--20 i-arrow-right"></i> — 색은 글자색을 따라간다',
        "만든날": datetime.date.today().isoformat(),
        "아이콘": icons,
    })
    print(f"\n→ registry.json · registry/ 에 {len(comps) + 1}개")


def entry_icon(cls, status_of, uses):
    e = {"클래스": cls}
    e.update(status_of(cls))
    if uses.get(cls):
        e["쓰는 화면"] = uses[cls]
    return e


def w(path, obj):
    io.open(path, "w", encoding="utf-8", newline="\n").write(
        json.dumps(obj, ensure_ascii=False, indent=1) + "\n")


if __name__ == "__main__":
    try: sys.stdout.reconfigure(encoding="utf-8")
    except Exception: pass
    main()
