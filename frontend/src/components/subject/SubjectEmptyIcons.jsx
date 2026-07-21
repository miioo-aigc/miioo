/**
 * 主体卡片无图片时使用的空态图标。
 * 图标 SVG 路径统一在 SubjectTypeIcons.jsx 维护，此处直接引用。
 */
import { CharIcon, SceneIcon, PropIcon } from './SubjectTypeIcons';

const SubjectEmptyIcons = {
  char: <CharIcon />,
  scene: <SceneIcon />,
  prop: <PropIcon />,
};

export default SubjectEmptyIcons;
