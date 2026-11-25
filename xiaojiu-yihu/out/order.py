import sys
sys.path.insert(0,'.claude/skills/mv-director/scripts')
import render
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path('mv-out/xiaojiu-yihu').resolve()
with sync_playwright() as p:
    b,pg,errs=render.open_page(p,root,'&scale=0.5')
    ts=[1.0+i*4.02 for i in range(60)]
    cuts=pg.evaluate('window.MV_INFO().shots.map(s=>s.t0)')
    ts+= [c+.05 for c in cuts[1:]]
    js='''(t)=>{window.render(t);const c=document.getElementById('c');const s=document.createElement('canvas');s.width=240;s.height=135;const x=s.getContext('2d');x.drawImage(c,0,0,240,135);return Array.from(x.getImageData(0,0,240,135).data)}'''
    A={t:pg.evaluate(js,t) for t in ts}
    bad=[]
    for t in reversed(ts):
        B=pg.evaluate(js,t); n=sum(1 for i in range(0,len(B),4) if max(abs(B[i+k]-A[t][i+k]) for k in range(3))>24)
        if n>30: bad.append((round(t,2),n))
    print('不一致',bad[:20],len(bad),'/',len(ts)); b.close()
