# 微信登录实现 - 快速改动总结

## 📋 文件改动列表

### 新建文件
```
src/utils/serialPolling.js              （串行轮询工具）
src/components/WechatOfficialQr.jsx     （官方微信二维码组件）
```

### 修改文件
```
src/api/auth.js                         （新增 3 个 API 函数）
src/components/LoginModal.jsx           （集成官方二维码 + 轮询 + postMessage）
src/pages/Home.jsx                      （承接 URL 回调参数）
```

---

## 🔑 核心改动要点

### 1️⃣ API 层（auth.js）

**新增函数：**
- `apiGetWechatQrCode()` → 返回微信授权链接（而非图片 URL）
- `apiCompleteWechatCallback({ code, state })` → 首页回调完成
- `apiConfirmWechatLogin({ session_id, phone, sms_code })` → 绑定手机号并登录

**字段映射：**
```
后端                    前端
session_id      →       qrcode_id
qr_code_value   →       raw_qr_code_value
expires_in      →       expire_seconds
```

---

### 2️⃣ 轮询工具（serialPolling.js）

**提供功能：**
- ✅ 串行执行（无重叠）
- ✅ 错误退避（递增延长间隔）
- ✅ 连续错误上限（自动停止）
- ✅ 页面隐藏暂停（后台标签页）
- ✅ 灵活控制（start/stop/pause/resume）

**基本用法：**
```javascript
const polling = createSerialPolling({
  task: async () => await apiPollWechatQrCodeStatus(qrcodeId),
  interval: 2000,
  onResult: (data) => { /* 处理结果 */ },
  onError: (err) => { /* 处理错误 */ },
  pauseWhenHidden: true,
});
polling.start();
```

---

### 3️⃣ 二维码组件（WechatOfficialQr.jsx）

**核心职责：**
1. 动态加载微信官方脚本（https://res.wx.qq.com/connect/zh_CN/htmledition/js/wxLogin.js）
2. 从授权链接解析 appid, redirect_uri, state, scope
3. 通过 WxLogin 渲染真实二维码（非图片）
4. 支持位置微调（offsetY）

**使用方式：**
```jsx
<WechatOfficialQr
  authUrl={authUrl}
  onReady={() => {}}
  onError={(err) => {}}
  offsetY={-8}
/>
```

---

### 4️⃣ 登录弹窗（LoginModal.jsx）

**WechatView 变化：**
- ❌ 旧：显示静态 QR 图片 + 简单定时器轮询
- ✅ 新：渲染官方二维码 + 串行轮询 + postMessage 通知

**状态流转：**
```
loading → ready → scanned → confirmed ✓
                         ├→ need_bind_mobile (进入手机号绑定)
                         └→ expired (刷新)
```

**新增 postMessage 监听：**
```javascript
useEffect(() => {
  const handleMessage = (event) => {
    if (event.data?.type === 'wechat-callback-complete') {
      const result = event.data.payload;
      if (result?.status === 'confirmed') {
        onSuccess?.();
      } else if (result?.status === 'need_bind_mobile') {
        setStep('bind');
      }
    }
  };
  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}, []);
```

**BindPhoneView 变化：**
- 调用接口从 `apiBindMobileWithBindToken()` → `apiConfirmWechatLogin()`

---

### 5️⃣ 首页（Home.jsx）

**新增初始化效果：**

在 `Home` 组件挂载时自动检测 URL 参数 `?code=&state=`

```javascript
useEffect(() => {
  const handleWechatCallback = async () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (!code || !state) return; // 无参数，继续正常流程

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

## 🔄 完整流程（非 iframe）

```
用户点击"微信扫码"
    ↓
弹窗调用 apiGetWechatQrCode()
    ↓
WechatOfficialQr 动态加载脚本、渲染二维码
    ↓
用户手机扫码
    ↓
微信重定向到：https://miiooai.com/?code=...&state=...
    ↓
Home.jsx 拦截 URL 参数
    ↓
Home 调用 apiCompleteWechatCallback({ code, state })
    ↓
后端返回登录结果
    ↓
Home 通过 postMessage 通知弹窗
    ↓
弹窗接收消息，更新状态 / 进入绑定流程
    ↓
完成登录 ✓
```

---

## ✅ 验证编译

```bash
npm run build
# ✓ 452 modules transformed.
# ✓ built in 259ms
```

代码已通过编译，无语法错误。

---

## 📝 后端对接清单

后端需确保以下接口已实现：

| 接口 | 方法 | 功能 |
|------|------|------|
| `/api/auth/wechat/qrcode` | GET | 生成二维码会话，返回微信授权链接 |
| `/api/auth/wechat/qrcode/status?qrcode_id=...` | GET | 查询扫码状态 |
| `/api/auth/wechat/callback` | POST | 接收回调完成（code + state） |
| `/api/auth/wechat/confirm-login` | POST | 绑定手机号并完成登录 |

---

## 🎯 核心设计三原则

### 1. 契约收口（API 层）
- 所有后端字段映射在 `src/api/auth.js` 中统一处理
- 组件只消费前端字段名，隔离后端变化

### 2. 状态收口（LoginModal + serialPolling）
- 二维码状态机统一管理
- 轮询逻辑统一封装

### 3. 回调收口（Home.jsx）
- 所有 URL 回调参数在首页统一承接
- 后端确认与前端状态同步的枢纽

**好处**：后续改动范围最小化，易于维护和复用。

