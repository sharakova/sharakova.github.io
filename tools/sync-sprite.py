#!/usr/bin/env python3
"""assets/icons.svg を各 HTML の <body> 先頭に埋め込む。

以前は js/site.js から fetch していたが、ブラウザキャッシュに古い
スプライトが残るとアイコンが表示されない・追加したアイコンが反映されない
という問題があったため、HTML に直接書き出す方式にしている。

アイコンを追加・修正したら assets/icons.svg を編集してこのスクリプトを実行する:

    python3 tools/sync-sprite.py
"""

import glob
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPRITE = os.path.join(ROOT, "assets", "icons.svg")
TARGETS = ["index.html", "projects/*.html", "skills/*.html"]

BEGIN = "<!-- icon sprite: assets/icons.svg / tools/sync-sprite.py で同期 -->"
END = "<!-- /icon sprite -->"


def build_block(indent="    "):
    svg = open(SPRITE, encoding="utf-8").read().strip()
    # ルート <svg> の属性を差し替える
    svg = re.sub(
        r"^<svg[^>]*>",
        '<svg xmlns="http://www.w3.org/2000/svg" id="svg-sprite" '
        'style="display:none" aria-hidden="true" focusable="false">',
        svg,
        count=1,
    )
    body = "\n".join(indent + line if line.strip() else line for line in svg.split("\n"))
    return f"{indent}{BEGIN}\n{body}\n{indent}{END}"


def main():
    block = build_block()
    pattern = re.compile(
        r"[ \t]*" + re.escape(BEGIN) + r".*?" + re.escape(END), re.S
    )
    changed = []

    for target in TARGETS:
        for path in sorted(glob.glob(os.path.join(ROOT, target))):
            src = open(path, encoding="utf-8").read()
            if BEGIN in src:
                out = pattern.sub(lambda _: block, src, count=1)
            elif "<body>" in src:
                out = src.replace("<body>", "<body>\n" + block, 1)
            else:
                print(f"skip (no <body>): {path}", file=sys.stderr)
                continue
            if out != src:
                open(path, "w", encoding="utf-8").write(out)
                changed.append(os.path.relpath(path, ROOT))

    print(f"synced {len(changed)} file(s)")
    for name in changed:
        print("  " + name)


if __name__ == "__main__":
    main()
