# fonts/script —— 前奏页的手写体

| 项 | 值 |
|---|---|
| 字体 | **Great Vibes** Regular (TTF, v1.103) |
| 作者 / 版权 | The Great Vibes Pro Project Authors，Copyright 2010 |
| 来源 | https://fonts.google.com/specimen/Great+Vibes （Google Fonts） |
| 许可 | SIL Open Font License 1.1 —— 见同目录 [`OFL.txt`](OFL.txt) |
| 作用 | 前奏页把歌名和作者"手写"到信封上（`STYLE.md` §6.1） |

## 怎么用

1. 字体**不进运行时**。它只在生成阶段被读一次：`tools/script_outlines.py` 把 A–Z、a–z、0–9 和常用标点的
   字形轮廓采样成 em 单位的多边形，写进 `icons/script.js`（`window.SCRIPT_FONTS['great-vibes']`）。
2. `index.html` 里在 `scene.js` 之前加载它：

   ```html
   <script src="icons/all.js"></script>
   <script src="icons/script.js"></script>
   ```

3. `scene.js` 的 `buildIntro()` 按字宽把字形拼成词，`drawIntro()` 先把轮廓当线条画出来，再把金色灌进去。

## 重新生成

```bash
python tools/script_outlines.py fonts/script/GreatVibes-Regular.ttf icons/script.js \
  --family "Great Vibes" --name great-vibes
```

- 换字体：把别的 OFL 手写体放进来，改上面两条参数，再改 `scene.js` 里的 `SCRIPT_FACE` 常量。
- 缺字（中文歌名等）：在 `tools/script_outlines.py` 的 `CHARS` 里加字符再生成，才会走手写；
  不补也能渲染：`scene.js` 会**降级为字体排版**（WenKai），并在控制台 warn 列出缺的字符，不再让整支 MV 失败。
  要手写就补 `CHARS`；只是能出片就不必补。

## 署名的义务

成片的 `NOTES.md` 里记一条：**字形 Great Vibes（The Great Vibes Pro Project Authors, SIL OFL 1.1）**。
OFL 允许商用与嵌入，但要求保留版权与许可声明；改字形另起名字时不能沿用原字体名。
