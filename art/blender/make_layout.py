"""生成数字岛的布局表 src/demo/numberLayout.json（地图像素坐标）。
大件（区域、关卡、小河、地标）手摆；树木自动撒，避开小路、小河、关卡和建筑。
运行：python3 art/blender/make_layout.py
"""
import json
import math
import os
import random

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
W, H = 4000, 2600
L = {
    "_说明": "数字岛布局（地图像素坐标，世界 4000×2600，60 像素/米）。Blender 渲染底图、程序摆放物件，都读这一份。由 art/blender/make_layout.py 生成。",
    "world": {"w": W, "h": H, "pxPerMeter": 60},
    "island": {"cx": 2000, "cy": 1330, "rx": 1850, "ry": 1150, "seed": 7},
    "gate": [960, 2250],
    "spots": {
        "m1": [1150, 2060], "m2": [1470, 2150], "m3": [1330, 1820], "m4": [1620, 1600], "m5": [1920, 1430],
        "m6": [2080, 1200], "m7": [2560, 1080], "m8": [2880, 1300], "m9": [3200, 1540], "m10": [3460, 1260]
    },
    "river": [[2300, 560], [2330, 800], [2260, 1050], [2310, 1250], [2250, 1550], [2320, 1900], [2280, 2300], [2300, 2720]],
    "waterfall": [2300, 560],
    "pond": {"cx": 1830, "cy": 1960, "rx": 150, "ry": 80},
    "hills": [[500, 420, 260], [1000, 330, 300], [1550, 360, 280], [2300, 420, 340], [2850, 380, 300], [3400, 450, 280], [3650, 800, 220], [2950, 700, 200]],
    "garden": [1020, 1975],
    "plaza": [1330, 2290],
    "rabbit": [960, 2110],
    "props": [
        {"id": "bridge", "at": [2290, 1150]},
        {"id": "lighthouse", "at": [820, 2150], "tap": "lighthouse"},
        {"id": "windmill", "at": [2900, 760], "tap": "windmill"},
        {"id": "castle", "at": [1780, 1270], "tap": "castle"},
        {"id": "rainbow", "at": [3040, 1440]},
        {"id": "sculpture1", "at": [1190, 2290], "scale": 0.75}, {"id": "sculpture2", "at": [1275, 2318], "scale": 0.75}, {"id": "sculpture3", "at": [1360, 2290], "scale": 0.75},
        {"id": "clocktower", "at": [3420, 760], "tap": "clock"},
        {"id": "house1", "at": [1000, 1760]}, {"id": "house2", "at": [1160, 1690]}, {"id": "house3", "at": [1720, 2240]},
        {"id": "house4", "at": [1890, 2260]}, {"id": "house5", "at": [2660, 1620]}, {"id": "house6", "at": [2930, 1760]},
        {"id": "appletree", "at": [1250, 1960], "tap": "apple"},
        {"id": "sign", "at": [1080, 2240], "label": "🔢 数字小镇"},
        {"id": "sign", "at": [1640, 1420], "label": "🏰 积木城堡"},
    ],
    "boats": [[620, 2440], [3500, 2400]],
    "areas": [
        {"id": "town", "name": "数字小镇", "open": True},
        {"id": "market", "name": "比一比集市", "at": [900, 820], "open": False},
        {"id": "clock", "name": "钟楼广场", "at": [3420, 700], "open": False}
    ]
}


def catmull(pts, steps=14):
    out = []
    for i in range(len(pts) - 1):
        p0, p1, p2, p3 = pts[max(0, i - 1)], pts[i], pts[i + 1], pts[min(len(pts) - 1, i + 2)]
        for s in range(steps):
            t = s / steps
            out.append(tuple(0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t ** 3) for k in (0, 1)))
    out.append(tuple(pts[-1]))
    return out


def seg_dist(px, py, pts):
    best = 1e9
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        dx, dy = bx - ax, by - ay
        l2 = dx * dx + dy * dy or 1
        t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / l2))
        best = min(best, math.hypot(px - ax - t * dx, py - ay - t * dy))
    return best


def on_land(x, y, margin=0.12):
    I = L['island']
    return ((x - I['cx']) / I['rx']) ** 2 + ((y - I['cy']) / I['ry']) ** 2 < (1 - margin)


route = catmull([L['gate']] + [L['spots'][f'm{i}'] for i in range(1, 11)])
river = catmull(L['river'])
blocked = [tuple(p['at']) for p in L['props']] + [tuple(v) for v in L['spots'].values()] + [tuple(L['rabbit']), tuple(L['plaza']), tuple(L['garden'])]
fogs = [tuple(a['at']) for a in L['areas'] if 'at' in a]
rnd = random.Random(11)
trees = []
for _ in range(4000):
    if len(trees) >= 46:
        break
    x, y = rnd.uniform(250, W - 250), rnd.uniform(500, H - 200)
    if not on_land(x, y):
        continue
    if seg_dist(x, y, route) < 110 or seg_dist(x, y, river) < 90:
        continue
    if any(math.hypot(x - bx, y - by) < 150 for bx, by in blocked):
        continue
    if any(math.hypot(x - fx, (y - fy) * 1.3) < 330 for fx, fy in fogs):
        continue
    if math.hypot(x - L['pond']['cx'], (y - L['pond']['cy']) * 1.6) < 230:
        continue
    if any(math.hypot(x - t[0], y - t[1]) < 95 for t in trees):
        continue
    trees.append((round(x), round(y)))
# “形状森林”：第 3 关附近多种一些塔形树
for i, (x, y) in enumerate(trees):
    near_shapes = math.hypot(x - 1150, y - 1550) < 420
    kind = 1 if near_shapes else (2 if rnd.random() < 0.22 else 0)
    L['props'].append({"id": f"tree{kind}", "at": [x, y]})

out = os.path.join(ROOT, 'src', 'demo', 'numberLayout.json')
json.dump(L, open(out, 'w'), ensure_ascii=False, indent=1)
print('layout', out, 'trees', len(trees))
