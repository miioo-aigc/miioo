---
name: MIIOO Botanical Homepage
description: 黑色留白中的摄影花园与轻量创作界面
colors:
  background: "#000000"
  ink: "#f4f4f1"
  muted: "#b3b8b1"
  border: "rgba(218,231,215,.12)"
  focus: "#cfe8d0"
  action-ink: "#1e2723"
  action-mint: "#c7eae7"
  action-lilac: "#e8dced"
  action-peach: "#f6dcc5"
typography:
  display:
    fontFamily: "DM Sans, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "clamp(48px,4.65vw,76px)"
    fontWeight: 500
    lineHeight: 1.12
    letterSpacing: "-.04em"
  display-emphasis:
    fontFamily: "Instrument Serif, Georgia, serif"
    fontSize: "1.18em"
    fontWeight: 400
    lineHeight: 0.8
    letterSpacing: "-.035em"
  body:
    fontFamily: "DM Sans, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  table:
    fontFamily: "DM Sans, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  compact: "6px"
  workspace: "19px 19px 0 0"
  pill: "999px"
spacing:
  tight: "8px"
  compact: "16px"
  content: "24px"
  section: "48px"
components:
  button-primary:
    textColor: "{colors.action-ink}"
    rounded: "{rounded.pill}"
    padding: "11px 24px"
    height: "44px"
  workspace:
    textColor: "{colors.ink}"
    rounded: "{rounded.workspace}"
    width: "70%"
---

# Design System: MIIOO Botanical Homepage

## Overview

**Creative North Star: "黑色留白中的摄影花园"**

视觉方向由用户指定的 Neuralyn 参考与保留 MIIOO 品牌的确认锁定。大面积纯黑承托白色标题，植物与薄雾提供深度，界面保持克制；本文件记录已实现系统，不引入新的视觉方向。

**Key Characteristics:**

- 摄影感植物包围中央空间。
- 无衬线主标题与单个衬线斜体强调。
- 淡彩入口、低对比玻璃工作台。
- 可见的花茎弯曲、叶片翻动与少量叶瓣飞舞，并保留暂停控制。

## Colors

主色是黑与暖白，植物承担橄榄绿和金黄色，淡彩仅用于主入口。边框、次要文字与焦点色带轻微植物色调。前文颜色 token 是规范值，场景贴图保留自身的自然色彩。

## Typography

DM Sans 负责拉丁标题与界面；中文使用系统中文字体。Instrument Serif 只用于主标题中的斜体强调词。字体文件随项目自托管。

桌面标题随视口缩放，窄屏标题采用 44–62px 范围；表格正文为 11px、表头和状态为 10px，项目链接和场景按钮为 11px。演示面板保持紧凑，不能把这套演示密度直接复制到正式编辑器。

## Layout

桌面导航居于顶部，标题、说明和主入口在中央，工作台宽度为页面 70%，常规最大宽 990px，大屏最大宽 1120px。摄影背景按完整画幅底部对齐，中央留白容纳内容。

700px 以下改为可滚动页面，工作台隐藏次要列并允许中文换行，场景按钮在卡片后独立占位；背景聚焦左侧蒲公英，静态图片与 Canvas 使用相同定位。另有 1100px 与 1600px 布局调整，短桌面窗口采用更紧凑的纵向间距。

## Elevation & Depth

植物摄影与低浓度雾光构成主要深度。工作台以半透明暗色渐变、细边框及 5px 背景模糊区分界面与花园；阴影为 `0 22px 90px #0008`，不把玻璃效果扩散到所有元素。

## Shapes

主入口和场景控制采用胶囊形；导航入口使用紧凑圆角；工作台只在上方两角做较大的圆角。图标使用一致线宽的 SVG，避免文字字符代替图标。

## Components

- **主入口**：淡青、淡紫、浅杏色线性渐变，深色文字；悬停上移 2px，按下恢复，焦点有明确描边。
- **导航**：MIIOO 标识、小字号文字导航与右侧浅色入口。窄屏保留首页和关于入口。
- **工作台**：真实 DOM 的交互示例，侧栏可切换剧本、分镜与影像内容，支持方向键、Home、End。示例标签不能删除。
- **场景控制**：首页提供暂停/播放、沉浸/退出，沉浸时内容不可聚焦，Esc 返回并恢复焦点；纯背景页提供播放/暂停与“吹一阵风”。减少动态效果偏好下默认静止，两种入口均允许用户主动播放。
- **背景**：使用本地 Three.js r170。摄影植物共享一张连续细分网格，5 组风响应按位置平滑混合；6 个花头或叶片在同一网格内局部摆动，局部形变在区域边界及叶柄处平滑归零，避免独立裁片拉开接缝。根部与静态苔藓底图保持稳定；鼠标输入按帧聚合，局部阵风衰减回弹。触摸设备不触发悬停阵风。
- **飞舞叶瓣**：少量弯曲的三维叶片与花瓣使用 InstancedMesh，随风场移动、旋转并改变受光。主体仍是摄影网格组成的 2.5D 场景，不能描述为全场景扫描三维重建。飞舞对象的数量与幅度必须服从摄影构图、黑色留白及运行预算。

## Do's and Don'ts

- **Do** 保留大面积黑色留白和清晰的标题层级。
- **Do** 让静态回退与动态场景共享同一素材和构图。
- **Do** 让演示内容、真实站点入口与本地功能边界可辨认。
- **Don't** 用更多高精度三维几何替代摄影质感。
- **Don't** 增加未经证实的客户、指标或评价。
- **Don't** 宣称重建素材与参考原站像素完全一致。
