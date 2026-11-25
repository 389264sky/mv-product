import sys, io
sys.path.insert(0,".claude/skills/mv-director/scripts")
import render, numpy as np
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
root=Path("mv-out/xiaojiu-yihu").resolve(); A=np.asarray(Image.open(root/"out/title_celadon.jpg").convert("RGB"),np.int16)
with sync_playwright() as p:
    b,pg,errs=render.open_page(p,root,"&scale=2"); ims=[]
    for t in (18.4,238.4):
        d,_=render.grab(pg,t,.96); ims.append(Image.open(io.BytesIO(d)).convert("RGB").resize((1920,1080),Image.LANCZOS))
    b.close()
S=Image.new("RGB",(1920,2168),(16,16,18)); S.paste(ims[0],(0,0)); S.paste(ims[1],(0,1088)); B=io.BytesIO(); S.save(B,"JPEG",quality=94); x=np.abs(np.asarray(Image.open(B).convert("RGB"),np.int16)-A).max(2)
print("同流程比较：变了的像素",int((x>24).sum()),"最大差",int(x.max()),"报错",errs[:2]); S.save(root/"out/title_final.jpg",quality=94)
