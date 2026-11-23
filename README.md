# mv-product

成品 MV 工程合集：每个文件夹是一支做好的 MV，下载下来就能预览、能渲染；换上你们自己的照片和旁白，就是你们自己的 MV。

> 仅供个人学习和非商业使用，禁止任何商业用途（[CC BY-NC 4.0](LICENSE)）。

## MV 列表

| 封面 | MV | 说明 |
|---|---|---|
| <a href="we-together-forever-mv/"><img src="we-together-forever-mv/out/发布封面.jpg" width="320"></a> | **[我会等](we-together-forever-mv/)**<br>歌：《我会等》戴羽彤<br>约 3 分 53 秒 | 从校服到婚纱的表白 MV：黑底打字的片头，3D 动画人物，118 个照片位按时间线铺开（现在是占位图），每段配日期卡和告白。<br>[使用说明](we-together-forever-mv/README.md) · [草稿视频](we-together-forever-mv/out/mv_草稿.mp4) |
| <a href="jingzhe-full/"><img src="jingzhe-full/out/封面.png" width="320"></a> | **[惊蛰](jingzhe-full/)**<br>歌：《惊蛰》音阙诗听 / 王梓钰<br>约 4 分 2 秒 | 冬夜冰湖下一粒火种，复燃成山火、惊雷、整个宇宙；春天化成锦鲤游过古镇，跃过龙门化成金龙飞回星海。同一段歌词唱两遍，画面走冬、春两个季节；每一帧都是代码画的（Canvas 2D、three.js 着色器）。<br>[使用说明](jingzhe-full/README.md)（草稿 130 MB 超过 GitHub 上限，没放进仓库，要自己渲） |
| <a href="jensen-return/"><img src="jensen-return/out/封面.jpg" width="320"></a> | **[黄仁勋，回来了](jensen-return/)**<br>音乐：《Victory》Two Steps From Hell<br>约 1 分 36 秒 | 黑白漫画分格的短片，只讲 2026 年 11 月 23 日英伟达董事会全票恢复黄仁勋职务这一天：公告付印、全票举手、皮衣走廊、芯片重新亮起绿色。人物由 AI 辅助生成，部分画面为艺术演绎。<br>[使用说明](jensen-return/README.md) · [草稿视频](jensen-return/out/mv_草稿.mp4) |

## 获取项目

一支 MV 就是一个文件夹，下载你要的那一个就行。

**只下载其中一支（推荐，仓库会越来越大）**，需要 git 2.25 以上：

```
git clone --filter=blob:none --sparse https://github.com/389264sky/mv-product.git
cd mv-product
git sparse-checkout set we-together-forever-mv
```

最后一行换成你要的文件夹名。以后想再加一支：`git sparse-checkout add <文件夹名>`。

**下载整个仓库**：`git clone https://github.com/389264sky/mv-product.git`，或者在 GitHub 页面点 Code → Download ZIP。

## 预览和渲染

每支 MV 的用法都一样，下面是大致步骤，细节（换照片、改旁白、去掉片头等）看各自文件夹里的 `README.md`。

1. **准备环境**（一次就行）：装 Python 3.10 以上和 ffmpeg，然后进到 MV 的文件夹里：
   ```
   pip install -r requirements.txt
   python -m playwright install chromium
   ```
2. **预览**（带声音）：`python scripts/preview.py .`，打开打印出来的网址。
3. **渲染**：
   ```
   python scripts/render.py . video --draft   # 草稿 960×540，一两分钟 → out/mv_草稿.mp4
   python scripts/render.py . video           # 1080P 成片 → out/mv.mp4
   ```
   仓库里每支 MV 只带草稿 `out/mv_草稿.mp4`；1080P 成片太大不放，自己渲（比草稿慢得多，要几十分钟）。

## 往仓库里加新的 MV

写给维护者：

- 一支 MV 一个文件夹，文件夹名用英文小写和短横线，比如 `we-together-forever-mv`。
- 文件夹要能自己跑：`index.html`、`scene.js`、`cues.json`、`audio.wav`、`scripts/`、`requirements.txt`、`README.md` 都在里面。
- 带上草稿 `out/mv_草稿.mp4` 和封面 `out/发布封面.jpg`；1080P 成片、母版和渲染中间文件不提交（根目录 `.gitignore` 已经挡住）。
- 真实照片、人名、日期、地点先换成占位，再提交。
- 在上面的「MV 列表」里加一行。

## 许可

各 MV 文件夹里的原创内容采用 CC BY-NC 4.0（署名-非商业性使用），全文和说明见 [LICENSE](LICENSE)。第三方的代码、字体、歌曲按各自的许可，见每支 MV 的 README「署名与许可」。
