/**
 * @file SubjectGridViewport.jsx
 * @structure-index
 *
 * ─── 组件职责 ─────────────────────────────────────────────────────
 *   主体列表滚动视口和 SubjectGrid 的布局接线
 *
 * ─── 依赖边界 ─────────────────────────────────────────────────────
 *   只接收列表展示数据、分页 sentinel 和显式回调；不调用 API、不处理主体编辑写回或生成副作用。
 *
 * ─── 更新记录 ─────────────────────────────────────────────────────
 *   2026-07-17  从 SubjectPage 抽离主体列表滚动视口，保持分页与展示契约不变
 */
import SubjectGrid from './SubjectGrid';

export default function SubjectGridViewport({ subjectListRef, gridProps }) {
  return (
    <div
      ref={subjectListRef}
      className="flex-1 self-stretch overflow-auto min-h-0"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(160px, 10vw, 208px), 1fr))', gap: '16px', alignContent: 'flex-start', padding: '16px 2px 2px 2px' }}
    >
      <SubjectGrid {...gridProps} />
    </div>
  );
}
