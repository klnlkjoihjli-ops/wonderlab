"""用 Blender 脚本生成小邮车模型，导出到 public/models/mail_cart.glb。

运行：blender --background --factory-startup --python art/blender/mail_cart.py -- [--render 预览图.png]

坐标约定（Blender，Z 向上）：车头朝 +X，车身左右沿 Y，地面 z=0。
glTF 导出会转成 Three.js 的 Y 向上，节点名供场景代码查找：
  CartBody / EyeL / EyeR / PupilL / PupilR / Wheel_FL / Wheel_FR / Wheel_RL / Wheel_RR / Letter / Gift
尺寸与 src/scene/characters.ts 里的程序化小车一致，替换时位置能对上。
"""
import math
import os
import sys

import bmesh
import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'public', 'models', 'mail_cart.glb'))
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
RENDER = argv[argv.index('--render') + 1] if '--render' in argv else None

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


# —— 材质：和场景 PALETTE 同一套颜色（十六进制是 sRGB，Blender 需要线性值）——
def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_linear(h):
    h = h.lstrip('#')
    return tuple(srgb_to_linear(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4)) + (1.0,)


_mats = {}


def mat(name, color, rough=0.6, coat=0.0, emit=None):
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = hex_linear(color)
    p.inputs['Roughness'].default_value = rough
    if coat:
        p.inputs['Coat Weight'].default_value = coat
        p.inputs['Coat Roughness'].default_value = 0.25
    if emit:
        p.inputs['Emission Color'].default_value = hex_linear(emit)
        p.inputs['Emission Strength'].default_value = 1.5
    _mats[name] = m
    return m


CHERRY = mat('Cherry', '#ee5a4f', 0.45, coat=0.35)
CHERRY_DEEP = mat('CherryDeep', '#c9443b', 0.55)
CREAM = mat('Cream', '#fff1d6', 0.6)
SATCHEL = mat('Satchel', '#3d5fc4', 0.5, coat=0.2)
GLASS = mat('Glass', '#bfe6f2', 0.12)
TIRE = mat('Tire', '#3a3a48', 0.9)
HONEY = mat('Honey', '#ffcf4a', 0.4)
INK = mat('Ink', '#24262e', 0.3)
WHITE = mat('White', '#ffffff', 0.35)
PAPER = mat('Paper', '#fffaf2', 0.7)
BLUSH = mat('Blush', '#ffb3a6', 0.6)
LAMP = mat('Lamp', '#ffe3a1', 0.3, emit='#ffcf6a')
PINK = mat('GiftPink', '#ff8fb1', 0.55)
CHROME = mat('Chrome', '#d9dde3', 0.25)


# —— 几何体工具 ——
def finish(name, bm, material, parent, loc, rot=(0, 0, 0), bevel=0.0, segs=3, subsurf=0, smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    me.materials.append(material)
    if smooth:
        me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    if bevel:
        b = ob.modifiers.new('Bevel', 'BEVEL')
        b.width = bevel
        b.segments = segs
        b.limit_method = 'NONE'
    if subsurf:
        s = ob.modifiers.new('Subsurf', 'SUBSURF')
        s.levels = s.render_levels = subsurf
    ob.parent = parent
    ob.location = loc
    ob.rotation_euler = rot
    return ob


def box(name, dims, loc, material, parent, bevel=0.05, segs=3, taper=1.0, rot=(0, 0, 0), subsurf=0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= dims[0]
        v.co.y *= dims[1]
        v.co.z *= dims[2]
        if v.co.z > 0 and taper != 1.0:          # 顶面收窄一点，更像玩具
            v.co.x *= taper
            v.co.y *= taper
    return finish(name, bm, material, parent, loc, rot, bevel=min(bevel, min(dims) * 0.49), segs=segs, subsurf=subsurf)


def cylinder(name, r, depth, loc, material, parent, rot=(0, 0, 0), bevel=0.0, segs=40):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs, radius1=r, radius2=r, depth=depth)
    return finish(name, bm, material, parent, loc, rot, bevel=bevel, segs=3)


def sphere(name, r, loc, material, parent, scale=(1, 1, 1)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=r)
    ob = finish(name, bm, material, parent, loc)
    ob.scale = scale
    return ob


def torus(name, major, minor, loc, material, parent, rot=(0, 0, 0), half=False):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=40, minor_segments=12)
    ob = bpy.context.active_object
    ob.name = name
    if half:                                      # 只留下半圈（笑脸）
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y > 0.001], context='VERTS')
        bm.to_mesh(ob.data)
        bm.free()
    ob.data.materials.append(material)
    ob.data.polygons.foreach_set('use_smooth', [True] * len(ob.data.polygons))
    ob.parent = parent
    ob.location = loc
    ob.rotation_euler = rot
    return ob


def empty(name, loc, parent=None):
    e = bpy.data.objects.new(name, None)
    scene.collection.objects.link(e)
    e.parent = parent
    e.location = loc
    e.empty_display_size = 0.1
    return e


# —— 车身 ——
body = empty('CartBody', (0, 0, 0))
box('Chassis', (1.36, 0.9, 0.42), (0, 0, 0.47), CHERRY, body, bevel=0.15, segs=5, taper=0.96)
box('Skirt', (1.30, 0.92, 0.1), (0, 0, 0.3), CHERRY_DEEP, body, bevel=0.05)
for x in (-0.42, 0.42):                           # 轮拱：车身上的半圆凸起，让轮子“嵌”在车里
    for y in (-0.45, 0.45):
        cylinder(f'Arch_{x}_{y}', 0.3, 0.06, (x, y * 1.02, 0.3), CHERRY_DEEP, body, rot=(math.pi / 2, 0, 0), bevel=0.025)
box('Cabin', (0.74, 0.84, 0.52), (-0.24, 0, 0.94), CREAM, body, bevel=0.14, segs=5, taper=0.86)
box('Roof', (0.92, 1.0, 0.1), (-0.24, 0, 1.24), SATCHEL, body, bevel=0.05, segs=4)
for side in (-1, 1):
    box(f'SideWindow{side}', (0.44, 0.03, 0.24), (-0.22, side * 0.405, 0.98), GLASS, body, bevel=0.06, segs=4)
    cylinder(f'RackRail{side}', 0.022, 0.8, (-0.24, side * 0.3, 1.33), CHROME, body, rot=(0, math.pi / 2, 0))
    for x in (-0.55, 0.07):
        cylinder(f'RackPost{side}{x}', 0.018, 0.08, (x, side * 0.3, 1.3), CHROME, body)
box('Windshield', (0.03, 0.62, 0.26), (0.115, 0, 0.98), GLASS, body, bevel=0.06, segs=4, rot=(0, -0.18, 0))
box('RearWindow', (0.03, 0.5, 0.2), (-0.6, 0, 0.98), GLASS, body, bevel=0.05, segs=3)
# 车头：格栅、保险杠、小灯、腮红、笑脸
box('Grille', (0.04, 0.4, 0.1), (0.69, 0, 0.33), CHERRY_DEEP, body, bevel=0.03)
for i in range(3):
    box(f'GrilleBar{i}', (0.02, 0.34, 0.016), (0.712, 0, 0.3 + i * 0.03), CHROME, body, bevel=0.007)
box('BumperFront', (0.12, 0.96, 0.1), (0.7, 0, 0.25), CREAM, body, bevel=0.05, segs=4)
box('BumperRear', (0.12, 0.96, 0.1), (-0.7, 0, 0.25), CREAM, body, bevel=0.05, segs=4)
for side in (-1, 1):
    sphere(f'Headlight{side}', 0.045, (0.76, side * 0.38, 0.27), LAMP, body, scale=(0.6, 1, 1))   # 车灯挪到保险杠两端
    sphere(f'Cheek{side}', 0.055, (0.665, side * 0.35, 0.47), BLUSH, body, scale=(0.35, 1, 0.75))
    cylinder(f'MirrorStalk{side}', 0.012, 0.12, (0.06, side * 0.47, 1.0), CHROME, body, rot=(math.pi / 2, 0, 0))
    sphere(f'Mirror{side}', 0.045, (0.06, side * 0.53, 1.02), CHERRY, body, scale=(0.6, 1, 0.8))
    # 车门上的邮局标志：白色信封
    box(f'Emblem{side}', (0.32, 0.02, 0.21), (0.24, side * 0.455, 0.5), PAPER, body, bevel=0.04)
    for s in (-1, 1):
        box(f'EmblemV{side}{s}', (0.19, 0.012, 0.025), (0.24 + s * 0.075, side * 0.467, 0.54), CHERRY, body,
            bevel=0.008, rot=(0, s * 0.55, 0))
torus('Smile', 0.065, 0.016, (0.695, 0, 0.475), INK, body, rot=(math.pi / 2, 0, math.pi / 2), half=True)


# —— 眼睛：单独的节点，场景里用来眨眼和看方向 ——
def make_eye(name, y):
    e = empty(name, (0.62, y, 0.64), body)
    sphere(name + 'White', 0.14, (0, 0, 0), WHITE, e, scale=(0.5, 1, 1))
    pupil = sphere('Pupil' + name[-1], 0.08, (0.05, 0, -0.005), INK, e, scale=(0.5, 1, 1))
    sphere(name + 'Spark', 0.028, (0.09, -0.03 if y > 0 else 0.03, 0.04), WHITE, e)
    sphere(name + 'Lid', 0.145, (-0.005, 0, 0.03), CHERRY, e, scale=(0.45, 1.02, 0.35))   # 上眼睑，表情更温柔
    return pupil


make_eye('EyeL', 0.2)
make_eye('EyeR', -0.2)

# —— 车轮 ——
for name, x, y in (('Wheel_FL', 0.42, 0.45), ('Wheel_FR', 0.42, -0.45), ('Wheel_RL', -0.42, 0.45), ('Wheel_RR', -0.42, -0.45)):
    w = empty(name, (x, y, 0.24))
    cylinder(name + 'Tire', 0.24, 0.18, (0, 0, 0), TIRE, w, rot=(math.pi / 2, 0, 0), bevel=0.06)
    side = 1 if y > 0 else -1
    cylinder(name + 'Hub', 0.12, 0.04, (0, side * 0.085, 0), HONEY, w, rot=(math.pi / 2, 0, 0), bevel=0.015)
    sphere(name + 'Cap', 0.05, (0, side * 0.1, 0), CHERRY, w, scale=(1, 0.5, 1))
    for k in range(5):                            # 螺丝：转起来能看出车轮在动
        a = k / 5 * math.tau
        sphere(f'{name}Bolt{k}', 0.016, (math.cos(a) * 0.08, side * 0.105, math.sin(a) * 0.08), INK, w)

# —— 邀请卡：竖在车顶行李架上 ——
letter = empty('Letter', (-0.24, 0, 1.55))
box('Envelope', (0.66, 0.05, 0.44), (0, 0, 0), PAPER, letter, bevel=0.025)
for face in (-1, 1):
    for s in (-1, 1):
        box(f'Flap{face}{s}', (0.4, 0.008, 0.035), (s * 0.155, face * 0.028, 0.06), mat('Fold', '#e7ddd0', 0.7), letter,
            bevel=0.004, rot=(0, s * 0.5, 0))
    cylinder(f'Seal{face}', 0.07, 0.03, (0, face * 0.035, -0.02), CHERRY, letter, rot=(math.pi / 2, 0, 0), bevel=0.01)

# —— 礼物（第二次送信时出现）——
gift = empty('Gift', (0.32, 0, 0.98))
box('GiftBox', (0.5, 0.5, 0.4), (0, 0, 0), PINK, gift, bevel=0.04)
box('RibbonA', (0.52, 0.09, 0.42), (0, 0, 0), HONEY, gift, bevel=0.01)
box('RibbonB', (0.09, 0.52, 0.42), (0, 0, 0), HONEY, gift, bevel=0.01)
for s in (-1, 1):
    torus(f'Bow{s}', 0.08, 0.028, (s * 0.08, 0, 0.26), HONEY, gift, rot=(math.pi / 2, 0, 0))

# —— 导出 ——
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_apply=True, export_yup=True,
                          export_cameras=False, export_lights=False)
print('EXPORTED', OUT, os.path.getsize(OUT), 'bytes')

# —— 可选：渲染一张预览图 ——
if RENDER:
    bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, 0))
    ground = bpy.context.active_object
    ground.data.materials.append(mat('Ground', '#a6d26a', 0.95))
    cam_data = bpy.data.cameras.new('Cam')
    cam_data.lens = 55
    cam = bpy.data.objects.new('Cam', cam_data)
    scene.collection.objects.link(cam)
    cam.location = (4.4, -3.9, 2.7)
    target = empty('Target', (0, 0, 0.85))
    track = cam.constraints.new('TRACK_TO')
    track.target = target
    scene.camera = cam
    for name, loc, energy, color, size in (('Key', (2.5, -3, 4.5), 900, (1, 0.9, 0.75), 3),
                                           ('Fill', (-3, 2, 2.5), 300, (0.8, 0.9, 1), 4),
                                           ('Rim', (-2.5, -0.5, 3), 400, (1, 0.75, 0.6), 2)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy, ld.color, ld.size = energy, color, size
        lo = bpy.data.objects.new(name, ld)
        lo.location = loc
        scene.collection.objects.link(lo)
        c = lo.constraints.new('TRACK_TO')
        c.target = target
    world = bpy.data.worlds.new('World')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = hex_linear('#cfe8f5')
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.8
    scene.world = world
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 96
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 1200, 900
    scene.render.filepath = RENDER
    scene.view_settings.view_transform = 'AgX'
    bpy.ops.render.render(write_still=True)
    print('RENDERED', RENDER)
