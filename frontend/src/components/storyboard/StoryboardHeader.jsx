/**
 * @file StoryboardHeader.jsx
 * @structure-index
 *
 * ─── 组件职责 ─────────────────────────────────────────────────────
 *   分镜页项目/选集头部、后台生成提示、批量工具栏和标题计数展示
 *
 * ─── 依赖边界 ─────────────────────────────────────────────────────
 *   只接收页面显式数据和动作回调；不读取 StoryboardPage 状态、不调用 API 或任务轮询。
 *
 * ─── 更新记录 ─────────────────────────────────────────────────────
 *   2026-07-17  从 StoryboardPage 抽离顶部稳定展示组合，保持选集和批量动作契约不变
 */
import { EpisodeSelector } from './StoryboardControls';
import StoryboardBatchToolbar from './StoryboardBatchToolbar';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

export default function StoryboardHeader({
  projectName,
  activeEpisodes,
  episode,
  onEpisodeChange,
  homeIsGenerating,
  shotsCount,
  completedEpisodesCount,
  downloadMode,
  selectedCount,
  generationDisabled,
  onOpenImageModal,
  onOpenVideoModal,
  onEnterDownloadMode,
  onSelectAll,
  onDownloadImages,
  onDownloadVideos,
  onExitDownloadMode,
  onStartEdit,
}) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.45)', fontFamily: FONT }}>{projectName}</span>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
            <path d="M5.5 3.5L9 7L5.5 10.5" stroke="#FFFFFF40" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <EpisodeSelector episodes={activeEpisodes} value={episode} onChange={onEpisodeChange} />
        </div>
        {homeIsGenerating && (
          <div style={{
            position: 'absolute', left: '50%', top: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex', alignItems: 'center', gap: '6px',
            height: '28px', padding: '0 10px', borderRadius: '6px',
            background: 'rgba(45,195,225,0.08)',
            border: '1px solid rgba(45,195,225,0.2)',
            pointerEvents: 'none', flexShrink: 0,
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, animation: 'spin 1.2s linear infinite' }}>
              <circle cx="6" cy="6" r="4.5" stroke="rgba(45,195,225,0.3)" strokeWidth="1.5" />
              <path d="M6 1.5A4.5 4.5 0 0 1 10.5 6" stroke="#2DC3E1" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span style={{ fontFamily: FONT, fontSize: '12px', color: '#2DC3E1', whiteSpace: 'nowrap' }}>
              后台还在抽取分镜，已完成 {completedEpisodesCount}/{activeEpisodes.length} 集
            </span>
          </div>
        )}
        <StoryboardBatchToolbar
          downloadMode={downloadMode}
          selectedCount={selectedCount}
          totalCount={shotsCount}
          generationDisabled={generationDisabled}
          onOpenImageModal={onOpenImageModal}
          onOpenVideoModal={onOpenVideoModal}
          onEnterDownloadMode={onEnterDownloadMode}
          onSelectAll={onSelectAll}
          onDownloadImages={onDownloadImages}
          onDownloadVideos={onDownloadVideos}
          onExitDownloadMode={onExitDownloadMode}
          onStartEdit={onStartEdit}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
        <span style={{ fontFamily: FONT_MEDIUM, fontSize: '16px', lineHeight: '20px', color: '#FFFFFF', fontWeight: 500 }}>分镜</span>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '18px', height: '16px', borderRadius: '999px', padding: '0 5px', backgroundColor: 'rgba(255,255,255,0.10)' }}>
          <span style={{ fontSize: '12px', lineHeight: '100%', color: 'rgba(255,255,255,0.80)', fontFamily: 'AlibabaPuHuiTi_2_55_Regular, "Alibaba PuHuiTi 2.0", system-ui, sans-serif' }}>{shotsCount}</span>
        </div>
      </div>
    </>
  );
}
