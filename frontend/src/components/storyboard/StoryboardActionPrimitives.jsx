/**
 * @file StoryboardActionPrimitives.jsx
 * @structure-index
 *
 * 分镜生成面板和页面工具区共用的轻量展示原子；不包含业务状态或 API。
 */



export function StoryboardIconPlus({ color = '#FFFFFF40' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 2V12M2 7H12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
