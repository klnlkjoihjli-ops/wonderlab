"""数字岛底图：按 src/demo/numberLayout.json 生成地形（海、沙滩、草地、小山、小河、池塘、小路），
用和物件一样的镜头角度、一样的暖光渲染成一张大图。
运行：blender -b -P number_map.py
输出：public/art/number/base.jpg（4800×3000，程序里按 2400×1500 用）
"""
import json
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector, noise

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import clay   # noqa: E402
import sprites   # noqa: E402

ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
L = json.load(open(os.path.join(ROOT, 'src', 'demo', 'numberLayout.json')))
W, H, PPMAP = L['world']['w'], L['world']['h'], L['world']['pxPerMeter']
SIN = math.sin(sprites.ELEV)


def to_ground(x, y):
    """地图像素 → 地面米（镜头正对画面中心）"""
    return (x - W / 2) / PPMAP, (H / 2 - y) / (PPMAP * SIN)


def catmull(pts, steps=16):
    out = []
    for i in range(len(pts) - 1):
        p0, p1, p2 = pts[max(0, i - 1)], pts[i], pts[i + 1]
        p3 = pts[min(len(pts) - 1, i + 2)]
        for s in range(steps):
            t = s / steps
            t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3) for k in (0, 1)))
    out.append(tuple(pts[-1]))
    return out


def seg_dist(px, py, pts):
    best = 1e9
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        dx, dy = bx - ax, by - ay
        L2 = dx * dx + dy * dy or 1
        t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / L2))
        qx, qy = ax + t * dx, ay + t * dy
        d = (px - qx) ** 2 + (py - qy) ** 2
        if d < best:
            best = d
    return math.sqrt(best)


ROUTE = catmull([L['gate']] + [L['spots'][k] for k in ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10']])
RIVER = catmull(L['river'])
IS = L['island']
POND = L['pond']


def sample(x, y):
    """地图像素 (x, y) 处的高度（米）和颜色"""
    n = noise.noise(Vector((x / 260 + IS['seed'], y / 260, 0.3)))
    n2 = noise.noise(Vector((x / 90, y / 90, 1.7)))
    dx, dy = (x - IS['cx']) / IS['rx'], (y - IS['cy']) / IS['ry']
    m = 1 - (dx * dx + dy * dy) ** 0.85 + n * 0.16          # >0 是陆地
    if m <= 0:
        h = max(-1.4, -0.18 + m * 5)                          # 海底：从岸边慢慢变深，没有悬崖
        return h, ('sea', min(1, -m * 3))
    h = -0.18 + min(1, m * 6) * 0.18 + n2 * 0.03            # 平地在 z≈0（物件也是按 z=0 落地渲染的）
    hill = 0
    for hx, hy, hr in L['hills']:
        d = math.hypot(x - hx, (y - hy) * 1.4)
        if d < hr * 1.8:
            hill += 2.6 * (hr / 190) * math.exp(-(d / hr) ** 2 * 1.8)
    h += hill
    # 小河、池塘挖下去
    rd = seg_dist(x, y, RIVER)
    if rd < 34:
        h = min(h, -0.6 + (rd / 34) ** 2 * 0.55)
        if rd < 26:
            return h, ('river', rd / 26)
    pd = ((x - POND['cx']) / POND['rx']) ** 2 + ((y - POND['cy']) / POND['ry']) ** 2
    if pd < 1.25:
        h = min(h, -0.6 + max(0, pd - 0.85) * 1.4)
        if pd < 1:
            return h, ('river', pd)
    # 小路先于沙滩判断：从码头上岸的那一段小路也要画出来
    pathd = seg_dist(x, y, ROUTE)
    if pathd < 22:
        return h - 0.02, ('path', pathd / 22)
    if m < 0.06:
        return h, ('sand', m / 0.06)
    gx, gy = L['garden']
    gd = ((x - gx) / 105) ** 2 + ((y - gy) / 44) ** 2
    if gd < 1:
        return h, ('garden', gd)
    return h, ('hill' if hill > 0.35 else 'grass', n2 if hill <= 0.35 else min(1, hill / 2))


def rgb(hexs):
    return clay.hex_linear(hexs)[:3]


def mix(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


COL = {
    'deep': rgb('#2e8fb8'), 'shallow': rgb('#7fd8d2'), 'sand': rgb('#f6dca2'), 'wetsand': rgb('#e8c48a'),
    'grass1': rgb('#a9d873'), 'grass2': rgb('#c6e48c'), 'hill': rgb('#8cc565'), 'path': rgb('#f1d7a6'), 'pathedge': rgb('#d8b07a'),
    'river': rgb('#6fd0e4'), 'garden': rgb('#c98f5c'),
}


def color(kind, t):
    if kind == 'sea':
        return mix(COL['shallow'], COL['deep'], min(1, t))
    if kind == 'river':
        return mix(COL['river'], COL['wetsand'], max(0, t - 0.85) * 4)
    if kind == 'sand':
        return mix(COL['wetsand'], COL['sand'], t)
    if kind == 'path':
        return mix(COL['path'], COL['pathedge'], max(0, t - 0.75) * 4)
    if kind == 'garden':
        return mix(COL['garden'], COL['grass1'], max(0, t - 0.8) * 5)
    if kind == 'hill':
        return mix(COL['grass1'], COL['hill'], t)
    return mix(COL['grass1'], COL['grass2'], (t + 0.5))


def build_terrain():
    nx, ny = 640, 440
    x0, x1, y0, y1 = -150, W + 150, -220, H + 120
    bm = bmesh.new()
    col_layer = bm.loops.layers.color.new('Col')
    verts, cols = [], []
    for j in range(ny + 1):
        row = []
        for i in range(nx + 1):
            x = x0 + (x1 - x0) * i / nx
            y = y0 + (y1 - y0) * j / ny
            h, (kind, t) = sample(x, y)
            gx, gy = to_ground(x, y)
            row.append(bm.verts.new((gx, gy, h)))
            cols.append(color(kind, t))
        verts.append(row)
    vcol = {}
    for j in range(ny + 1):
        for i in range(nx + 1):
            vcol[verts[j][i]] = cols[j * (nx + 1) + i]
    for j in range(ny):
        for i in range(nx):
            f = bm.faces.new((verts[j][i], verts[j][i + 1], verts[j + 1][i + 1], verts[j + 1][i]))
            for loop in f.loops:
                c = vcol[loop.vert]
                loop[col_layer] = (c[0], c[1], c[2], 1)
    me = bpy.data.meshes.new('Terrain')
    bm.to_mesh(me)
    bm.free()
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    ob = bpy.data.objects.new('Terrain', me)
    bpy.context.scene.collection.objects.link(ob)
    m = bpy.data.materials.new('TerrainMat')
    m.use_nodes = True
    nt = m.node_tree
    attr = nt.nodes.new('ShaderNodeVertexColor')
    attr.layer_name = 'Col'
    p = nt.nodes['Principled BSDF']
    p.inputs['Roughness'].default_value = 0.9
    nt.links.new(attr.outputs['Color'], p.inputs['Base Color'])
    me.materials.append(m)
    return ob


def build_water():
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, -0.3))
    w = bpy.context.active_object
    w.name = 'Water'
    w.scale = (70, 70, 1)
    m = bpy.data.materials.new('WaterMat')
    m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = clay.hex_linear('#47c2df')
    p.inputs['Roughness'].default_value = 0.25
    p.inputs['Alpha'].default_value = 0.62
    m.surface_render_method = 'BLENDED' if hasattr(m, 'surface_render_method') else None
    w.data.materials.append(m)


def build_garden():
    """兔子花园：一小片彩色的花"""
    gx, gy = L['garden']
    cols = ['#ff6b8a', '#ffcf4a', '#b48cff', '#ff8f4a', '#ffffff']
    for k in range(26):
        x = gx - 84 + (k % 9) * 21 + (k // 9 % 2) * 10
        y = gy - 24 + (k // 9) * 24
        h, _ = sample(x, y)
        g = to_ground(x, y)
        clay.sphere(f'Flower{k}', 0.15, (g[0], g[1], h + 0.2), clay.mat('Fl' + cols[k % 5], cols[k % 5], 0.5), None)
        clay.cylinder(f'Stem{k}', 0.02, 0.18, (g[0], g[1], h + 0.07), clay.mat('Stem', '#4f9a45', 0.7), None)


def main():
    sc = sprites.reset_sprite_scene()
    bpy.data.objects.remove(bpy.data.objects['ShadowCatcher'])
    sc.render.film_transparent = False
    sc.world.node_tree.nodes['Background'].inputs['Color'].default_value = clay.hex_linear('#47c2df')
    build_terrain()
    build_water()
    build_garden()
    cam = sprites._camera()
    fwd = Vector((0, math.cos(sprites.ELEV), -math.sin(sprites.ELEV)))
    cam.location = Vector((0, 0, 0)) - fwd * 80
    cam.data.ortho_scale = W / PPMAP
    sc.render.resolution_x, sc.render.resolution_y = W * 2, H * 2
    sc.cycles.samples = 48
    out = os.path.join(ROOT, 'public', 'art', 'number', 'base.png')
    sc.render.filepath = out
    bpy.ops.render.render(write_still=True)
    print('BASE', out)


main()
