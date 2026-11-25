import sys, json, base64, numpy as np; sys.path[:0]=['.claude/skills/mv-director/scripts']
import render
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path('mv-out/xiaojiu-yihu').resolve(); f=60; a,z=float(sys.argv[1]),float(sys.argv[2])
JS=open(root/'out/flick_all.py').read().split("pg.evaluate('''")[1].split("''')")[0]
AB={'原样':'','无涟漪':"X.Lake.rip=()=>{for(let i=0;i<6;i++)X.Lake.u.uRip.value[i].set(0,0,-99,0)}",'无花瓣':"X.petOn=()=>{}",'无雪':"X.ptOn=()=>{}",'无景深':"window.__o={dof:null}",'无倒影':"window.__o={mirror:null}",'无描边':"window.__o={edge:0}",'无AO':"window.__o={ao:0}",'无光束':"window.__o={rays:0}",'无描金环':"X.pulse=()=>{}"}
with sync_playwright() as p:
    for n,js in AB.items():
        b,pg,e=render.open_page(p,root,'&scale=0.5&nolyrics'); pg.evaluate(JS); pg.evaluate("(j)=>{const X=window.XJ;window.__o={};const r=X.render;X.render=(c,w,o)=>r(c,w,{...o,...window.__o});(0,eval)('const X=window.XJ;'+j)}",js)
        i0=int(a*f); N=int(z*f)-i0; G=np.concatenate([np.frombuffer(base64.b64decode(pg.evaluate('([a,n,f])=>window.fl(a,n,f)',[i0+k,min(60,N-k),f])),np.uint8).reshape(-1,2304) for k in range(0,N,60)]).astype(np.float32); b.close()
        d=np.diff(G,axis=0); ad=np.abs(d); m=np.minimum(ad[:-1],ad[1:])*(np.sign(d[:-1])!=np.sign(d[1:])); c=(m>14).sum(1)
        print(f'{n:5s} 每帧超标格 均 {c.mean():.1f} 最大 {c.max()}  平均闪 {m.mean():.2f}', e[:1], flush=True)
        if n=='原样':
            h=(m>14).sum(0).reshape(36,64); print('  位置(行9等分×列8等分)'); print(h.reshape(9,4,8,8).sum((1,3)).astype(int))
