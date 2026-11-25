# 逐帧（60 帧）量局部跳变：每块取 |F[i]-F[i-1]|，减去前后两帧的中位 → 突然跳一下的块。用法：flick.py a b [ablate]
import sys, io; sys.path[:0]=['.claude/skills/mv-director/scripts']
import render, numpy as np
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
root=Path('mv-out/xiaojiu-yihu').resolve()
def run(pg,a,b,fps=60):
    F=[]
    for i in range(int(round((b-a)*fps))+1):
        d,_=render.grab(pg,a+i/fps,.95); F.append(np.asarray(Image.open(io.BytesIO(d)).convert('L').resize((320,180),Image.BOX)).astype(np.float32))
    return np.stack(F)
def blocks(F):
    D=np.abs(np.diff(F,axis=0)); n=D.shape[0]; B=D.reshape(n,18,10,32,10).mean((2,4)); return B
def spikes(B,a,fps=60):
    out=[]
    for i in range(3,len(B)-3):
        nb=np.median(np.concatenate([B[i-3:i],B[i+1:i+4]]),axis=0); ex=B[i]-nb; out.append((float(ex.max()),float((ex>3).sum()),a+(i+1)/fps,np.unravel_index(ex.argmax(),ex.shape)))
    return sorted(out,reverse=True)
if __name__=='__main__':
    a,b=float(sys.argv[1]),float(sys.argv[2])
    with sync_playwright() as p:
        br,pg,errs=render.open_page(p,root,'&scale=1&nolyrics'); F=run(pg,a,b); B=blocks(F)
        print(f'{a}–{b}s 全帧平均差 {np.abs(np.diff(F,axis=0)).mean((1,2)).round(2)[::4].tolist()}')
        for s in spikes(B,a)[:8]: print(f'  {s[2]:.3f}s 局部多跳 {s[0]:.1f}  超标块 {s[1]:.0f}/576  位置 行{s[3][0]} 列{s[3][1]}')
        print(errs[:2]); br.close()
