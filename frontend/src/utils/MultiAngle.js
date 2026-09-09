export const ANGLE_PRESETS = [
  ['左上', 315, 30], ['俯视', 0, 60], ['右上', 45, 30],
  ['左视', 270, 0], ['正视', 0, 0], ['右视', 90, 0],
  ['左下', 315, -30], ['仰视', 0, -30], ['右下', 45, -30],
];

export function normalizeAngles(horizontal = 0, vertical = 0) {
  if (!Number.isFinite(horizontal) || !Number.isFinite(vertical)) throw new Error('角度必须是有效数字');
  return { horizontal: ((horizontal % 360) + 360) % 360, vertical: Math.max(-30, Math.min(60, vertical)) };
}

export function buildMultiAnglePrompt(horizontal, vertical) {
  const angles = normalizeAngles(horizontal, vertical);
  const h = Number(angles.horizontal.toFixed(1));
  const v = Number(angles.vertical.toFixed(1));
  const displacement = h > 180 ? h - 360 : h;
  const horizontalText = h === 0 ? '保持原图的水平方位' : `相机向${displacement < 0 ? '左' : '右'}水平绕拍${Math.abs(displacement)}度${h > 180 ? `，水平${h}度等价于向左${360 - h}度，不表示必须向右移动${h}度` : ''}`;
  const verticalText = v === 0 ? '保持原图的相对高度，不额外俯仰' : `同时向${v > 0 ? '上' : '下'}绕拍${Math.abs(v)}度，形成${v > 0 ? '从上方俯视' : '从下方仰视'}的观察视角`;
  const surfaces = v > 0 ? '更多上表面及自然的俯视透视' : v < 0 ? '合理可见的下表面及自然的仰视透视' : '与原图相同的相对观察高度';
  return `基于输入图片进行相机视角编辑，不重新设计画面内容。

以原图主要主体的中心为观察目标；如果没有明确的单一主体，则以原图画面中心附近的主要场景区域为观察目标。

角度定义：原图相机位置为水平0度、垂直0度。以原图观看者为参照，水平向右为正，垂直向上为正。水平角度采用360度环绕表示，垂直角度范围为-30度至60度。

目标相机位置：水平${h}度，垂直${v}度。
其含义是：${horizontalText}；${verticalText}。

将这两个角度作为本次编辑的明确目标。相机始终朝向观察目标，不发生画面侧倾，焦距和相机到观察目标的距离尽量保持不变。

${h === 0 && v === 0 ? '本次保持原始机位，不强行制造侧面、俯视或仰视变化。' : `新视角应体现${h === 0 ? '' : h === 180 ? '背面与背向遮挡变化，以及' : '与水平绕拍方向对应的侧面、遮挡变化，以及'}${surfaces}，以及前景、主体和背景之间自然的透视与遮挡变化。`}不得仅通过裁切、平移、镜像或旋转原图模拟换视角。

保持主体自身的形态、朝向和姿态，保持场景中各元素的空间位置关系，保留材质、颜色和光照风格。合理补全新视角显露的区域，不添加无关内容。

只输出编辑后的图片。`;
}
