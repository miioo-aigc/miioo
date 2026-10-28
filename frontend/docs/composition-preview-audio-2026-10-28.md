# 剪辑预览声音播放优化

日期：2026-10-28。依据后端交接 EDITOR-AUDIO-PREVIEW-001；用户选择缓冲期间画面和进度继续、恢复后纠偏。实现完成，Suzy 已于2026-10-28确认本轮全部验收通过。

## 实现与边界

- 复用 PreviewMediaClock、PreviewAudioLayer、PreviewCanvas；新增 PreviewAudioClock 纯函数，不变更页面布局与接口模型。
- 输入仍为媒体元素、片段窗口、轨道可听状态、播放状态和最新游标读取函数；片段字段使用 sourceUrl、offset、speed、start/end。无新增 API 返回字段或页面闭包依赖。
- 定位副作用仍由片段、播放状态和 seekEpoch 触发，不依赖逐帧 cursor。播放时定位阈值 0.3 秒、暂停时 0.05 秒。播放启动和冷加载由媒体事件驱动，逐帧循环不调用 play。
- 缓冲、定位、冷加载、媒体出错时墙钟继续，不暂停其他轨道。真实 playing 后才使用媒体时钟；waiting 后的 playing 对齐最新游标，让附加音轨也能恢复同步。
- 纯函数按不可用、回退、停顿、前跳、正常的顺序判断。常量与交接文档一致；协调器额外保留每秒最多一次异常纠偏，避免异常源持续重定位。
- 保留现有无 A1 时其他可听音轨或视频作为主时钟的能力。段边界由现有窗口上限约束；间隙暂停但保留 src。
- 已有的拖动动画帧合并、缩略图 metadata 预加载、GainNode 与 WeakMap 复用继续使用。seek/末尾重播/逐帧动作契约已增加状态测试；保留现有 resetPreview 主动复位动作。
- 错误媒体不再调用页面 pause，保持用户选择的继续播放行为；媒体错误对应轨道静音，不能视为媒体本身已修复。

## 自动化验证

- node --test scripts/preview-media-clock.test.mjs scripts/preview-audio-clock.test.mjs scripts/composition-preview-state.test.mjs scripts/composition-contract.test.mjs：37 项通过、零失败。
- 本次改动文件定向 ESLint、构建、架构检查与差异空白检查通过。构建仍有包体大于 500 kB 提示，架构仍有既有规模提示。
- 全仓 npm run lint 未通过：Home.jsx:276 变量声明前访问、Home.jsx:807 effect 同步设置状态，两处错误；CanvasNodeShell.jsx:47/52 和 PanelPromptInput.jsx:318 共三处依赖警告。这些文件本次未修改。

## 媒体端点探测

从既有 scripts/video-media-url.test.mjs 取真实视频样本，以 Range: bytes=0-1023 请求 www.chengxvblog.top 的 /media/origin/ 地址：返回 HTTP 206、Content-Range: bytes 0-1023/3721300、Content-Length: 1024，但没有 Accept-Ranges。说明该样本实际支持分段响应，尚未满足交接要求的完整响应头；应由后端补查/补齐 Accept-Ranges: bytes。

该结果不覆盖 /uploads、音频地址、开发静态服务或所有生产媒体。当前未获取实际剪辑项目音频 URL，音频分段响应仍待验证。未修改后端或部署配置。

## 用户手动验收（2026-10-28确认通过）

1. 至少五分钟的长音频连续播放三十秒，检查声音是否连续。
2. 播放中拖动，检查松手后恢复速度与定位准确性。
3. 暂停五秒再继续，确认从暂停位置出声。
4. 多音轨同时播放、调整各轨音量，检查是否互相打断。
5. 含视频切段，检查声音不重载、音画偏差小于 0.3 秒。
6. 多条三至五秒短音频拼接，检查边界断音和重复音节。
7. 播放到末尾后再播放，应从零开始且无双声。
8. 网络缓冲时进度继续；缓冲恢复后音频重新对齐，其他已正常播放轨道不被强制暂停。

未自动打开浏览器，未提交或推送。
