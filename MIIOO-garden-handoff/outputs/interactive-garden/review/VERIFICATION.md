# 本轮验收记录

日期：2026-10-28（Asia/Shanghai）。

## 视觉与交互

- 桌面初轮 1440×900，最终 1280×720（整页 1280×760）；手机 390×844（整页另存）。
- 独立 reviewer 发现的三项问题：移动端植物裁切、工作台小字号、手机场景按钮遮挡。完成一次集中修正，最终三项均评分 resolved，结论 ship。
- 页面保留 MIIOO 品牌，主体按 Neuralyn 参考重做。植物图由 Imagegen 重建；植物形态与原 GIF 并非逐像素相同。
- 剧本／分镜／影像三个页签点击及方向键切换通过。
- 暂停／播放：canvas 的 motion 状态与按钮 aria-pressed 一致。
- 沉浸模式仅显示花园与返回按钮；Escape 返回首页，焦点回到原入口。
- 通过浏览器指针路径操作触发 8 次阵风采样，观察花头形态；修正逐像素局部扰动造成的挤压，改为各植株共享头部位移并随高度减弱至根部。
- 移动端页面宽度等于视口宽度，无全页横向溢出。场景按钮在工作台下方独立区域。
- 最终主页控制台无 error/warn；两个 JS 文件通过 node --check。

## 兼容分支

测试入口 `review/runtime-checks.html`，通过浏览器实际访问。此为受控模拟，不等同于全设备覆盖。

| 场景 | 观测结果 |
|---|---|
| `?case=no-webgl`，模拟 getContext 不可用 | fallback，poster 已加载且 visible |
| `?case=reduced-motion`，模拟系统媒体查询为 reduce | ready，paused=true，motion=paused |
| `?case=context-restore`，调用 WEBGL_lose_context | ready → fallback → ready，恢复绘制 |

## 性能样本

- 设备：MacBook Air / Mac16,12 / Apple M4 / 24 GB / macOS 27.2。
- 浏览器：Codex 内置浏览器；没有记录具体 Chromium 版本。
- 最终样本视口：1280×720；背景舞台高度 760px；绘制像素比 1.50。
- 120 帧窗口：约 60.0 FPS，中位帧间隔 16.70 ms，P95 17.10 ms。
- 新背景每帧 2 次 drawArrays 调用；36 个花粉点与两个纹理三角形，不再绘制旧版程序化三维植物。
- 上述为浏览器帧间隔，不是 GPU 单帧耗时；尚无普通办公集显、其他浏览器、长时间或多设备基准，不能承诺跨设备 60 FPS。
- 提供持续慢帧后的分辨率降级、较长恢复观察窗、隐藏页面停帧；无运行时网络字体或第三方 CDN 请求。

## 截图

- `homepage-desktop-final.jpg`：最终桌面视口。
- `homepage-desktop-full.jpg`：最终桌面整页，包含场景控制。
- `homepage-mobile-final.jpg`：最终手机视口。
- `homepage-mobile-full.jpg`：最终手机整页。
- `homepage-desktop.jpg`、`homepage-mobile.jpg`：修正前记录。

该版本为本地首页和背景实现，尚未部署到 miiooai.com；工作台内容标记为交互示例，按钮指向现有公开网站。
