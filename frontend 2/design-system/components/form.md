# Form 表单布局规范

> 本文档描述 label 与输入框的组合规则，以及表单字段的排列规范。
> 组件本身的详细规范参考 `design-system/components/input.md`。
> 字体：`AlibabaPuHuiTi 2_55 Regular` / `Alibaba PuHuiTi 2.0` / `system-ui` / `sans-serif`。

---

## 一、Label 规范

| 属性 | 值 |
|---|---|
| 字号 | `font-size-14` |
| 字重 | `font-weight-regular` |
| 颜色 | `text-text-secondary` |
| 与输入框间距 | `gap-[4px]`（4px） |

**选填字段处理：** 不使用必填标识，选填情况在输入框的 placeholder 中注明，格式为"提示文字（选填）"。

---

## 二、字段结构

Label 与输入框为**上下结构**，label 在上，输入框在下。

```
Label 文字
[输入框]
```

字段内部使用 `flex flex-col gap-[4px]` 布局（gap-[4px] = 4px）。

---

## 三、字段间距

多个字段纵向排列时，字段与字段之间间距为 `gap-[16px]`（16px）。

---

## 四、代码示例

### 4.1 基础表单字段

```jsx
const FONT = "'AlibabaPuHuiTi 2_55 Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function FormField({ label, placeholder, value, disabled, state }) {
  return (
    <div className="flex flex-col gap-[4px]">
      <span
        className="text-text-secondary text-font-size-14 font-font-weight-regular"
        style={{ fontFamily: FONT }}
      >
        {label}
      </span>
      <Input
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        state={state}
      />
    </div>
  );
}
```

> `Input` 组件参考 `design-system/components/input.md`。

---

### 4.2 多字段表单

```jsx
export default function FormDemo() {
  return (
    <div className="flex flex-col gap-[16px]">
      <FormField
        label="项目名称"
        placeholder="请输入项目名称"
      />
      <FormField
        label="项目描述"
        placeholder="简要描述项目内容（选填）"
      />
      <FormField
        label="导演"
        placeholder="请输入导演姓名"
      />
    </div>
  );
}
```

---

## 五、使用禁忌

- 不使用左右结构，label 始终在输入框上方
- 不在 label 上添加必填星号，选填信息在 placeholder 中说明
- 字段间距固定为 `gap-[16px]`（16px），不可随意调整
