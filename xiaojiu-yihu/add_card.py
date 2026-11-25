# 片头卡：静止 HOLD 秒，再用 FADE 秒淡出叠进 MV（音乐从淡出那一刻起），MV 本身的时间轴不动。
# 仓库根跑：.venv/bin/python -I mv-out/xiaojiu-yihu/add_card.py <输入视频> <输出.mp4>   发布版从母版做：out/mv_母版.mov → out/mv_发布.mp4
import subprocess, sys
CARD, HOLD, FADE = 'out/关注私我-横版.png', 4, 1
src, out = sys.argv[1:]
dur = lambda f: float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]))
V = 'fps=60,setsar=1,format=yuv420p10le,settb=AVTB'
fc = (f'[0:v]scale=1920:1080:out_color_matrix=bt709:out_range=tv,{V}[c];[1:v]{V}[m];[c][m]xfade=transition=fade:duration={FADE}:offset={HOLD},format=yuv420p[v];'
      f'[1:a]adelay={HOLD * 1000}:all=1[a]')
subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-loop', '1', '-framerate', '60', '-t', str(HOLD + FADE), '-i', CARD, '-i', src, '-filter_complex', fc, '-map', '[v]', '-map', '[a]',
                '-c:v', 'libx264', '-preset', 'slow', '-crf', '13', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
                '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', out], check=True)
assert abs(dur(out) - dur(src) - HOLD) < .1, (dur(out), dur(src))   # 片头只应多出 HOLD 秒
print('写好了', out, f'{dur(out):.2f} 秒')
