# 方块俱乐部 · BLOCK CLUB

像素复古风的经典俄罗斯方块，支持电脑和手机。所有代码均为原生 HTML、CSS、JavaScript，无构建步骤、依赖或后端。

[在线游玩](https://luke0033.github.io/tetris/) · [GitHub 仓库](https://github.com/luke0033/tetris)

## 打开

电脑可以直接用浏览器打开 `index.html`。分享或部署时请一起保留 `index.html`、`style.css`、`engine.js`、`motion.js` 和 `game.js`。手机推荐通过网站链接打开。

本地预览（需要 Node.js）：

```sh
node tools/serve.cjs
```

电脑打开 `http://localhost:8188`；同一 Wi-Fi 下手机打开 `http://电脑局域网IP:8188`。服务仅提供本项目文件。

## 操作

方向键左右移动；↑ / X 顺时针旋转；Z 逆时针旋转；↓ 软降；空格硬降；P / Esc 暂停；Enter 开始或继续。手机使用下方触控按钮，可长按左右移动及下落。切换窗口或进入后台自动暂停。重开有确认提示，Esc 取消。

右上角「玩法说明 / 按键查看」打开完整说明，查看时自动暂停，关闭后恢复原来的游戏状态。

## 画面与反馈

方块下落、移动和旋转使用独立的视觉插值，判定仍然对齐棋盘格。消行依次显示扫光、像素粒子、加分文字和上方方块下落，约 420ms 后恢复操作；暂停时特效一起冻结。四行消除使用更强反馈，升级也会提示。系统启用「减少动态效果」时省略屏幕轻震与粒子，缩短消行过渡。

## 规则

10×20 棋盘，七袋随机、SRS 踢墙旋转、落点投影、500ms 锁定延迟（最多 15 次地面移动重置）。一次消除 1 / 2 / 3 / 4 行分别获得 100 / 300 / 500 / 800 × 当前等级分；软降每格 1 分，硬降每格 2 分。每累计消除 10 行升级，自动下落加速。最高分保存在当前浏览器，无法使用本地存储时也能正常游玩。

## 验证

```sh
node --test tests/engine.test.cjs tests/motion.test.cjs
node tools/browser-check.cjs
```

浏览器检查使用本机 Windows Edge，结果截图存放在 `tools/screenshots/`。

## 自动部署

GitHub Pages 使用 `.github/workflows/deploy.yml` 发布。推送 `main` 分支时自动运行规则与动画测试，通过后只将游戏所需的 HTML、CSS、JavaScript 文件发布到网站。
