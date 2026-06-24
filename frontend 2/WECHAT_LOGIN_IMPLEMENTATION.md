# 微信二维码登录前端实现总结

## 实现完成日期
2026-06-23

## 核心改动概览

本次实现补齐了微信扫码登录的完整闭环，将其从"静态二维码图片"升级为"真实微信官方授权链接 + 异步状态机"。

### 改动文件清单

| 文件路径 | 改动类型 | 职责 |
|---------|--------|------|
| `src/api/auth.js` | 新增 + 改动 | API 契约适配层，字段映射与新接口 |
| `src/utils/serialPolling.js` | 新增 | 串行轮询工具，支持错误退避与页面隐藏暂停 |
| `src/components/WechatOfficialQr.jsx` | 新增 | 官方微信二维码组件，动态加载脚本并渲染 |
| `src/components/LoginModal.jsx` | 改动 | 集成官方二维码、完整轮询、postMessage 通知 |
| `src/pages/Home.jsx` | 改动 | 承接 URL 回调参数，完成后端确认 |

---

## 详细改动说明

### 1. API 层收口（src/api/auth.js）

#### 新增函数

**apiGetWechatQrCode()**
- 返回真实微信授权链接（而非静态二维码 URL）
- 字段映射：
  - `session_id` → `qrcode_id`
  - `qr_code_value` → `raw_qr_code_value`
  - `expires_in` → `expire_seconds`
- 支持 mock 模式测试

**apiCompleteWechatCallback({ code, state })**
- 新增接口，对应首页根路径回调完成
- 传递微信授权后的 `code` 和 `state` 给后端
- 后端返回登录结果或绑定状态

**apiConfirmWechatLogin({ session_id, phone, sms_code })**
- 新增接口，对应"已扫码、未绑定手机号"场景
- 继续手机号绑定流程并完成登录

#### 保留的向后兼容

- `apiPollWechatQrCodeStatus(qrcodeId)` - 保留，继续支持状态轮询
- `apiBindMobileWithBindToken()` - 改为调用新的 `apiConfirmWechatLogin()`
- `bindPhone()` - 保留，改为调用新接口

### 2. 串行轮询工具（src/utils/serialPolling.js）

新增 `createSerialPolling()` 工具函数，提供：
- **串行执行**：保证轮询任务不重叠
- **错误退避**：连续错误时递增延长间隔（可配置倍数）
- **连续错误上限**：超过阈值自动停止
- **页面隐藏暂停**：后台标签页时暂停轮询，恢复时自动续轮
- **灵活控制**：`start()`, `stop()`, `pause()`, `resume()`

使用场景：
```javascript
const polling = createSerialPolling({
  task: async () => await apiPollWechatQrCodeStatus(qrcodeId),
  interval: 2000,
  onResult: (data) => {
    if (data.status === 'confirmed') {
      // 处理登录成功
    }
  },
  onError: (error) => console.error('轮询出错:', error),
  maxConsecutiveErrors: 3,
  pauseWhenHidden: true,
});
polling.start();
```

### 3. 官方二维码组件（src/components/WechatOfficialQr.jsx）

新增 React 组件，负责：
1. **动态加载微信官方脚本**（https://res.wx.qq.com/connect/zh_CN/htmledition/js/wxLogin.js）
2. **从授权链接解析参数**（appid, redirect_uri, state, scope）
3. **通过 WxLogin 渲染真实二维码**（而非图片）
4. **支持视觉微调**（offsetY 参数可调整位置）

Props:
- `authUrl` - 微信授权链接
- `onReady` - 加载成功回调
- `onError` - 加载失败回调
- `offsetY` - 纵向位置微调（默认 -8px）

### 4. 登录弹窗改动（src/components/LoginModal.jsx）

#### WechatView 组件

- **引入 WechatOfficialQr**：替代旧的静态图片方案
- **完整轮询逻辑**：使用 `createSerialPolling()` 统一管理
- **状态流转**：
  - `loading` → `ready` → `scanned` → `confirmed` / `need_bind_mobile` / `expired`
  - 支持错误重试和过期刷新
- **postMessage 通知**：监听来自 iframe 父窗口的微信回调完成消息

#### BindPhoneView 组件

- 更新绑定接口调用为 `apiConfirmWechatLogin()`
- 参数映射：`{ session_id, phone, sms_code }`

#### 新增 useEffect

```javascript
useEffect(() => {
  const handleWechatCallbackMessage = (event) => {
    if (event.data?.type === 'wechat-callback-complete') {
      const result = event.data?.payload;
      if (result?.status === 'confirmed') {
        onSuccess?.(); // 登录成功
      } else if (result?.status === 'need_bind_mobile') {
        setBindToken(result?.bind_token);
        setStep('bind'); // 进入绑定流程
      }
    }
  };
  window.addEventListener('message', handleWechatCallbackMessage);
  return () => window.removeEventListener('message', handleWechatCallbackMessage);
}, [onSuccess]);
```

### 5. 首页回调承接（src/pages/Home.jsx）

#### 新增初始化效果

在组件加载时自动检测 URL 参数：

```javascript
useEffect(() => {
  const handleWechatCallback = async () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (!code || !state) return;

    try {
      // 1. 向后端发送回调完成请求
      const result = await apiCompleteWechatCallback({ code, state });
      
      // 2. 若是 iframe 内，通知父窗口
      if (window.self !== window.top) {
        window.parent.postMessage({
          type: 'wechat-callback-complete',
          payload: result,
        }, '*');
      }

      // 3. 清理 URL（避免刷新重复执行）
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err) {
      console.error('微信回调处理失败:', err);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  handleWechatCallback();
}, []);
```

---

## 完整流程梳理

### 非 iframe 场景（常规桌面浏览）

1. 用户点击"微信扫码"标签
2. 弹窗调用 `apiGetWechatQrCode()` 获取授权链接
3. WechatOfficialQr 组件动态加载微信脚本，渲染真实二维码
4. 用户用手机扫码，微信回跳到 `https://miiooai.com/?code=...&state=...`
5. 首页 Home.jsx 拦截 URL 参数，调用 `apiCompleteWechatCallback({ code, state })`
6. 后端返回登录结果或绑定状态
7. **（关键）** 首页通过 `window.parent.postMessage()` 通知 iframe 内的登录弹窗
8. 弹窗收到消息后更新状态或进入绑定流程

### iframe 场景（内嵌登录弹窗）

1-3. 同上
4. 用户扫码后，微信在 iframe 内回跳（受 `self_redirect: true` 控制）
5. iframe 内的首页同样拦截参数，调用后端
6. iframe 主动发送 `postMessage` 给父窗口
7. 登录弹窗在父窗口中接收消息，完成登录/绑定

---

## 测试清单

### 功能验收

- [ ] 二维码能正常拉起，确实是微信官方生成的（非静态占位图）
- [ ] 手机扫码后，状态正确推进：`pending` → `scanned` → `confirmed`
- [ ] 已绑定手机号的用户直接登录成功
- [ ] 未绑定手机号的用户能继续绑定并完成登录
- [ ] 二维码过期后，点击可刷新
- [ ] 轮询错误时有重试机制（不无限重试）
- [ ] 页面隐藏时轮询暂停，恢复时继续轮询
- [ ] URL 回调参数处理后被清理，刷新不会重复执行

### 视觉验收

- [ ] 二维码在弹窗中位置合适（offsetY = -8px 的微调）
- [ ] 加载状态、已扫码、过期等提示文案清晰
- [ ] 整体 UI 与现有设计风格一致

### 兼容性验收

- [ ] 桌面浏览器正常流程
- [ ] iframe 嵌入场景正常流程
- [ ] Mock 模式下数据流正常（用于开发测试）

---

## 后续配置清单

### 后端需确保

1. 微信开放平台回调地址配置为根路径 `/`（现已实现）
2. 以下接口已实现并返回正确字段：
   - `GET /api/auth/wechat/qrcode` → 返回 `qrcode_id`, `raw_qr_code_value`, `expire_seconds`
   - `GET /api/auth/wechat/qrcode/status?qrcode_id=...` → 返回 `status`, `bind_token` 等
   - `POST /api/auth/wechat/callback` → 接收 `{ code, state }`，返回登录结果或绑定状态
   - `POST /api/auth/wechat/confirm-login` → 接收 `{ session_id, phone, sms_code }`

### 前端环境变量

确保 `.env` 中配置了 `VITE_API_BASE_URL`，指向后端 API 地址。

### 微信官方脚本

- 脚本从 `https://res.wx.qq.com/connect/zh_CN/htmledition/js/wxLogin.js` 动态加载
- 无需预加载，首次使用时自动获取

---

## 设计原则回顾

### 三个收口点

1. **契约收口** - `src/api/auth.js`
   - 统一字段映射（session_id → qrcode_id 等）
   - 隔离前端 UI 与后端字段变化

2. **状态收口** - `LoginModal.jsx` + `serialPolling.js`
   - 统一管理扫码状态机（pending → scanned → confirmed 等）
   - 统一处理轮询逻辑（间隔、错误、暂停、恢复）

3. **回调收口** - `Home.jsx`
   - 统一承接根路径 URL 参数
   - 统一处理后端确认与前端状态同步

### 优势

- 后续接口字段变化、轮询策略调整等，**改动范围最小化**
- 新项目要复刻此能力，直接套用这三个收口点的框架即可
- 组件逻辑清晰，易于测试与维护

---

## 常见问题

### Q: 为什么要用 postMessage 而不是全局事件？
A: postMessage 更安全，支持跨域场景（iframe）。全局事件容易被中间件干扰。

### Q: 轮询间隔为什么默认 2000ms？
A: 平衡用户体验（不能太快，浪费请求）和响应速度。可根据后端能力调整。

### Q: 二维码过期后能自动刷新吗？
A: 目前需要用户手动点击"点击刷新"。若后端支持，可改为自动刷新。

### Q: 支持多个登录弹窗同时打开吗？
A: 不支持。多个弹窗会共享同一个轮询实例，导致状态混乱。建议同时只打开一个。

---

## 版本日志

### v1.0.0 (2026-06-23)
- 初始实现：完整微信扫码登录闭环
- 支持异步状态机、错误退避、页面隐藏暂停
- 支持手机号绑定分支
- API 层字段映射与后端隔离
