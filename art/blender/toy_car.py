"""拼装小车：探索工作台的第一个模块。导出 public/models/toy_car.glb。

运行：blender --background --factory-startup --python art/blender/toy_car.py -- [--render 预览图.png]

每个零件是一个以零件 id 命名的节点，放在“装好时”的位置；场景代码负责拆开、飞回、点选。
零件 id 与 shared/modules/car.ts 一致：
  Chassis 底盘（不拆，放在台上当底座）
  AxleRear / AxleFront 车轴，WheelFL / WheelFR / WheelRL / WheelRR 车轮，
  Motor 马达，Battery 电池，Shell 车壳，Roof 车顶
坐标：Blender Z 向上，车头朝 +X；导出时转成 Three.js 的 Y 向上。
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from clay import box, cylinder, empty, export_glb, mat, render_preview, reset, sphere, torus  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'public', 'models', 'toy_car.glb'))
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
RENDER = argv[argv.index('--render') + 1] if '--render' in argv else None

reset()
WOOD = mat('Wood', '#e2a24a', 0.7)
WOOD_DARK = mat('WoodDark', '#b97a33', 0.75)
CHERRY = mat('Cherry', '#ee5a4f', 0.45, coat=0.35)
CREAM = mat('Cream', '#fff1d6', 0.6)
SATCHEL = mat('Satchel', '#3d5fc4', 0.5, coat=0.2)
GLASS = mat('Glass', '#bfe6f2', 0.12)
TIRE = mat('Tire', '#3a3a48', 0.9)
HONEY = mat('Honey', '#ffcf4a', 0.4)
INK = mat('Ink', '#24262e', 0.3)
WHITE = mat('White', '#ffffff', 0.35)
BLUSH = mat('Blush', '#ffb3a6', 0.6)
STEEL = mat('Steel', '#c7ccd4', 0.3, metal=0.5)
MOTOR = mat('Motor', '#5cbf5a', 0.45, coat=0.2)
LAMP = mat('Lamp', '#ffe3a1', 0.3, emit='#ffcf6a')

# —— 底盘：木板 + 四个轴座（车轴就卡在这里）——
ch = empty('Chassis', (0, 0, 0.3))
box('ChassisBoard', (1.7, 0.8, 0.12), (0, 0, 0), WOOD, ch, bevel=0.05, segs=4)
for x in (-0.5, 0.5):
    for y in (-0.33, 0.33):
        box(f'Holder{x}{y}', (0.18, 0.1, 0.14), (x, y, -0.1), WOOD_DARK, ch, bevel=0.03)
for i, x in enumerate((-0.65, -0.1, 0.45)):                       # 木纹钉，让它像手工玩具
    sphere(f'Peg{i}', 0.03, (x, 0.28, 0.065), WOOD_DARK, ch, scale=(1, 1, 0.5))

# —— 车轴：粗一点，孩子才点得中 ——
for name, x in (('AxleRear', -0.5), ('AxleFront', 0.5)):
    a = empty(name, (x, 0, 0.2))
    cylinder(name + 'Rod', 0.06, 1.26, (0, 0, 0), STEEL, a, rot=(math.pi / 2, 0, 0), bevel=0.015)
    for s in (-1, 1):
        cylinder(f'{name}Stop{s}', 0.085, 0.05, (0, s * 0.5, 0), CHERRY, a, rot=(math.pi / 2, 0, 0), bevel=0.012)

# —— 车轮 ——
for name, x, y in (('WheelFL', 0.5, 0.63), ('WheelFR', 0.5, -0.63), ('WheelRL', -0.5, 0.63), ('WheelRR', -0.5, -0.63)):
    w = empty(name, (x, y, 0.2))
    side = 1 if y > 0 else -1
    cylinder(name + 'Tire', 0.24, 0.17, (0, 0, 0), TIRE, w, rot=(math.pi / 2, 0, 0), bevel=0.06)
    cylinder(name + 'Hub', 0.12, 0.04, (0, side * 0.08, 0), HONEY, w, rot=(math.pi / 2, 0, 0), bevel=0.015)
    sphere(name + 'Cap', 0.05, (0, side * 0.1, 0), CHERRY, w, scale=(1, 0.5, 1))
    for k in range(5):
        a = k / 5 * math.tau
        sphere(f'{name}Bolt{k}', 0.017, (math.cos(a) * 0.08, side * 0.102, math.sin(a) * 0.08), INK, w)

# —— 马达：绿色圆筒 + 银色端盖 + 转轴 ——
m = empty('Motor', (-0.32, 0, 0.52))
cylinder('MotorBody', 0.15, 0.36, (0, 0, 0), MOTOR, m, rot=(0, math.pi / 2, 0), bevel=0.03)
for s in (-1, 1):
    cylinder(f'MotorCap{s}', 0.12, 0.04, (s * 0.19, 0, 0), STEEL, m, rot=(0, math.pi / 2, 0), bevel=0.01)
for s in (-0.07, 0.07):
    torus(f'MotorRib{s}', 0.152, 0.012, (s, 0, 0), MOTOR, m, rot=(0, math.pi / 2, 0))
cylinder('MotorShaft', 0.025, 0.14, (-0.27, 0, 0), STEEL, m, rot=(0, math.pi / 2, 0))

# —— 电池：黄色 + 黑色一头 + 正极小凸起 + 闪电 ——
b = empty('Battery', (0.25, 0, 0.47))
box('BatteryBody', (0.44, 0.26, 0.2), (0, 0, 0), HONEY, b, bevel=0.05, segs=4)
box('BatteryBand', (0.12, 0.27, 0.21), (-0.16, 0, 0), INK, b, bevel=0.04)
cylinder('BatteryNub', 0.04, 0.05, (0.235, 0, 0), STEEL, b, rot=(0, math.pi / 2, 0))
for s in (-1, 1):
    box(f'Bolt{s}', (0.03, 0.01, 0.1), (0.04 + s * 0.02, 0.131, s * 0.025), INK, b, bevel=0.004, rot=(0, s * 0.5, 0))

# —— 车壳：红色车身 + 小脸 ——
sh = empty('Shell', (0, 0, 0.62))
box('ShellBody', (1.6, 0.86, 0.4), (0, 0, 0), CHERRY, sh, bevel=0.15, segs=5, taper=0.95)
for s in (-1, 1):
    e = empty(f'Eye{s}', (0.78, s * 0.2, 0.05), sh)
    sphere(f'EyeWhite{s}', 0.12, (0, 0, 0), WHITE, e, scale=(0.5, 1, 1))
    sphere(f'Pupil{s}', 0.07, (0.045, 0, -0.005), INK, e, scale=(0.5, 1, 1))
    sphere(f'Spark{s}', 0.024, (0.08, -s * 0.03, 0.035), WHITE, e)
    sphere(f'Cheek{s}', 0.05, (0.795, s * 0.33, -0.05), BLUSH, sh, scale=(0.35, 1, 0.75))
    sphere(f'Headlight{s}', 0.045, (0.79, s * 0.36, -0.13), LAMP, sh, scale=(0.6, 1, 1))
torus('Smile', 0.06, 0.015, (0.8, 0, -0.07), INK, sh, rot=(math.pi / 2, 0, math.pi / 2), half=True)

# —— 车顶：奶油色小屋 + 窗户 + 蓝色顶盖 ——
r = empty('Roof', (-0.15, 0, 0.98))
box('Cabin', (0.8, 0.76, 0.32), (0, 0, 0), CREAM, r, bevel=0.12, segs=5, taper=0.86)
for s in (-1, 1):
    box(f'Window{s}', (0.46, 0.03, 0.16), (0.02, s * 0.36, 0.02), GLASS, r, bevel=0.05, segs=3)
box('FrontGlass', (0.03, 0.5, 0.16), (0.36, 0, 0.02), GLASS, r, bevel=0.05, segs=3, rot=(0, -0.2, 0))
box('RoofCap', (0.74, 0.7, 0.07), (0, 0, 0.18), SATCHEL, r, bevel=0.035, segs=3)

export_glb(OUT)
if RENDER:
    render_preview(RENDER, cam_loc=(4.0, -3.4, 2.4), target_z=0.55)
