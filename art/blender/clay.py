"""Blender 建模小工具：和 mail_cart.py 同一套“软胶玩具”造型语言（倒角、柔和材质、sRGB→线性色）。
在其他脚本里：sys.path.insert(0, 脚本目录); from clay import *
"""
import math
import os

import bmesh
import bpy

scene = None


def reset():
    global scene
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    _mats.clear()
    return scene


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_linear(h):
    h = h.lstrip('#')
    return tuple(srgb_to_linear(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4)) + (1.0,)


_mats = {}


def mat(name, color, rough=0.6, coat=0.0, emit=None, metal=0.0):
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = hex_linear(color)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    if coat:
        p.inputs['Coat Weight'].default_value = coat
        p.inputs['Coat Roughness'].default_value = 0.25
    if emit:
        p.inputs['Emission Color'].default_value = hex_linear(emit)
        p.inputs['Emission Strength'].default_value = 1.5
    _mats[name] = m
    return m


def finish(name, bm, material, parent, loc, rot=(0, 0, 0), bevel=0.0, segs=3, smooth=True):
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
    ob.parent = parent
    ob.location = loc
    ob.rotation_euler = rot
    return ob


def box(name, dims, loc, material, parent, bevel=0.05, segs=3, taper=1.0, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= dims[0]
        v.co.y *= dims[1]
        v.co.z *= dims[2]
        if v.co.z > 0 and taper != 1.0:
            v.co.x *= taper
            v.co.y *= taper
    return finish(name, bm, material, parent, loc, rot, bevel=min(bevel, min(dims) * 0.49), segs=segs)


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
    if half:
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


def export_glb(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True, export_yup=True,
                              export_cameras=False, export_lights=False)
    print('EXPORTED', path, os.path.getsize(path), 'bytes')


def render_preview(path, cam_loc=(4.4, -3.9, 2.7), target_z=0.6, lens=55, size=(1200, 900)):
    bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, 0))
    bpy.context.active_object.data.materials.append(mat('Ground', '#e8c79a', 0.95))
    cam_data = bpy.data.cameras.new('Cam')
    cam_data.lens = lens
    cam = bpy.data.objects.new('Cam', cam_data)
    scene.collection.objects.link(cam)
    cam.location = cam_loc
    target = empty('Target', (0, 0, target_z))
    cam.constraints.new('TRACK_TO').target = target
    scene.camera = cam
    for name, loc, energy, color, sz in (('Key', (2.5, -3, 4.5), 900, (1, 0.9, 0.75), 3),
                                         ('Fill', (-3, 2, 2.5), 300, (0.8, 0.9, 1), 4),
                                         ('Rim', (-2.5, -0.5, 3), 400, (1, 0.75, 0.6), 2)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy, ld.color, ld.size = energy, color, sz
        lo = bpy.data.objects.new(name, ld)
        lo.location = loc
        scene.collection.objects.link(lo)
        lo.constraints.new('TRACK_TO').target = target
    world = bpy.data.worlds.new('World')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = hex_linear('#f3e6d2')
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.8
    scene.world = world
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 96
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = size
    scene.render.filepath = path
    scene.view_settings.view_transform = 'AgX'
    bpy.ops.render.render(write_still=True)
    print('RENDERED', path)
