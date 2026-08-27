# Seedance 文件夹挡板毛玻璃效果实现经验

## 背景

Seedance 素材库文件夹卡片的前方挡板由 SVG 路径绘制，并且挡板会在悬停时通过路径插值改变形状。需求是在挡板内部增加背景毛玻璃效果，同时满足以下条件：

- 毛玻璃边缘必须与当前 SVG 挡板曲线完全重合；
- 不能出现矩形外溢、左右宽度不一致或边缘错位；
- 模糊值固定为 `6px`；
- 必须是真实的背景模糊，而不是把前方素材复制后再进行图片模糊。

## 最终方案

实现位于 `src/components/assets/SeedanceFolderCard.jsx` 的 `FrontGlass`。

1. 前方挡板的填充路径由 `FRONT_FILL_DEFAULT`、`FRONT_FILL_HOVER` 和 `interpolatePath` 共同生成。
2. 毛玻璃层使用与挡板相同尺寸和定位的 HTML `div`，而不是 SVG `rect`。
3. 将当前动态 `fillPath` 写入一个内联 SVG，并编码为 `data:image/svg+xml`，作为 `mask-image` 和 `-webkit-mask-image`。
4. 毛玻璃层使用 `mask-size: 100% 100%` 和 `mask-repeat: no-repeat`，让矩形背景层按挡板原始曲线裁剪。
5. 使用 `backdrop-filter: blur(6px)` 和 `-webkit-backdrop-filter: blur(6px)` 实现背景模糊。
6. 图层顺序保持为：挡板填充、HTML 毛玻璃层、挡板描边、文字和操作按钮。描边单独保留在最上层，保证曲线边界清晰。

## 关键代码原则

```jsx
const fillPath = interpolatePath(FRONT_FILL_DEFAULT, FRONT_FILL_HOVER, progress);
const pathMask = createPathMask(fillPath);

<div
  style={{
    background: 'rgba(35, 35, 35, 0.14)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    maskImage: pathMask,
    WebkitMaskImage: pathMask,
    maskSize: '100% 100%',
    WebkitMaskSize: '100% 100%',
  }}
/>
```

最重要的是：毛玻璃层和挡板必须共用同一个动态 `fillPath`，不能单独重新估算梯形宽度、左右偏移或曲线参数。

## 方案取舍与排查结论

### 不推荐：直接在 SVG 图形元素上使用 `backdrop-filter`

虽然 SVG `clipPath` 可以准确裁剪路径，但浏览器对 SVG `rect`、`g` 等图形元素上的 `backdrop-filter` 支持和表现不稳定，可能出现裁剪失效、仍显示矩形，或模糊没有真正作用于后方 DOM 内容。

### 不推荐：使用 `feGaussianBlur` 模糊复制的素材图

这种方式得到的是前方素材副本的图像模糊，不是挡板对后方内容的背景模糊。视觉上容易出现亮度、颜色和层次不自然的问题，也无法等价替代毛玻璃。

### 不推荐：使用固定 `clip-path: polygon(...)` 近似挡板

固定多边形只能近似当前形状，无法覆盖挡板真实的曲线边缘，也无法在悬停动画过程中同步路径变化，容易造成两侧宽度和曲线不匹配。

## 后续维护注意事项

- 修改 `FRONT_FILL_DEFAULT` 或 `FRONT_FILL_HOVER` 时，必须继续让 `FrontFolder` 和 `FrontGlass` 使用同一套填充路径来源。
- 不要把毛玻璃蒙版改成独立的固定梯形、多边形或另一套 SVG 路径。
- `backdrop-filter` 的模糊值当前约定为 `6px`，如需调整必须进行实际截图验证。
- `FrontGlass` 使用 `pointer-events-none`，避免遮挡文件夹卡片点击、悬停和操作按钮事件。
- 动态路径通过 `data:image/svg+xml` 生成蒙版时，需要保留 `preserveAspectRatio="none"`，确保蒙版随卡片尺寸拉伸并与挡板 SVG 的 `viewBox` 对齐。

## 验证结果

- 用户已实际验证毛玻璃视觉效果正常；
- 用户已确认毛玻璃与当前 SVG 挡板曲线边缘重合；
- `blur` 值为 `6px`；
- 定向 ESLint、`npm run build`、`npm run check:architecture` 和 `git diff --check` 均通过。

## 同日补充：中层图片悬停动效

文件夹视觉优化随后增加了中层预览图片的悬停动效，动效与挡板/毛玻璃层相互独立：

- 单图默认通过独立外层容器保持水平居中，悬停或键盘聚焦时垂直上移 `20px`。
- 双图悬停或键盘聚焦时，两张图片共同上移 `16px`；数组第一张向右位移 `4px` 并顺时针旋转 `3°`，数组第二张向左位移 `4px` 并逆时针旋转 `3°`。
- 数组第一张图片默认透明度为 `40%`，悬停或聚焦时在 `300ms` 内过渡到 `100%`。
- 位移和旋转使用 `300ms cubic-bezier(0.34, 1.56, 0.64, 1)`，保留轻微弹性效果；透明度使用 `300ms ease`。
- `FrontFolder`、`FrontGlass`、动态路径插值和 `blur(6px)` 未因本次图片动效调整而改变。
