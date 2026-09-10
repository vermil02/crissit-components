#!/usr/bin/env python3
"""
화면이 **실제로 쓰는** 컴포넌트를 세어 `쓰임.json` 을 만든다.

  왜 필요한가 — 카탈로그는 피그마에 있는 것을 **전부** 옮겨 놓은 라이브러리다.
  라이브러리와 「우리 웹사이트가 실제로 붙인 것」은 다르다. 2026-09-09 첫 조사에서
  카탈로그가 보여주는 200개 중 **77개(38%)가 어느 화면에도 없었다** —
  아이콘 47개, 배지 4개, 버튼·칩 변형 20여 개.

  ⚠ **이 표를 손으로 적지 않는다.** 화면이 늘고 줄면 곧바로 썩는다 —
     `컴포넌트에-올릴-것.md` 가 실제로 그렇게 썩어서 썸네일 값이 문서·화면·피그마
     셋 다 달랐다(2026-09-09 확인). 그래서 화면 마크업에서 직접 센다.

  쓰는 법

    python3 쓰임-조사.py            # 조사해서 쓰임.json 을 쓴다
    python3 쓰임-조사.py --확인      # 안 쓰고 결과만 본다

  세는 방법 — 화면 HTML 의 **마크업에 실제로 붙은 `class`** 를 보고,
  거기에 **그 화면이 불러오는 JS 가 다루는 클래스**를 더한다.
    · `<style>` 안은 안 본다. 규칙이 있어도 그 요소가 없으면 안 쓰는 것이다
    · `.pg-*` 는 화면 전용 클래스라 뺀다 (컴포넌트가 아니다)
    · 화면이 아직 확정이 아니면 등급을 `확정아님` 으로 따로 적는다 —
      「안 쓴다」와 「아직 안 만들었다」는 다르다
"""
import datetime, io, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.abspath(os.path.join(HERE, "..", "..",
        "0. 본사 홈페이지 리뉴얼", "03. 페이지 소스화", "_소스"))

# 화면 — 등급은 `03. 페이지 소스화/00. 메모.md` 의 현황 표를 따른다
SCREENS = [
    ("보도자료 목록", "보도자료/목록.html",            "정식"),
    ("보도자료 상세", "보도자료/상세-2026-05-07.html",  "정식"),
    ("회사소개",     "회사소개/회사소개.html",          "정식"),
    ("메인 하단",    "메인/메인-하단.html",             "정식"),
    ("파트너사",     "파트너사/파트너사.html",          "확정아님"),
    ("연혁",        "연혁/연혁.html",                 "확정아님"),
]

# 컴포넌트 클래스의 머리 — 이것으로 시작하는 클래스만 센다.
# ⚠ 이 두 목록은 `쓰임.json` 에 그대로 실려서 `js/use.js` 가 **같은 것을 쓴다.**
#    양쪽에 따로 적으면 어긋난다 — 실제로 어긋나서 `has-overlay` 가 미사용으로 잡혔다(2026-09-10).
# ⚠ 머리가 하나라도 빠지면 그 가족이 **통째로 안 세어진다.** 2026-09-10 에 `drawer` 를
#    `drw` 로 잘못 적어 드로어 20개 클래스가 전부 미사용으로 잡혔다.
#    빠진 것이 있는지는 `python3 쓰임-조사.py --감사` 로 CSS 전체와 대조한다.
STEMS = ("btn", "ibtn", "chip", "dd", "filter-bar", "empty", "sh", "gnb", "drawer",
         "ft", "pgn", "bl", "badge", "icon", "logo", "has-overlay", "i-", "iconset",
         "container", "chip-option")
SKIP = ("pg-", "cc", "grp", "org", "crew", "tbd", "is-")   # 화면 전용·상태


def is_component(c):
    if c.startswith(SKIP):
        return False
    # 클래스가 아닌 토막 — JS 문자열을 훑다 보면 이벤트 이름(`bl:next`)이나
    # 조립 중인 조각(`gnb--`)이 섞인다
    if ":" in c or c.endswith("-") or c.endswith("_"):
        return False
    return any(c == s or c.startswith(s + "-") or c.startswith(s + "_") or c.startswith(s)
               for s in STEMS)


def scan(path):
    """(클래스 집합, 조합 집합) — 조합은 요소 하나에 함께 붙은 컴포넌트 클래스를 정렬해 이은 것.

    조합까지 세는 이유 — 클래스만 세면 **어느 판을 쓰는지** 구분이 안 된다.
    보도자료 목록은 `bl bl-h bl-h--wide`(사진 300) 를 쓰고 피그마 판
    `bl bl-h`(사진 176) 는 안 쓴다. `bl-h` 하나만 보면 둘 다 「쓴다」가 된다."""
    html = io.open(path, encoding="utf-8").read()
    body = re.sub(r"<style.*?</style>", "", html, flags=re.S)   # 규칙이 아니라 요소를 센다
    body = re.sub(r"<!--.*?-->", "", body, flags=re.S)          # 주석의 예시 마크업도 뺀다
    classes, combos = set(), set()
    for m in re.finditer(r'class="([^"]+)"', body):
        got = sorted(c for c in m.group(1).split() if is_component(c))
        if not got:
            continue
        classes.update(got)
        combos.add(" ".join(got))

    # 스크립트가 붙였다 떼는 클래스도 **쓰는 것이다.** 정적 마크업에는 안 보인다 —
    # 2026-09-10 에 이걸 안 봐서 `gnb--transparent` 가 미사용으로 잡히고 GNB 데모 4개가
    # 잘못 접혔다. `gnb.js` 는 classList 가 아니라 문자열로 조립하므로
    # (`c + ' gnb--transparent'`) 따온 문자열을 통째로 훑는다.
    runtime = set()
    for m in re.finditer(r'src="([^"]*js/[^"]+\.js)"', body):
        jp = os.path.normpath(os.path.join(os.path.dirname(path), m.group(1)))
        if not os.path.exists(jp):
            continue
        js = io.open(jp, encoding="utf-8").read()
        js = re.sub(r"/\*.*?\*/", "", js, flags=re.S)
        js = re.sub(r"(?m)//.*$", "", js)
        for q in re.finditer(r"""['"]([^'"\n]{1,120})['"]""", js):
            for tok in q.group(1).split():
                if is_component(tok):
                    runtime.add(tok)
    classes.update(runtime)
    return classes, combos, runtime


def audit():
    """css/*.css 의 클래스 중 STEMS 에 안 걸리는 것을 머리별로 보여준다.

    머리가 빠지면 그 가족이 통째로 「안 씀」이 되므로, 컴포넌트를 늘린 뒤 한 번 돌린다.
    `t-*`(타이포 유틸) · `pg-*`(화면 전용) · `is-*`(상태) 는 원래 컴포넌트가 아니다."""
    import collections, glob
    found = set()
    for f in glob.glob(os.path.join(HERE, "css", "*.css")):
        css = re.sub(r"/\*.*?\*/", "", io.open(f, encoding="utf-8").read(), flags=re.S)
        found.update(m.group(1) for m in re.finditer(r"\.([a-zA-Z][a-zA-Z0-9_-]*)", css))
    un = sorted(c for c in found if not is_component(c))
    g = collections.Counter((re.match(r"[a-z]+", c) or re.match(r".", c)).group(0) for c in un)
    print(f"css 클래스 {len(found)}개 · 어느 머리에도 안 걸리는 것 {len(un)}개\n")
    for k, n in g.most_common():
        ex = [c for c in un if c.startswith(k)][:4]
        print(f"  {k:<12} {n:>3}개   예: {', '.join(ex)}")
    print("\n컴포넌트인데 여기 나오면 STEMS 에 머리를 더한다")


def main():
    if "--감사" in sys.argv:
        audit(); return
    dry = "--확인" in sys.argv
    screens, uses, combos, runtime = {}, {}, {}, {}
    missing = []
    for name, rel, grade in SCREENS:
        p = os.path.join(SRC, rel)
        if not os.path.exists(p):
            missing.append(rel)
            continue
        screens[name] = {"파일": rel, "등급": grade}
        cls, cmb, rt = scan(p)
        for c in cls:
            uses.setdefault(c, []).append(name)
        for c in rt:
            runtime.setdefault(c, []).append(name)
        for k in cmb:
            combos.setdefault(k, []).append(name)

    for d in (uses, combos, runtime):
        for k in d:
            d[k].sort()

    formal = sorted(c for c, v in uses.items()
                    if any(screens[s]["등급"] == "정식" for s in v))
    data = {
        "설명": "화면 마크업에서 센 것. 손으로 고치지 않는다 — 쓰임-조사.py 가 만든다",
        # 돌린 날짜를 그대로 넣는다 — 손으로 적으면 표는 새것인데 날짜가 옛것이 된다
        "조사일": datetime.date.today().isoformat(),
        "화면": screens,
        "규칙": {"머리": list(STEMS), "제외": list(SKIP)},
        "쓰임": uses,
        "런타임": runtime,
        "조합": combos,
    }

    print(f"화면 {len(screens)}장 · 쓰는 컴포넌트 클래스 {len(uses)}개 "
          f"(그중 정식 화면이 쓰는 것 {len(formal)}개) · 클래스 조합 {len(combos)}가지 "
          f"· 스크립트가 다루는 것 {len(runtime)}개")
    if missing:
        print("  ! 파일 없음:", ", ".join(missing))
    for name, meta in screens.items():
        n = sum(1 for v in uses.values() if name in v)
        print(f"  {name:<14} {meta['등급']:<8} {n:>3}개")

    if not dry:
        p = os.path.join(HERE, "쓰임.json")
        io.open(p, "w", encoding="utf-8", newline="\n").write(
            json.dumps(data, ensure_ascii=False, indent=1) + "\n")
        print(f"\n→ {os.path.basename(p)} 를 썼다")


if __name__ == "__main__":
    try: sys.stdout.reconfigure(encoding="utf-8")
    except Exception: pass
    main()
