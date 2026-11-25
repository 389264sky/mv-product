import sys, json, numpy as np; sys.path[:0]=['.claude/skills/mv-director/scripts']
import render
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path('mv-out/xiaojiu-yihu').resolve(); cues=json.load(open(root/'cues.json'))['shots']
with sync_playwright() as p:
    b,pg,e=render.open_page(p,root,'&scale=0.25'); S=[(pg.evaluate('(r)=>window.MV.M.ref(r)',c['at']) if isinstance(c['at'],str) else c['at'],c['scene']) for c in cues]; b.close()
S.sort(); f=60; G=np.load(root/'out/flick.npy').astype(np.float32); d=np.diff(G,axis=0); ad=np.abs(d)
m=np.minimum(ad[:-1],ad[1:])*(np.sign(d[:-1])!=np.sign(d[1:])); rc=np.r_[0,(m>14).sum(1),0]
nb=np.maximum.reduce([ad[:-4],ad[1:-3],ad[3:-1],ad[4:]]); jc=np.zeros(len(G)); jc[3:len(G)-2]=((ad[2:-2]-2.5*nb)>7).sum(1)
st=np.array([s[0] for s in S]); nm=[s[1] for s in S]
def shot(t): return nm[max(0,int(np.searchsorted(st,t+1e-6))-1)]
def near(t): return np.min(np.abs(st-t))<.75
for name,c in (('回跳',rc),('突跳',jc)):
    out=[]
    for i in np.argsort(-c):
        t=i/f
        if c[i]<10 or len(out)>=30: break
        if near(t) or any(abs(t-o[0])<.5 for o in out): continue
        out.append((round(float(t),2),shot(t),int(c[i])))
    print(name,out)
for a,z in ((26.3,27.9),(99.0,101.9)):
    r=[(round(i/f,2),int(rc[i]),int(jc[i])) for i in range(int(a*f),int(z*f)) if rc[i]>=8 or jc[i]>=8]; print('点名镜头',shot(a+.1),a,z,'超标帧',len(r),r[:20])
