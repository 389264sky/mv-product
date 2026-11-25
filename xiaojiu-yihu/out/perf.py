import sys,json,time
sys.path.insert(0,'.claude/skills/mv-director/scripts')
import render
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path('mv-out/xiaojiu-yihu').resolve()
with sync_playwright() as p:
    for sc in ('0.5','2'):
        t0=time.time(); b,pg,errs=render.open_page(p,root,'&scale='+sc); print('scale',sc,'open %.1f s'%(time.time()-t0), flush=True)
        tot=[]
        for t in (3,9,15,22,26,30.5,35,39,43,48,52,57,61,65,69,71.5,75,79,83,88,92,96,100,105,110,113,118,122,127,131,136,140,145,149,153,158,162,167,171,175,179,184,188,192,194,197,201,205,209,215,223,235):
            ms=pg.evaluate('(t)=>{window.render(t);const a=performance.now();for(let i=1;i<=3;i++){window.render(t+i/60);document.getElementById("c").getContext("2d").getImageData(0,0,1,1);}return (performance.now()-a)/3}',t); tot.append((round(ms),t))
        print('avg %.0f ms'%(sum(m for m,_ in tot)/len(tot)),'slowest',sorted(tot)[-8:], flush=True)
        if errs: print(errs[:3])
        b.close()
