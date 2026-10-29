# 从这里开始

这是 MIIOO 首页重设计的本地可运行版本：保留 MIIOO 品牌，参考 Neuralyn 的黑色留白、摄影花园、居中标题和半透明工作台。新版已替换默认入口，旧版继续保留。

## 启动

需要 Python 3，在此目录执行：

```sh
python3 -m http.server 8766 --bind 127.0.0.1 --directory outputs/interactive-garden
```

然后打开：

- [新版首页](http://127.0.0.1:8766/)
- [纯交互背景](http://127.0.0.1:8766/garden-background.html)
- [旧版花园](http://127.0.0.1:8766/garden-original.html)

若端口已占用，可改用 8767，并替换地址中的端口。通过 HTTP 服务运行，不要直接双击 HTML。预览不需要 npm、API key 或在线字体服务。

## 体验与交接

移动鼠标扫过花草产生局部阵风：花茎弯曲、花头回摆，独立叶片翻动，少量三维叶瓣随风飞舞。首页可暂停动画或进入沉浸花园，按 Esc 返回；纯背景页也有“暂停动画／播放动画”和“吹一阵风”按钮。若系统开启减少动态效果，可主动点击播放。工作台内容是可切换的演示，创作入口打开 MIIOO 真实网站。

新版实现、素材和验证边界见 [REDESIGN.md](outputs/interactive-garden/REDESIGN.md)。设计约定见 [DESIGN.md](DESIGN.md)，产品事实见 [PRODUCT.md](PRODUCT.md)。HANDOFF.md 与 README.md 保留历史记录，不代表新版当前状态。

当前动画使用随项目附带的 Three.js r170。摄影植物共享一张连续细分网格，以 2.5D 方式弯曲和局部摆动，避免强阵风时裁片分离；飞舞叶瓣是真正的三维网格，苔藓地面保持独立静止。动态录像见 [garden-motion.mp4](outputs/interactive-garden/review/garden-motion.mp4)，历史动画检查见 [WIND-VERIFICATION.md](outputs/interactive-garden/review/WIND-VERIFICATION.md)，最新接缝修复见 [CONTINUITY-VERIFICATION.md](outputs/interactive-garden/review/CONTINUITY-VERIFICATION.md)。

本交付是本地原型，尚未发布到生产网站。场景不是原站分层源文件或全场景扫描三维重建，不宣称像素完全一致。
