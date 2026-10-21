"""发现岛的地图物件（风格 A：暖色黏土、2.5D）：四个区域的建筑和几件小装饰。
运行：blender -b -P discover_props.py -- [物件名 ...]   （不写就全部渲染）
输出：public/art/discover/*.png 和 manifest.json
"""
import math
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from clay import box, cylinder, sphere, mat, empty, torus   # noqa: E402
from sprites import reset_sprite_scene, render_sprite, save_manifest   # noqa: E402
from number_props import cone, prism   # noqa: E402

OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'public', 'art', 'discover'))
R = math.radians
RAINBOW = ['#ee5a4f', '#f29c45', '#ffcf4a', '#7dba5a', '#4f9fd8', '#9b7fe0']


# ===================== 彩虹实验室：圆圆的白房子、玻璃圆顶、屋顶一道彩虹、烧瓶烟囱 =====================
def lab():
    root = empty('Lab', (0, 0, 0))
    wall, trim, glass = mat('LWall', '#fff4e2', 0.8), mat('LTrim', '#9b7fe0', 0.55), mat('LGlass', '#9fd8f2', 0.15)
    cylinder('Plinth', 2.0, 0.3, (0, 0, 0.15), mat('LStone', '#d8c4a4', 0.9), root, bevel=0.08)
    cylinder('Wall', 1.75, 1.9, (0, 0, 1.25), wall, root, bevel=0.06)
    for i, z in enumerate((0.55, 2.15)):
        torus(f'Band{i}', 1.77, 0.07, (0, 0, z), trim, root)
    sphere('Dome', 1.6, (0, 0, 2.2), glass, root, scale=(1, 1, 0.8))
    torus('DomeRing', 1.62, 0.08, (0, 0, 2.22), trim, root)
    # 门和窗
    box('Door', (0.8, 0.12, 1.15), (0, -1.73, 0.9), mat('LDoor', '#ee8a5a', 0.6), root, bevel=0.3)
    for k, a in enumerate((-48, 48)):
        x, y = math.sin(R(a)) * 1.72, -math.cos(R(a)) * 1.72
        cylinder(f'Win{k}', 0.32, 0.12, (x, y, 1.45), glass, root, rot=(R(90), 0, R(a)))
        torus(f'WinRim{k}', 0.33, 0.05, (x, y, 1.45), trim, root, rot=(R(90), 0, R(a)))
    # 屋顶的彩虹门
    for i, col in enumerate(RAINBOW):
        torus(f'Arc{i}', 1.75 - i * 0.13, 0.08, (0, 0.35, 2.75), mat(f'LArc{i}', col, 0.5), root, rot=(R(-90), 0, 0), half=True)   # 转 -90° 才是拱向上的那一半
    # 烧瓶烟囱，冒着彩色泡泡
    for k, (x, y, col) in enumerate(((1.2, 0.7, '#7dba5a'), (-1.15, 0.8, '#ee5a4f'))):
        cylinder(f'Neck{k}', 0.13, 0.6, (x, y, 3.0), glass, root)
        sphere(f'Flask{k}', 0.36, (x, y, 2.6), glass, root)
        sphere(f'Liquid{k}', 0.3, (x, y, 2.55), mat(f'LLiq{k}', col, 0.3), root, scale=(1, 1, 0.7))
        for j in range(3):
            sphere(f'Bub{k}{j}', 0.1 + j * 0.03, (x + 0.1 * j, y, 3.45 + j * 0.3), mat(f'LBub{k}', col, 0.3), root)
    return root


# ===================== 小车工坊：车库、大卷帘门、屋顶大齿轮 =====================
def gear(name, r, teeth, loc, material, parent, rot=(R(90), 0, 0), depth=0.18):
    g = empty(name, loc, parent)
    g.rotation_euler = rot
    cylinder(name + 'Disc', r * 0.82, depth, (0, 0, 0), material, g, bevel=0.03)
    cylinder(name + 'Hole', r * 0.28, depth + 0.04, (0, 0, 0), mat('GHole', '#5a4a3c', 0.8), g)
    for t in range(teeth):
        a = 2 * math.pi * t / teeth
        tooth = box(f'{name}T{t}', (r * 0.22, r * 0.3, depth), (math.cos(a) * r * 0.9, math.sin(a) * r * 0.9, 0), material, g, bevel=0.02)
        tooth.rotation_euler = (0, 0, a)
    return g


def workshop():
    root = empty('Workshop', (0, 0, 0))
    wall, roof, door, wood = mat('WkWall', '#f6d7a8', 0.8), mat('WkRoof', '#4f9fd8', 0.55), mat('WkDoor', '#fff4e2', 0.7), mat('WkWood', '#a8703c', 0.75)
    box('Body', (3.6, 2.6, 2.0), (0, 0, 1.0), wall, root, bevel=0.12)
    prism('Roof', 3.9, 2.9, 0.9, (0, 0, 2.0), roof, root)
    # 卷帘门：一条条横板
    box('DoorFrame', (2.2, 0.12, 1.6), (-0.3, -1.32, 0.82), wood, root, bevel=0.06)
    for i in range(6):
        box(f'Slat{i}', (2.0, 0.08, 0.2), (-0.3, -1.38, 0.2 + i * 0.25), door, root, bevel=0.03)
    box('Window', (0.6, 0.1, 0.55), (1.35, -1.32, 1.25), mat('WkGlass', '#9fd8f2', 0.2), root, bevel=0.1)
    gear('BigGear', 0.9, 10, (0.3, -0.2, 3.6), mat('WkGear', '#ffcf4a', 0.45), root)
    gear('SmallGear', 0.5, 8, (1.3, -0.2, 3.05), mat('WkGear2', '#ee5a4f', 0.5), root)
    # 门口的工具箱和轮胎
    box('Toolbox', (0.6, 0.4, 0.35), (1.5, -1.65, 0.18), mat('WkBox', '#ee5a4f', 0.55), root, bevel=0.05)
    torus('Tire', 0.3, 0.12, (-1.95, -1.4, 0.3), mat('WkTire', '#3a3a40', 0.7), root, rot=(R(90), 0, R(20)))
    return root


# ===================== 小农场：红色谷仓、栅栏、一块小菜地 =====================
def barn():
    root = empty('Barn', (0, 0, 0))
    red, white, roof, wood = mat('BRed', '#d9534f', 0.6), mat('BWhite', '#fffaf0', 0.7), mat('BRoof', '#7a5a4a', 0.7), mat('BWood', '#c89058', 0.8)
    box('Body', (3.0, 2.4, 2.1), (0, 0, 1.05), red, root, bevel=0.1)
    prism('Roof', 3.3, 2.7, 1.2, (0, 0, 2.1), roof, root)
    box('Door', (1.2, 0.12, 1.5), (0, -1.22, 0.78), white, root, bevel=0.05)
    for s in (-1, 1):   # 门上的白色交叉
        b = box(f'X{s}', (1.6, 0.06, 0.1), (0, -1.3, 0.78), white, root)
        b.rotation_euler = (0, R(s * 50), 0)
    box('Loft', (0.6, 0.12, 0.5), (0, -1.22, 2.3), white, root, bevel=0.05)
    # 栅栏
    for i in range(7):
        x = -2.6 + i * 0.45
        box(f'Post{i}', (0.1, 0.1, 0.6), (x, -1.9, 0.3), wood, root, bevel=0.02)
    for z in (0.22, 0.45):
        box(f'Rail{z}', (2.8, 0.06, 0.07), (-1.25, -1.9, z), wood, root)
    # 菜地：几垄土和小苗
    for r in range(3):
        box(f'Row{r}', (1.4, 0.3, 0.12), (2.3, -1.2 + r * 0.55, 0.06), mat('BSoil', '#8a5b3c', 0.9), root, bevel=0.05)
        for c in range(4):
            sphere(f'Sprout{r}{c}', 0.1, (1.8 + c * 0.33, -1.2 + r * 0.55, 0.2), mat('BLeaf', '#7dba5a', 0.6), root, scale=(1, 1, 1.3))
    # 向日葵
    cylinder('SunStem', 0.04, 1.2, (-1.75, -1.5, 0.6), mat('BStem', '#5f9e45', 0.6), root)
    cylinder('SunFace', 0.28, 0.08, (-1.75, -1.55, 1.25), mat('BSun', '#ffcf4a', 0.5), root, rot=(R(80), 0, 0))
    cylinder('SunMid', 0.13, 0.1, (-1.75, -1.6, 1.26), mat('BSunMid', '#8a5b3c', 0.6), root, rot=(R(80), 0, 0))
    return root


# ===================== 星星天文台：白色塔楼、半球顶、伸出来的望远镜 =====================
def observatory():
    root = empty('Observatory', (0, 0, 0))
    wall, dome, trim = mat('OWall', '#fffaf0', 0.75), mat('ODome', '#3d5fc4', 0.45), mat('OTrim', '#ffcf4a', 0.45)
    cylinder('Base', 1.7, 0.4, (0, 0, 0.2), mat('OStone', '#cdbb9c', 0.9), root, bevel=0.08)
    cylinder('Tower', 1.35, 2.4, (0, 0, 1.6), wall, root, bevel=0.06)
    torus('Band', 1.37, 0.08, (0, 0, 2.75), trim, root)
    sphere('Dome', 1.38, (0, 0, 2.8), dome, root, scale=(1, 1, 0.85))
    for k in range(5):   # 圆顶上的小星星
        a = R(-60 + k * 30)
        sphere(f'Star{k}', 0.09, (math.sin(a) * 1.0, -math.cos(a) * 1.0, 3.55 - abs(k - 2) * 0.12), trim, root)
    box('Slit', (0.45, 0.2, 1.1), (0.2, -0.95, 3.3), mat('OSlit', '#2a2f5a', 0.6), root, bevel=0.08)
    tube = cylinder('Scope', 0.2, 1.6, (0.55, -1.2, 3.75), mat('OScope', '#ee8a5a', 0.5), root, rot=(R(-55), R(25), 0))
    box('Door', (0.7, 0.12, 1.05), (0, -1.35, 0.9), mat('ODoor', '#4f9fd8', 0.6), root, bevel=0.25)
    box('Win', (0.4, 0.1, 0.5), (0, -1.35, 2.0), mat('OGlass', '#9fd8f2', 0.2), root, bevel=0.15)
    return root


def telescope():
    root = empty('Telescope', (0, 0, 0))
    leg = mat('TLeg', '#a8703c', 0.75)
    for k in range(3):
        a = R(90 + k * 120)
        b = cylinder(f'Leg{k}', 0.05, 1.3, (math.cos(a) * 0.3, math.sin(a) * 0.3, 0.6), leg, root)
        b.rotation_euler = (math.sin(a) * R(14), -math.cos(a) * R(14), 0)
    cylinder('Tube', 0.14, 1.1, (0.15, -0.1, 1.35), mat('TTube', '#4f9fd8', 0.5), root, rot=(R(-60), R(20), 0))
    return root


def greenhouse():
    root = empty('Greenhouse', (0, 0, 0))
    glass, frame = mat('GGlass', '#bfe8d8', 0.15), mat('GFrame', '#fffaf0', 0.6)
    box('Base', (2.4, 1.6, 0.25), (0, 0, 0.12), mat('GBase', '#cdbb9c', 0.9), root, bevel=0.05)
    cylinder('Roof', 0.8, 2.3, (0, 0, 0.3), glass, root, rot=(0, R(90), 0))
    for x in (-1.1, -0.55, 0, 0.55, 1.1):
        torus(f'Rib{x}', 0.8, 0.04, (x, 0, 0.3), frame, root, rot=(0, R(90), 0), half=True)
    for i in range(5):
        sphere(f'Plant{i}', 0.18, (-0.8 + i * 0.4, -0.2, 0.45), mat('GPlant', '#7dba5a', 0.6), root)
        sphere(f'Bloom{i}', 0.08, (-0.8 + i * 0.4, -0.25, 0.62), mat(f'GBloom{i % 3}', ['#ff6b8a', '#ffcf4a', '#b48cff'][i % 3], 0.5), root)
    return root


def flasks():
    root = empty('Flasks', (0, 0, 0))
    glass = mat('FGlass', '#cfeefa', 0.12)
    box('Table', (1.4, 0.7, 0.08), (0, 0, 0.7), mat('FTop', '#c89058', 0.7), root, bevel=0.03)
    for x in (-0.6, 0.6):
        for y in (-0.28, 0.28):
            cylinder(f'Leg{x}{y}', 0.04, 0.7, (x, y, 0.35), mat('FLeg', '#a8703c', 0.7), root)
    for k, (x, col) in enumerate(((-0.4, '#ee5a4f'), (0, '#4f9fd8'), (0.4, '#7dba5a'))):
        sphere(f'Ball{k}', 0.2, (x, 0, 0.95), glass, root)
        sphere(f'Liq{k}', 0.16, (x, 0, 0.92), mat(f'FLiq{k}', col, 0.3), root, scale=(1, 1, 0.8))
        cylinder(f'Neck{k}', 0.06, 0.3, (x, 0, 1.25), glass, root)
    return root


def toycar():
    root = empty('ToyCar', (0, 0, 0))
    box('Body', (1.3, 0.75, 0.4), (0, 0, 0.42), mat('CBody', '#ee5a4f', 0.5), root, bevel=0.15)
    box('Cabin', (0.7, 0.65, 0.4), (-0.1, 0, 0.8), mat('CCabin', '#fff4e2', 0.6), root, bevel=0.15)
    for x in (-0.42, 0.42):
        for y in (-0.4, 0.4):
            cylinder(f'Wheel{x}{y}', 0.2, 0.14, (x, y, 0.2), mat('CWheel', '#3a3a40', 0.7), root, rot=(R(90), 0, 0))
    return root


PROPS = {'lab': lab, 'workshop': workshop, 'barn': barn, 'observatory': observatory,
         'telescope': telescope, 'greenhouse': greenhouse, 'flasks': flasks, 'toycar': toycar}

if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    os.makedirs(OUT, exist_ok=True)
    for nm in (argv or list(PROPS)):
        reset_sprite_scene()
        PROPS[nm]()
        render_sprite(os.path.join(OUT, nm + '.png'), key=nm)
    save_manifest(os.path.join(OUT, 'manifest.json'))
