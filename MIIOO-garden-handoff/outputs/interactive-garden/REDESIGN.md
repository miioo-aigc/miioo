# MIIOO 首页重设计

2026-10-28。用户确认保留 MIIOO 品牌，复刻 [Neuralyn 动图](https://motionsites.ai/assets/hero-neuralyn-preview-Br4FRDQA.gif) 的视觉，并加入鼠标交互。

## 当前交付

首页采用黑色留白、双行标题、衬线斜体强调、淡彩主按钮和半透明工作台。摄影花园分布于两侧与底部，包含白色蒲公英、金黄色野花、绿叶和苔藓。手机端另做裁切与内容排列。

背景由内置 Imagegen 按参考重建，当前使用本地 Three.js r170。原始摄影颜色与透明植被 alpha 配合，使用一张 144×80 的连续细分网格。5 组风响应按位置平滑混合；6 处花头和叶片局部摆动在区域边缘及连接处归零，不再裁开照片或挖矩形孔。植被根部在与地面混合前恢复固定位置，独立苔藓底图保持静止。

空中叶瓣由两组 InstancedMesh 绘制，具有实际弯曲表面、旋转和光照变化，随风漂移，也能被鼠标阵风带起。植物主体仍是摄影网格组成的 2.5D 场景，不是全场景扫描三维重建；飞舞叶瓣则是真正的三维网格。它不包含完整空气流体求解，也不宣称与参考逐像素一致。

## 体验方式

- 移动鼠标扫过花草触发局部阵风，无需按住拖动；触摸输入不模拟悬停。
- “暂停动画”切换为静态场景；“沉浸花园”隐藏首页内容，Esc 或“返回首页”退出。
- 纯背景页提供“暂停动画／播放动画”和“吹一阵风”；系统开启减少动态效果时默认静止，仍可由用户主动播放。
- 鼠标事件按动画帧聚合位移与速度，避免高频鼠标事件被时间阈值全部过滤。
- 工作台可切换剧本、分镜、影像示例，支持方向键与 Home/End。
- 创作按钮与导航链接指向 MIIOO 真实网站。示例内容未连接账号、项目数据库或生成服务。

## 文件

| 文件 | 用途 |
| --- | --- |
| `index.html` | 新版首页入口 |
| `hero.css`、`hero-ui.js` | 页面样式、工作台切换、沉浸与暂停控制 |
| `neural-garden.js` | Three.js 场景、摄影网格、花茎与局部叶片动画、阵风与生命周期 |
| `wind-particles.js` | 实例化三维飞舞叶片与花瓣 |
| `background-controls.js` | 纯背景页的播放、暂停和阵风按钮 |
| `garden-background.html` | 无首页文案与工作台的背景入口，保留简洁动画控制 |
| `garden-original.html` | 保留的旧版入口，继续引用旧 Three.js 实现 |
| `previous/neural-garden-v1.js` | 上一版单张照片原生 WebGL 变形渲染器备份 |
| `vendor/three.module.js` | 本地 Three.js r170，附许可证 |
| `assets/neuralyn-garden.webp` | 植物摄影颜色与静态回退图，约 182 KB |
| `assets/neuralyn-garden.png` | 生成式重建的原始背景 |
| `assets/garden-ground-plate.webp` | 去除站立植物、保留苔藓的静态底图，约 91 KB |
| `assets/garden-vegetation-alpha.webp` | 用于植物轮廓的透明 alpha 素材，约 605 KB |
| `assets/ASSET_ORIGIN.md` | 素材来源、完整 Imagegen 提示词与字体信息 |
| `review/garden-motion.mp4` | 本轮约 8 秒动态演示 |
| `review/WIND-VERIFICATION.md` | 本轮动画观测、性能样本及兼容性验证 |
| `review/PERFORMANCE-VERIFICATION.md` | 桌面流畅度优化前后对照及验证边界 |
| `review/CONTINUITY-VERIFICATION.md` | 鼠标连续摇晃的接缝修复与复验 |
| `review/motion-continuity-checks.html` | 左侧、右侧及全画幅摇晃复现页 |

字体使用本地 DM Sans 和 Instrument Serif，附开源许可证。Three.js 同样从项目本地加载，不依赖 CDN 或联网生成服务；旧版所需文件继续保留。

## 运行与集成

在项目根目录运行：

```sh
python3 -m http.server 8766 --bind 127.0.0.1 --directory outputs/interactive-garden
```

首页地址为 [http://127.0.0.1:8766/](http://127.0.0.1:8766/)，纯背景地址为 [garden-background.html](http://127.0.0.1:8766/garden-background.html)。需要通过 HTTP 运行模块。

正式集成可保留 `#garden-stage`、`#garden-poster`、`#garden-canvas`，连同 `neural-garden.js`、`wind-particles.js`、本地 Three.js 与所需素材，在其上放业务界面。渲染器监听窗口指针，不要求 Canvas 捕获鼠标。UI 通过 `garden-motion` 事件传入 `{paused}`，通过 `garden-gust` 触发一次阵风；渲染器通过 `garden-state` 返回 `{paused,reduced,available}`。

这是本地实现，尚未发布到 MIIOO 生产网站。

## 性能与兼容边界

植物通过着色器变形，不逐帧重建几何；连续植被网格取消了独立裁片与孔洞遮罩，空中叶瓣仅绘制活跃实例。像素比上限为 1.5：持续掉帧时降低分辨率；稳定慢帧先试探较低分辨率，仅在测得改善时保留，恢复使用较长观察窗口。后台标签页及完全滚出视口的花园停止动画。减少动态效果偏好下默认静止，用户仍可主动播放。

实现保留了 WebGL 不可用或初始化失败时的静态回退、上下文丢失处理及恢复入口。本轮已观察到帧数连续增长至 1,500、动画时间 25.03 秒和空中 11 片叶瓣，并录制约 8 秒动态演示、触发两次阵风。本轮已通过 WebGL 不可用回退、减少动态效果默认暂停、暂停／继续及图形上下文丢失恢复检查，具体结果与测试边界见 [动画验收记录](review/WIND-VERIFICATION.md)。此前首页布局与旧渲染器检查保留在 [历史验收记录](review/VERIFICATION.md)。

2026-10-29 的桌面优化对照和实测设备信息见 [性能验证记录](review/PERFORMANCE-VERIFICATION.md)。浏览器帧间隔不是 GPU 单独耗时；未完成普通办公集显、跨浏览器、长时间内存趋势或多设备性能验收，不能保证所有设备 60 FPS。

## 历史说明

HANDOFF.md、README.md 和旧截图保留先前三维花园的探索过程；其中“当前版本”仅指各自记录时点。新版状态以本文件、当前源码和后续验收记录为准。旧模型导出脚本只用于旧版，不是新版预览的前置条件。
