# 《小酒一壶》MV（可预览、可渲染的工程）

一支用网页画出来的 MV：`index.html` 逐帧画画面（three.js r170，全片代码生成，没有外部模型和贴图），`scripts/render.py` 把它渲成视频。

壶中天地：一壶酒里装着整片江湖。公子化成一只丹顶鹤，从杯中山水飞出去：青绿群峰、沧海孤舟、月下巨壶、大雪千里；第二段换一重天地：竹海飞瀑、大漠荷塘、月宫桂树、雪窗红泥炉、云上棋局、凤引鹤群、长城烽火、屋脊星轨。最后一杯饮尽，群山又缩回杯里。画风是 3D 青绿描金，歌词在右下角逐字亮起。

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

只想预览不渲染的话，有第 1 项就够。全片是 WebGL 画的，要用显卡，没有显卡的机器（比如云服务器）会很慢。

作者跑通的环境：macOS（Apple 芯片）。Windows 和 Linux 没有实测。

## 预览（带声音）

```
python scripts/preview.py .
```

打开打印出来的网址：空格播放，←→ 跳小节。预览默认按半分辨率画，渲出来是全分辨率。

## 渲染

> **本仓库不放视频**（草稿 157 MB、成片都超过 GitHub 单文件 100 MB 的上限）。**装好上面的环境后，在工程目录里直接运行下面这一条就能得到成片** `out/mv.mp4`（1920×1080、60 帧，和作者发布的画面一样，只是没有片头卡）：
>
> ```
> python scripts/render.py . video --subframes 8
> ```

其他命令：

```
python scripts/render.py . video --draft              # 草稿 960×540、30 帧 → out/mv_草稿.mp4
python scripts/render.py . shots                      # 每个镜头一张 → out/stills/
python scripts/render.py . stills 60                  # 第 60 秒一张 → out/stills/
```

成片作者用的是 `--subframes 8`（每帧 8 个子帧做运动模糊，镜头竖移时不会重影成横线），在 Mac 上渲了约 100 分钟；不加就是默认的 4 个子帧，快一倍。其他出图方式见 `scripts/render.py` 开头的说明。

## 文件说明

- 画面：`core.js` 是公共的渲染、转场和光影，`land.js`、`sea.js`、`flora.js`、`crane.js`、`still.js`、`stage.js`、`worlds*.js` 画各个场景，`shots_a.js`–`shots_e.js` 是逐个镜头；`title.js` 片名，`lyric.js` 歌词上屏。
- `cues.json`：54 个镜头的时间表，由 `build_cues.py` 按 `plan.md` 第 4 节生成；拍点和逐字时间在 `song.json`（`fix_song.py`、`realign*.py` 手修过，见 `NOTES.md`）。
- `lib/`：three.js r170。`stems/`：用 demucs 从原曲分出来的四轨，对拍点、对歌词时用的，预览和渲染用不到。
- `发布/`：横竖封面、发布文案和提示词。`add_card.py` 给成片前面接片头卡（片头图不在本工程里）。
- `out/`：审片记录、对比图和作者查问题用的小脚本。
- `plan.md`、`NOTES.md`、`feedback.json`：作者做这支 MV 时的设计、记录和逐条修改意见。

## 署名与许可

- **禁止商业用途**：本工程里作者自己的内容（画面与镜头设计、`cues.json` 等）采用 CC BY-NC 4.0（署名-非商业性使用）许可，全文和说明见仓库根目录的 `LICENSE`。可以个人学习、修改，但要注明出处，且不得用于任何商业用途（出售、收费代做、广告或商业推广）；商用需作者书面同意。
- 下面几项是第三方的东西，按它们各自的许可来，不受上一条限制，也不因上一条而放宽：
  - `scripts/`、`mv/mv.js` 来自 mv-director，MIT 许可，见 `scripts/LICENSE`。
  - `lib/` 是 three.js r170，MIT 许可。
  - 字体许可见 `fonts/字体授权.md` 和 `fonts/OFL_*.txt`（画面上用到的是 ZCOOL KuaiLe、Zhi Mang Xing，都是 SIL OFL 1.1）。
  - 歌曲《小酒一壶》词：张凤敏，曲：康兵辉，编曲：伍威，演唱：灼夭，出品：小田音乐社，版权归原权利人。`audio.wav`、`stems/` 只供个人预览，不要公开发布。
