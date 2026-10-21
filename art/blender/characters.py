"""角色（风格 A：暖色黏土）：小诺、数数兔、孩子小人，每个几个姿势。
运行：blender -b -P characters.py -- [名字 ...]
输出：public/art/chars/*.png 和 manifest.json
"""
import math
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from clay import box, cylinder, sphere, mat, empty   # noqa: E402
import clay   # noqa: E402
from sprites import reset_sprite_scene, render_sprite, save_manifest, MANIFEST   # noqa: E402

OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'public', 'art', 'chars'))
R = math.radians


def cone(name, r1, r2, depth, loc, material, parent, segs=24, rot=(0, 0, 0)):
    import bmesh
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs, radius1=r1, radius2=r2, depth=depth)
    return clay.finish(name, bm, material, parent, loc, rot, segs=2)


def eye(name, x, z, r, parent, y=-0.0):
    white, ink, hi = mat('EyeW', '#ffffff', 0.25), mat('EyeK', '#2a2630', 0.2), mat('EyeH', '#ffffff', 0.1, emit='#ffffff')
    sphere(name + 'W', r, (x, y, z), white, parent)
    sphere(name + 'K', r * 0.62, (x, y - r * 0.55, z - r * 0.05), ink, parent)
    sphere(name + 'H', r * 0.2, (x + r * 0.22, y - r * 0.95, z + r * 0.22), hi, parent)


# ===================== 小诺：紫色小猫头鹰，蓝色邮差帽 =====================
def owl(pose='idle'):
    root = empty('Owl', (0, 0, 0))
    purple, deep, cream = mat('OPurple', '#b9a4ee', 0.65), mat('ODeep', '#9781dc', 0.65), mat('OCream', '#fff2dc', 0.7)
    orange, pink, navy, gold = mat('OOrange', '#f6a04a', 0.5), mat('OPink', '#ffb3c1', 0.6), mat('ONavy', '#2f3f8f', 0.55), mat('OGold', '#f4c64a', 0.35)
    body = sphere('Body', 0.62, (0, 0, 0.72), purple, root, scale=(1, 0.92, 1.08))
    sphere('Belly', 0.42, (0, -0.28, 0.6), cream, root, scale=(1, 0.6, 1.05))
    # 眉毛一样的耳羽
    for s in (-1, 1):
        cone(f'Tuft{s}', 0.13, 0.02, 0.28, (s * 0.36, 0, 1.36), deep, root, rot=(0, R(s * 25), 0))
    # 脸盘、眼睛、嘴、腮红
    for s in (-1, 1):
        sphere(f'Mask{s}', 0.24, (s * 0.21, -0.42, 0.95), cream, root, scale=(1, 0.5, 1))
        eye(f'Eye{s}', s * 0.21, 0.96, 0.15, root, y=-0.5)
        sphere(f'Cheek{s}', 0.08, (s * 0.4, -0.5, 0.78), pink, root, scale=(1, 0.5, 0.7))
    cone('Beak', 0.07, 0.0, 0.13, (0, -0.62, 0.8), orange, root, rot=(R(100), 0, 0))
    # 翅膀：不同姿势
    wing_rot = {'idle': (10, 10), 'wave': (10, -120), 'cheer': (-130, -130), 'fly': (-70, -70)}[pose]
    for s, ang in ((-1, wing_rot[0]), (1, wing_rot[1])):
        piv = empty(f'WingPiv{s}', (s * 0.55, 0, 0.95), root)
        w = sphere(f'Wing{s}', 0.3, (s * 0.12, 0, -0.28), deep, piv, scale=(0.45, 0.8, 1.1))
        piv.rotation_euler = (0, R(-s * ang) if pose != 'idle' else R(s * 12), 0)
    # 小脚
    for s in (-1, 1):
        sphere(f'Foot{s}', 0.1, (s * 0.2, -0.2, 0.08), orange, root, scale=(1.2, 1.4, 0.6))
    # 邮差帽
    cap = empty('Cap', (0, -0.05, 1.3), root)
    cap.rotation_euler = (R(-8), 0, R(-6))
    cylinder('CapTop', 0.36, 0.22, (0, 0, 0.08), navy, cap, bevel=0.06)
    brim = sphere('Brim', 0.3, (0, -0.28, -0.02), navy, cap, scale=(1.05, 0.7, 0.12))
    sphere('Button', 0.06, (0, -0.33, 0.12), gold, cap)
    if pose == 'fly':
        root.location.z = 0.6
    return root


# ===================== 数数兔：白色小兔子，薄荷绿围裙写着 123 =====================
def rabbit(pose='idle'):
    root = empty('Rabbit', (0, 0, 0))
    fur, pink, mint, ink = mat('RFur', '#fffaf4', 0.75), mat('RPink', '#ffb7c5', 0.6), mat('RMint', '#4fb39b', 0.6), mat('RInk', '#2a2630', 0.3)
    sphere('Body', 0.5, (0, 0, 0.62), fur, root, scale=(1, 0.9, 1.12))
    sphere('Head', 0.42, (0, -0.05, 1.42), fur, root)
    for s in (-1, 1):
        piv = empty(f'EarPiv{s}', (s * 0.16, 0, 1.75), root)
        piv.rotation_euler = (0, R(s * (12 if pose == 'idle' else 22)), 0)
        sphere(f'Ear{s}', 0.13, (0, 0, 0.42), fur, piv, scale=(1, 0.6, 3.4))
        sphere(f'EarIn{s}', 0.08, (0, -0.06, 0.42), pink, piv, scale=(1, 0.4, 3.0))
        eye(f'Eye{s}', s * 0.15, 1.48, 0.075, root, y=-0.4)
        sphere(f'Cheek{s}', 0.07, (s * 0.26, -0.36, 1.33), pink, root, scale=(1, 0.5, 0.7))
        arm_rot = R(s * 150) if pose == 'happy' else R(s * 20)
        piv = empty(f'ArmPiv{s}', (s * 0.42, -0.05, 0.92), root)
        piv.rotation_euler = (0, arm_rot, 0)
        sphere(f'Arm{s}', 0.12, (0, 0, -0.22), fur, piv, scale=(1, 1, 1.9))
        sphere(f'Foot{s}', 0.14, (s * 0.24, -0.22, 0.1), fur, root, scale=(1, 1.5, 0.7))
    sphere('Nose', 0.05, (0, -0.42, 1.38), pink, root)
    box('Apron', (0.62, 0.12, 0.55), (0, -0.42, 0.62), mint, root, bevel=0.12)
    cu = bpy.data.curves.new('Num', 'FONT'); cu.body = '123'; cu.size = 0.24; cu.align_x = 'CENTER'; cu.align_y = 'CENTER'; cu.extrude = 0.02
    t = bpy.data.objects.new('Num', cu); bpy.context.scene.collection.objects.link(t)
    t.data.materials.append(mat('RNum', '#fffaf0', 0.5)); t.parent = root; t.location = (0, -0.5, 0.62); t.rotation_euler = (R(90), 0, 0)
    return root


# ===================== 孩子小人：黄衣服、蓝裤子、蓝色邮差帽、红背包 =====================
def kid(pose='idle'):
    root = empty('Kid', (0, 0, 0))
    skin, hair, shirt = mat('KSkin', '#ffd9bf', 0.7), mat('KHair', '#3b2a22', 0.8), mat('KShirt', '#ffcf4a', 0.6)
    pants, shoe, bag, navy, pink = mat('KPants', '#3d5fc4', 0.6), mat('KShoe', '#5a3a2a', 0.7), mat('KBag', '#ee5a4f', 0.6), mat('KNavy', '#2f3f8f', 0.55), mat('KPink', '#ffb3a6', 0.6)
    swing = {'idle': 0, 'walk1': 28, 'walk2': -28, 'cheer': 0}[pose]
    box('Torso', (0.56, 0.4, 0.55), (0, 0, 0.85), shirt, root, bevel=0.16)
    box('Hips', (0.52, 0.38, 0.2), (0, 0, 0.55), pants, root, bevel=0.08)
    for s in (-1, 1):
        piv = empty(f'LegPiv{s}', (s * 0.14, 0, 0.5), root)
        piv.rotation_euler = (R(s * swing), 0, 0)
        box(f'Leg{s}', (0.18, 0.2, 0.36), (0, 0, -0.18), pants, piv, bevel=0.07)
        box(f'Shoe{s}', (0.22, 0.3, 0.12), (0, -0.04, -0.4), shoe, piv, bevel=0.05)
        apiv = empty(f'ArmPiv{s}', (s * 0.36, 0, 1.05), root)
        apiv.rotation_euler = (R(-s * swing), R(s * 155) if pose == 'cheer' else R(s * 8), 0)
        box(f'Arm{s}', (0.15, 0.16, 0.4), (0, 0, -0.18), shirt, apiv, bevel=0.07)
        sphere(f'Hand{s}', 0.09, (0, 0, -0.42), skin, apiv)
    head = sphere('Head', 0.4, (0, 0, 1.52), skin, root)
    sphere('Hair', 0.415, (0, 0.06, 1.6), hair, root, scale=(1, 1, 0.85))
    for s in (-1, 1):
        eye(f'Eye{s}', s * 0.14, 1.52, 0.065, root, y=-0.34)
        sphere(f'Cheek{s}', 0.065, (s * 0.24, -0.33, 1.42), pink, root, scale=(1, 0.5, 0.7))
        sphere(f'Ear{s}', 0.08, (s * 0.4, 0, 1.5), skin, root)
    cylinder('CapTop', 0.36, 0.2, (0, 0, 1.86), navy, root, bevel=0.06)
    sphere('Brim', 0.26, (0, -0.32, 1.78), navy, root, scale=(1, 0.75, 0.12))
    sphere('CapBtn', 0.05, (0, -0.37, 1.9), mat('KGold', '#f4c64a', 0.35), root)
    box('Bag', (0.44, 0.2, 0.46), (0, 0.3, 0.9), bag, root, bevel=0.1)
    if pose == 'cheer':
        root.location.z = 0.15
    return root


CHARS = {
    'owl_idle': lambda: owl('idle'), 'owl_wave': lambda: owl('wave'), 'owl_cheer': lambda: owl('cheer'), 'owl_fly': lambda: owl('fly'),
    'rabbit_idle': lambda: rabbit('idle'), 'rabbit_happy': lambda: rabbit('happy'),
    'kid_idle': lambda: kid('idle'), 'kid_walk1': lambda: kid('walk1'), 'kid_walk2': lambda: kid('walk2'), 'kid_cheer': lambda: kid('cheer'),
}

if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    for nm in (argv or list(CHARS)):
        reset_sprite_scene()
        CHARS[nm]()
        # 角色更正对着孩子一点（转 15°），镜头放低到 24°，看得到脸
        render_sprite(os.path.join(OUT, nm + '.png'), key=nm, yaw=math.radians(15), pad=0.2, shadow_pad=0.4, elev=math.radians(24))
    save_manifest(os.path.join(OUT, 'manifest.json'))
