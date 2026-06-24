import { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import InputCard from '../../components/InputCard';
import { FONT } from '../../utils/fonts';
import VideoResultCard from '../../components/VideoResultCard';
import ImageResultCard from '../../components/ImageResultCard';
import AudioResultCard from '../../components/AudioResultCard';
import BatchButton from '../../components/BatchButton';

const SHIMMER_STYLE_ID = 'creation-shimmer-style';

function ensureShimmerStyle() {
  if (document.getElementById(SHIMMER_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = SHIMMER_STYLE_ID;
  style.textContent = `
    @keyframes creation-shimmer {
      0% { background-position: -400px 0; }
      100% { background-position: 400px 0; }
    }
    .creation-shimmer {
      background: linear-gradient(90deg, #FFFFFF08 25%, #FFFFFF14 50%, #FFFFFF08 75%);
      background-size: 800px 100%;
      animation: creation-shimmer 1.6s ease-in-out infinite;
    }
  `;
  document.head.appendChild(style);
}


function CreationResultState({ generations, onGenerate, genType, onGenTypeChange, model, onModelChange, modelOptions, creationParams, onDeleteCard, batchMode = false, selected, onToggleSelect, onSwitchToFrameMode, onVideoCardClick, favorites, toggleFavorite, showToast, onBeforeModelOpen, isGenerating = false, historyLoading = false, historyHasMore = false, onLoadMore, pendingCount = 0, activeCount = 0 }) {
  const scrollRef = useRef(null);
  useEffect(() => { ensureShimmerStyle(); }, []);
  const sentinelRef = useRef(null);
  const [prefillVersion, setPrefillVersion] = useState(0);
  const [prefillData, setPrefillData] = useState(null);

  const allCards = [...generations].reverse().flatMap((gen) =>
    gen.cards.map((card, i) => ({
      ...card,
      key: `${gen.id}-${i}`,
      genId: gen.id,
      cardIndex: i,
      prompt: gen.prompt,
      promptHTML: gen.promptHTML || '',
      model: gen.model,
      ratio: gen.ratio,
      resolution: gen.resolution,
      duration: gen.duration,
      refImages: gen.refImages,
      refMode: gen.refMode || (gen.firstFrame ? "frame" : "all"),
      firstFrame: gen.firstFrame,
      lastFrame: gen.lastFrame,
      refVideos: gen.refVideos || [],
      refAudios: gen.refAudios || [],
      createdAt: gen.createdAt,
    }))
  );


  // 如果 generation 为空，渲染空状态
  if (generations.length === 0 && !historyLoading && !isGenerating) {
    return null;
  }

  // ─── 处理重新编辑 ─────────────────────
  const handleReEdit = useCallback((card) => {
    const gen = generations.find(g => g.id === card.genId);
    if (!gen) return;
    setPrefillVersion(v => v + 1);
    setPrefillData({
      prompt: gen.prompt,
      promptHTML: gen.promptHTML || '',
      files: (gen.refImages || []).map((img) => ({
        name: img.name && /\.(jpg|jpeg|png|webp|gif|bmp|tiff?|heic|heif)$/i.test(img.name) ? img.name : 'ref.png',
        url: img.url || img.previewUrl || '',
        previewUrl: img.url || img.previewUrl || '',
        type: 'image/png',
        isAsset: true,
        size: 0,
      })),
      refMode: gen.refMode || (gen.firstFrame ? "frame" : "all"),
      ...(gen.firstFrame ? { firstFrameFile: { name: 'firstframe.png', url: gen.firstFrame, previewUrl: gen.firstFrame, isAsset: true, size: 0 } } : {}),
      ...(gen.lastFrame ? { lastFrameFile: { name: 'lastframe.png', url: gen.lastFrame, previewUrl: gen.lastFrame, isAsset: true, size: 0 } } : {}),
      ratio: gen.ratio,
      resolution: gen.resolution,
      ...(gen.duration ? { duration: gen.duration } : {}),
    });
  }, [generations]);

  // ─── 处理尾帧 → 首帧参考（视频） ─────
  const handleVideoFrameSwap = useCallback(async (videoUrl) => {
    try {
      // 用 video + canvas 抽取视频最后一帧为图片
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.preload = 'metadata';
      video.src = videoUrl;

      await new Promise((resolve, reject) => {
        video.onloadedmetadata = () => {
          video.currentTime = Math.max(0, video.duration - 0.1);
        };
        video.onseeked = () => resolve();
        video.onerror = () => reject(new Error('视频加载失败'));
      });

      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) throw new Error('视频帧尺寸无效');

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);

      // canvas.toBlob 直接产出 Blob，无需 dataUrl → fetch 中转
      const blob = await new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png'));
      const file = new File([blob], 'lastframe.png', { type: 'image/png' });

      setPrefillVersion(v => v + 1);
      setPrefillData(prev => ({
        ...(prev || {}),
        refMode: 'frame',
        firstFrameFile: file,
      }));
      showToast('success', '尾帧已提取为首帧参考');
    } catch {
      showToast('error', '获取尾帧失败，请重试');
    }

  }, [showToast]);




  const isAudio = genType === 'dubbing';

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
      {/* Grid: absolutely fills the container, scrolls internally */}
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
            gap: '16px',
            alignContent: 'flex-start',
          }}
        >
          {isGenerating && Array.from({ length: Math.max(pendingCount, 1) }).map((_, i) => (
            <div key={`pending-${i}`} style={{
              width: '100%',
              height: isAudio ? '72px' : undefined,
              aspectRatio: isAudio ? undefined : '16/9',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.06)',
              overflow: 'hidden',
              flexShrink: 0,
              position: 'relative',
            }}>
              <div className="creation-shimmer" style={{ width: '100%', height: '100%' }} />
            </div>
          ))}

          {allCards.map((card) => {
            const { key, ...cardProps } = card;
            if (card.type === 'audio' || isAudio) {
              return (
                <AudioResultCard
                  key={key}
                  {...cardProps}
                  batchMode={batchMode}
                  isSelected={batchMode && selected?.has(key)}
                  onToggleSelect={() => onToggleSelect?.(key)}
                  onDelete={() => onDeleteCard?.(card.genId, card.cardIndex)}
                />
              );
            }
            if (card.type === 'video') {
              return (
                <VideoResultCard
                  key={key}
                  status={card.status}
                  videoUrl={card.videoUrl}
                  prompt={card.prompt}
                  model={card.model}
                  ratio={card.ratio}
                  resolution={card.resolution}
                  duration={card.duration}
                  refImages={card.refImages}
                  createdAt={card.createdAt}
                  onReEdit={() => handleReEdit(card)}
                  onUseAsFirstFrame={() => handleVideoFrameSwap(card.videoUrl)}
                  onDelete={() => onDeleteCard?.(card.genId, card.cardIndex)}
                  onCardClick={() => onVideoCardClick?.(card)}
                  batchMode={batchMode}
                  isSelected={batchMode && selected?.has(key)}
                  onToggleSelect={() => onToggleSelect?.(key)}
                  favorited={favorites?.has(key)}
                  onToggleFavorite={() => toggleFavorite?.(key)}
                />
              );
            }
            return (
              <ImageResultCard
                key={key}
                status={card.status}
                imageUrl={card.imageUrl}
                originalUrl={card.originalUrl}
                prompt={card.prompt}
                promptHTML={card.promptHTML}
                model={card.model}
                ratio={card.ratio}
                resolution={card.resolution}
                refImages={card.refImages}
                createdAt={card.createdAt}
                onReEdit={() => handleReEdit(card)}
                onUseAsRef={() => {
                  const newFile = { name: 'creation.png', url: card.imageUrl, previewUrl: card.imageUrl, assetId: card.assetId || card.id || undefined, isAsset: true, size: 0 };
                  setPrefillData({
                    appendFiles: [newFile],
                  });
                  setPrefillVersion((v) => v + 1);
                }}
                onDelete={() => onDeleteCard?.(card.genId, card.cardIndex)}
                onSave={() => {}}
                batchMode={batchMode}
                isSelected={batchMode && selected?.has(key)}
                onToggleSelect={() => onToggleSelect?.(key)}
                favorited={favorites?.has(key)}
                onToggleFavorite={() => toggleFavorite?.(key)}
              />
            );
          })}

          {historyLoading && (
            <div style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '16px' }}>
              <span style={{ fontFamily: FONT, fontSize: '12px', color: '#FFFFFF66' }}>加载中...</span>
            </div>
          )}

          {!historyLoading && historyHasMore && (
            <div style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '8px' }}>
              <button type="button" onClick={onLoadMore}
                style={{ fontFamily: FONT, fontSize: '12px', color: '#2DC3E1', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 16px' }}>
                加载更多
              </button>
            </div>
          )}

          <div ref={sentinelRef} />
        </div>
      </div>

      {/* InputCard */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center', paddingLeft: '32px', paddingRight: '32px', paddingBottom: '16px', paddingTop: '8px', zIndex: 1 }}>
        <div style={{ width: 'min(800px, 100%)' }}>
          <InputCard onGenerate={onGenerate} width="100%" genType={genType} onGenTypeChange={onGenTypeChange}
          model={model} onModelChange={onModelChange} modelOptions={modelOptions} creationParams={creationParams}
          onBeforeModelOpen={onBeforeModelOpen} showToast={showToast} activeCount={activeCount}
          prefillVersion={prefillVersion} prefillData={prefillData} />
        </div>
      </div>
    </div>
  );
}

export default memo(CreationResultState);
