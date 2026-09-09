#!/usr/bin/env python3
"""
아이콘·로고의 SVG 를 CSS 안에 직접 넣는다 (data: URI).

  왜 필요한가 — 두 가지다.

  ① 빠르다. 아이콘은 파일 하나가 1KB 인데, 브라우저가 서버에 **낱개로 물어본다.**
     크기가 아니라 왕복 횟수가 시간을 만든다 — 라이브 카탈로그 실측(2026-09-09)에서
     SVG 68개가 각각 1.3초씩 대기해 첫 화면이 2.59초에 나왔다. 내장하면 물어볼 일이 0 이다.
  ② 더블클릭으로 열어도 보인다. 아이콘과 로고는 CSS `mask` 로 그린다(그림을 오려내는 틀).
     mask 로 쓰는 그림은 CORS 제한을 받고, `file://` 은 파일마다 출처가 다른 것으로 취급되어
     거부된다 — 아이콘이 통째로 안 보인다. `data:` 는 출처를 따지지 않는다.

  쓰는 법

    python3 아이콘-내장하기.py               # 이 폴더의 css/ 를 내장판으로 바꾼다
    python3 아이콘-내장하기.py --확인         # 안 고치고 몇 곳이 바뀔지만 센다
    python3 아이콘-내장하기.py <폴더>         # 다른 폴더의 css/ · assets/ 에 대고 돌린다

  ▸ **주석 안의 `url(../assets/…)` 는 건드리지 않는다.** 주석에는 마크업 예시가 들어 있어서,
    거기까지 바꾸면 파일이 통째로 갈라지면서 얻는 것이 없다 — 2026-09-09 이전 판이 그랬고
    `button.css` · `icon-button.css` 두 파일은 **실제 규칙이 0곳인데** 갈라져 있었다.
  ▸ `assets/*.svg` 는 지우지 않는다. **아이콘 모양의 원본은 여전히 그 파일들이다** —
    아이콘을 고칠 때는 svg 를 고치고 이 스크립트를 다시 돌린다.
  ▸ 이미 내장된 파일은 건너뛴다(여러 번 돌려도 안전하다).
  ▸ 줄바꿈은 LF 로 쓴다. 이전 판이 일부 파일을 CRLF 로 써서 전체 줄이 다른 것으로 보였다.
  ▸ 파일 머리에 `/* @assets … */` 한 줄을 남긴다. **키트(`js/kit.js`)가 이 줄을 읽는다** —
    내장하면 CSS 안에 `url(../assets/…)` 가 남지 않아서, 이 줄이 없으면 개발용 키트에
    SVG 가 0개로 들어간다.
"""
import io, os, re, sys, urllib.parse

REF = re.compile(r"url\(\.\./assets/([A-Za-z0-9._-]+\.svg)\)")
COMMENT = re.compile(r"/\*.*?\*/", re.S)
MARK = "아이콘-내장하기.py"


def to_data(svg_text):
    """SVG 를 data: URI 로. base64 보다 짧고 눈으로 읽힌다"""
    s = COMMENT.sub("", svg_text)
    s = re.sub(r"\s+", " ", s).strip()
    s = urllib.parse.quote(s, safe="/:=;,+@ ()<>'!*-._~")
    s = s.replace('"', "%22").replace("#", "%23")
    return "data:image/svg+xml;charset=utf-8," + s


def comment_spans(css):
    return [(m.start(), m.end()) for m in COMMENT.finditer(css)]


def inline_one(css, assets_dir):
    """주석 밖의 참조만 data: 로 바꾼다. (새 css, 바꾼 곳 수, 쓰인 파일 수)"""
    spans = comment_spans(css)

    def in_comment(i):
        return any(a <= i < b for a, b in spans)

    cache, count = {}, 0

    def sub(m):
        nonlocal count
        if in_comment(m.start()):
            return m.group(0)                      # 주석 안 — 그대로 둔다
        fn = m.group(1)
        if fn not in cache:
            fp = os.path.join(assets_dir, fn)
            if not os.path.exists(fp):
                print(f"    ⚠ 파일 없음 — 그대로 둔다: {fn}")
                return m.group(0)
            cache[fn] = to_data(io.open(fp, encoding="utf-8").read())
        count += 1
        return 'url("' + cache[fn] + '")'

    return REF.sub(sub, css), count, len(cache)


NOTE = (
    "/* ⚠ 이 파일은 **생성물**이다 — 아이콘·로고 SVG 를 CSS 안에 직접 넣은 판(data: URI).\n"
    "   손으로 고치지 않는다. 고칠 것은 `assets/*.svg` 이고, 고친 뒤\n"
    "   `python3 아이콘-내장하기.py` 를 다시 돌린다.\n"
    "   왜 내장하나 — ① 낱개 요청 68번이 사라진다(첫 화면 2.59초의 주원인)\n"
    "                ② mask 는 CORS 를 따져서, 파일 참조판은 더블클릭(file://)으로 열면 안 보인다\n"
    "   되돌리려면 git 으로 이 파일을 이전 판으로 되돌린다. */\n"
)


def run(root, dry):
    css_dir = os.path.join(root, "css")
    assets_dir = os.path.join(root, "assets")
    if not os.path.isdir(css_dir) or not os.path.isdir(assets_dir):
        sys.exit(f"css/ 와 assets/ 가 함께 있는 폴더가 아니다: {root}")

    total, touched = 0, 0
    for name in sorted(os.listdir(css_dir)):
        if not name.endswith(".css"):
            continue
        p = os.path.join(css_dir, name)
        css = io.open(p, encoding="utf-8", newline="").read()

        if MARK in css[:600]:
            print(f"{name:18s} 이미 내장판 — 건너뜀")
            continue

        spans = comment_spans(css)
        real = [m for m in REF.finditer(css)
                if not any(a <= m.start() < b for a, b in spans)]
        in_com = len(REF.findall(css)) - len(real)

        if not real:
            note = f" (주석 안 {in_com}곳은 그대로 둔다)" if in_com else ""
            print(f"{name:18s} 바꿀 규칙 없음{note}")
            continue

        if dry:
            print(f"{name:18s} {len(real)}곳 · 파일 {len(set(m.group(1) for m in real))}개"
                  + (f" (주석 안 {in_com}곳은 건드리지 않는다)" if in_com else ""))
            total += len(real)
            continue

        used = sorted(set(m.group(1) for m in real))
        new, count, files = inline_one(css, assets_dir)
        # 키트(js/kit.js)가 담을 파일을 여기서 읽는다 — 내장하면 CSS 안에
        # url(../assets/…) 가 남지 않아서, 이 줄이 없으면 키트에 SVG 가 0개로 들어간다
        manifest = ("/* @assets " + " ".join("assets/" + f for f in used) + " */\n")
        before, after = len(css), len(NOTE) + len(manifest) + len(new)
        io.open(p, "w", encoding="utf-8", newline="\n").write(NOTE + manifest + new)
        print(f"{name:18s} {count}곳 바꿈 · 파일 {files}개 · "
              f"{before / 1024:.0f}KB → {after / 1024:.0f}KB"
              + (f" (주석 안 {in_com}곳은 그대로)" if in_com else ""))
        total += count
        touched += 1

    print(f"\n{'세어 본 것' if dry else '바꾼 것'} {total}곳"
          + ("" if dry else f" · 파일 {touched}개"))


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "--확인"]
    run(os.path.abspath(args[0]) if args else os.path.dirname(os.path.abspath(__file__)),
        "--확인" in sys.argv)
