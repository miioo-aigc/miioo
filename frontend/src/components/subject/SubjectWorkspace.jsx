/**
 * @file SubjectWorkspace.jsx
 * @structure-index
 *
 * ─── 组件职责 ─────────────────────────────────────────────────────
 *   主体页工作区外框、顶部工具栏、标签和主体网格的组合布局
 *
 * ─── 依赖边界 ─────────────────────────────────────────────────────
 *   只负责布局和稳定展示组合；编辑面板、弹窗、API、任务轮询和状态写回通过 children 或显式 props 由页面提供。
 *
 * ─── 更新记录 ─────────────────────────────────────────────────────
 *   2026-07-17  从 SubjectPage 抽离工作区外框和稳定展示组合
 *   2026-08-03  主体页右上角新增按钮文案统一为「新增主体类型」
 *   2026-08-21  透传 Seedance 真人素材认证模式和进入/退出回调
 */
import { SUBJECT_TABS } from './SubjectTabsConstants';
import SubjectToolbar from './SubjectToolbar';
import SubjectTabs from './SubjectTabs';
import SubjectGridViewport from './SubjectGridViewport';

export default function SubjectWorkspace({
  projectName,
  activeTab,
  counts,
  subjectListRef,
  gridProps,
  onBack,
  onAddSubject,
  onBatchGenerate,
  onStartStoryboard,
  isSeedanceCertificationMode,
  onEnterSeedanceCertification,
  onExitSeedanceCertification,
  onTabChange,
  children,
}) {
  const tabLabel = SUBJECT_TABS.find((tab) => tab.key === activeTab)?.label ?? '主体';

  return (
    <div
      className="bg-neutral-200 rounded-[16px] border border-solid border-[#FFFFFF14] overflow-hidden"
      style={{ position: 'absolute', inset: 0, marginBottom: '24px', marginRight: '32px', padding: '16px 24px', display: 'flex', flexDirection: 'column' }}
    >
      <SubjectToolbar
        projectName={projectName}
        onBack={onBack}
        addLabel={`新增${tabLabel}`}
        onAddSubject={onAddSubject}
        onBatchGenerate={onBatchGenerate}
        onStartStoryboard={onStartStoryboard}
        tabLabel={tabLabel}
        isCharacterTab={activeTab === 'char'}
        isSeedanceCertificationMode={isSeedanceCertificationMode}
        onEnterSeedanceCertification={onEnterSeedanceCertification}
        onExitSeedanceCertification={onExitSeedanceCertification}
      />
      <SubjectTabs activeTab={activeTab} counts={counts} onChange={onTabChange} />
      <SubjectGridViewport subjectListRef={subjectListRef} gridProps={gridProps} />
      {children}
    </div>
  );
}
