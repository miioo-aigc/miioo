/**
 * @file CreationPageOverlays.jsx
 * @structure-index
 *
 * ─── 展示组合 ───────────────────────────────────────────────
 *   CreationPageOverlays                                      创作页确认弹窗与媒体详情 Portal
 *
 * ─── 边界 ───────────────────────────────────────────────────
 *   只接收显式状态、展示文本和动作回调；不调用 API、Store、缓存或任务轮询。
 *   视频下载、删除和收藏仍由页面通过回调提供，避免业务副作用越过页面边界。
 *
 * ─── 更新记录 ───────────────────────────────────────────────
 *   2026-07-16  从 CreationPage.jsx 抽离页面确认弹窗和视频详情 Portal 组合
 *   2026-08-19  新增独立音频详情 Portal，页面仅编排音频详情状态与动作回调
 */

import { createPortal } from 'react-dom';
import ConfirmDialog from '../ConfirmDialog';
import CreationVideoDetailModal from '../CreationVideoDetailModal';
import CreationAudioDetailModal from './CreationAudioDetailModal';

export default function CreationPageOverlays({
  batchDeleteConfirm = false,
  onBatchDeleteConfirm,
  onBatchDeleteCancel,
  clearHistoryConfirm = false,
  clearHistoryDescription,
  onClearHistoryConfirm,
  onClearHistoryCancel,
  videoDetail,
  onVideoDetailClose,
  onVideoDetailDownload,
  onVideoDetailDelete,
  videoDetailFavorited = false,
  onVideoDetailFavorite,
  audioDetail,
  onAudioDetailClose,
  onAudioDetailDownload,
  onAudioDetailDelete,
  audioDetailFavorited = false,
  onAudioDetailFavorite,
}) {
  return (
    <>
      {batchDeleteConfirm && (
        <ConfirmDialog
          title="确认删除"
          description="删除后无法恢复，确定要删除这张图片吗？"
          confirmText="删除"
          onConfirm={onBatchDeleteConfirm}
          onCancel={onBatchDeleteCancel}
          zIndex={1100}
        />
      )}

      {clearHistoryConfirm && (
        <ConfirmDialog
          title="清空创作历史"
          description={clearHistoryDescription}
          confirmText="清空"
          onConfirm={onClearHistoryConfirm}
          onCancel={onClearHistoryCancel}
          zIndex={1100}
        />
      )}

      {videoDetail && createPortal(
        <CreationVideoDetailModal
          videoUrl={videoDetail.videoUrl}
          prompt={videoDetail.prompt}
          promptHTML={videoDetail.promptHTML}
          model={videoDetail.model}
          ratio={videoDetail.ratio}
          resolution={videoDetail.resolution}
          duration={videoDetail.duration}
          refMode={videoDetail.refMode}
          refModeLabel={videoDetail.refModeLabel}
          refImages={videoDetail.refImages}
          refVideos={videoDetail.refVideos}
          refAudios={videoDetail.refAudios}
          firstFrame={videoDetail.firstFrame || videoDetail.firstFrameUrl}
          lastFrame={videoDetail.lastFrame || videoDetail.lastFrameUrl}
          createdAt={videoDetail.createdAt}
          onClose={onVideoDetailClose}
          onDownload={onVideoDetailDownload}
          onDelete={onVideoDetailDelete}
          favorited={videoDetailFavorited}
          onFavorite={onVideoDetailFavorite}
        />,
        document.body
      )}
      {audioDetail && createPortal(
        <CreationAudioDetailModal
          audioUrl={audioDetail.audioUrl}
          prompt={audioDetail.prompt}
          model={audioDetail.model}
          speed={audioDetail.speed}
          pitch={audioDetail.pitch}
          volume={audioDetail.volume}
          advancedEnabled={audioDetail.advancedEnabled}
          voiceName={audioDetail.voiceName}
          voiceId={audioDetail.voiceId}
          voiceOriginLabel={audioDetail.voiceOriginLabel}
          createdAt={audioDetail.createdAt}
          onClose={onAudioDetailClose}
          onDownload={onAudioDetailDownload}
          onDelete={onAudioDetailDelete}
          favorited={audioDetailFavorited}
          onFavorite={onAudioDetailFavorite}
        />, document.body
      )}
    </>
  );
}
