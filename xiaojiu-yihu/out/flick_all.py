# 全片 60 帧逐帧、64×36 小格扫局部闪：①跳一下又回来 ②整组突跳（换拍重排之类）。用法：flick_all.py [a b]
import sys; sys.path[:0]=['.claude/skills/mv-director/scripts']
import render, json, numpy as np
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path('mv-out/xiaojiu-yihu').resolve(); f=60
with sync_playwright() as p:
    b,pg,errs=render.open_page(p,root,'&scale=0.5&nolyrics')
    pg.evaluate('''()=>{const s=document.createElement('canvas');s.width=320;s.height=180;const x=s.getContext('2d',{willReadFrequently:true});x.imageSmoothingQuality='high';const X=window.XJ,_r=X.render;X.render=(c,w,o)=>_r(c,w,{...o,grain:0});
      window.fl=(i0,n,f)=>{let o='';for(let i=0;i<n;i++){window.render((i0+i)/f);x.drawImage(document.getElementById('c'),0,0,320,180);const d=x.getImageData(0,0,320,180).data;for(let r=0;r<36;r++)for(let q=0;q<64;q++){let v=0;for(let y=0;y<5;y++)for(let z=0;z<5;z++){const k=((r*5+y)*320+q*5+z)*4;v+=d[k]*.299+d[k+1]*.587+d[k+2]*.114}o+=String.fromCharCode(Math.round(v/25));}}return btoa(o)}}''')
    import base64
    dur=pg.evaluate('window.DUR'); a,z=(float(sys.argv[1]),float(sys.argv[2])) if len(sys.argv)>2 else (0,dur); i0=int(a*f); N=int(z*f)-i0; G=[]
    for k in range(0,N,120): G.append(np.frombuffer(base64.b64decode(pg.evaluate('([a,n,f])=>window.fl(a,n,f)',[i0+k,min(120,N-k),f])),np.uint8).reshape(-1,2304))
    b.close()
G=np.concatenate(G).astype(np.float32); np.save(root/'out/flick.npy',G.astype(np.uint8)); d=np.diff(G,axis=0); ad=np.abs(d); cues=json.load(open(root/'cues.json'))['shots']
rev=np.zeros(len(G)); jmp=np.zeros(len(G))
m=np.minimum(ad[:-1],ad[1:]); rev[1:-1]=((np.sign(d[:-1])!=np.sign(d[1:]))&(m>10)).sum(1)
nb=np.maximum.reduce([ad[:-4],ad[1:-3],ad[3:-1],ad[4:]]); jmp[3:len(G)-2]=((ad[2:-2]>3*nb)&(ad[2:-2]>5)).sum(1)
R=[(round((i+i0)/f,2),int(rev[i])) for i in range(len(G)) if rev[i]>=6]; J=[(round((i+i0)/f,2),int(jmp[i])) for i in range(len(G)) if jmp[i]>=6]
def grp(L):
    o=[]
    for t,c in L:
        if o and t-o[-1][1]<.3: o[-1][1]=t; o[-1][2]=max(o[-1][2],c); o[-1][3]+=1
        else: o.append([t,t,c,1])
    return o
print('跳一下又回来', len(grp(R)), grp(R)[:60]); print('突跳', len(grp(J)), grp(J)[:60]); print(errs[:2])
