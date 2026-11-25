import sys
sys.path.insert(0,'.claude/skills/mv-director/scripts')
import render, json
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path('mv-out/xiaojiu-yihu').resolve()
with sync_playwright() as p:
    b,pg,errs=render.open_page(p,root,'&scale=0.25')
    pg.evaluate('''()=>{const s=document.createElement('canvas');s.width=160;s.height=90;window.__s=s.getContext('2d',{willReadFrequently:true});window.__prev=null;
      window.probe=(t0,n,f)=>{const out=[];for(let i=0;i<n;i++){window.render(t0+i/f);const c=window.__s;c.drawImage(document.getElementById('c'),0,0,160,90);const d=c.getImageData(0,0,160,90).data;let m=0,df=0;const g=new Float32Array(14400);for(let k=0;k<14400;k++){const v=.299*d[k*4]+.587*d[k*4+1]+.114*d[k*4+2];g[k]=v;m+=v;if(window.__prev)df+=Math.abs(v-window.__prev[k]);}window.__prev=g;out.push([m/14400,df/14400]);}return out;}}''')
    dur=pg.evaluate('window.DUR'); f=30; N=int(dur*f); res=[]
    for k in range(0,N,150): res+=pg.evaluate('([a,n,f])=>window.probe(a,n,f)',[k/f,min(150,N-k),f])
    b.close()
L=[r[0] for r in res]; D=[r[1] for r in res]
fl=[]   # 和 check.py 一样：0.1 秒内跳 ≥8，半秒内落回一半以上
for i in range(3,N-20):
    up=L[i]-L[i-3]
    if up>=8 and (not fl or i/f-fl[-1][0]>.6):
        pk=max(range(i,i+7),key=lambda k:L[k]); base=L[i-3]; rise=L[pk]-base
        if min(L[pk:pk+16])<=L[pk]-rise/2: fl.append((round(i/f,2),round(rise,1)))
hard=[(round(i/f,2),round(D[i],1)) for i in range(2,N-2) if D[i]>=8 and D[i]>4*max(D[i-1],D[i+1],.5)]
still=[]; run=0
for i in range(1,N):
    run=run+1 if D[i]<.12 else 0
    if run==30: still.append(round(i/f,1))
print('闪',fl[:30],len(fl)); print('硬切',hard[:30],len(hard)); print('不动>1s',still[:20])
bars=[.064+k*4*60/110 for k in range(1,111)]
hit=[]
for t in bars:
    i=int(t*f); a=max(D[i:i+4]); bq=sum(D[max(0,i-12):i])/12
    hit.append(a>=2*bq)
print('小节头命中 %.0f%%'%(100*sum(hit)/len(hit)))
per=[sum(D[int(t*f):int((t+2.18)*f)])/65 for t in bars]
json.dump({'L':L,'D':D,'per':per},open(root/'out/probe.json','w'))
