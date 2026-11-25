import subprocess, numpy as np
from PIL import Image
P='mv-out/xiaojiu-yihu/out/'
def fr(f,t):
    r=subprocess.run(['ffmpeg','-nostdin','-v','error','-ss',str(t),'-i',P+f,'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','-'],capture_output=True).stdout
    return np.frombuffer(r,np.uint8).reshape(1080,1920,3)
def hp(Y,ax):   # 沿 ax 方向去掉慢变化，剩下的按另一方向取中位数 → 只剩横跨整幅的条
    k=np.hanning(33); k/=k.sum(); s=np.apply_along_axis(lambda v:np.convolve(np.pad(v,16,'edge'),k,'valid'),ax,Y); return np.median(Y-s,axis=1-ax)
if __name__=='__main__':
    for t in (3,9,18.4,25,34,43.6,48,52,58.3,64,70,74,79,83,90,96,103,110,116.2,122,128,135,143,148,153,160,166,172,180,186,192,199,206,215,224,233,239):
        Y=fr('mv.mp4',t).astype(np.float32)@np.array([.299,.587,.114],np.float32); Y=Y[60:1020,60:1860]
        h=hp(Y,0); v=hp(Y,1); F=np.abs(np.fft.rfft(h*np.hanning(len(h)))); f=np.fft.rfftfreq(len(h)); i=int(np.argmax(F[20:]))+20
        print(f'{t:6.1f}s 横条 {h.std():.2f} 竖条 {v.std():.2f}  主周期 {1/f[i]:.1f}px 占比 {F[i]/F[20:].mean():.0f}x')
