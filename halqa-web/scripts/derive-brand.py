#!/usr/bin/env python3
"""Derive production assets from the master HALQA mark.

Master: public/brand/halqa-mark.svg (auto-trace, 1920², 5 paths, 285 KB)
  path 0 = rounded frame
  path 1..4 = the pinwheel mark

Outputs:
  public/brand/halqa-symbol.svg  frame-less mark, simplified for small sizes
  public/icon-192.png · icon-512.png · apple-touch-icon.png · favicon.svg
"""
import math
import re
import struct
import subprocess
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MASTER = ROOT / 'public/brand/halqa-mark.svg'


# ---------------------------------------------------------------- path parse
def parse_path(d):
    """Absolute M/L/C/Z subset → list of subpaths as cubic segments."""
    toks = re.findall(r'[MLCZmlcz]|-?\d+\.?\d*', d)
    subs, cur, i, cmd, pen = [], [], 0, None, (0.0, 0.0)
    start = (0.0, 0.0)
    while i < len(toks):
        t = toks[i]
        if t.isalpha():
            cmd = t
            i += 1
            if cmd in 'Zz':
                if cur:
                    subs.append(cur)
                cur, pen = [], start
            continue
        if cmd in 'Mm':
            x, y = float(toks[i]), float(toks[i + 1]); i += 2
            if cur:
                subs.append(cur)
            pen = start = (x, y)
            cur = [('M', x, y)]
            cmd = 'L' if cmd == 'M' else 'l'
        elif cmd in 'Ll':
            x, y = float(toks[i]), float(toks[i + 1]); i += 2
            cur.append(('L', x, y)); pen = (x, y)
        elif cmd in 'Cc':
            pts = [float(v) for v in toks[i:i + 6]]; i += 6
            cur.append(('C', pen, (pts[0], pts[1]), (pts[2], pts[3]), (pts[4], pts[5])))
            pen = (pts[4], pts[5])
        else:
            i += 1
    if cur:
        subs.append(cur)
    return subs


def flatten(subs, steps=8):
    """Sample cubics into polylines."""
    out = []
    for sp in subs:
        poly, pen = [], None
        for seg in sp:
            if seg[0] == 'M':
                poly.append((seg[1], seg[2])); pen = (seg[1], seg[2])
            elif seg[0] == 'L':
                poly.append((seg[1], seg[2])); pen = (seg[1], seg[2])
            elif seg[0] == 'C':
                _, p0, c1, c2, p3 = seg
                for k in range(1, steps + 1):
                    t = k / steps
                    mt = 1 - t
                    x = (mt**3 * p0[0] + 3 * mt**2 * t * c1[0] + 3 * mt * t**2 * c2[0] + t**3 * p3[0])
                    y = (mt**3 * p0[1] + 3 * mt**2 * t * c1[1] + 3 * mt * t**2 * c2[1] + t**3 * p3[1])
                    poly.append((x, y))
                pen = p3
        out.append(poly)
    return out


def rdp(pts, eps):
    """Ramer–Douglas–Peucker."""
    if len(pts) < 3:
        return pts
    ax, ay = pts[0]
    bx, by = pts[-1]
    dx, dy = bx - ax, by - ay
    n = math.hypot(dx, dy)
    best, idx = -1.0, 0
    for i in range(1, len(pts) - 1):
        px, py = pts[i]
        dist = abs(dy * (px - ax) - dx * (py - ay)) / n if n else math.hypot(px - ax, py - ay)
        if dist > best:
            best, idx = dist, i
    if best <= eps:
        return [pts[0], pts[-1]]
    return rdp(pts[:idx + 1], eps)[:-1] + rdp(pts[idx:], eps)


def simplify(subs, eps):
    keep = []
    for poly in flatten(subs):
        if len(poly) < 3:
            continue
        closed = poly + [poly[0]] if poly[0] != poly[-1] else poly
        s = rdp(closed, eps)
        if len(s) >= 3:
            keep.append(s)
    d = []
    for s in keep:
        d.append(f'M{s[0][0]:.1f} {s[0][1]:.1f}' + ''.join(f'L{x:.1f} {y:.1f}' for x, y in s[1:]) + 'Z')
    return ''.join(d)


# ------------------------------------------------------------------- rasters
def render_png(svg_path, out_path, size):
    subprocess.run(
        ['node', str(ROOT.parent / 'demo/shot.cjs'),
         f"data:text/html,<body style='margin:0'>{svg_path}</body>",
         str(out_path), str(size)],
        check=True, capture_output=True, cwd=str(ROOT.parent / 'demo'))
    return out_path.stat().st_size


def main():
    master = MASTER.read_text()
    defs = re.search(r'<defs>.*?</defs>', master, re.S).group(0)
    paths = re.findall(r'<path[^>]*>', master)
    frame, mark = paths[0], paths[1:]

    # --- symbol: mark only, geometrically simplified -----------------------
    budget = []
    for p in mark:
        cols = re.search(r'<path fill="([^"]+)"', p).group(1)
        d = re.search(r'd="([^"]+)"', p).group(1)
        subs = parse_path(d)
        simp = simplify(subs, eps=1.1)
        budget.append((cols, simp))
    body = '\n'.join(f'  <path fill="{c}" fill-rule="evenodd" d="{d}"/>' for c, d in budget)
    symbol = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1920" '
              f'role="img" aria-label="HALQA">\n{defs}\n{body}\n</svg>\n')
    (ROOT / 'public/brand/halqa-symbol.svg').write_text(symbol)

    # --- icons: full mark, on white ---------------------------------------
    icon = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1920" '
            f'width="512" height="512">\n{defs}\n  <rect width="1920" height="1920" fill="#fff"/>\n'
            + '\n'.join('  ' + p for p in paths) + '\n</svg>\n')
    (ROOT / 'public/icon-full.svg').write_text(icon)

    master_kb = MASTER.stat().st_size / 1024
    sym_kb = len(symbol) / 1024
    print(f'master   {master_kb:7.1f} KB')
    print(f'symbol   {sym_kb:7.1f} KB  ({sym_kb / master_kb * 100:.0f}% of master)')
    print(f'paths simplified: {", ".join(str(len(d)) + " chars" for _, d in budget)}')


if __name__ == '__main__':
    main()
