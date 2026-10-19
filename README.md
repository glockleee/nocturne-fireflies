# 星海萤光 · Nocturne for the Fireflies

一个可互动的夜色微光网站：星辰、萤火、月晕与极光，配以实时合成的环境音乐和音效。

## 线上地址

- **Cloudflare Pages**：<https://nocturne-fireflies.pages.dev/>
- **GitHub Pages**：<https://glockleee.github.io/nocturne-fireflies/>
- **GitHub 仓库**：<https://github.com/glockleee/nocturne-fireflies>

## 打开方式

**方式一（最简单）**：双击 `index.html`，用 Chrome / Edge / Safari 打开。

**方式二（本地服务）**：

```bash
cd E:\picture
python -m http.server 8123
```

然后访问 <http://127.0.0.1:8123/>。

> 首次进入需要点击一次，浏览器才允许播放声音。建议佩戴耳机。
> 字体来自 Google Fonts，离线时会自动回退到系统宋体，不影响动画与声音。

## 交互

| 操作 | 效果 |
| --- | --- |
| 移动鼠标 / 滑动手指 | 萤火追随指尖，星与星之间浮起金色星座线 |
| 轻触 / 点击夜空 | 光之涟漪绽放：星芒、光环与漂浮光尘 |
| 按住拖动 | 一路洒下细碎星光与轻响 |
| 空格键 | 在随机位置再点亮一束光 |
| `M` | 静音 / 取消静音 |
| 右上角按钮 | 开启或关闭声音 |

每隔几次点击还会偶尔引来一场小型流星雨。

## 声音

全部由 Web Audio API 实时合成，没有外部音频文件：

- **铺底**：A 小调色彩的柔和和弦垫（Am9 → Fmaj9 → Cmaj9 → G6/9），带缓慢滤波起伏与风声
- **点缀**：五声音阶钟琴随机洒落，卷积混响 + 延迟
- **音效**：点击为按五声音阶上行的钟音（按左右位置声场定位），拖动为轻响，入场有空气般的上升音
- 月晕会随音乐电平轻轻呼吸

## 文件结构

```
index.html          页面结构
css/style.css       视觉、排版、极光与月光动画
js/audio.js         Web Audio 音乐与音效引擎
js/scene.js         Canvas 星辰、萤火、涟漪、流星与交互
```

## 细节

- 自适应桌面 / 平板 / 手机，触屏与鼠标均可用
- 支持 `prefers-reduced-motion`，会减少粒子并关闭装饰动画
- 粒子数量、DPR（上限 2）按屏幕自适应，兼顾画质与性能
- 静音模式进入：入口下方的「静音进入」，之后可随时开启声音

## 部署

```bash
# 生成待部署目录
mkdir dist
cp -r index.html css js README.md robots.txt _headers .nojekyll dist/
# Cloudflare Pages（需要先 wrangler login）
wrangler pages deploy dist --project-name=nocturne-fireflies --branch=main
```

GitHub Pages 会在推送到 `main` 后自动构建。

Made of stardust & sound · 2026
