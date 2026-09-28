#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从游戏 APK 一键重新导出网页资源（游戏版本更新时使用）
==========================================================

依赖：pip install UnityPy Pillow

用法：
    python3 export_assets.py /path/to/Simple_x.y.z.apk

生成到 web/assets/：
    covers/thumb/*.webp     320px WebP q66   （表格缩略图 / 卡片背景，手机友好）
    covers/full/*.webp      2048px WebP q92  （大图查看器）
    covers/original/*.png   2048px PNG       （原图收藏，可不上传云端）
    data/meta.js            MUSIC_DB / CHART_DB / CHAPTER_CN / SAMPLE_CODE
"""

import csv
import io
import json
import os
import sys
import zipfile

import UnityPy
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.dirname(HERE)
ASSETS = os.path.join(WEB, 'assets')
THUMB = os.path.join(ASSETS, 'covers', 'thumb')
FULL = os.path.join(ASSETS, 'covers', 'full')
ORIG = os.path.join(ASSETS, 'covers', 'original')
DATA = os.path.join(ASSETS, 'data')


def extract_bundles(apk_path, tmp_dir):
    """从 APK 中提取 image / config 相关 bundle 到临时目录，返回路径列表。"""
    os.makedirs(tmp_dir, exist_ok=True)
    out = []
    with zipfile.ZipFile(apk_path) as z:
        for name in z.namelist():
            base = os.path.basename(name)
            if not name.startswith('assets/aa/Android/'):
                continue
            if 'image_assets_all' in base or 'config_assets_all' in base:
                dst = os.path.join(tmp_dir, base)
                if not os.path.exists(dst):
                    with z.open(name) as src, open(dst, 'wb') as f:
                        while True:
                            b = src.read(1 << 20)
                            if not b:
                                break
                            f.write(b)
                out.append(dst)
    return out


def read_textassets(bundle_path):
    """读出 bundle 中全部 TextAsset，返回 {name: bytes}。"""
    out = {}
    env = UnityPy.load(bundle_path)
    for obj in env.objects:
        if obj.type.name == 'TextAsset':
            d = obj.read()
            s = d.m_Script
            out[d.m_Name] = s.encode('utf-8') if isinstance(s, str) else bytes(s)
    return out


def export_covers(bundles):
    thumb_kb = full_kb = 0
    n = 0
    for path in bundles:
        if 'image_assets_all' not in os.path.basename(path):
            continue
        env = UnityPy.load(path)
        for obj in env.objects:
            if obj.type.name != 'Texture2D':
                continue
            d = obj.read()
            name = d.m_Name
            im = d.image.convert('RGB')
            w = 320
            h = int(im.height * w / im.width)
            im2 = im.resize((w, h), Image.LANCZOS)
            im2.save(os.path.join(THUMB, name + '.webp'), 'WEBP', quality=66, method=6)
            im.save(os.path.join(FULL, name + '.webp'), 'WEBP', quality=92, method=6)
            im.save(os.path.join(ORIG, name + '.png'), 'PNG', optimize=True)
            thumb_kb += os.path.getsize(os.path.join(THUMB, name + '.webp')) / 1024
            full_kb += os.path.getsize(os.path.join(FULL, name + '.webp')) / 1024
            n += 1
            im.close(); im2.close()
        del env
    print('covers: %d | thumb %.1f KB | full %.1f KB' % (n, thumb_kb, full_kb))


def rows(data):
    text = data.decode('utf-8-sig', errors='replace')
    r = csv.reader(io.StringIO(text))
    next(r, None)
    return [row for row in r if len(row) >= 2 and row[0]]


def build_meta(bundles):
    cfg = {}
    for path in bundles:
        if 'config_assets_all' in os.path.basename(path):
            cfg.update(read_textassets(path))
    mus = {}
    for row in rows(cfg.get('Config_Music', b'')):
        if len(row) < 10:
            continue
        mus[row[0]] = {'title': row[1], 'composer': row[2], 'chapter': row[7],
                       'ci': int(row[9]), 'il': row[4]}
    charts = {}
    for row in rows(cfg.get('Config_Chart', b'')):
        if len(row) < 10:
            continue
        charts[row[0] + '|' + row[3]] = {'lv': row[4], 'charter': row[2],
                                         'hi': int(row[8]), 'ci': int(row[9])}
    chapter_cn = {}
    for row in rows(cfg.get('Config_Chapter', b'')):
        if len(row) >= 4:
            chapter_cn[row[0]] = row[3]
    sample = ''
    sample_file = os.path.join(HERE, 'sample_code.txt')
    if os.path.exists(sample_file):
        sample = open(sample_file, encoding='utf-8').read().strip()
    meta = {'MUSIC_DB': mus, 'CHART_DB': charts, 'CHAPTER_CN': chapter_cn,
            'SAMPLE_CODE': sample, 'COVER_BASE': 'assets/covers'}
    out = 'window.SIMPLE_META = ' + json.dumps(meta, ensure_ascii=False,
                                               separators=(',', ':')) + ';' + chr(10)
    with open(os.path.join(DATA, 'meta.js'), 'w', encoding='utf-8') as f:
        f.write(out)
    print('meta.js: %d music, %d charts, %d chapters' % (len(mus), len(charts), len(chapter_cn)))


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    apk = sys.argv[1]
    for d in (THUMB, FULL, ORIG, DATA):
        os.makedirs(d, exist_ok=True)
    tmp = os.path.join(HERE, '_tmp_bundles')
    bundles = extract_bundles(apk, tmp)
    print('bundles extracted:', len(bundles))
    export_covers(bundles)
    build_meta(bundles)
    print('done. 提示: covers/original 体积较大（~80MB），云端部署时可不上传')
    return 0


if __name__ == '__main__':
    sys.exit(main())
