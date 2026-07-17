/**
 * @file StoryboardToast.jsx
 * @structure-index
 *
 * ─── 组件职责 ─────────────────────────────────────────────────────
 *   分镜页 Toast 的 Portal 视觉展示
 *
 * ─── 依赖边界 ─────────────────────────────────────────────────────
 *   只接收 toast 数据；提示触发、定时器和业务错误处理仍由 StoryboardPage 持有。
 *
 * ─── 更新记录 ─────────────────────────────────────────────────────
 *   2026-07-17  从 StoryboardPage 抽离 Toast 展示，保持位置和视觉状态不变
 */
import { createPortal } from 'react-dom';
import HomeToast from '../home/HomeToast';

export default function StoryboardToast({ toast }) {
  if (!toast) return null;
  return createPortal(<HomeToast toast={toast} />, document.body);
}
