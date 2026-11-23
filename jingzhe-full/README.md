# 《惊蛰》MV（可预览、可渲染的工程）

一支用网页画出来的 MV：`index.html` 逐帧画画面（Canvas 2D、three.js 着色器），`scripts/render.py` 把它渲成视频。

冬夜冰湖下一粒火种，复燃成山火、惊雷、整个宇宙；春天化成锦鲤游过古镇，跃过龙门化成金龙飞回星海。同一段歌词唱两遍，画面走冬、春两个季节。

> **声明：本工程仅供个人学习和非商业使用，禁止任何商业用途**（包括但不限于出售、收费代做、用于广告或商业推广）。详见文末「署名与许可」。

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

只想预览不渲染的话，有第 1 项就够。湖、宇宙这些画面是 WebGL 着色器画的，要用显卡，没有显卡的机器（比如云服务器）会很慢。

作者跑通的环境：macOS（Apple 芯片）。Windows 和 Linux 没有实测。

## 预览（带声音）

```
python scripts/preview.py .
```

打开打印出来的网址：空格播放，←→ 跳小节。预览默认按 0.4 倍分辨率画，看着糊一点是正常的，渲出来是全分辨率。

## 渲染

> **本仓库不带视频**：草稿有 130 MB，超过了 GitHub 单个文件的上限，1080P 成片更大，都要你自己用下面的命令渲。成片带 2 倍超采样和运动模糊，比草稿慢得多。

```
python scripts/render.py . video --draft     # 草稿 960×540、30 帧 → out/mv_草稿.mp4
python scripts/render.py . video             # 成片 1920×1080、60 帧 → out/mv.mp4
python scripts/render.py . shots             # 每个镜头一张 → out/stills/
python scripts/render.py . stills 60         # 第 60 秒一张 → out/stills/
```

其他出图方式见 `scripts/render.py` 开头的说明。

## 文件说明

- 画面：`scene.js` 是入口，各段在 `jz_*.js`（`jz_lake.js` 冰湖、`jz_cosmos.js` 宇宙、`jz_town.js` 古镇、`jz_koi.js` 锦鲤、`jz_dragon.js` 金龙……）；镜头表和歌词版面在 `cues.json`，拍点和逐字歌词时间在 `song.json`。
- `plan.md`、`NOTES.md`：作者做这支 MV 时的设计和记录。
- `stems/`：用 demucs 从原曲分出来的人声、鼓、贝斯和其他四轨，对拍点、对歌词时用的，预览和渲染用不到。
- `blender/`、`out/blender_cache/`：早期 3D 版的 Blender 素材和缓存，现在的版本不用。
- `title_glyphs.js` 是片名和尾声「祥」字的轮廓，由 `bake_title_glyphs.py` 从字体烘出来；换字体才要重跑。

## 署名与许可

- **禁止商业用途**：本工程里作者自己的内容（画面与镜头设计 `scene.js`、`jz_*.js`、`cues.json` 等）采用 CC BY-NC 4.0（署名-非商业性使用）许可，全文和说明见仓库根目录的 `LICENSE`。可以个人学习、修改，但要注明出处，且不得用于任何商业用途（出售、收费代做、广告或商业推广）；商用需作者书面同意。
- 下面几项是第三方的东西，按它们各自的许可来，不受上一条限制，也不因上一条而放宽：
  - `scripts/`、`mv/mv.js` 来自 mv-director，MIT 许可，见 `scripts/LICENSE`。
  - `lib/` 是 three.js r170，MIT 许可（Copyright 2010-2024 Three.js Authors）。
  - 字体许可见 `fonts/字体授权.md` 和 `fonts/OFL_*.txt`（画面上用到的是 Ma Shan Zheng、ZCOOL KuaiLe、Zhi Mang Xing，都是 SIL OFL 1.1）。
  - `blender/assets/moon_2k.jpg` 来自 NASA Scientific Visualization Studio「CGI Moon Kit」（https://svs.gsfc.nasa.gov/4720），公有领域。
  - 歌曲《惊蛰》（演唱：音阙诗听 / 王梓钰；作曲：殇小谨；作词：假寐）版权归原权利人，`audio.wav` 和 `stems/` 只供个人预览，不要公开发布。
