"""数字岛的地图物件（风格 A：暖色黏土、2.5D）。
运行：blender -b -P number_props.py -- [物件名 ...]   （不写就全部渲染）
输出：public/art/number/*.png 和 manifest.json（每张图的尺寸和落地点）
"""
import math
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from clay import box, cylinder, sphere, mat, empty, hex_linear   # noqa: E402
import clay   # noqa: E402
from sprites import reset_sprite_scene, render_sprite, save_manifest   # noqa: E402

OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'public', 'art', 'number'))


def cone(name, r1, r2, depth, loc, material, parent, segs=32, rot=(0, 0, 0), bevel=0.0):
    import bmesh
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs, radius1=r1, radius2=r2, depth=depth)
    return clay.finish(name, bm, material, parent, loc, rot, bevel=bevel, segs=2)


def text(name, s, size, loc, material, parent, rot=(math.radians(90), 0, 0), depth=0.03):
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = s
    cu.size = size
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    cu.extrude = depth
    cu.bevel_depth = 0.008
    ob = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(ob)
    ob.data.materials.append(material)
    ob.parent = parent
    ob.location = loc
    ob.rotation_euler = rot
    return ob


def prism(name, length, depth, height, loc, material, parent):
    """三角柱：沿 X 方向长 length，底边沿 Y 宽 depth，尖顶高 height（底边在 loc 的高度）"""
    import bmesh
    bm = bmesh.new()
    vs = []
    for x in (-length / 2, length / 2):
        vs.append([bm.verts.new((x, -depth / 2, 0)), bm.verts.new((x, depth / 2, 0)), bm.verts.new((x, 0, height))])
    bm.faces.new(vs[0]); bm.faces.new(list(reversed(vs[1])))
    for i in range(3):
        j = (i + 1) % 3
        bm.faces.new((vs[0][i], vs[1][i], vs[1][j], vs[0][j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return clay.finish(name, bm, material, parent, loc, smooth=False)


# ===================== 钟楼 =====================
def clocktower(restored: bool):
    root = empty('ClockTower', (0, 0, 0))
    grey = not restored
    wall = mat('TWall' + ('R' if restored else 'G'), '#f3d3a2' if restored else '#cfcac3', 0.85)
    stone = mat('TStone' + ('R' if restored else 'G'), '#d8b98c' if restored else '#bdb6ad', 0.9)
    roof = mat('TRoof' + ('R' if restored else 'G'), '#ec6f55' if restored else '#a99d98', 0.55)
    trim = mat('TTrim', '#fffaf0', 0.6)
    ink = mat('TInk', '#3a3340', 0.4)
    wood = mat('TWood', '#a8703c', 0.7)
    gold = mat('TGold', '#f4c64a', 0.35, metal=0.4)
    glow = mat('TGlow', '#ffe3a1', 0.5, emit='#ffcf6a') if restored else mat('TDark', '#5d5a66', 0.6)
    # 底座 + 塔身 + 钟层
    box('Base', (1.5, 1.5, 0.5), (0, 0, 0.25), stone, root, bevel=0.12)
    box('Body', (1.2, 1.2, 2.2), (0, 0, 1.6), wall, root, bevel=0.1)
    box('Belt', (1.32, 1.32, 0.16), (0, 0, 2.72), trim, root, bevel=0.06)
    box('Belfry', (1.25, 1.25, 0.9), (0, 0, 3.25), wall, root, bevel=0.1)
    # 屋顶：四棱锥
    cone('Roof', 1.05, 0.02, 1.25, (0, 0, 4.32), roof, root, segs=4, rot=(0, 0, math.radians(45)), bevel=0.06)
    sphere('Tip', 0.11, (0, 0, 5.0), gold, root)
    # 正面（-Y，对着孩子）的大钟
    face = cylinder('Face', 0.43, 0.08, (0, -0.64, 3.25), trim, root, rot=(math.radians(90), 0, 0), bevel=0.02)
    cylinder('FaceRim', 0.47, 0.06, (0, -0.62, 3.25), gold if restored else stone, root, rot=(math.radians(90), 0, 0))
    for k in range(12):
        a = k / 12 * math.tau
        box(f'Tick{k}', (0.045, 0.02, 0.09 if k % 3 == 0 else 0.05), (math.sin(a) * 0.34, -0.69, 3.25 + math.cos(a) * 0.34), ink, root, bevel=0.01, rot=(0, -a, 0))
    # 指针：恢复时指 3 点，停摆时歪在 7:40
    hm, mm = (math.radians(90), 0) if restored else (math.radians(220), math.radians(240))
    for nm, ln, ang in (('Hour', 0.22, hm), ('Minute', 0.32, mm)):
        h = box(nm, (0.05, 0.03, ln), (0, 0, 0), ink, root, bevel=0.012)
        h.location = (math.sin(ang) * ln / 2, -0.71, 3.25 + math.cos(ang) * ln / 2)
        h.rotation_euler = (0, -ang, 0)
    sphere('Pin', 0.05, (0, -0.72, 3.25), gold, root)
    # 门和窗
    box('Door', (0.5, 0.08, 0.8), (0, -0.6, 0.85), wood, root, bevel=0.2)
    for x in (-0.3, 0.3):
        box(f'Win{x}', (0.22, 0.06, 0.32), (x, -0.6, 1.95), glow, root, bevel=0.08)
    if restored:
        # 小彩旗
        box('FlagLine', (1.5, 0.02, 0.02), (0, -0.82, 2.84), mat('TLine', '#fffaf0', 0.6), root, bevel=0.005)
        for i, c in enumerate(['#ee5a4f', '#ffcf4a', '#4fb39b', '#5b8fe0', '#9b7fe0']):
            box(f'Flag{i}', (0.16, 0.02, 0.18), (-0.6 + i * 0.3, -0.82, 2.74), mat('F' + c, c, 0.6), root, bevel=0.02, rot=(0, 0, 0))
    return root


# ===================== 带数字的小房子 =====================
HOUSE_COLORS = ['#ee7a5f', '#4fb39b', '#f0b62a', '#9b7fe0', '#5b8fe0', '#e0567a', '#6dbb4a', '#f08a4b', '#33b6d6', '#c98fd8']


def house(n: int, lit: bool):
    root = empty(f'House{n}', (0, 0, 0))
    roofc = HOUSE_COLORS[(n - 1) % len(HOUSE_COLORS)]
    wall = mat('HWall', '#fff1d8', 0.85)
    roof = mat('HRoof' + roofc, roofc, 0.55)
    wood = mat('HWood', '#a8703c', 0.7)
    trim = mat('HTrim', '#fffaf0', 0.6)
    glow = mat('HGlow', '#ffe3a1', 0.5, emit='#ffc86a') if lit else mat('HWinDark', '#8fb8d0', 0.3)
    box('Wall', (1.4, 1.2, 1.0), (0, 0, 0.5), wall, root, bevel=0.12)
    # 山墙：屋顶下面的三角形墙（前后方向是 Y，屋脊沿 X）
    prism('Gable', 1.3, 1.16, 0.46, (0, 0, 0.98), wall, root)
    # 人字形屋顶：两块平平的薄板，各自绕 X 轴往中间抬起来
    ang = math.radians(38)
    for s in (-1, 1):
        box(f'Roof{s}', (1.62, 0.82, 0.12), (0, s * 0.82 / 2 * math.cos(ang), 1.0 + 0.82 / 2 * math.sin(ang) + 0.04), roof, root, bevel=0.05, rot=(-s * ang, 0, 0))
    box('Chimney', (0.2, 0.2, 0.4), (0.42, 0.22, 1.42), mat('HBrick', '#d9826a', 0.8), root, bevel=0.05)
    # 正面：门、窗、门牌（数字）
    box('Door', (0.34, 0.08, 0.54), (-0.36, -0.61, 0.29), wood, root, bevel=0.12)
    box('Win', (0.32, 0.06, 0.3), (0.38, -0.61, 0.6), glow, root, bevel=0.06)
    cylinder('Plate', 0.17, 0.05, (0.0, -0.63, 0.78), trim, root, rot=(math.radians(90), 0, 0), bevel=0.02)
    text('Num', str(n), 0.24, (0.0, -0.67, 0.77), mat('HNum' + roofc, roofc, 0.5), root)
    return root


# ===================== 苹果树（苹果单独一张，用来做“掉下来”的彩蛋） =====================
def apple_tree(with_apples=True):
    root = empty('AppleTree', (0, 0, 0))
    trunk = mat('Trunk', '#8a5b3c', 0.8)
    leaf = mat('Leaf', '#5fa84a', 0.85)
    leaf2 = mat('Leaf2', '#79c25a', 0.85)
    cylinder('Trunk', 0.18, 1.3, (0, 0, 0.65), trunk, root, bevel=0.04)
    for (x, y, z, r, m) in ((0, 0, 1.9, 0.95, leaf), (-0.6, -0.1, 1.55, 0.62, leaf2), (0.62, 0, 1.6, 0.66, leaf2), (0.1, -0.35, 2.35, 0.55, leaf2)):
        sphere(f'Crown{x}{z}', r, (x, y, z), m, root)
    if with_apples:
        red = mat('Apple', '#ee4b3e', 0.35)
        for i, (x, z) in enumerate(((-0.5, 1.6), (0.35, 2.3), (0.75, 1.5), (-0.1, 1.35), (0.15, 1.95))):
            sphere(f'Apple{i}', 0.13, (x, -0.85 + abs(x) * 0.25, z), red, root)
    return root


def apple():
    root = empty('Apple', (0, 0, 0))
    sphere('A', 0.13, (0, 0, 0.13), mat('Apple', '#ee4b3e', 0.35), root)
    cylinder('Stem', 0.02, 0.1, (0, 0, 0.28), mat('Trunk', '#8a5b3c', 0.8), root)
    return root


# ===================== 普通的树（3 种） =====================
def tree(kind: int):
    root = empty(f'Tree{kind}', (0, 0, 0))
    trunk = mat('Trunk', '#8a5b3c', 0.8)
    cols = [('#4f9a45', '#7fc35a'), ('#5fa84a', '#9fd36a'), ('#e39a3f', '#f7c75e')][kind]
    a, b = mat('TA' + cols[0], cols[0], 0.85), mat('TB' + cols[1], cols[1], 0.85)
    cylinder('Trunk', 0.14, 1.0, (0, 0, 0.5), trunk, root, bevel=0.03)
    if kind == 0:     # 圆圆的大树
        sphere('C1', 0.8, (0, 0, 1.55), a, root); sphere('C2', 0.5, (-0.4, -0.2, 1.3), b, root); sphere('C3', 0.5, (0.42, -0.1, 1.35), b, root)
    elif kind == 1:   # 塔形的树
        for i, (r, z) in enumerate(((0.75, 1.1), (0.58, 1.6), (0.38, 2.05))):
            cone(f'L{i}', r, 0.05, 0.75, (0, 0, z), a if i % 2 == 0 else b, root, segs=24, bevel=0.05)
    else:             # 秋天的小树
        sphere('C1', 0.62, (0, 0, 1.4), a, root); sphere('C2', 0.42, (0.3, -0.25, 1.65), b, root)
    return root


# ===================== 码头和小木桥 =====================
def dock():
    root = empty('Dock', (0, 0, 0))
    wood, dark = mat('DWood', '#d9a066', 0.8), mat('DDark', '#a8703c', 0.8)
    for i in range(6):
        box(f'Plank{i}', (0.32, 2.2, 0.1), (-0.85 + i * 0.34, 0, 0.16), wood, root, bevel=0.04)
    for x in (-1.0, 1.0):
        for y in (-0.9, 0.9):
            cylinder(f'Post{x}{y}', 0.08, 0.6, (x, y, 0.05), dark, root, bevel=0.02)
    return root


def bridge():
    root = empty('Bridge', (0, 0, 0))
    wood, dark = mat('DWood', '#d9a066', 0.8), mat('DDark', '#a8703c', 0.8)
    n = 7
    for i in range(n):
        x = -1.2 + i * 0.4
        z = 0.12 + math.sin(i / (n - 1) * math.pi) * 0.25
        box(f'Plank{i}', (0.36, 1.1, 0.1), (x, 0, z), wood, root, bevel=0.04)
    for y in (-0.58, 0.58):
        for i in range(4):
            x = -1.2 + i * 0.8
            cylinder(f'Post{y}{i}', 0.05, 0.55, (x, y, 0.35 + math.sin((i / 3) * math.pi) * 0.22), dark, root)
        for i in range(3):
            x0 = -1.2 + i * 0.8
            box(f'Rail{y}{i}', (0.82, 0.06, 0.06), (x0 + 0.4, y, 0.6 + math.sin(((i + 0.5) / 3) * math.pi) * 0.24), dark, root, bevel=0.02)
    return root


# ===================== 区域木牌（牌面空白，文字由程序显示） =====================
def sign():
    root = empty('Sign', (0, 0, 0))
    wood, face = mat('SWood', '#a8703c', 0.75), mat('SFace', '#fff4dc', 0.7)
    cylinder('Pole', 0.07, 1.2, (0, 0, 0.6), wood, root)
    box('Board', (1.9, 0.12, 0.55), (0, 0, 1.25), wood, root, bevel=0.1)
    box('Face', (1.72, 0.06, 0.42), (0, -0.07, 1.25), face, root, bevel=0.08)
    return root


# ===================== 关卡点：圆圆的黏土台子（图标由程序画在上面） =====================
def spot(state: str):
    root = empty('Spot', (0, 0, 0))
    base = {'lock': '#c8c2b6', 'now': '#4fb39b', 'done': '#f4c64a'}[state]
    cylinder('Base', 0.72, 0.28, (0, 0, 0.14), mat('SpBase' + state, base, 0.6), root, bevel=0.1)
    cylinder('Top', 0.6, 0.08, (0, 0, 0.31), mat('SpTop', '#fffaf0', 0.65), root, bevel=0.04)
    if state == 'done':
        cylinder('Pole', 0.03, 0.9, (0.48, 0.25, 0.75), mat('SpPole', '#8a5b3c', 0.7), root)
        box('Flag', (0.36, 0.03, 0.24), (0.66, 0.25, 1.05), mat('SpFlag', '#ee5a4f', 0.55), root, bevel=0.03)
    if state == 'lock':
        for i in range(3):   # 几块小石头，看起来“还没整理好”
            a = i * 2.1
            box(f'Stone{i}', (0.18, 0.16, 0.12), (math.cos(a) * 0.8, math.sin(a) * 0.8, 0.06), mat('SpStone', '#a8a196', 0.8), root, bevel=0.05)
    return root


PROPS = {
    'spot_lock': lambda: spot('lock'), 'spot_now': lambda: spot('now'), 'spot_done': lambda: spot('done'),
    'clocktower_stopped': lambda: clocktower(False),
    'clocktower_restored': lambda: clocktower(True),
    **{f'house{n}_dark': (lambda n=n: house(n, False)) for n in range(1, 11)},
    **{f'house{n}_lit': (lambda n=n: house(n, True)) for n in range(1, 11)},
    'appletree': lambda: apple_tree(True),
    'appletree_bare': lambda: apple_tree(False),
    'apple': apple,
    'tree0': lambda: tree(0), 'tree1': lambda: tree(1), 'tree2': lambda: tree(2),
    'dock': dock, 'bridge': bridge, 'sign': sign,
}

if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    names = argv or list(PROPS)
    for nm in names:
        reset_sprite_scene()
        PROPS[nm]()
        render_sprite(os.path.join(OUT, nm + '.png'), key=nm)
    save_manifest(os.path.join(OUT, 'manifest.json'))
