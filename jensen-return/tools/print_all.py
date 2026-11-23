# 把选中的生成图印成网点：满幅图先切掉模型自己画的外框和白边
import glob, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'out/comfy/output/film'
PREP = str(ROOT / 'tools/prep.py')
FULL = {'s_campus': 's_campus', 's_press': 's_press', 's_board': 's_board2', 's_stamp': 's_stamp', 's_servers': 's_servers',
        'hero_back': 'hero_back', 's_shoes': 's_shoes', 's_eyes': 's_eyes2', 'hero_desk': 'hero_desk', 's_hands': 's_hands',
        's_office': 's_office2', 's_dawn': 's_dawn'}
KEYED = {'hand_a': ('hand_a', 620), 'hand_b': ('hand_b', 620), 'hero_turn': ('hero_turn2', 1000), 'hero_stride': ('hero_stride', 760),
         'hero_close': ('hero_close', 1040), 'hero_chip': ('hero_chip2', 1040)}

def trim(f):
    g = np.asarray(Image.open(f).convert('L'), np.float32) / 255
    H, W = g.shape
    def edge(dark, n):   # 从边往里找：白边之后的第一条外框线；先碰到画面内容就是没有外框
        for i in range(int(n * .08)):
            d = dark(i)
            if d > .5: return i + 6
            if d > .08: return 0
        return 0
    t, b = edge(lambda i: (g[i] < .4).mean(), H), edge(lambda i: (g[H - 1 - i] < .4).mean(), H)
    l, r = edge(lambda i: (g[:, i] < .4).mean(), W), edge(lambda i: (g[:, W - 1 - i] < .4).mean(), W)
    return f'{l},{t},{W - r},{H - b}'

def src(n):
    fs = sorted(glob.glob(str(RAW / f'{n}_*.png')))
    assert fs, n
    return fs[-1]

for out, n in FULL.items():
    f = src(n); c = {'s_campus': '60,60,1478,802'}.get(out) or trim(f)   # 夜景顶部是深色，自动切边认不出外框
    subprocess.run([sys.executable, '-I', PREP, f, out, '--crop', c, '--width', '1920', '--cell', '8', '--line', '.62'], check=True, stdout=subprocess.DEVNULL)
    print(out, c)
for out, (n, w) in KEYED.items():
    subprocess.run([sys.executable, '-I', PREP, src(n), out, '--key', '--width', str(w), '--cell', '7', '--line', '.68', '--rim', '3'], check=True, stdout=subprocess.DEVNULL)
    print(out, Image.open(ROOT / f'img/{out}.png').size)
chip = str(ROOT / 'out/comfy/output/ref/chip_a_00001_.png')
subprocess.run([sys.executable, '-I', PREP, chip, 'chip_dark', '--key', '--width', '900', '--cell', '7', '--rim', '2', '--noacc'], check=True, stdout=subprocess.DEVNULL)
assert Image.open(ROOT / 'img/chip_dark.png').size == Image.open(ROOT / 'img/chip.png').size
print('chip_dark ok')
