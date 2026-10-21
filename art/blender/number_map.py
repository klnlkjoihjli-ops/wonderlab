"""数字岛底图：按 src/demo/numberLayout.json 生成地形（海、沙滩、草地、小山、瀑布、小河、池塘、小路、花园），
用和物件一样的镜头角度、一样的暖光渲染成一张大图。地形一次性用 numpy 算，地图再大也快。
运行：blender -b -P number_map.py                      （数字岛）
      WL_LAYOUT=src/proto/discoverLayout.json WL_OUT=public/art/discover/base.png blender -b -P number_map.py   （发现岛）
输出：public/art/number/base.png（世界尺寸的 1.5 倍）
布局里可以有 routes（几条小路）；没有就用 gate + 关卡点连成一条。river、waterfall、garden、plaza 都是可选的。
"""
import json
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import clay   # noqa: E402
import sprites   # noqa: E402

ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
L = json.load(open(os.path.join(ROOT, os.environ.get('WL_LAYOUT', 'src/demo/numberLayout.json'))))
W, H, PPMAP = L['world']['w'], L['world']['h'], L['world']['pxPerMeter']
SIN = math.sin(sprites.ELEV)
RES = 1.5                       # 渲染倍数


def catmull(pts, steps=16):
    out = []
    for i in range(len(pts) - 1):
        p0, p1, p2, p3 = pts[max(0, i - 1)], pts[i], pts[i + 1], pts[min(len(pts) - 1, i + 2)]
        for s in range(steps):
            t = s / steps
            out.append([0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t ** 3) for k in (0, 1)])
    out.append(list(pts[-1]))
    return np.array(out, dtype=np.float64)


def poly_dist(X, Y, pts):
    """网格上每个点到折线的最短距离"""
    best = np.full(X.shape, 1e9)
    for (ax, ay), (bx, by) in zip(pts[:-1], pts[1:]):
        dx, dy = bx - ax, by - ay
        l2 = dx * dx + dy * dy or 1.0
        t = np.clip(((X - ax) * dx + (Y - ay) * dy) / l2, 0, 1)
        best = np.minimum(best, np.hypot(X - ax - t * dx, Y - ay - t * dy))
    return best


def vnoise(X, Y, scale, seed):
    """平滑的值噪声（-0.5..0.5）"""
    rng = np.random.default_rng(seed)
    gx, gy = int((W + 600) / scale) + 3, int((H + 600) / scale) + 3
    g = rng.random((gy + 2, gx + 2)) - 0.5
    fx, fy = (X + 300) / scale, (Y + 300) / scale
    ix, iy = np.clip(np.floor(fx).astype(int), 0, gx), np.clip(np.floor(fy).astype(int), 0, gy)
    tx, ty = np.clip(fx - ix, 0, 1), np.clip(fy - iy, 0, 1)
    tx, ty = tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)
    a, b, c, d = g[iy, ix], g[iy, ix + 1], g[iy + 1, ix], g[iy + 1, ix + 1]
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty


def hexrgb(h):
    return np.array(clay.hex_linear(h)[:3])


def build_terrain(nx=900, ny=600):
    x0, x1, y0, y1 = -200, W + 200, -260, H + 160
    X, Y = np.meshgrid(np.linspace(x0, x1, nx + 1), np.linspace(y0, y1, ny + 1))
    I = L['island']
    n1 = vnoise(X, Y, 420, I['seed']) + vnoise(X, Y, 160, I['seed'] + 1) * 0.5
    n2 = vnoise(X, Y, 90, I['seed'] + 2) * 0.6 + vnoise(X, Y, 230, I['seed'] + 3) * 0.6
    dx, dy = (X - I['cx']) / I['rx'], (Y - I['cy']) / I['ry']
    m = 1 - (dx * dx + dy * dy) ** 0.85 + n1 * 0.28          # >0 是陆地；噪声让海岸线有海湾和岬角
    land = m > 0
    h = np.where(land, -0.18 + np.minimum(1, m * 6) * 0.18 + n2 * 0.04, np.maximum(-1.6, -0.18 + m * 5))
    hill = np.zeros_like(X)
    for hx, hy, hr in L['hills']:
        d = np.hypot(X - hx, (Y - hy) * 1.4)
        hill += 5.2 * (hr / 300) * np.exp(-(d / hr) ** 2 * 1.5)
    hill = np.where(land, hill, 0)
    h = h + hill
    if 'routes' in L:
        pd_ = np.min([poly_dist(X, Y, catmull(r)) for r in L['routes']], axis=0)
    else:
        pd_ = poly_dist(X, Y, catmull([L['gate']] + [L['spots'][f'm{i}'] for i in range(1, 11)]))
    rd = poly_dist(X, Y, catmull(L['river'])) if 'river' in L else np.full(X.shape, 1e9)
    if 'waterfall' in L:
        wx, wy = L['waterfall']
        wf = np.hypot(X - wx, (Y - wy) * 0.8) < 80            # 瀑布：河的源头，从山上落下来
    else:
        wf = np.zeros(X.shape, bool)
    river_on = (rd < 40) & land
    h = np.where(river_on, np.minimum(h, -0.65 + (rd / 40) ** 2 * 0.6 + np.where(wf, hill * 0.7, 0)), h)
    P = L['pond']
    pdist = ((X - P['cx']) / P['rx']) ** 2 + ((Y - P['cy']) / P['ry']) ** 2
    h = np.where(pdist < 1.25, np.minimum(h, -0.65 + np.maximum(0, pdist - 0.85) * 1.6), h)
    path = (pd_ < 26) & land & ~river_on
    h = np.where(path, h - 0.02, h)
    # —— 颜色 ——
    deep, shallow = hexrgb('#2b86b3'), hexrgb('#86ddd5')
    t_sea = np.clip(-m * 3, 0, 1)[..., None]
    C = shallow * (1 - t_sea) + deep * t_sea
    grass1, grass2, hillc, meadow = hexrgb('#a6d670'), hexrgb('#c2e489'), hexrgb('#6fae54'), hexrgb('#d6e98f')
    tg = np.clip(0.5 + n2 * 0.7, 0, 1)[..., None]
    G = grass1 * (1 - tg) + grass2 * tg
    th = np.clip(hill / 3.5, 0, 1)[..., None]
    G = G * (1 - th) + hillc * th
    md = np.clip((vnoise(X, Y, 260, 99) - 0.18) * 4, 0, 1)[..., None]   # 一片片浅黄绿的“草甸”
    G = G * (1 - md * 0.6) + meadow * md * 0.6
    C = np.where(land[..., None], G, C)
    sand, wet = hexrgb('#f7dea6'), hexrgb('#e6c086')
    tb = np.clip(m / 0.07, 0, 1)[..., None]
    C = np.where((land & (m < 0.07))[..., None], wet * (1 - tb) + sand * tb, C)
    pathc, edge = hexrgb('#f3dbab'), hexrgb('#d4ab76')
    te = np.clip((pd_ - 18) / 8, 0, 1)[..., None]
    C = np.where(path[..., None], pathc * (1 - te) + edge * te, C)
    C = np.where(((river_on & (rd < 32)) | (pdist < 1))[..., None], hexrgb('#6fd3e6'), C)
    C = np.where((wf & river_on)[..., None], hexrgb('#f2fbff'), C)       # 瀑布白白的水花
    if 'garden' in L:
        gx, gy = L['garden']
        C = np.where(((((X - gx) / 120) ** 2 + ((Y - gy) / 52) ** 2) < 1)[..., None], hexrgb('#c99060'), C)
    if 'plaza' in L:
        pl = L['plaza']
        C = np.where(((((X - pl[0]) / 220) ** 2 + ((Y - pl[1]) / 80) ** 2) < 1)[..., None] & land[..., None], hexrgb('#efe2c4'), C)
    # —— 建网格 ——
    GX, GY = (X - W / 2) / PPMAP, (H / 2 - Y) / (PPMAP * SIN)
    verts = np.stack([GX.ravel(), GY.ravel(), h.ravel()], 1).astype(np.float32)
    ii = np.arange((ny + 1) * (nx + 1)).reshape(ny + 1, nx + 1)
    faces = np.stack([ii[:-1, :-1].ravel(), ii[:-1, 1:].ravel(), ii[1:, 1:].ravel(), ii[1:, :-1].ravel()], 1).astype(np.int32)
    me = bpy.data.meshes.new('Terrain')
    me.vertices.add(len(verts)); me.vertices.foreach_set('co', verts.ravel())
    me.loops.add(faces.size); me.loops.foreach_set('vertex_index', faces.ravel())
    me.polygons.add(len(faces))
    me.polygons.foreach_set('loop_start', (np.arange(len(faces)) * 4).astype(np.int32))
    me.polygons.foreach_set('loop_total', np.full(len(faces), 4, np.int32))
    me.update(calc_edges=True)
    me.polygons.foreach_set('use_smooth', np.ones(len(faces), bool))
    attr = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    rgba = np.concatenate([C.reshape(-1, 3), np.ones((C.size // 3, 1))], 1).astype(np.float32)
    attr.data.foreach_set('color', rgba.ravel())
    ob = bpy.data.objects.new('Terrain', me)
    bpy.context.scene.collection.objects.link(ob)
    mt = bpy.data.materials.new('TerrainMat'); mt.use_nodes = True
    nt = mt.node_tree
    vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Col'
    p = nt.nodes['Principled BSDF']; p.inputs['Roughness'].default_value = 0.9
    nt.links.new(vc.outputs['Color'], p.inputs['Base Color'])
    me.materials.append(mt)


def build_water():
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, -0.3))
    w = bpy.context.active_object
    w.name = 'Water'; w.scale = (140, 140, 1)
    m = bpy.data.materials.new('WaterMat'); m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = clay.hex_linear('#43c0de')
    p.inputs['Roughness'].default_value = 0.22
    p.inputs['Alpha'].default_value = 0.6
    w.data.materials.append(m)


def build_garden():
    """兔子花园：一片彩色的花"""
    gx, gy = L['garden']
    cols = ['#ff6b8a', '#ffcf4a', '#b48cff', '#ff8f4a', '#ffffff']
    for k in range(40):
        x = gx - 100 + (k % 10) * 22 + (k // 10 % 2) * 11
        y = gy - 36 + (k // 10) * 24
        g = ((x - W / 2) / PPMAP, (H / 2 - y) / (PPMAP * SIN))
        clay.sphere(f'Flower{k}', 0.15, (g[0], g[1], 0.2), clay.mat('Fl' + cols[k % 5], cols[k % 5], 0.5), None)


def main():
    sc = sprites.reset_sprite_scene()
    bpy.data.objects.remove(bpy.data.objects['ShadowCatcher'])
    sc.render.film_transparent = False
    sc.world.node_tree.nodes['Background'].inputs['Color'].default_value = clay.hex_linear('#43c0de')
    build_terrain()
    build_water()
    build_garden()
    cam = sprites._camera()
    fwd = Vector((0, math.cos(sprites.ELEV), -math.sin(sprites.ELEV)))
    cam.location = Vector((0, 0, 0)) - fwd * 120
    cam.data.ortho_scale = W / PPMAP
    sc.render.resolution_x, sc.render.resolution_y = int(W * RES), int(H * RES)
    sc.cycles.samples = 40
    out = os.path.join(ROOT, os.environ.get('WL_OUT', 'public/art/number/base.png'))
    sc.render.filepath = out
    bpy.ops.render.render(write_still=True)
    print('BASE', out)


main()
