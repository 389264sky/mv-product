# 逐帧差：60 帧，64×36 格，报相邻帧差的离群点。用法（仓库根）.venv/bin/python mv-out/xiaojiu-yihu/out/jump.py 起 止
import sys, base64, numpy as np; sys.path[:0]=['.claude/skills/mv-director/scripts']
import render
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path('mv-out/xiaojiu-yihu').resolve(); f=60; a,z=float(sys.argv[1]),float(sys.argv[2])
JS=open(root/'out/flick_all.py').read().split("pg.evaluate('''")[1].split("''')")[0]
with sync_playwright() as p:
    b,pg,e=render.open_page(p,root,'&scale=0.5&nolyrics'); pg.evaluate(JS)
    i0=int(a*f); N=int(z*f)-i0; G=np.concatenate([np.frombuffer(base64.b64decode(pg.evaluate('([a,n,f])=>window.fl(a,n,f)',[i0+k,min(60,N-k),f])),np.uint8).reshape(-1,2304) for k in range(0,N,60)]).astype(np.float32); b.close()
d=np.abs(np.diff(G,axis=0)).mean(1); med=np.array([np.median(d[max(0,i-8):i+9]) for i in range(len(d))])
for i in np.argsort(-(d/(med+.3)))[:12]: print(f'{(i0+i+1)/f:.3f}s 帧差 {d[i]:.2f} 周围中位 {med[i]:.2f} 倍 {d[i]/(med[i]+.3):.1f}')
