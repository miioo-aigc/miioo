import { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import InputCard from '../../components/InputCard';
import { FONT } from '../../utils/fonts';
import VideoResultCard from '../../components/VideoResultCard';
import ImageResultCard from '../../components/ImageResultCard';
import AudioResultCard from '../../components/AudioResultCard';
import BatchButton from '../../components/BatchButton';

function CreationResultState({ generations, onGenerate, genType, onGenTypeChange, model, onModelChange, modelOptions, creationParams, onDeleteCard, batchMode = false, selected, onToggleSelect, onSwitchToFrameMode, onVideoCardClick, favorites, toggleFavorite, showToast, onBeforeModelOpen, isGenerating = false, historyLoading = false, historyHasMore = false, onLoadMore, activeCount = 0 }) {
  const scrollRef = useRef(null);
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
      createdAt: gen.createdAt,
    }))
  );

  const videoCards = allCards.filter(c => c.type === 'video');
  const imageCards = allCards.filter(c => c.type === 'image');
  const audioCards = allCards.filter(c => c.type === 'audio');

  // 如果 generation 为空，渲染空状态
  if (generations.length === 0 && !historyLoading) {
    return null;
  }

  // ─── 处理重新编辑 ─────────────────────
  const handleReEdit = useCallback((card) => {
    const gen = generations.find(g => g.id === card.genId);
    if (!gen) return;
    setPrefillVersion(v => v + 1);
    setPrefillData({
      prompt: gen.prompt,
      model: gen.model,
      ratio: gen.ratio,
      resolution: gen.resolution,
      ...(gen.duration ? { duration: gen.duration } : {}),
      refImages: gen.refImages || [],
    });
  }, [generations]);

  // ─── 处理尾帧 → 首帧参考（视频） ─────
  const handleVideoFrameSwap = useCallback(async (videoUrl) => {
    try {
      const res = await fetch(videoUrl);
      const blob = await res.blob();
      const file = new File([blob], 'lastframe.png', { type: 'image/png' });
      setPrefillVersion(v => v + 1);
      setPrefillData(prev => ({
        ...(prev || {}),
        firstFrameFile: file,
      }));
      showToast('success', '尾帧已添加为首帧参考');
    } catch {
      showToast('error', '获取尾帧失败，请重试');
    }
  }, [showToast]);

  function renderCard(card) {
    const key = card.key;
    const isFav = !!favorites?.[card.genId]?.includes(card.cardIndex);
    const sel = !!selected?.[card.genId]?.includes(card.cardIndex);

    function handleDelete() {
      onDeleteCard?.(card.genId, card.cardIndex);
    }

    function toggleFav() {
      toggleFavorite?.(card.genId, card.cardIndex, !isFav);
      if (isFav) showToast('success', '取消收藏');
      else showToast('success', '收藏成功');
    }

    function handleSelect() {
      onToggleSelect?.(card.genId, card.cardIndex);
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
          onDelete={handleDelete}
          onCardClick={() => onVideoCardClick?.(card)}
          batchMode={batchMode}
          isSelected={sel}
          onToggleSelect={handleSelect}
          favorited={isFav}
          onToggleFavorite={toggleFav}
        />
      );
    }

    if (card.type === 'audio') {
      return (
        <AudioResultCard
          key={key}
          status={card.status}
          audioUrl={card.audioUrl}
          prompt={card.prompt}
          model={card.model}
          createdAt={card.createdAt}
          onDelete={handleDelete}
          batchMode={batchMode}
          isSelected={sel}
          onToggleSelect={handleSelect}
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
        onUseAsRef={() => {}}
        onDelete={handleDelete}
        onSave={() => {}}
        batchMode={batchMode}
        isSelected={sel}
        onToggleSelect={handleSelect}
        favorited={isFav}
        onToggleFavorite={toggleFav}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, flexDirection: 'column', alignSelf: 'stretch' }}>
      {/* Scrollable content */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '16px 24px 16px 24px', display: 'flex', flexDirection: 'column' }}>
        <div ref={sentinelRef} />

        {isGenerating && (
          <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#272727' }}>
            <div className="creation-shimmer" style={{ width: '100%', height: '100%' }} />
          </div>
        )}

        {imageCards.length > 0 && genType === 'image' && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-[8px]">
            {imageCards.map(renderCard)}
          </div>
        )}

        {videoCards.length > 0 && genType === 'video' && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-[8px]">
            {videoCards.map(renderCard)}
          </div>
        )}

        {audioCards.length > 0 && genType === 'dubbing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {audioCards.map(renderCard)}
          </div>
        )}

        {historyLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
            <span style={{ fontFamily: FONT, fontSize: '12px', color: '#FFFFFF66' }}>加载中...</span>
          </div>
        )}

        {!historyLoading && historyHasMore && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '8px' }}>
            <button type="button" onClick={onLoadMore}
              style={{ fontFamily: FONT, fontSize: '12px', color: '#2DC3E1', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 16px' }}>
              加载更多
            </button>
          </div>
        )}
      </div>

      {/* InputCard */}
      <div style={{ flexShrink: 0, alignSelf: 'center' }}>
        <InputCard onGenerate={onGenerate} width="100%" genType={genType} onGenTypeChange={onGenTypeChange}
          model={model} onModelChange={onModelChange} modelOptions={modelOptions} creationParams={creationParams}
          onBeforeModelOpen={onBeforeModelOpen} showToast={showToast} activeCount={activeCount}
          prefillVersion={prefillVersion} prefillData={prefillData} />
      </div>
    </div>
  );
}

export default memo(CreationResultState);
