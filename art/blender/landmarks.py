"""数字岛的标志性建筑（风格 A）：风车（叶片单独一张，程序里转）、灯塔、热气球、帆船、数字雕塑、彩虹门、积木城堡。
运行：blender -b -P landmarks.py -- [名字 ...]
"""
import math
import os
import sys

import bmesh
import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from clay import box, cylinder, sphere, mat, empty   # noqa: E402
import clay   # noqa: E402
import sprites   # noqa: E402
from sprites import reset_sprite_scene, render_sprite, save_manifest   # noqa: E402
from number_props import cone, text, prism   # noqa: E402

OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'public', 'art', 'number'))
R = math.radians


def tube(name, r1, r2, depth, loc, material, parent, segs=36, bevel=0.0):
    return cone(name, r1, r2, depth, loc, material, parent, segs=segs, bevel=bevel)


# ===================== 风车：塔身（叶片另画） =====================
def windmill_body():
    root = empty('Windmill', (0, 0, 0))
    wall, roof, wood, trim = mat('WWall', '#fff1d8', 0.8), mat('WRoof', '#4f9fd8', 0.55), mat('WWood', '#a8703c', 0.7), mat('WTrim', '#ffcf4a', 0.5)
    tube('Base', 1.3, 1.25, 0.4, (0, 0, 0.2), mat('WStone', '#d8b98c', 0.9), root, bevel=0.1)
    tube('Tower', 1.1, 0.72, 3.4, (0, 0, 2.1), wall, root, bevel=0.06)
    for z in (1.2, 2.4):
        tube(f'Band{z}', 1.12 - (z - 0.4) * 0.11, 1.08 - (z - 0.4) * 0.11, 0.12, (0, 0, z), trim, root)
    cone('Roof', 0.95, 0.05, 1.3, (0, 0, 4.4), roof, root, segs=36)
    sphere('Tip', 0.12, (0, 0, 5.1), trim, root)
    box('Door', (0.5, 0.1, 0.8), (0, -1.12, 0.75), wood, root, bevel=0.2)
    for z, x in ((2.0, 0), (3.1, 0)):
        box(f'Win{z}', (0.3, 0.1, 0.36), (x, -0.95 + (z - 2.0) * 0.12, z), mat('WGlass', '#8fd0f0', 0.2), root, bevel=0.1)
    # 轴心（叶片装在这里）
    cylinder('Axle', 0.16, 0.5, (0, -0.95, 3.75), wood, root, rot=(R(90), 0, 0))
    empty('PT_hub', (0, -1.22, 3.75), root)
    return root


def windmill_blades():
    """叶片：画成正对镜头的样子，程序里绕轴心转"""
    root = empty('Blades', (0, 0, 0))
    sail, wood = mat('BSail', '#fffaf0', 0.7), mat('BWood', '#a8703c', 0.7)
    sphere('Hub', 0.24, (0, 0, 0), mat('BHub', '#ee5a4f', 0.5), root)
    for k in range(4):
        arm = empty(f'Arm{k}', (0, 0, 0), root)
        arm.rotation_euler = (0, R(k * 90 + 20), 0)
        box(f'Spar{k}', (0.1, 0.08, 2.4), (0, 0, 1.3), wood, arm, bevel=0.03)
        box(f'Sail{k}', (0.62, 0.05, 1.8), (0.38, 0, 1.45), sail, arm, bevel=0.05)
    # 让叶片所在的平面正对镜头：绕 X 轴转 -俯角；整体缩小一点，别把塔身全挡住
    root.rotation_euler = (-sprites.ELEV, 0, 0)
    root.scale = (0.8, 0.8, 0.8)
    return root


# ===================== 灯塔 =====================
def lighthouse():
    root = empty('Lighthouse', (0, 0, 0))
    white, red, rock = mat('LWhite', '#fffaf2', 0.6), mat('LRed', '#ee5a4f', 0.5), mat('LRock', '#b9b2a6', 0.9)
    for i, (x, y, r) in enumerate(((0, 0, 1.3), (0.9, 0.5, 0.6), (-0.9, 0.4, 0.55), (0.6, -0.8, 0.45))):
        sphere(f'Rock{i}', r, (x, y, r * 0.35), rock, root, scale=(1, 1, 0.55))
    n = 5
    for i in range(n):
        z0 = 0.6 + i * 0.75
        r1, r2 = 0.85 - i * 0.08, 0.85 - (i + 1) * 0.08
        tube(f'Seg{i}', r1, r2, 0.75, (0, 0, z0 + 0.375), red if i % 2 else white, root)
    tube('Deck', 0.75, 0.75, 0.14, (0, 0, 4.42), mat('LDark', '#3a3340', 0.4), root)
    tube('Lamp', 0.42, 0.42, 0.6, (0, 0, 4.8), mat('LLamp', '#fff1b0', 0.2, emit='#ffd86a'), root)
    cone('Cap', 0.62, 0.05, 0.6, (0, 0, 5.4), red, root)
    sphere('CapTip', 0.1, (0, 0, 5.72), mat('LGold', '#f4c64a', 0.35), root)
    box('Door', (0.4, 0.1, 0.6), (0, -0.82, 0.95), mat('LWood', '#a8703c', 0.7), root, bevel=0.15)
    empty('PT_lamp', (0, 0, 4.8), root)
    return root


# ===================== 热气球（飘在天上，不要地面影子） =====================
def balloon():
    root = empty('Balloon', (0, 0, 0))
    cols = ['#ee5a4f', '#ffcf4a', '#4fb39b', '#5b8fe0', '#ff8fb0', '#f08a4b']
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=16, radius=1.0)
    for v in bm.verts:            # 上面圆、下面收窄成水滴形
        if v.co.z < 0:
            k = 1 + v.co.z * 0.55
            v.co.x *= k; v.co.y *= k
    me = bpy.data.meshes.new('Envelope'); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new('Envelope', me); bpy.context.scene.collection.objects.link(ob)
    for c in cols:
        me.materials.append(mat('BL' + c, c, 0.55))
    import mathutils
    for poly in me.polygons:
        ang = math.atan2(poly.center.y, poly.center.x)
        poly.material_index = int(((ang + math.pi) / (2 * math.pi)) * 12) % len(cols)
        poly.use_smooth = True
    ob.parent = root; ob.location = (0, 0, 2.3); ob.scale = (1.15, 1.15, 1.25)
    basket = box('Basket', (0.55, 0.55, 0.4), (0, 0, 0.2), mat('BBasket', '#c98f55', 0.8), root, bevel=0.08)
    for x in (-0.22, 0.22):
        for y in (-0.22, 0.22):
            box(f'Rope{x}{y}', (0.03, 0.03, 0.85), (x * 1.6, y * 1.6, 0.85), mat('BRope', '#8a5b3c', 0.8), root, rot=(R(-y * 40), R(x * 40), 0))
    return root


# ===================== 帆船（在海上，不要地面影子） =====================
def boat():
    root = empty('Boat', (0, 0, 0))
    hull = sphere('Hull', 1.0, (0, 0, 0.1), mat('BtHull', '#ee5a4f', 0.55), root, scale=(1.5, 0.7, 0.45))
    box('Deck', (2.2, 0.9, 0.12), (0, 0, 0.38), mat('BtDeck', '#d9a066', 0.7), root, bevel=0.06)
    cylinder('Mast', 0.06, 2.6, (0, 0, 1.6), mat('BtMast', '#8a5b3c', 0.7), root)
    sail = prism('Sail', 0.06, 1.5, 2.0, (0.05, 0, 0.6), mat('BtSail', '#fffaf0', 0.7), root)
    sail.rotation_euler = (0, 0, R(90))
    box('Flag', (0.3, 0.03, 0.2), (0.2, 0, 2.85), mat('BtFlag', '#ffcf4a', 0.55), root, bevel=0.03)
    return root


# ===================== 巨大的数字雕塑 =====================
def sculpture(n: int):
    root = empty(f'Sculpture{n}', (0, 0, 0))
    col = ['#ee5a4f', '#ffcf4a', '#5b8fe0'][n - 1]
    tube('Plinth', 0.95, 1.0, 0.4, (0, 0, 0.2), mat('SPlinth', '#fff1d8', 0.8), root, bevel=0.08)
    cu = bpy.data.curves.new(f'Big{n}', 'FONT'); cu.body = str(n); cu.size = 2.8; cu.align_x = 'CENTER'; cu.align_y = 'BOTTOM'
    cu.extrude = 0.28; cu.bevel_depth = 0.08; cu.bevel_resolution = 4
    ob = bpy.data.objects.new(f'Big{n}', cu); bpy.context.scene.collection.objects.link(ob)
    ob.data.materials.append(mat('SN' + col, col, 0.45)); ob.parent = root; ob.location = (0, 0, 0.4); ob.rotation_euler = (R(90), 0, 0)
    return root


# ===================== 彩虹门（横跨小路） =====================
def rainbow():
    root = empty('Rainbow', (0, 0, 0))
    cols = ['#ee5a4f', '#f29c45', '#ffcf4a', '#7dba5a', '#4f9fd8', '#9b7fe0']
    for i, c in enumerate(cols):
        r = 2.4 - i * 0.24
        bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=0.13, major_segments=48, minor_segments=12)
        t = bpy.context.active_object
        bm = bmesh.new(); bm.from_mesh(t.data)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y < -0.001], context='VERTS')
        bm.to_mesh(t.data); bm.free()
        t.data.materials.append(mat('RB' + c, c, 0.5)); t.data.polygons.foreach_set('use_smooth', [True] * len(t.data.polygons))
        t.parent = root; t.rotation_euler = (R(90), 0, 0); t.location = (0, 0, 0)
    for x in (-2.15, 2.15):        # 两头的小云朵
        for k, (dx, dz, r) in enumerate(((0, 0.25, 0.45), (0.35, 0.15, 0.35), (-0.35, 0.15, 0.35))):
            sphere(f'Cloud{x}{k}', r, (x + dx, 0, dz), mat('RCloud', '#ffffff', 0.8), root)
    return root


# ===================== 积木城堡 =====================
def castle():
    root = empty('Castle', (0, 0, 0))
    cols = ['#ee7a5f', '#ffcf4a', '#4fb39b', '#5b8fe0', '#9b7fe0', '#ff8fb0']
    k = 0
    def block(x, y, z, c=None, s=0.7):
        nonlocal k
        k += 1
        return box(f'B{k}', (s, s, s), (x, y, z), mat('CB' + (c or cols[k % len(cols)]), c or cols[k % len(cols)], 0.55), root, bevel=0.08)
    # 城墙：两层积木
    for i in range(-2, 3):
        for zz in (0.35, 1.05):
            block(i * 0.72, 0, zz)
    # 城门
    box('Gate', (0.6, 0.2, 0.9), (0, -0.3, 0.45), mat('CGate', '#a8703c', 0.7), root, bevel=0.25)
    # 两座塔 + 尖顶 + 旗
    for x in (-1.9, 1.9):
        for zz in (0.4, 1.2, 2.0):
            box(f'T{x}{zz}', (0.8, 0.8, 0.8), (x, 0, zz), mat('CTower', '#fff1d8', 0.7), root, bevel=0.1)
        cone(f'Spire{x}', 0.6, 0.02, 1.0, (x, 0, 2.9), mat('CSpire', '#5b8fe0' if x < 0 else '#ee5a4f', 0.5), root, segs=4)
        cylinder(f'Pole{x}', 0.03, 0.6, (x, 0, 3.6), mat('CPole', '#8a5b3c', 0.7), root)
        box(f'Flag{x}', (0.36, 0.03, 0.22), (x + 0.2, 0, 3.78), mat('CFlag', '#ffcf4a', 0.55), root, bevel=0.03)
    # 城垛（积木的“凸点”）
    for i in range(-2, 3):
        cylinder(f'Stud{i}', 0.16, 0.12, (i * 0.72, -0.1, 1.46), mat('CStud', cols[(i + 2) % len(cols)], 0.55), root)
    # 前面散落几块积木（立方体关卡的感觉）
    block(-1.1, -1.2, 0.3, '#ffcf4a', 0.55); block(1.0, -1.3, 0.3, '#4fb39b', 0.55); block(1.3, -1.0, 0.85, '#ee7a5f', 0.5)
    return root


PROPS = {
    'windmill': (windmill_body, {}),
    'windmill_blades': (windmill_blades, {'yaw': 0, 'shadow': False, 'pad': 0.15}),
    'lighthouse': (lighthouse, {}),
    'balloon': (balloon, {'shadow': False, 'pad': 0.15}),
    'boat': (boat, {'shadow': False, 'pad': 0.15}),
    'sculpture1': (lambda: sculpture(1), {}), 'sculpture2': (lambda: sculpture(2), {}), 'sculpture3': (lambda: sculpture(3), {}),
    'rainbow': (rainbow, {'yaw': 0}),
    'castle': (castle, {}),
}

if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    for nm in (argv or list(PROPS)):
        fn, kw = PROPS[nm]
        reset_sprite_scene()
        fn()
        render_sprite(os.path.join(OUT, nm + '.png'), key=nm, **kw)
    save_manifest(os.path.join(OUT, 'manifest.json'))
