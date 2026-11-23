# 黄仁勋回归：制作说明

## 内容
只讲 2026 年 11 月 23 日：英伟达董事会全票恢复黄仁勋总裁、CEO 和董事职务，即刻生效。台词只用官方公告原话。音乐是纯器乐，没有歌词，画面靠字卡和分镜讲事。22 个镜头，96.47 秒。

## 画风
lemo-opuscar 的 manga-panels：纸、墨、网点和一个英伟达绿。绿色只给芯片和它点亮的东西。

## 用户意见
- 只用 23 日回归的新闻做背景；生图用 ComfyUI 的 Z-Image。
- 修了片名“仁”字描边；人物按用户给的五张照片重画，戴细金属半框眼镜；修了微笑图的脸部轮廓和举显卡的手。
- 举显卡的手、走廊和书桌背影由 Z-Image 生成，不来自照片。

## 成片审片（out/审片.md）
- 通过：小节头命中 77%，没有硬切，8 个大时刻全部通过。
- 用户同意带着出片：画面起伏相关 0.37（门槛 0.4）。
- 成片才报出、待用户决定：7 段超过 1 秒几乎不动（38.8–40.4、40.8–42.1、67.2–68.3、72.8–77.8、84.9–86.3、86.3–88.3、88.3–89.8 秒）；10.53 秒报闪动，逐帧看是深色镜头擦到亮色镜头的正常转场。

## 署名与来源
- 音乐：Two Steps From Hell《Victory》，版权归权利人。
- 画风：Lemomo (LemoLab) lemo-opuscar，风格文档 CC BY-NC 4.0，代码 MIT；`tools/prep.py` 改自其 manga-panels。
- 生图：ComfyUI + Z-Image Turbo。人物参考：用户提供的五张带百度百科水印的照片，版权归原作者。
- 字体：Noto Sans SC、Anton（OFL）。
- 事实来源：NVIDIA 公告 https://nvidianews.nvidia.com/news/nvidia-board-reinstates-jensen-huang-as-president-ceo-and-board-director ；“盘前大涨近三成”来自媒体报道，公告里没有。
