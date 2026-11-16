# NOTES

- 20XX-XX-XX 整首重跑 listen.py 后手修了 17 句逐字时间（song.json 的 fixes）。再跑 listen.py 会覆盖，要重新修：塌掉的副歌句照同词句按人声响度互相关平移。

## 成片（20XX-XX-XX）

- 文件：`out/mv.mp4`（1920×1080、60 帧、H.264 约 20 Mbps、AAC，213.2 秒）；`out/mv_母版.mov`（10 bit H.265、无损 PCM）。Blender 镜头 5 个共 1558 帧（hug、home1、homeRain、homeRain2、home2），其余人物镜头用 three.js 代理。
- 这首歌在讲什么、每句怎么演、画风：见 `plan.md` 第 2、4、5、10 节和 `cues.json` 的 `board`。
- 成片审片（`out/审片.md`）：硬切 5 次全部在拍上或字上 ✓；起伏和 arc 相关 0.51 ✓；18 个大时刻 17 个炸了；42 句歌词上屏时间 ✓。
- 带着 ✗ 交付（用户 20XX-XX-XX 直接要求出成片）：
  - 小节头命中 30%（门槛 50%）：用户定了不要闪白、镜头不推不震，小节头上没有动作。
  - 160.67s 进副歌没有大时刻：用户要求去掉 `home2` 的两次炸光屑。
  - 三处超过 1 秒不动：123.8–125.1s、167.9–169.5s、197.5–199.0s。没改。
  - 歌词 48px 不到 100px：用户定的，歌词只在右下角。
- 用户看预览的意见（没用 feedback.json，口头给的）：见 `plan.md` 第 11、12 节。
- 遇到的问题：
  - 牵手交叉：手腕落在对方手腕根上、两只手各顺小臂伸出去；改成两人手腕往自己身上勾（掌心朝前的手 `wrist` 用负值）。
  - 7.96s 整幅画面跳一下：`moments` 里 bar1 的 `drift` 效果 6 秒后被 `mv.js` 的 `fxAt` 丢掉（`dt > 6` 就 break），2% 的推近一帧缩回去。删了这个 `drift`。以后别用 `drift`，除非 6 秒内换镜头。
  - `render.py determinism` 在渲过 Blender 帧以后会报「缺第 N 帧」：它没有预加载 Blender 帧，不是真缺。要查确定性就在渲 Blender 帧之前跑。
  - 草稿（960×540）里每 2 秒整幅画面轻轻跳一下是草稿压缩，成片没有。
  - 找单帧跳变：`ffmpeg -i <视频> -vf "scale=480:270,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=yd.txt" -f null -`，再找比前后中位数大 2.5 倍的帧；除了硬切和大时刻不该有别的。
- 署名：人物是用户的 VRM 模型；字体 霞鹜文楷（LXGW WenKai）、站酷快乐体（ZCOOL KuaiLe）、Allura，都在 `fonts/`，许可见 `fonts/字体授权.md`；画风参考见 `plan.md` 第 5 节。
