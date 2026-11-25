# 封面：c1a 同一镜另摆机位（只在页面里改，不动源码），片名透明层单独导出再叠。用法：cover.py try | final
import sys, io, base64
sys.path.insert(0,'.claude/skills/mv-director/scripts')
import render
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
root=Path('mv-out/xiaojiu-yihu').resolve(); T=58.35
# 名字: (机位, 看向, 视角, 裁宽高比, 裁切中心 x, 片名宽/画宽, 片名中心)
H={'h1':([-6,3.0,30],[66,39,-96],54,16/9,.5,.552,(.677,.30)),'h2':([-6,3.0,30],[64,43,-96],57,16/9,.5,.552,(.677,.265))}
V={'v1':([4,2.6,34],[20,50,-96],68,9/16,.5,.86,(.5,.235)),'v2':([4,2.6,34],[22,56,-96],74,9/16,.455,.86,(.5,.235)),'v3':([2,2.4,24],[22,52,-96],66,9/16,.5,.86,(.5,.235))}
TITLE="""()=>{const M=window.MV.M,X=window.XJ,c=document.createElement('canvas');c.width=1920*M.SC;c.height=1080*M.SC;const o=c.getContext('2d');o.setTransform(M.SC,0,0,M.SC,0,0);X.drawTitle(o,9,1);return c.toDataURL('image/png')}"""
def shot(pg,c):
    pg.evaluate("(c)=>{const X=window.XJ; X._cam=X._cam||X.cam; X.cam=(w)=>X._cam(w,c[0],c[1],c[2]);}",list(c[:3]))
    d,_=render.grab(pg,T,.97); bg=Image.open(io.BytesIO(d)).convert('RGBA'); W,Hh=bg.size; w=round(min(W,Hh*c[3])); x=round((W-w)*c[4]); bg=bg.crop((x,0,x+w,Hh))
    d=pg.evaluate(TITLE); t=Image.open(io.BytesIO(base64.b64decode(d.split(',',1)[1]))).convert('RGBA'); t=t.crop(t.getchannel('A').point(lambda v:255 if v>8 else 0).getbbox())
    tw=round(w*c[5]); th=round(t.height*tw/t.width); bg.alpha_composite(t.resize((tw,th),Image.LANCZOS),(round(w*c[6][0]-tw/2),round(Hh*c[6][1]-th/2))); return bg.convert('RGB')
with sync_playwright() as p:
    final=sys.argv[1]=='final'; b,pg,errs=render.open_page(p,root,f'&scale={2 if final else 1}&nolyrics')
    if final:
        (root/'发布').mkdir(exist_ok=True)
        for k,n,sz in ((sys.argv[2],'封面_横屏_1920x1080.jpg',(1920,1080)),(sys.argv[3],'封面_竖屏_1080x1920.jpg',(1080,1920))):
            im=shot(pg,(H|V)[k]).resize(sz,Image.LANCZOS); im.save(root/'发布'/n,quality=95,subsampling=0); print(n,im.size)
    else:
        S=Image.new('RGB',(2*700+3*400,710))
        for i,k in enumerate(H): S.paste(shot(pg,H[k]).resize((696,392),Image.LANCZOS),(i*700,0))
        for i,k in enumerate(V): S.paste(shot(pg,V[k]).resize((396,704),Image.LANCZOS),(1400+i*400,0))
        S.save(root/'out/ov0.jpg',quality=88); print('done',errs[:2])
    b.close()
