import sys, io; sys.path[:0]=['.claude/skills/mv-director/scripts','mv-out/xiaojiu-yihu/out']
import render, numpy as np
from pathlib import Path
from PIL import Image
from bars import fr, hp
from playwright.sync_api import sync_playwright
root=Path('mv-out/xiaojiu-yihu').resolve(); K=np.array([.299,.587,.114],np.float32)
def m(a):
    Y=a[60:1020,60:1860].astype(np.float32)@K; h=hp(Y,0); F=np.abs(np.fft.rfft(h*np.hanning(len(h)))); f=np.fft.rfftfreq(len(h)); return F[(f>1/14)&(f<1/11.5)].max()
T=(3,9,18.4,25,34,43.6,48,52,58.3,64,70,74,79,83,90,96,103,110,116.2,122,128,135,143,148,153,160,166,172,180,186,192,199,206,215,224,233,239); bad=[]
with sync_playwright() as p:
    b,pg,errs=render.open_page(p,root,'&scale=2'); pg.evaluate("()=>{const X=window.XJ; X._r=X.render; X._o={}; X.render=(c,w,o)=>X._r(c,w,{...o,...X._o});}"); n0=n1=0
    for t in T:
        r=[m(fr('mv.mp4',t))]
        for o in ({},{'ao':0}): pg.evaluate("(o)=>{window.XJ._o=o}",o); d,_=render.grab(pg,t,.98); r.append(m(np.asarray(Image.open(io.BytesIO(d)).convert('RGB').resize((1920,1080),Image.LANCZOS))))
        n0+=r[0]>r[2]*2 and r[0]>25; n1+=r[1]>r[2]*1.3 and r[1]>25
        print(f'{t}s 旧片 {r[0]:.0f}  现在 {r[1]:.0f}  无AO基线 {r[2]:.0f}',flush=True)
    b.close(); print('旧片有横纹的时刻',n0,'/ 37；现在',n1,'/ 37；页面报错',errs[:2])
