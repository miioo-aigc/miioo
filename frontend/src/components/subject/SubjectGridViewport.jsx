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
 *   2026-08-24  角色 Tab 图片列表上方新增可关闭的真人素材认证提示 banner
 */
import SubjectGrid from './SubjectGrid';
import SubjectCertificationBanner from './SubjectCertificationBanner';

export default function SubjectGridViewport({ subjectListRef, gridProps }) {
  const showCertificationBanner = gridProps?.activeTab === 'char' && gridProps?.showCertificationBanner;

  return (
    <div
      ref={subjectListRef}
      className="flex-1 self-stretch overflow-auto min-h-0"
      style={{ padding: '16px 2px 2px 2px' }}
    >
      {showCertificationBanner && <SubjectCertificationBanner onClose={gridProps.onCloseCertificationBanner} />}
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(160px, 10vw, 208px), 1fr))', gap: '16px', alignContent: 'flex-start', marginTop: showCertificationBanner ? '16px' : undefined }}
      >
        <SubjectGrid {...gridProps} />
      </div>
    </div>
  );
}
