"""2.5D 素材渲染：所有地图物件、角色用同一个角度、同一套暖光、同一个比例渲染成透明 PNG。

- 镜头：正交，从南边往北看，俯角 ELEV（地面上的 Y 轴在画面里会压扁成 sin(ELEV) 倍）
- 光：左上方暖色主光 + 冷色补光 + 天光，柔和投影
- 比例：PPM 像素 / 米，所有素材一样，放到地图上大小就对了
- 每张图记下“落地点”（物体原点在图里的像素位置），程序按它摆放

用法（在其他脚本里）：
    sys.path.insert(0, 脚本目录); from clay import *; from sprites import *
    reset_sprite_scene(); ...建模...; render_sprite('out.png', root)
"""
import json
import math
import os

import bpy
from mathutils import Vector

import clay

ELEV = math.radians(52)          # 俯角
PPM = 110                        # 每米多少像素（@1x；渲染时乘 SCALE 得到 @2x）
SCALE = 2
MANIFEST = {}


def reset_sprite_scene():
    sc = clay.reset()
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = 64
    sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    # 用 Standard 色彩映射：颜色保持饱满（AgX 会把黏土的颜色洗淡）
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.exposure = -0.15
    # 天光：暖暖的
    world = bpy.data.worlds.new('World')
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = clay.hex_linear('#fff1dc')
    bg.inputs['Strength'].default_value = 0.75
    sc.world = world
    # 主光（左上、暖）+ 补光（右、冷）
    # 主光放高一点（影子短、柔），从左上方照过来
    for name, rot, energy, color, angle in (('Key', (math.radians(30), 0, math.radians(-35)), 2.6, (1.0, 0.9, 0.76), 22),
                                            ('Fill', (math.radians(55), 0, math.radians(125)), 0.7, (0.8, 0.88, 1.0), 30)):
        ld = bpy.data.lights.new(name, 'SUN')
        ld.energy, ld.color, ld.angle = energy, color, math.radians(angle)
        lo = bpy.data.objects.new(name, ld)
        lo.rotation_euler = rot
        sc.collection.objects.link(lo)
    # 只接影子的地面
    bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, 0))
    ground = bpy.context.active_object
    ground.name = 'ShadowCatcher'
    ground.is_shadow_catcher = True
    return sc


def _camera():
    sc = bpy.context.scene
    cd = bpy.data.cameras.new('Cam')
    cd.type = 'ORTHO'
    cam = bpy.data.objects.new('Cam', cd)
    sc.collection.objects.link(cam)
    cam.rotation_euler = (math.pi / 2 - ELEV, 0, 0)     # 从南往北看，向下俯视
    sc.camera = cam
    return cam


def _bbox(objs):
    pts = []
    for o in objs:
        if o.type != 'MESH' or o.name == 'ShadowCatcher':
            continue
        for c in o.bound_box:
            pts.append(o.matrix_world @ Vector(c))
    return pts


YAW = math.radians(30)   # 物件统一转 30°，能看到两个面，才有 2.5D 的感觉


def render_sprite(path, root=None, key=None, pad=0.35, shadow_pad=0.6, samples=None, yaw=YAW, elev=None):
    """把场景里所有物体渲染成一张透明 PNG，自动取景；返回落地点（原点）在图里的位置（@1x 像素）"""
    sc = bpy.context.scene
    for o in sc.objects:
        if o.parent is None and o.type in ('EMPTY', 'MESH', 'FONT') and o.name != 'ShadowCatcher':
            o.rotation_euler.z += yaw
    bpy.context.view_layer.update()
    # 角色可以用更低的镜头（看得到脸）；物件统一用 ELEV
    E = ELEV if elev is None else elev
    cam = _camera()
    cam.rotation_euler = (math.pi / 2 - E, 0, 0)
    objs = [o for o in sc.objects if o.type == 'MESH' and o.name != 'ShadowCatcher']
    pts = _bbox(objs)
    # 把包围盒投到镜头平面：x 不变；竖直方向 = z*cos(ELEV) + y*sin(ELEV)
    def proj(p): return (p.x, p.z * math.cos(E) + p.y * math.sin(E))
    pp = [proj(p) for p in pts]
    x0, x1 = min(p[0] for p in pp) - pad, max(p[0] for p in pp) + pad
    y0, y1 = min(p[1] for p in pp) - pad - shadow_pad * 0.5, max(p[1] for p in pp) + pad
    x0 -= shadow_pad * 0.3; x1 += shadow_pad                 # 影子往右下落，多留一点
    w, h = x1 - x0, y1 - y0
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    # 镜头中心放在投影平面 (cx, cy) 对应的位置
    fwd = Vector((0, math.cos(E), -math.sin(E)))      # 镜头朝向
    up = Vector((0, math.sin(E), math.cos(E)))
    cam.location = Vector((cx, 0, 0)) + up * cy - fwd * 40
    cam.data.ortho_scale = max(w, h)
    rx, ry = round(w * PPM * SCALE), round(h * PPM * SCALE)
    sc.render.resolution_x, sc.render.resolution_y = rx, ry
    if samples:
        sc.cycles.samples = samples
    sc.render.filepath = path
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.render.render(write_still=True)
    # 原点（落地点）在图里的位置（@1x）
    ax = (0 - x0) * PPM
    ay = (y1 - 0) * PPM
    info = {'file': os.path.basename(path), 'w': round(rx / SCALE), 'h': round(ry / SCALE), 'ax': round(ax, 1), 'ay': round(ay, 1)}
    if key:
        MANIFEST[key] = info
    print('SPRITE', key or path, info)
    return info


def save_manifest(path):
    old = {}
    if os.path.exists(path):
        with open(path) as f:
            old = json.load(f)
    old.update(MANIFEST)
    with open(path, 'w') as f:
        json.dump(old, f, ensure_ascii=False, indent=1)
    print('MANIFEST', path, len(old))
