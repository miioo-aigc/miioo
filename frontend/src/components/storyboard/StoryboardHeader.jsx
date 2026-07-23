/**
 * @file StoryboardHeader.jsx
 * @structure-index
 *
 * ─── 组件职责 ─────────────────────────────────────────────────────
 *   分镜页面包屑、分镜统计、重新分镜动作和批量工具栏组合
 *
 * ─── 依赖边界 ─────────────────────────────────────────────────────
 *   只接收页面显式数据和动作回调；不读取页面状态、不调用 API。
 *
 * ─── 更新记录 ─────────────────────────────────────────────────────
 *   2026-07-17  从 StoryboardPage 抽离头部组合
 *   2026-07-23  按新版设计稿重做面包屑和分镜统计，复用 TextButton
 */
import { TextButton } from '../ui';
import { EpisodeSelector } from './StoryboardControls';
import StoryboardBatchToolbar from './StoryboardBatchToolbar';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function RegenerateIcon() {
  return (
    <svg viewBox="0 0 81.92 81.92" width="16" height="16" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M46.141 65.944c-8.16 1.656-16.96-0.64-23.208-6.88C13.621 49.76 12.989 35.232 21.021 25.296v4.712c0 1.4 1.152 2.544 2.552 2.544 1.408 0 2.544-1.144 2.552-2.544V19.816c0-0.768-0.256-1.4-0.768-1.784-0.512-0.512-1.152-0.768-1.784-0.768H13.373c-1.408 0-2.544 1.144-2.552 2.552 0 1.4 1.152 2.552 2.552 2.552h3.568C7.373 34.216 8.269 51.544 19.237 62.632c7.648 7.648 18.232 10.32 28.056 8.28 0.384-0.128 0.896-0.384 1.152-0.64 1.016-1.016 1.016-2.552 0-3.568-0.52-0.76-1.536-1.016-2.304-0.76z m22.448-6.24h-3.44c9.312-11.976 8.544-29.312-2.552-40.392C55.453 12.176 45.757 9.368 36.453 10.64c-0.64 0-1.152 0.256-1.656 0.768-1.016 1.016-1.016 2.544 0 3.568 0.64 0.64 1.528 0.888 2.424 0.64 7.648-1.144 15.816 1.272 21.68 7.136 9.312 9.304 9.944 23.832 1.912 33.768v-4.712c0-1.4-1.152-2.552-2.552-2.552-1.408 0-2.544 1.144-2.552 2.552V62c0 0.768 0.256 1.4 0.768 1.784 0.512 0.512 1.152 0.768 1.784 0.768h10.2c1.408 0 2.544-1.144 2.552-2.552 0-1.408-1.024-2.296-2.424-2.296z m0 0" fill="#2DC3E1" />
    </svg>
  );
}

function DownArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 10.666 10.666" aria-hidden="true" style={{ overflow: 'visible', rotate: '270deg', flexShrink: 0 }}>
      <path d="M8 4L5.334 6.666 2.666 4" fill="none" stroke="#FFFFFF99" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function StoryboardHeader({
  projectName,
  activeEpisodes,
  episode,
  onEpisodeChange,
  homeIsGenerating,
  shotsCount,
  totalDuration = 0,
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
  onRegenerate,
}) {
  const shotText = String(shotsCount || 0).padStart(2, '0');
  const durationText = Number.isInteger(totalDuration) ? String(totalDuration) : totalDuration.toFixed(1);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', columnGap: '24px', rowGap: '8px', minHeight: '28px', flexShrink: 0, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '22px', minWidth: 0, flex: '1 1 auto', flexWrap: 'wrap', rowGap: '8px', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
          <span style={{ display: 'inline-block', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: FONT, fontSize: '14px', lineHeight: '20px', color: '#FFFFFF99' }}>{projectName}</span>
          <DownArrow />
          <EpisodeSelector episodes={activeEpisodes} value={episode} onChange={onEpisodeChange} />
        </div>
        <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '20px', color: '#FFFFFFCC' }}>分镜数{shotText}，总时长{durationText}秒</span>
        <TextButton variant="link" icon={<RegenerateIcon />} disabled={homeIsGenerating} onClick={onRegenerate} contentClassName="text-[14px] leading-[20px]">
          重新分镜
        </TextButton>
      </div>
      {homeIsGenerating && (
        <span style={{ flex: '1 1 100%', order: 3, textAlign: 'center', fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#2DC3E1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', pointerEvents: 'none' }}>
          后台还在抽取分镜，已完成 {completedEpisodesCount}/{activeEpisodes.length} 集
        </span>
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
  );
}
