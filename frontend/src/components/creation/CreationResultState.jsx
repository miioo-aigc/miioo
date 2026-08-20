/**
 * @file CreationResultState.jsx
 * @structure-index
 *
 * ─── 状态 ─────────────────────────────────────────────────────
 *   scrollRef / sentinelRef                                      结果列表滚动容器与分页哨兵
 *   autoFillCountRef                                             视口未满时的自动分页次数
 *   prefillVersion / prefillData                                 重新编辑和参考图回填 InputCard 的数据
 *
 * ─── 数据流与副作用 ───────────────────────────────────────────
 *   generations → allCards                                      生成记录扁平化与最新优先排序
 *   onLoadMore                                                    IntersectionObserver 与视口自动填充
 *   onVideoCardClick / onDownloadCard / onDeleteCard / toggleFavorite 页面业务回调
 *   renderInputCard                                               以渲染回调接入页面内 InputCard，避免反向依赖页面
 *
 * ─── 组件结构 ─────────────────────────────────────────────────
 *   CreationResultState                                           结果滚动区、结果卡片、加载态和底部输入区
 *   CreationVideoResultCard / CreationImageResultCard             图片与视频结果展示
 *   CreationAudioResultCard                                      配音结果展示（与图片/视频共用 240px 最小列宽、16px 间距、16:9 卡片）
 *
 * ─── 更新记录 ─────────────────────────────────────────────────
 *   2026-07-16  从 CreationPage.jsx 抽离结果列表容器；页面继续持有历史请求、生成请求、轮询、缓存和 Toast
 *   2026-07-16  统一后端视频参考模式到首尾帧/全能参考 UI 模式，保证重新编辑参数回填一致
 *   2026-07-16  复用 creationDetailAdapter，统一视频详情素材字段转换
 *   2026-07-16  抽离视频重新编辑预填充参数组装，组件保留详情请求和预填充状态
 *   2026-07-16  复用统一适配工具处理图片重新编辑和用作参考图回填
 *   2026-07-16  抽离尾帧转首帧的预填充对象构造，组件保留尾帧 API 和 Blob 生命周期
 *   2026-08-03  尾帧转首帧预填充同步写入预览地址，修复首帧槽位不显示图片
 *   2026-08-03  预览字段改为可枚举，修复文件归一化展开时字段丢失
 *   2026-08-07  结果区输入卡接入配音取消回调，保留再次发送后的提示词并支持失败/取消恢复
 *   2026-08-17  图片、视频和配音下载统一回调页面正式下载接口
 *   2026-08-07  配音结果纳入图片/视频结果网格：列宽最小 240px、宽度随容器适配、卡片比例 16:9
 *   2026-08-18  配音高级模式下输入框保持下边缘并向内容区上方和两侧展开
 */

import { useEffect, useRef, useState } from 'react';
import { apiGetCreationVideo, apiGetVideoLastFrame } from '../../api/creation';
import {
  buildCreationImageReferencePrefill,
  buildCreationImageReeditPrefill,
  createCreationFirstFramePrefill,
  buildCreationVideoReeditPrefill,
  normalizeCreationVideoDetailMedia,
} from '../../utils/creationDetailAdapter';
import DotsLoading from '../DotsLoading';
import CreationAudioResultCard from './CreationAudioResultCard';
import CreationImageResultCard from './CreationImageResultCard';
import CreationVideoResultCard from './CreationVideoResultCard';
import CreationInputDock from './CreationInputDock';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
export default function CreationResultState({
  generations,
  onGenerate,
  genType,
  onGenTypeChange,
  model,
  onModelChange,
  modelOptions,
  creationParams,
  onDeleteCard,
  batchMode = false,
  selected,
  onToggleSelect,
  onSwitchToFrameMode,
  onVideoCardClick,
  onAudioCardClick,
  onDownloadCard,
  favorites,
  toggleFavorite,
  showToast,
  onBeforeModelOpen,
  isGenerating = false,
  historyLoading = false,
  historyHasMore = false,
  onLoadMore,
  autoFillLimit = Infinity,
  activeCount = 0,
  capabilitiesMap = {},
  onCancelGeneration,
  renderInputCard,
  dubbingAdvancedEnabled = false,
  onDubbingAdvancedChange,
}) {
  const scrollRef = useRef(null);
  const sentinelRef = useRef(null);
  const autoFillCountRef = useRef(0);
  const [prefillVersion, setPrefillVersion] = useState(0);
  const [prefillData, setPrefillData] = useState(null);

  // Newest generation first — index 0 is the most recently generated image/video
  const allCards = [...generations].reverse().flatMap((gen) =>
    gen.cards.map((card, i) => ({
      ...card,
      key: `${gen.id}-${i}`,
      genId: gen.id,
      cardIndex: i,
      prompt: gen.prompt,
      promptHTML: gen.promptHTML || '',
      model: gen.model,
      voiceName: gen.voiceName,
      voiceId: gen.voiceId || '',
      voiceSource: gen.voiceSource,
      speed: gen.speed,
      pitch: gen.pitch,
      volume: gen.volume,
      advancedEnabled: gen.advancedEnabled,
      ratio: gen.ratio,
      resolution: gen.resolution,
      duration: gen.duration,
      refImages: gen.refImages,
      refVideos: gen.refVideos,
      refAudios: gen.refAudios,
      refMode: gen.refMode,
      refModeLabel: gen.refModeLabel,
      firstFrameUrl: gen.firstFrameUrl,
      lastFrameUrl: gen.lastFrameUrl,
      createdAt: gen.createdAt,
      _needsDetail: gen._needsDetail,
      backendId: gen.backendId,
    }))
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
    autoFillCountRef.current = 0;
  }, [genType]);

  // ── 滚动到底加载更多（IntersectionObserver） ────────────────────────────────
  useEffect(() => {
    if (!sentinelRef.current || !onLoadMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && historyHasMore && !historyLoading) {
          onLoadMore();
        }
      },
      { root: scrollRef.current, rootMargin: '120px', threshold: 0 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [historyHasMore, historyLoading, onLoadMore]);

  // ── 视口未满时自动加载下一页 ───────────────────────────────────────────────
  useEffect(() => {
    if (!historyHasMore || historyLoading || !onLoadMore) return;
    const container = scrollRef.current;
    if (!container) return;
    const raf = requestAnimationFrame(() => {
      const underfilled = container.scrollHeight <= container.clientHeight + 1;
      if (underfilled && autoFillCountRef.current < autoFillLimit) {
        autoFillCountRef.current += 1;
        onLoadMore();
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [autoFillLimit, genType, generations.length, historyHasMore, historyLoading, onLoadMore]);

  const isAudio = genType === 'dubbing' || genType === 'music';
  const inputDisabled = isGenerating && (genType === 'dubbing' || genType === 'music');
  const inputCardProps = {
    onGenerate,
    onCancelGeneration,
    disabled: inputDisabled,
    width: '100%',
    genType,
    onGenTypeChange,
    model,
    onModelChange,
    modelOptions,
    creationParams,
    prefillVersion,
    prefillData,
    onBeforeModelOpen,
    showToast,
    activeCount,
    capabilitiesMap,
    dubbingAdvancedEnabled,
    onDubbingAdvancedChange,
  };

  return (
    <div
      style={{
        position: 'relative',
        flex: 1,
        minHeight: 0,
        alignSelf: 'stretch',
        overflow: 'hidden',
      }}
    >
      <div
        ref={scrollRef}
        style={{
          position: 'absolute',
          inset: 0,
          padding: '8px 24px 220px',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            width: '100%',
            rowGap: '16px',
            columnGap: '16px',
            alignContent: 'flex-start',
          }}
        >
          {isGenerating && allCards.length === 0 && (
            <div style={{
              width: '100%', aspectRatio: '16/9', borderRadius: '8px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  border: '2.5px solid rgba(255,255,255,0.10)',
                  borderTopColor: '#2DC3E1',
                  animation: 'spin 1s linear infinite',
                }} />
                <span style={{ fontFamily: FONT, fontSize: '13px', lineHeight: '18px', color: 'rgba(255,255,255,0.30)' }}>
                  正在创作…
                </span>
              </div>
            </div>
          )}

          {allCards.map((card) => {
            const { key, ...cardProps } = card;
            if (card.type === 'audio' || isAudio) {
              return (
                <CreationAudioResultCard
                  key={key}
                  {...cardProps}
                  batchMode={batchMode}
                  isSelected={batchMode && selected?.has(key)}
                  onToggleSelect={() => onToggleSelect?.(key)}
                  favorited={favorites?.has(key)}
                  onToggleFavorite={() => toggleFavorite?.(key)}
                  onDownload={() => onDownloadCard?.(card)}
                  onDelete={() => onDeleteCard?.(card.genId, card.cardIndex)}
                  onCardClick={() => onAudioCardClick?.(card)}
                />
              );
            }
            if (card.type === 'video') {
              return (
                <CreationVideoResultCard
                  key={key}
                  {...cardProps}
                  batchMode={batchMode}
                  isSelected={batchMode && selected?.has(key)}
                  onToggleSelect={() => onToggleSelect?.(key)}
                  onCardClick={() => onVideoCardClick?.(card)}
                  favorited={favorites?.has(key)}
                  onToggleFavorite={() => toggleFavorite?.(key)}
                  onDownload={() => onDownloadCard?.(card)}
                  onReEdit={async () => {
                    let refImages = card.refImages || [];
                    let refVideos = card.refVideos || [];
                    let refAudios = card.refAudios || [];
                    if (card._needsDetail && card.backendId) {
                      try {
                        const detail = await apiGetCreationVideo(card.backendId);
                        const detailMedia = normalizeCreationVideoDetailMedia(detail, { preferOriginalImageUrl: true });
                        refImages = detailMedia.refImages;
                        refVideos = detailMedia.refVideos;
                        refAudios = detailMedia.refAudios;
                      } catch (e) {
                        console.warn('[CreationPage] re-edit: failed to fetch video detail', e);
                      }
                    }
                    setPrefillData(buildCreationVideoReeditPrefill(card, { refImages, refVideos, refAudios }));
                    setPrefillVersion((v) => v + 1);
                  }}
                  onUseAsFirstFrame={async () => {
                    try {
                      const result = await apiGetVideoLastFrame(card.videoUrl);
                      const lastFrameUrl = result.lastFrameUrl;
                      const frameBlob = result.blob;

                      if (!lastFrameUrl || !frameBlob) {
                        showToast('error', '获取尾帧失败，请重试');
                        return;
                      }

                      onSwitchToFrameMode?.();
                      setPrefillData(createCreationFirstFramePrefill(frameBlob, lastFrameUrl));
                      setPrefillVersion((v) => v + 1);
                      showToast('success', '尾帧已添加为首帧参考');
                    } catch (error) {
                      console.error('Failed to get video last frame:', error);
                      showToast('error', '获取尾帧失败，请重试');
                    }
                  }}
                  onDelete={() => onDeleteCard?.(card.genId, card.cardIndex)}
                />
              );
            }
            return (
              <CreationImageResultCard
                key={key}
                {...cardProps}
                batchMode={batchMode}
                isSelected={batchMode && selected?.has(key)}
                onToggleSelect={() => onToggleSelect?.(key)}
                onReEdit={() => {
                  setPrefillData(buildCreationImageReeditPrefill(card));
                  setPrefillVersion((v) => v + 1);
                }}
                onUseAsRef={() => {
                  setPrefillData(buildCreationImageReferencePrefill(card));
                  setPrefillVersion((v) => v + 1);
                }}
                favorited={favorites?.has(key)}
                onToggleFavorite={() => toggleFavorite?.(key)}
                onDownload={() => onDownloadCard?.(card)}
                onDelete={() => onDeleteCard?.(card.genId, card.cardIndex)}
              />
            );
          })}
        </div>
        <div ref={sentinelRef} style={{ height: '1px', flexShrink: 0 }} />
        {(historyLoading && allCards.length > 0) && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px 0', gap: '8px' }}>
            <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#2DC3E1', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
            <span style={{ fontFamily: FONT, fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>加载中…</span>
          </div>
        )}
      </div>

      {!isGenerating && allCards.length === 0 && historyLoading && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '12px',
          zIndex: 0,
          pointerEvents: 'none',
        }}>
          <DotsLoading size={6} color="#2DC3E1" gap={4} />
          <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '18px', color: '#FFFFFF99' }}>
            正在获取数据，请稍后
          </span>
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '50%',
          background: 'linear-gradient(to bottom, transparent, #161616)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      <CreationInputDock
        expanded={genType === 'dubbing' && dubbingAdvancedEnabled}
        collapsedWidth="min(800px, calc(100% - 64px))"
        zIndex={2}
      >
        {renderInputCard?.(inputCardProps)}
      </CreationInputDock>
    </div>
  );
}
