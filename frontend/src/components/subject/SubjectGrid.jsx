/**
 * @file SubjectGrid.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   SubjectGrid 仅负责主体列表错误提示、卡片列表、新增卡片和分页加载提示
 *   不依赖页面 API、Store、路由或 Toast；主体卡片由主体域组件直接复用
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  从 SubjectPage 抽离角色/场景/道具网格渲染区
 */
import { Button } from '../ui';
import { AddSubjectCard, SubjectCard } from './SubjectCard';
import { getCurrentSubjectCertificationStatus } from './SubjectCertificationAdapter';

const TAB_LABELS = { char: '角色', scene: '场景', prop: '道具' };

function getEmptyIcon(activeTab, emptyIcons) {
  return emptyIcons?.[activeTab] ?? null;
}

export default function SubjectGrid({
  activeTab,
  chars = [],
  scenes = [],
  props = [],
  charVoices = {},
  voiceList = [],
  selectedChar,
  selectedScene,
  selectedProp,
  batchLoadingSubjects = {},
  charsLoadError = false,
  scenesLoadError = false,
  propsLoadError = false,
  onRetryChars,
  onRetryScenes,
  onRetryProps,
  onVoiceClick,
  onVoiceRemove,
  onSelect,
  onDownloadImage,
  onDeleteSubject,
  onAdd,
  emptyIcons,
  sentinelRef,
  hasMore = false,
  certificationMode = false,
  certificationBySubject = {},
  certificationGroups = [],
  onCertificationClick,
  onCertificationCreateGroup,
}) {
  const items = activeTab === 'char' ? chars : activeTab === 'scene' ? scenes : props;
  const isCharacterTab = activeTab === 'char';
  const loadError = activeTab === 'char' ? charsLoadError : activeTab === 'scene' ? scenesLoadError : propsLoadError;
  const retry = activeTab === 'char' ? onRetryChars : activeTab === 'scene' ? onRetryScenes : onRetryProps;
  const selectedId = activeTab === 'char' ? selectedChar?.id : activeTab === 'scene' ? selectedScene?.id : selectedProp?.id;
  const emptyIcon = getEmptyIcon(activeTab, emptyIcons);
  const label = TAB_LABELS[activeTab] ?? '主体';

  return (
    <>
      {loadError && (
        <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '10px 14px', marginBottom: '4px', borderRadius: '8px', background: '#FF6B6B14', border: '1px solid #FF6B6B33' }}>
          <span style={{ fontSize: '13px', color: '#FFB4B4', fontFamily: "'AlibabaPuHuiTi_2_55_Regular',system-ui,sans-serif" }}>
            {label}加载失败，已保留当前已加载的卡片
          </span>
          <Button variant="danger" size="small" onClick={() => retry?.()}>
            点击重试
          </Button>
        </div>
      )}
      {items.map((item) => {
        const voiceId = charVoices[item.id];
        const voice = voiceList.find((entry) => entry.voice_id === voiceId);
        const certificationStatus = certificationMode && isCharacterTab
          ? getCurrentSubjectCertificationStatus(item, certificationBySubject[item.id])
          : undefined;
        return (
          <SubjectCard
            key={item.id}
            name={item.name}
            desc={item.desc}
            imageUrl={item.imageUrl}
            emptyIcon={emptyIcon}
            voice={isCharacterTab ? voiceId : undefined}
            // 音色 ID 已清空时不能继续展示主体接口返回的旧 voice_name。
            voiceName={isCharacterTab && voiceId ? (item.voice_name ?? voice?.name) : undefined}
            voicePreviewUrl={isCharacterTab ? (item.voice_preview_url ?? voice?.preview_url) : undefined}
            onVoiceClick={isCharacterTab ? () => onVoiceClick?.(item) : undefined}
            onVoiceRemove={isCharacterTab ? () => onVoiceRemove?.(item) : undefined}
            onClick={() => onSelect?.(activeTab, item)}
            onDownloadImage={() => onDownloadImage?.(item.id)}
            onDeleteSubject={() => onDeleteSubject?.(item.id)}
            loading={!!batchLoadingSubjects[item.id]}
            selected={selectedId === item.id}
            certificationStatus={certificationStatus}
            certificationGroups={certificationGroups}
            onCertificationClick={(group) => onCertificationClick?.(item, group)}
            onCertificationCreateGroup={onCertificationCreateGroup}
          />
        );
      })}
      <AddSubjectCard onClick={onAdd} />
      <div ref={sentinelRef} style={{ gridColumn: '1 / -1', height: '1px' }} />
      {hasMore && (
        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
          <span style={{ fontSize: '13px', color: '#FFFFFF40', fontFamily: "'AlibabaPuHuiTi_2_55_Regular',system-ui,sans-serif" }}>加载中…</span>
        </div>
      )}
    </>
  );
}
