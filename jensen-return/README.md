# 《黄仁勋，回来了》MV（可预览、可渲染的工程）

一支用网页画出来的 96 秒短片：`index.html` 逐帧画画面，`scripts/render.py` 把它渲成视频。

黑白漫画分格（纸、墨、网点，加一种英伟达绿），只讲 2026 年 11 月 23 日英伟达董事会全票恢复黄仁勋总裁、CEO 和董事职务这一天：公告付印、全票举手、皮衣走廊、芯片重新亮起绿色，最后回到那张亮着灯的办公桌。音乐是纯器乐，画面靠字卡和分镜讲事，台词只用官方公告原话。

> **声明：本工程仅供个人学习和非商业使用，禁止任何商业用途**（包括但不限于出售、收费代做、用于广告或商业推广）。本片是漫画风格的二次创作，人物与场景由 AI 辅助生成，部分画面为艺术演绎，不代表真实现场，与英伟达公司及黄仁勋本人无关。详见文末「署名与许可」。

目录：[准备](#准备) → [预览](#预览带声音) → [渲染](#渲染) → [文件说明](#文件说明) → [署名与许可](#署名与许可)

## 准备

要装三样东西，都装好才能预览和渲染：

1. **Python 3.10 以上**（[python.org](https://www.python.org/downloads/)）。
2. **Python 依赖**（playwright、pillow、numpy，版本在 `requirements.txt`）和渲染用的浏览器。在工程目录里跑：
   ```
   pip install -r requirements.txt
   python -m playwright install chromium
   ```
3. **ffmpeg**，装好后 `ffmpeg -version` 能打印版本号才算成。macOS：`brew install ffmpeg`；Windows：`winget install ffmpeg`；Linux：`sudo apt install ffmpeg`。

只想预览不渲染的话，有第 1 项就够。

作者跑通的环境：macOS（Apple 芯片）。Windows 和 Linux 没有实测。

## 预览（带声音）

```
python scripts/preview.py .
```

打开打印出来的网址：空格播放，←→ 跳小节。预览默认按半分辨率画，渲出来是全分辨率。

## 渲染

> **本仓库只提供草稿**：`out/mv_草稿.mp4`（960×540、30 帧，约 46 MB），先看效果用。1080P 成片太大不放，用下面第二条命令渲出来就行，出来是 `out/mv.mp4`。成片带 2 倍超采样和运动模糊，比草稿慢得多。

```
python scripts/render.py . video --draft     # 草稿 960×540、30 帧 → out/mv_草稿.mp4
python scripts/render.py . video             # 成片 1920×1080、60 帧 → out/mv.mp4
python scripts/render.py . shots             # 每个镜头一张 → out/stills/
python scripts/render.py . stills 30         # 第 30 秒一张 → out/stills/
```

其他出图方式见 `scripts/render.py` 开头的说明。

## 文件说明

- 画面：`scene.js` 画漫画分格、网点、对白气泡和大字（文字也写在这里）；22 个镜头和每格用的图在 `cues.json`，拍点在 `song.json`。
- `img/`：每格的画（ComfyUI + Z-Image Turbo 生成，再用 `tools/prep.py` 处理成墨黑、纸白和网点）。换图就换这里的同名文件。
- `tools/`、`gen/`：生图和处理图的脚本、ComfyUI 任务单，要本机装好 ComfyUI 和 Z-Image 才能跑；预览和渲染用不到。
- `out/封面.jpg`：封面（1920×1080），`tools/cover.py` 生成。
- `plan.md`、`NOTES.md`：作者做这支 MV 时的设计和记录。

## 署名与许可

- **禁止商业用途**：本工程里作者自己的内容（画面与镜头设计 `scene.js`、`cues.json`，字卡文字等）采用 CC BY-NC 4.0（署名-非商业性使用）许可，全文和说明见仓库根目录的 `LICENSE`。可以个人学习、修改，但要注明出处，且不得用于任何商业用途（出售、收费代做、广告或商业推广）；商用需作者书面同意。
- 下面几项是第三方的东西，按它们各自的许可来，不受上一条限制，也不因上一条而放宽：
  - `scripts/`、`mv/mv.js` 来自 mv-director，MIT 许可，见 `scripts/LICENSE`。
  - 画风来自 Lemomo (LemoLab) 的 lemo-opuscar（manga-panels）：风格文档 CC BY-NC 4.0，代码 MIT；`tools/prep.py` 改自其 manga-panels。
  - 字体许可见 `fonts/字体授权.md` 和 `fonts/OFL_*.txt`（画面上用到的是 Noto Sans SC、Anton，都是 SIL OFL 1.1）。
  - 人物画面由 AI 辅助生成；人物外貌参考的照片版权归原作者，不在本工程里。
  - 音乐 Two Steps From Hell《Victory》版权归原权利人，`audio.wav` 只供个人预览，不要公开发布。
  - 事实来源：[NVIDIA 公告](https://nvidianews.nvidia.com/news/nvidia-board-reinstates-jensen-huang-as-president-ceo-and-board-director)。
