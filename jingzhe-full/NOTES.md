# NOTES

- 2026-11-17 建项目后手修了 song.json（记在 fixes）：拍点改成固定网格（122.005 BPM，没有不规则小节）；44 句重建（line5–22 取 61 秒版手修过的，line23–44 由 line1–22 按人声响度互相关平移 110.15–110.21 秒）；line1、line23「盈十」重量。再跑 listen.py / new_project.py 会覆盖，要按 plan.md「交接」重做。自动结果留在 out/song.before-grid.json。
- 署名：three.js r170（MIT）；字体 Ma Shan Zheng（歌词）、ZCOOL KuaiLe（片名）、Zhi Mang Xing（尾声「祥」），都是 SIL OFL 1.1，许可在 `fonts/OFL_*.txt`。

## Blender 素材（前奏、A2）

- `blender/assets/moon_2k.jpg`：NASA Scientific Visualization Studio「CGI Moon Kit」（https://svs.gsfc.nasa.gov/4720）的 lroc_color_2k.jpg，公有领域（NASA 素材不受版权保护，注明出处）。
- 本项目的 `mv/mv.js` 改了一处：`M.plate(id)` 可以指定镜头（默认当前镜头），bar6→7 的叠化要同一刻两个 Blender 镜头的帧。从 skill 重拷 mv.js 时把这处带上。
- （2026-11-18 第七次）`mv/mv.js` 预览默认分辨率 0.5 → 0.4（湖着色器重，0.5 倍时山火那几小节掉帧）；重拷时也带上。

## 片名、署名（2026-11-18 第六次）

- 片头、片尾画面上只写歌名「惊蛰」和演唱「音阙诗听 / 王梓钰」（`jz_title.js`）。作曲：殇小谨；作词：假寐（cues.json credit），不上画面。
- 片名的字形（2026-11-18 第七次换字体）：`title_glyphs.js` 从 `fonts/ZCOOLKuaiLe-Regular.ttf`（ZCOOL KuaiLe，SIL OFL 1.1，`fonts/OFL_ZCOOLKuaiLe.txt`）烘的轮廓，烘法 `bake_title_glyphs.py`。描字、灌金、走光照 `mv-line-art/STYLE.md` §6.1。
- 尾声锦鲤写的「祥」（2026-11-20）：`title_glyphs.js` 的 `zhimangxing`，从 `fonts/ZhiMangXing-Regular.ttf`（Zhi Mang Xing，SIL OFL 1.1，`fonts/OFL_ZhiMangXing.txt`）烘的轮廓，烘法同上。

## 审片（2026-11-20 草稿第四版）

- 过了：确定性、歌词版面、没有闪（原来 10 处）、没有超过 1 秒的不动（原来 4 段）、硬切 3 次全在拍上、坏帧 0。
- 带着 ✗ 交付，用户 2026-11-20 同意（「接受现状」）：小节头命中率 6%（拍点 3%）、画面运动量和 arc 相关 0.31、歌词字号不到 100px。前两项是 2026-11-18 定的运镜取向（一条路径走下来、不为卡点刹车、不切）带来的；歌词是右下角一行小字的版式。

## 成片（2026-11-21）

- 用户要求最多渲一小时：前奏到 bar17 的 8 个 Cycles 镜头（w_sky … w_thaw）没渲 Blender 帧，成片用的是草稿里用户看过的 three.js 代理（Cycles 256 采样实测约 58 秒/帧 × 约 2090 帧 ≈ 34 小时）。要换真帧：`blender.py <项目> frames` 后重跑 `render.py <项目> video --master hevc`。
- render.py 默认画质（2× 超采样、4 子帧运动模糊）3 个进程用了约 3 小时 13 分；0–80 秒那段每帧约 3.3 秒，是瓶颈（其余两段各约 75 分钟）。
- 审片（`out/审片.md`）：和草稿一样的 ✗ 照旧（小节头 7%、arc 0.29、歌词字号、大时刻）；新出 3 处「闪一下」（137.1、142.3、157.6 秒，全画面亮度 +8/255，是水珠帘、小鱼群、红绸扫进画面，不是整屏加亮），用户 2026-11-21 同意带着交付。
- 交付：`out/mv.mp4`、`out/mv_母版.mov`、`out/封面.png`（从母版抽的 237.0 秒那帧）、`out/发布文案.md`。
