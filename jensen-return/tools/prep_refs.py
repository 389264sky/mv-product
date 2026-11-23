# 用户给的五张照片 → 裁成人物构图、人物以外换成纯绿，作为 Z-Image 图生图的起始图（裁切避开图库水印）
import sys
from pathlib import Path
import numpy as np, torch
from PIL import Image, ImageDraw, ImageFilter
from torchvision.models.segmentation import deeplabv3_resnet50, DeepLabV3_ResNet50_Weights as W
ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT.parents[1] / 'music-source'
OUT = ROOT / 'out/comfy/input'
CROPS = {'talk': ('342ac65c10385343fbf21454304ea77eca806538220a.webp', (100, 0, 1200, 900), (1136, 928)),
         'heroic': ('5243fbf2b2119313b07e63c5c6651bd7912397dd270a.webp', (0, 0, 950, 960), (1008, 1024)),
         'hold': ('b17eca8065380cd791233a980219ba345982b2b72b0a.webp', (120, 0, 1620, 900), (1520, 912)),
         'gesture': ('b3119313b07eca806538a792327e80dda144ad34250a.webp', (200, 0, 1240, 905), (1168, 1024)),
         'smile': ('c75c10385343fbf2b21134561323dd8065380cd7210a.webp', (712, 20, 1130, 590), (752, 1024))}
# 原图坐标：ERASE 去掉脸旁的话筒和支架，KEEP 保住手里的显卡（人物分割不认它，手会跟着没掉）
ERASE = {'smile': [[(712, 360), (742, 440), (770, 520), (790, 590), (712, 590)]]}
KEEP = {'hold': [[(167, 268), (468, 199), (503, 220), (500, 336), (198, 409), (167, 406)], [(292, 248), (298, 222), (346, 216), (354, 234)]]}   # 第二块是卡片上沿露出的手指
w = W.DEFAULT; net = deeplabv3_resnet50(weights=w).eval(); tf = w.transforms()
person = w.meta['categories'].index('person')
for name, (f, box, size) in CROPS.items():
    im = Image.open(SRC / f).convert('RGB').crop(box).resize(size, Image.LANCZOS)
    with torch.no_grad():
        p = net(tf(im)[None])['out'].softmax(1)[0, person][None, None]
        p = torch.nn.functional.interpolate(p, size=size[::-1], mode='bilinear', align_corners=False)[0, 0].numpy()
    m = Image.fromarray(((p > .45) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(3))
    sx, sy = size[0] / (box[2] - box[0]), size[1] / (box[3] - box[1])
    for polys, v in ((KEEP, 255), (ERASE, 0)):
        for poly in polys.get(name, []): ImageDraw.Draw(m).polygon([((x - box[0]) * sx, (y - box[1]) * sy) for x, y in poly], fill=v)
    bg = Image.new('RGB', size, (0, 255, 0)); bg.paste(im, (0, 0), m)
    bg.save(OUT / f'ref_{name}.png'); print(name, size, f'{(p > .45).mean():.2f}')
