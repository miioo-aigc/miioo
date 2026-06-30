# Modal 弹窗组件

> 参考 `design-system/tokens.md` 获取所有 token 的完整定义和色值。
> 表单内容区参考 `design-system/components/form.md`。
> 按钮规范参考 `design-system/components/button.md`。
> 字体：`AlibabaPuHuiTi 2_55 Regular` / `Alibaba PuHuiTi 2.0` / `system-ui` / `sans-serif`。

---

## 一、组件概述

Modal 弹窗由三部分组成：**遮罩层 Overlay** + **弹窗容器 Container**（Header + Body + Footer）。

---

## 二、尺寸规范

| 属性 | 大弹窗 | 小弹窗 |
|---|---|---|
| 宽度 | 固定 800px（`w-[800px]`） | 固定 400px（`w-[400px]`） |
| 最大高度 | 600px（`max-h-[600px]`） | 600px（`max-h-[600px]`） |
| 最小高度 | 240px（`min-h-[240px]`） | 240px（`min-h-[240px]`） |
| 圆角 | `rounded-large`（16px） | `rounded-large`（16px） |

---

## 三、结构规范

### 遮罩层 Overlay
- 背景色：`bg-surface-overlay`（black-50 → rgba(0,0,0,0.50)）
- 背景模糊：`backdrop-blur-[20px]`
- 固定全屏覆盖，居中显示弹窗容器

### Header
- 背景色：`bg-surface-modal`
- 高度：自适应，内边距 `py-[16px] px-6`
- 圆角：上两角 `rounded-t-large`
- 标题：`font-size-16` + `font-weight-medium` + `text-text-primary`
- 右侧关闭图标：16x16 SVG，颜色白色

### Body
- 背景色：`bg-surface-modal`
- 内边距：`py-[8px] px-6`
- 内容区字段间距遵循 `form.md` 规范

### Footer
- 背景色：`bg-surface-modal`
- 高度：自适应，内边距 `py-[16px] px-6`
- 圆角：下两角 `rounded-b-large`
- 按钮靠右对齐，间距 `gap-[16px]`
- 左侧为 Secondary 按钮（取消/保存），右侧为 Primary 按钮（确认）

---

## 四、代码示例

### 4.1 完整弹窗组件

```jsx
const FONT = "'AlibabaPuHuiTi 2_55 Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

/* 关闭图标 */
function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
      xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M2.667 2.667L13.333 13.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.667 13.333L13.333 2.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* 弹窗容器 */
function Modal({ title, children, onClose, onCancel, onConfirm, cancelLabel = "取消", confirmLabel = "确认", size = "small" }) {
  const widthClass = size === "large" ? "w-[800px]" : "w-[400px]";

  return (
    /* 遮罩层 */
    <div
      className="fixed inset-0 flex items-center justify-center bg-surface-overlay backdrop-blur-[20px] z-50"
    >
      {/* 弹窗容器 */}
      <div
        className={`${widthClass} min-h-[240px] max-h-[600px] flex flex-col rounded-large bg-surface-modal overflow-hidden`}
      >
        {/* Header */}
        <div className="flex items-center gap-[16px] justify-between py-[16px] px-6 rounded-t-large bg-surface-modal">
          <span
            className="flex-1 text-text-primary text-font-size-16 font-font-weight-medium"
            style={{ fontFamily: FONT }}
          >
            {title}
          </span>
          <button onClick={onClose} className="cursor-pointer">
            <CloseIcon />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-[16px] py-[8px] px-6 bg-surface-modal overflow-y-auto flex-1">
          {children}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-[16px] py-[16px] px-6 rounded-b-large bg-surface-modal">
          {/* Secondary 按钮 */}
          <button
            onClick={onCancel}
            className="
              flex items-center h-9 shrink-0 rounded-medium px-[16px] gap-[4px]
              bg-btn-primary-bg-normal
              hover:bg-btn-primary-bg-hover
              active:bg-btn-primary-bg-active
              border border-btn-primary-border
              [outline:1px_solid_var(--color-stroke-outline)] outline-offset-0
              [box-shadow:var(--color-shadow)_3px_3px_8px]
              cursor-pointer
            "
          >
            <span
              className="text-btn-primary-text text-font-size-14 font-font-weight-regular"
              style={{ fontFamily: FONT }}
            >
              {cancelLabel}
            </span>
          </button>

          {/* Primary 按钮（双层渐变border结构） */}
          <button
            onClick={onConfirm}
            className="
              flex flex-col h-9 shrink-0 rounded-medium
              bg-btn-primary-bg-normal
              [outline:1px_solid_var(--color-stroke-outline)] outline-offset-0
              [box-shadow:var(--color-shadow)_3px_3px_8px]
              p-px cursor-pointer
            "
            style={{
              backgroundImage:
                "linear-gradient(148.76deg, #ABFFFF4D 3.64%, #2DC3E100 42.81%), linear-gradient(#FFFFFF14)",
            }}
          >
            <div
              className="
                flex items-center grow shrink rounded-[7px] px-[16px] gap-[4px]
                bg-btn-primary-bg-normal
                hover:bg-btn-primary-bg-hover
                active:bg-btn-primary-bg-active
              "
            >
              <span
                className="text-text-primary text-font-size-14 font-font-weight-regular"
                style={{ fontFamily: FONT }}
              >
                {confirmLabel}
              </span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

### 4.2 使用示例 — 小弹窗含表单

```jsx
import { FormField } from "./form";

export default function ModalDemo() {
  return (
    <Modal
      title="新建项目"
      size="small"
      cancelLabel="取消"
      confirmLabel="确认"
      onClose={() => {}}
      onCancel={() => {}}
      onConfirm={() => {}}
    >
      <FormField label="项目名称" placeholder="请输入项目名称" />
      <FormField label="项目描述" placeholder="简要描述项目内容（选填）" />
      <FormField label="导演" placeholder="请输入导演姓名" />
    </Modal>
  );
}
```

---

## 五、使用禁忌

- 弹窗必须配合遮罩层使用，不可裸露出现在页面上
- 同一时间只能显示一个弹窗，不可叠加
- Footer 按钮顺序固定：左侧次要操作，右侧主要操作
- Body 内容超出最大高度时，内容区滚动，Header 和 Footer 固定不动
- 关闭弹窗的方式：点击关闭图标、点击取消按钮、点击遮罩层三种，行为保持一致
