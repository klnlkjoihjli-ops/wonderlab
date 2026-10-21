"""渲染完的素材瘦身：底图 PNG → JPG；带透明的物件、角色 PNG → WebP（保留透明），并更新 manifest 里的文件名。
运行：python3 art/blender/optimize.py   （在 wonderlab 目录下）
原始 PNG 不删；它们只在本机（public/art/**/*.png 不进 Git），网页用的是 JPG / WebP。
"""
import json
import os
import sys

from PIL import Image

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'art'))


def kb(p):
    return os.path.getsize(p) // 1024


def clean_shadow(im):
    """影子收边：
    1) 去掉整张图上极淡的一层（透明度 ≤ 14）；
    2) 物体挡住了一部分天光，会在很大一片地上留下很淡的影子，图片边缘把它切成一块方框——
       所以只对“影子像素”（暗色）做边缘渐隐：离图片边缘越近越透明，物体本身不受影响。"""
    import numpy as np
    arr = np.array(im).astype(np.float32)
    h, w = arr.shape[:2]
    a = arr[..., 3]
    a = np.where(a <= 14, 0, (a - 14) * 255 / 241)
    yy, xx = np.mgrid[0:h, 0:w]
    edge = np.minimum(np.minimum(xx, w - 1 - xx) / (0.22 * w), np.minimum(yy, h - 1 - yy) / (0.22 * h))
    edge = np.clip(edge, 0, 1)
    edge = edge * edge * (3 - 2 * edge)                      # 平滑
    dark = (arr[..., 0] + arr[..., 1] + arr[..., 2]) < 90     # 影子是黑色的
    a = np.where(dark, a * edge, a)
    arr[..., 3] = np.clip(a, 0, 255)
    return Image.fromarray(arr.astype(np.uint8), 'RGBA')


def main():
    before = after = 0
    base = os.path.join(ROOT, 'number', 'base.png')
    if os.path.exists(base):
        out = base[:-4] + '.jpg'
        Image.open(base).convert('RGB').save(out, quality=86, optimize=True, progressive=True)
        before += kb(base); after += kb(out)
        print('base', kb(base), '→', kb(out), 'KB')
    for sub in ('number', 'chars'):
        mf = os.path.join(ROOT, sub, 'manifest.json')
        if not os.path.exists(mf):
            continue
        m = json.load(open(mf))
        for key, info in m.items():
            src = os.path.join(ROOT, sub, info['file'].replace('.webp', '.png'))
            if not os.path.exists(src):
                continue
            dst = src[:-4] + '.webp'
            im = Image.open(src).convert('RGBA')
            # 接影子的地面会在整张图上留一层极淡的“雾”（透明度 1–15），压缩后会变成一块淡淡的方框：
            # 把这层去掉，真正的影子（更深）保留，并拉回原来的深浅
            im = clean_shadow(im)
            im.save(dst, 'WEBP', quality=90, method=4, exact=False)
            before += kb(src); after += kb(dst)
            info['file'] = os.path.basename(dst)
        json.dump(m, open(mf, 'w'), ensure_ascii=False, indent=1)
    # 素材版本号：网页加载图片时带上它，素材一更新浏览器就会重新下载，不会用旧的缓存
    import time
    json.dump({'v': int(time.time())}, open(os.path.join(ROOT, 'version.json'), 'w'))
    print(f'合计 {before} KB → {after} KB')


if __name__ == '__main__':
    sys.exit(main())
