import sys, io; sys.path[:0]=['.claude/skills/mv-director/scripts','mv-out/xiaojiu-yihu/out']
import render, numpy as np
from pathlib import Path
from PIL import Image
from bars import fr, hp
from playwright.sync_api import sync_playwright
root=Path('mv-out/xiaojiu-yihu').resolve(); K=np.array([.299,.587,.114],np.float32)
def m(a):
    Y=a[60:1020,60:1860].astype(np.float32)@K; h=hp(Y,0); F=np.abs(np.fft.rfft(h*np.hanning(len(h)))); f=np.fft.rfftfreq(len(h)); b=(f>1/14)&(f<1/11.5)
    return f'{h.std():.2f}/{F[b].max():.0f}'
AB={'原样':{}, '绢纹关':{'silk':0}, '颗粒关':{'grain':0}, '描边关':{'edge':0}, '光束关':{'rays':0}, 'AO关':{'ao':0,'aoR':0}, '泛光关':{'bloom':0}, '云关':{'cloud':None}}
T=(58.3,128,135,172,215)
with sync_playwright() as p:
    for sc in (1,2):
        b,pg,errs=render.open_page(p,root,f'&scale={sc}')
        pg.evaluate("()=>{const X=window.XJ; X._r=X.render; X._o={}; X.render=(c,w,o)=>X._r(c,w,{...o,...X._o});}")
        print(f'--- 页面单帧 scale={sc}（横条std / 12.5px 带能量）', *T)
        for n,o in ([x for x in AB.items() if x[0] in ('原样','AO关')]):
            pg.evaluate("(o)=>{window.XJ._o=o}",o); r=[]
            for t in T: d,_=render.grab(pg,t,.98); im=Image.open(io.BytesIO(d)).convert('RGB'); r.append(m(np.asarray(im.resize((1920,1080),Image.LANCZOS))))
            print(f'{n:6s}',*r,flush=True)
        b.close()
for f in ():
    if f=='mv_草稿.mp4': continue
    print(f, *[m(fr(f,t)) for t in T])
