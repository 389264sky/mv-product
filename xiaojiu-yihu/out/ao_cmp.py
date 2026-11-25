import sys, io; sys.path[:0]=['.claude/skills/mv-director/scripts','mv-out/xiaojiu-yihu/out']
import render, numpy as np
from pathlib import Path
from PIL import Image, ImageDraw
from bars import fr
from playwright.sync_api import sync_playwright
root=Path('mv-out/xiaojiu-yihu').resolve(); T=(25,58.3,72,128,143,168.1,199,215); out=[]
with sync_playwright() as p:
    b,pg,errs=render.open_page(p,root,'&scale=2'); pg.evaluate("()=>{const X=window.XJ; X._r=X.render; X._o={}; X.render=(c,w,o)=>X._r(c,w,{...o,...X._o});}")
    for t in T:
        r=[]
        for o in ({},{'ao':0}): pg.evaluate("(o)=>{window.XJ._o=o}",o); d,_=render.grab(pg,t,.98); r.append(Image.open(io.BytesIO(d)).convert('RGB').resize((1920,1080),Image.LANCZOS))
        x=np.abs(np.asarray(r[0]).astype(int)-np.asarray(r[1])).mean(2); print(f'{t}s  AO 开/关 平均差 {x.mean():.2f}  最大 {x.max():.0f}  差>6 的像素 {100*(x>6).mean():.1f}%',flush=True); out.append((t,r[0]))
    b.close()
L={128:(200,560),135:(0,0),215:(600,600),58.3:(900,560)}
S=Image.new('RGB',(3*640,2*420)); d=ImageDraw.Draw(S)
for i,(t,(x,y)) in enumerate([(128,(200,600)),(215,(600,600)),(58.3,(900,600))]):
    for j,im in enumerate((Image.fromarray(fr('mv.mp4',t)), dict(out)[t])): S.paste(im.crop((x,y,x+630,y+410)),(i*640,j*420)); d.text((i*640+6,j*420+4),f'{t}s '+('before' if j==0 else 'after'),fill=(255,255,0))
S.save(root/'out/ov0.jpg',quality=95,subsampling=0)
