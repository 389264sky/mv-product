import sys, io
sys.path.insert(0,'.claude/skills/mv-director/scripts')
import render
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright
root=Path('mv-out/xiaojiu-yihu').resolve(); NAMES=['A 月白天青釉','B 朱砂漆描金','C 鎏金']; KEY=['celadon','cinnabar','gilt']; ALL=[]
with sync_playwright() as p:
    for k in range(3):
        b,pg,errs=render.open_page(p,root,f'&scale=2&title={k}'); ims=[]
        for t in (18.4,238.4):
            d,_=render.grab(pg,t,.96); ims.append(Image.open(io.BytesIO(d)).convert('RGB').resize((1920,1080),Image.LANCZOS))
        b.close(); ALL.append(ims); S=Image.new('RGB',(1920,2168),(16,16,18)); S.paste(ims[0],(0,0)); S.paste(ims[1],(0,1088)); S.save(root/f'out/title_{KEY[k]}.jpg',quality=94); print(NAMES[k],errs[:2],flush=True)
f=ImageFont.truetype('/System/Library/Fonts/Hiragino Sans GB.ttc',44); W,H=1600,900; box=(330,70,1590,779)
S=Image.new('RGB',(W*2+24,3*(H+84)),(16,16,18)); d=ImageDraw.Draw(S)
for k,ims in enumerate(ALL):
    y=k*(H+84); d.text((20,y+18),NAMES[k]+'    左：片头    右：片尾',font=f,fill=(240,214,150))
    for j,im in enumerate(ims): S.paste(im.crop(box).resize((W,H),Image.LANCZOS),(j*(W+24),y+84))
S.save(root/'out/title_compare.jpg',quality=93); print(S.size)
