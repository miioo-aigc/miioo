import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { apiDeleteCreationImage, apiDeleteCreationVideo, apiDeleteCreationAudio, apiBatchDeleteImages, apiBatchDeleteVideos, apiBatchDeleteAudios, apiToggleImageFavorite, apiToggleVideoFavorite, apiToggleAudioFavorite, apiListCreationImages, apiListCreationVideos, apiListCreationAudios, apiGetCreationAudio, apiDownloadCreationImage, apiDownloadCreationVideo, apiDownloadCreationAudio } from '../../api/creation';
import { useCreationStore } from '../../stores/creationStore';
import { useAssetSelection } from '../../hooks/useAssetSelection';
import { generationsToDays } from '../../utils/creativeDaysAdapter';
import { normalizeImageUrl } from '../../utils/imageUrl';
import { dedupeByMediaAliases, dedupeCreationHistoryList, getCreationAssetMediaAliases } from '../../utils/creationHistoryAdapter';
import { getCreativeBatchDeleteRequest } from '../../utils/assetsBatchAdapter';
import { downloadBlob } from '../../utils/downloadBlob';
import { getCreativeAssetDownloadInfo } from '../../utils/creativeAssetDownload';
import { normalizeCreationAudioDetail } from '../../utils/creationAudioDetailAdapter';
import ConfirmDialog from '../ConfirmDialog';
import { AssetsTabBar } from './AssetsTabs';
import AssetsBatchToolbar from './AssetsBatchToolbar';
import { EmptyCreativeAssets } from './AssetsEmptyState';
import { AssetCard } from './AssetsCards';
import CreationAudioResultCard from '../creation/CreationAudioResultCard';
import CreationAudioDetailModal from '../creation/CreationAudioDetailModal';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const CREATIVE_TYPE_TABS = [
  { key: 'image', label: '图片' },
  { key: 'video', label: '视频' },
  { key: 'dubbing', label: '配音' },
];

export default function AssetsCreativePanel({ isLoggedIn }) {
  const [activeType, setActiveType] = useState('image');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const {
    batchMode,
    selected,
    selectedCount,
    enterBatch,
    toggleSelect,
    selectAll: selectAllAssets,
    exitBatch,
  } = useAssetSelection();
  const [toast, setToast] = useState(null);
  const [audioDetail, setAudioDetail] = useState(null);
  const scrollContainerRef = useRef(null);
  const loadMoreSentinelRef = useRef(null);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);
  // 创作资产历史改为页面内本地 state，与创作页共享 store 解耦：
  // 避免资产库拉取全部创作历史（不带 exclude_hidden）后回灌共享 store，
  // 否则会把创作页已「清空」的记录重新写回。收藏状态仍复用共享 store。
  const [creationGenerationsByTab, setCreationGenerationsByTab] = useState({ image: [], video: [], dubbing: [] });
  const [creationHistoryMeta, setCreationHistoryMeta] = useState({
    image:   { page: 0, hasMore: true, loading: false, initialized: false },
    video:   { page: 0, hasMore: true, loading: false, initialized: false },
    dubbing: { page: 0, hasMore: true, loading: false, initialized: false },
  });
  // 始终指向最新本地 state，供 loadHistoryPage 同步读取（对应原 useCreationStore.getState()）
  const creationGenerationsRef = useRef(creationGenerationsByTab);
  const creationHistoryMetaRef = useRef(creationHistoryMeta);
  const historyRequestTabsRef = useRef(new Set());
  const favorites = useCreationStore((s) => s.favorites);
  const storeToggleFavorite = useCreationStore((s) => s.toggleFavorite);
  const storeSyncFavorites = useCreationStore((s) => s.syncFavorites);

  // 与 CreationPage 共用同一套历史字段口径；下载命名另由纯适配工具统一处理。
  function normalizeHistoryItem(item, type) {
    const id = `history-${item.id}`;
    // 视频、音频接口字段与图片接口字段不完全一致，统一成卡片可消费的媒体地址。
    const rawUrl = type === 'video'
      ? (item.video_url || item.videoUrl || item.preview_video_url || item.previewVideoUrl || item.original_url || item.file_url || item.url || '')
      : type === 'audio'
        ? (item.audio_url || item.audioUrl || item.original_url || item.file_url || item.url || '')
        : (item.preview_url || item.previewUrl || item.reference_frame_url || item.referenceFrameUrl || item.original_url || item.originalUrl || item.download_url || item.downloadUrl || item.thumbnail_url || item.thumbnailUrl || item.file_url || item.fileUrl || item.url || '');
    const url = normalizeImageUrl(rawUrl) || rawUrl;
    const referenceImages = item.reference_images
      || item.referenceImages
      || item.reference_image_urls
      || item.referenceImageUrls
      || (item.asset_bindings || item.assetBindings || [])
        .filter((binding) => binding?.asset_type === 'image' || binding?.assetType === 'image');
    const refImages = referenceImages.map((img) => {
      const imgUrl = typeof img === 'string'
        ? img
        : (img?.preview_url || img?.previewUrl || img?.url || img?.original_url || img?.originalUrl || '');
      return {
        url: imgUrl,
        previewUrl: imgUrl,
        isAsset: true,
        name: img?.name || imgUrl.split('/').pop() || 'ref.png',
        size: 0,
        role: img?.role || img?.assetRole || '',
      };
    }).filter((img) => img.url);
    const firstFrame = item.first_frame_url || item.firstFrameUrl || '';
    const lastFrame = item.last_frame_url || item.lastFrameUrl || '';
    const createdAt = item.created_at || new Date().toISOString();
    const refMode = item.ref_mode || item.refMode || item.reference_mode || item.referenceMode || item.generation_mode || '';
    const refModeLabel = item.reference_mode_label || item.referenceModeLabel || '';
    const sound = item.sound ?? item.with_audio ?? item.withAudio;
    const metadata = item.metadata_json || item.metadataJson || item.metadata || {};
    const voiceName = item.voice_name || item.voiceName || metadata.voice_name || metadata.voiceName || '';
    const voiceId = item.voice_id || item.voiceId || metadata.voice_id || metadata.voiceId || '';
    const speed = item.speed ?? metadata.speed;
    const pitch = item.pitch ?? metadata.pitch;
    const volume = item.volume ?? metadata.volume;
    const advancedEnabled = item.advanced_mode_enabled
      ?? item.advanced_enabled
      ?? item.advancedEnabled
      ?? metadata.advanced_mode_enabled
      ?? metadata.advanced_enabled
      ?? metadata.advancedEnabled;
    return {
      id,
      backendId: item.id,
      ratio: item.ratio || item.aspect_ratio || '16:9',
     resolution: item.resolution || item.size || '',
     duration: item.duration || undefined,
     model: item.model || '',
     voiceName,
     voiceId,
     speed,
     pitch,
     volume,
     advancedEnabled,
     input_prompt: item.input_prompt || item.inputPrompt || '',
     prompt: item.prompt || item.input_prompt || item.inputPrompt || '',
     refImages,
     refMode,
     refModeLabel,
     firstFrame,
     lastFrame,
     sound,
     createdAt,
      cards: [{
        id: item.id,
        assetId: item.asset_id || item.assetId || item.image?.asset_id || item.image?.assetId || null,
        type,
        status: 'done',
        imageUrl: type === 'image' ? url : null,
        originalUrl: type === 'image' ? (normalizeImageUrl(item.download_url || item.downloadUrl || item.original_url || item.originalUrl || item.file_url || item.fileUrl || url) || url) : null,
        videoUrl: type === 'video' ? url : null,
        audioUrl: type === 'audio' ? url : null,
        prompt: item.prompt || item.input_prompt || item.inputPrompt || '',
        model: item.model || '',
        voiceName,
        voiceId,
        speed,
        pitch,
        volume,
        advancedEnabled,
        ratio: item.ratio || item.aspect_ratio || '16:9',
        resolution: item.resolution || item.size || '',
        duration: item.duration || undefined,
        refImages,
        refMode,
        refModeLabel,
        firstFrame,
        lastFrame,
        sound,
        createdAt,
        isFavorite: item.is_favorite ?? item.is_liked ?? item.isLiked ?? false,
      }],
    };
  }

  function getCreativeMediaAliases(generation) {
    const card = generation?.cards?.[0];
    return getCreationAssetMediaAliases(card);
  }

  function openAudioDetail(card) {
    setAudioDetail(card);
    const audioId = card.backendId || card.audioId || card.id;
    if (!audioId) return;
    apiGetCreationAudio(audioId).then((detail) => {
      setAudioDetail((current) => {
        const currentAudioId = current?.backendId || current?.audioId || current?.id;
        return current && String(currentAudioId) === String(audioId)
          ? normalizeCreationAudioDetail(detail, current)
          : current;
      });
    }).catch((error) => {
      console.warn('[AssetsCreativePanel] 获取创作音频详情失败，保留列表详情:', error);
    });
  }

  // 根据视口计算首屏所需条数
  // 创作资产卡片：图片/视频/配音均为 16:9 网格卡片，gap 16，左右 padding 32
  function calcCreativePageSize() {
    const NAV_W = 48;
    const MODULE_TAB_H = 48; // 模块切换 tab 栏
    const FILTER_TAB_H = 48; // 图片/视频/配音 tab 栏
    const CARD_W = 320;
    const CARD_H = 180;
    const GAP = 16;
    const PAD_X = 32;
    const availW = window.innerWidth - NAV_W - PAD_X * 2;
    const availH = window.innerHeight - MODULE_TAB_H - FILTER_TAB_H;
    const cols = Math.max(1, Math.floor((availW + GAP) / (CARD_W + GAP)));
    const rows = Math.max(1, Math.ceil(availH / (CARD_H + GAP))) + 1;
    return cols * rows;
  }

  useEffect(() => {
    creationGenerationsRef.current = creationGenerationsByTab;
  }, [creationGenerationsByTab]);

  useEffect(() => {
    creationHistoryMetaRef.current = creationHistoryMeta;
  }, [creationHistoryMeta]);

  const loadHistoryPage = useCallback(async (tab) => {
    if (!isLoggedIn) return;
    const meta = creationHistoryMetaRef.current[tab];
    if (meta.loading || !meta.hasMore || historyRequestTabsRef.current.has(tab)) return;

    historyRequestTabsRef.current.add(tab);
    setCreationHistoryMeta((prev) => ({ ...prev, [tab]: { ...prev[tab], loading: true } }));
    const nextPage = meta.page + 1;
    const pageSize = calcCreativePageSize();

    try {
      let resp;
      if (tab === 'image') {
        // 资产库不传 exclude_hidden，保持「可见全部创作资产」的既有口径
        resp = await apiListCreationImages({ page: nextPage, page_size: pageSize });
      } else if (tab === 'video') {
        resp = await apiListCreationVideos({ page: nextPage, page_size: pageSize });
      } else {
        resp = await apiListCreationAudios({ page: nextPage, page_size: pageSize });
      }

      const type = tab === 'dubbing' ? 'audio' : tab;
      const rawList = Array.isArray(resp) ? resp : (resp?.list ?? resp?.items ?? resp?.data ?? []);
      const explicitHasMore = resp?.has_more ?? resp?.hasMore;
      const hasMore = explicitHasMore !== undefined
        ? Boolean(explicitHasMore)
        : rawList.length >= pageSize;
      // 资产库接口可能为同一媒体返回不同 ID 的多条记录，不能只按后端 ID 去重。
      const list = dedupeCreationHistoryList(rawList, type);
      const normalized = list.map((item) => normalizeHistoryItem(item, type));
      // 合并到本地创作资产列表：按卡片 ID 或媒体地址去重，重复时保留非空提示词。
      const existing = creationGenerationsRef.current[tab] ?? [];
      const existingCardIds = new Set(
        existing.flatMap((g) => g.cards.map((c) => c.id).filter(Boolean))
      );
      const existingMediaKeys = new Map();
      existing.forEach((generation, index) => {
        getCreativeMediaAliases(generation).forEach((key) => existingMediaKeys.set(key, index));
      });
      const toAdd = [];
      const mergedExisting = existing.map((generation) => ({
        ...generation,
        cards: generation.cards.map((card) => ({ ...card })),
      }));
      normalized.forEach((generation) => {
        const card = generation.cards[0];
        const mediaKeys = getCreativeMediaAliases(generation);
        const existingIndex = card?.id && existingCardIds.has(card.id)
          ? mergedExisting.findIndex((item) => item.cards.some((existingCard) => existingCard.id === card.id))
          : mediaKeys.map((key) => existingMediaKeys.get(key)).find((index) => index !== undefined);
        if (existingIndex == null || existingIndex < 0) {
          toAdd.push(generation);
          return;
        }
        const current = mergedExisting[existingIndex];
        mergedExisting[existingIndex] = {
          ...current,
          prompt: current.prompt || generation.prompt || '',
          input_prompt: current.input_prompt || generation.input_prompt || '',
          model: current.model || generation.model || '',
          cards: current.cards.map((existingCard, cardIndex) => cardIndex === 0
            ? {
                ...existingCard,
                ...card,
                id: card.id || existingCard.id,
                assetId: card.assetId || existingCard.assetId || null,
              }
            : existingCard),
        };
      });
      const additions = [...toAdd].reverse();
      // 分页响应与已有列表都要再做一次全量合并，覆盖跨页、缓存和别名交叉形成的重复。
      const mergedGens = dedupeByMediaAliases(
        [...additions, ...mergedExisting],
        getCreativeMediaAliases,
        (previous, current) => ({
          ...previous,
          prompt: previous.prompt || current.prompt || '',
          input_prompt: previous.input_prompt || current.input_prompt || '',
          model: previous.model || current.model || '',
          cards: previous.cards.map((existingCard, cardIndex) => cardIndex === 0
            ? { ...existingCard, ...current.cards?.[0], id: existingCard.id || current.cards?.[0]?.id, assetId: existingCard.assetId || current.cards?.[0]?.assetId || null }
            : existingCard),
        }),
      );
      setCreationGenerationsByTab((prev) => ({
        ...prev,
        [tab]: mergedGens,
      }));

      // 同步收藏状态
      const latestGens = mergedGens;
      const syncItems = [];
      for (const gen of latestGens) {
        for (let i = 0; i < gen.cards.length; i++) {
          const card = gen.cards[i];
          if (card.isFavorite !== undefined) {
            syncItems.push({ key: `${gen.id}-${i}`, isFavorite: card.isFavorite });
          }
        }
      }
      if (syncItems.length > 0) storeSyncFavorites(syncItems);

      setCreationHistoryMeta((prev) => ({
        ...prev,
        [tab]: { ...prev[tab], page: nextPage, hasMore, loading: false, initialized: true },
      }));
    } catch {
      setCreationHistoryMeta((prev) => ({
        ...prev,
        [tab]: { ...prev[tab], loading: false, initialized: true },
      }));
    } finally {
      historyRequestTabsRef.current.delete(tab);
    }
  }, [isLoggedIn, storeSyncFavorites]);

  // 登录后 / 切换 tab 时，若当前 tab 未初始化则拉第一页
  useEffect(() => {
    if (!isLoggedIn) return;
    const meta = creationHistoryMetaRef.current[activeType];
    if (!meta.initialized && !meta.loading) {
      loadHistoryPage(activeType);
    }
  }, [isLoggedIn, activeType, loadHistoryPage]);

  const generations = creationGenerationsByTab[activeType] ?? [];
  const activeHistoryMeta = creationHistoryMeta[activeType];
  const days = generationsToDays(generations).map((day) => favoritesOnly
    ? { ...day, cards: day.cards.filter((card) => favorites.has(card.id)) }
    : day
  ).filter((day) => day.cards.length > 0);

  // 滚动接近底部时继续请求下一页；以面板自身为 root，避免页面外层 overflow 影响触发。
  useEffect(() => {
    const container = scrollContainerRef.current;
    const sentinel = loadMoreSentinelRef.current;
    if (!container || !sentinel || !activeHistoryMeta?.hasMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !creationHistoryMetaRef.current[activeType]?.loading) {
          loadHistoryPage(activeType);
        }
      },
      { root: container, rootMargin: '120px', threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeType, activeHistoryMeta?.hasMore, activeHistoryMeta?.loading, loadHistoryPage]);

  // 首屏数据不足以形成滚动条时主动补页，直到填满视口或服务端返回没有更多数据。
  useEffect(() => {
    if (!activeHistoryMeta?.initialized || activeHistoryMeta.loading || !activeHistoryMeta.hasMore) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const frame = requestAnimationFrame(() => {
      if (container.scrollHeight <= container.clientHeight + 1) {
        loadHistoryPage(activeType);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [activeType, activeHistoryMeta?.hasMore, activeHistoryMeta?.initialized, activeHistoryMeta?.loading, generations.length, loadHistoryPage]);

  function selectAll() {
    const allIds = days.flatMap((d) => d.cards.map((c) => c.id));
    selectAllAssets(allIds);
  }

  async function deleteSelected() {
    const cards = days.flatMap((day) => day.cards);
    const { kind, ids: cardIds } = getCreativeBatchDeleteRequest({
      activeType,
      selectedIds: selected,
      cards,
    });
    const selectedIds = [...selected];
    const selectedCards = cards.filter((card) => selected.has(card.id));
    const missingBackendId = selectedCards.some((card) => !card.backendId);
    if (missingBackendId) {
      showToast('删除失败：部分创作资产缺少真实编号，请刷新后重试', 'error');
      return;
    }
    const deleteRequest = kind === 'image'
      ? apiBatchDeleteImages(cardIds)
      : kind === 'video'
        ? apiBatchDeleteVideos(cardIds)
        : apiBatchDeleteAudios(cardIds);
    try {
      await deleteRequest;
    } catch {
      showToast('删除失败，请刷新后重试', 'error');
      return;
    }

    // 服务端确认成功后再移除本地展示，避免请求失败时刷新页面恢复资产。
    setCreationGenerationsByTab((prev) => {
      const toDelete = {};
      selectedIds.forEach((key) => {
        const lastDash = key.lastIndexOf('-');
        const genId = key.slice(0, lastDash);
        const cardIdx = parseInt(key.slice(lastDash + 1), 10);
        if (!toDelete[genId]) toDelete[genId] = new Set();
        toDelete[genId].add(cardIdx);
      });
      return {
        ...prev,
        [activeType]: prev[activeType]
          .map((gen) => toDelete[gen.id]
            ? { ...gen, cards: gen.cards.filter((_, i) => !toDelete[gen.id].has(i)) }
            : gen)
          .filter((gen) => gen.cards.length > 0),
      };
    });
    exitBatch();
  }

  function toggleStar(cardKey, backendId, cardType) {
    const isLiked = favorites.has(cardKey);
    storeToggleFavorite(cardKey);
    showToast(isLiked ? '取消收藏' : '收藏成功');
    if (!backendId) return;
    const type = cardType || activeType;
    const apiCall = type === 'video'
      ? apiToggleVideoFavorite(backendId, !isLiked)
      : type === 'audio'
        ? apiToggleAudioFavorite(backendId)
        : apiToggleImageFavorite(backendId, !isLiked);
    apiCall.catch(() => storeToggleFavorite(cardKey)); // rollback on failure
  }

  async function deleteSingle(card) {
    const backendId = card.backendId;
    if (!backendId) {
      showToast('删除失败：缺少真实创作资产编号，请刷新后重试', 'error');
      return;
    }
    const deleteRequest = activeType === 'image'
      ? apiDeleteCreationImage(backendId)
      : activeType === 'video'
        ? apiDeleteCreationVideo(backendId)
        : apiDeleteCreationAudio(backendId);
    try {
      await deleteRequest;
    } catch {
      showToast('删除失败，请刷新后重试', 'error');
      return;
    }
    setCreationGenerationsByTab((prev) => ({
      ...prev,
      [activeType]: prev[activeType]
        .map((gen) => gen.id !== card.genId
          ? gen
          : { ...gen, cards: gen.cards.filter((_, i) => i !== card.cardIdx) })
        .filter((gen) => gen.cards.length > 0),
    }));
  }

  function downloadCreativeAsset(card, options) {
    const downloadInfo = getCreativeAssetDownloadInfo(card, options);
    if (!downloadInfo) return Promise.resolve(false);

    const downloadApi = card.type === 'image'
      ? apiDownloadCreationImage
      : card.type === 'video'
        ? apiDownloadCreationVideo
        : apiDownloadCreationAudio;

    // 创作记录必须走鉴权下载接口，避免将已过期的短时媒体链接保存为文件。
    if (card.backendId) {
      return downloadApi(card.backendId)
        .then((blob) => {
          downloadBlob(blob, downloadInfo.filename);
          return true;
        })
        .catch((error) => {
          showToast(error?.message || '下载失败，请稍后重试', 'error');
          return false;
        });
    }
    showToast('下载信息尚未同步，请刷新后重试', 'error');
    return Promise.resolve(false);
  }

  async function downloadSelected() {
    const selectedCards = days
      .flatMap((day) => day.cards)
      .filter((card) => selected.has(card.id));

    for (const card of selectedCards) {
      try {
        await downloadCreativeAsset(card, { batch: true });
      } catch {
        // 单项下载失败时继续处理剩余选中项。
      }
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <AssetsTabBar tabs={CREATIVE_TYPE_TABS} active={activeType} onChange={(k) => { setActiveType(k); exitBatch(); }} />
        <AssetsBatchToolbar
          batchMode={batchMode}
          selectedCount={selectedCount}
          favoritesOnly={favoritesOnly}
          onToggleFavoritesOnly={() => setFavoritesOnly((v) => !v)}
          onEnterBatch={enterBatch}
          onSelectAll={selectAll}
          onDownload={downloadSelected}
          onDelete={() => setBatchDeleteConfirm(true)}
          onCancel={exitBatch}
        />
      </div>

      <div ref={scrollContainerRef} style={{
        flex: 1,
        overflowY: 'auto',
        paddingTop: '16px',
        paddingBottom: '16px',
        paddingLeft: '32px',
        paddingRight: '32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '32px',
        alignItems: days.length === 0 ? 'center' : undefined,
        justifyContent: days.length === 0 ? 'center' : undefined,
      }}>
        {days.length === 0 ? (
          <EmptyCreativeAssets type={activeType} />
        ) : days.map((day) => (
          <div key={day.date} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontFamily: FONT, fontSize: '14px', color: '#FFFFFF99', flexShrink: 0 }}>{day.date}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
              {day.cards.map((card) => {
                const isStarred = favorites.has(card.id);
                return activeType === 'dubbing' ? (
                  <CreationAudioResultCard
                    key={card.id}
                    status="done"
                    audioUrl={card.audioUrl || null}
                    audioId={card.backendId}
                    prompt={card.prompt || ''}
                    batchMode={batchMode}
                    isSelected={batchMode && selected.has(card.id)}
                    onToggleSelect={() => toggleSelect(card.id)}
                    favorited={isStarred}
                    onToggleFavorite={() => toggleStar(card.id, card.backendId, card.type)}
                    onDownload={() => downloadCreativeAsset(card)}
                    onDelete={() => deleteSingle(card)}
                    onCardClick={() => openAudioDetail(card)}
                  />
                ) : (
                  <AssetCard
                    key={card.id}
                    name={card.name}
                    url={card.url || null}
                    starred={isStarred}
                    selected={batchMode && selected.has(card.id)}
                    batchMode={batchMode}
                    showStar
                    onSelect={() => toggleSelect(card.id)}
                    onStar={() => toggleStar(card.id, card.backendId, card.type)}
                    onDownload={() => downloadCreativeAsset(card)}
                    onDelete={() => deleteSingle(card)}
                    asset={card}
                  />
                );
              })}
            </div>
          </div>
        ))}
        <div ref={loadMoreSentinelRef} style={{ width: '100%', height: '1px', flexShrink: 0 }} />
        {activeHistoryMeta?.loading && generations.length > 0 && (
          <div role="status" aria-label="正在加载更多创作资产" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '32px' }}>
            <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid #FFFFFF1A', borderTopColor: '#2DC3E1', animation: 'spin 1s linear infinite' }} />
          </div>
        )}
      </div>
      {/* 批量删除二次确认 */}
      {batchDeleteConfirm && (
        <ConfirmDialog
          title="确定要删除吗？"
          description={`将删除已选中的 ${selected.size} 项创作资产，删除后无法恢复。`}
          confirmText="删除"
          onCancel={() => setBatchDeleteConfirm(false)}
          onConfirm={() => {
            setBatchDeleteConfirm(false);
            deleteSelected();
          }}
          zIndex={100}
        />
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
          onClose={() => setAudioDetail(null)}
          onDownload={() => downloadCreativeAsset(audioDetail)}
          onDelete={() => {
            deleteSingle(audioDetail);
            setAudioDetail(null);
          }}
          favorited={favorites.has(audioDetail.id)}
          onFavorite={() => toggleStar(audioDetail.id, audioDetail.backendId, audioDetail.type)}
        />,
        document.body
      )}
      {toast && createPortal(
        <div style={{
          position: 'fixed', top: '25vh', left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, pointerEvents: 'none',
          animation: 'slideUpBounce 250ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', background: 'rgba(30,30,30,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'nowrap' }}>
            {toast.type === 'success' && (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M8 14.667C11.682 14.667 14.667 11.682 14.667 8C14.667 4.318 11.682 1.333 8 1.333C4.318 1.333 1.333 4.318 1.333 8C1.333 11.682 4.318 14.667 8 14.667Z" fill="#52BF92" stroke="#52BF92" strokeWidth="1.333" strokeLinejoin="round"/><path d="M5.333 8L7.333 10L11.333 6" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round" strokeLinejoin="round"/></svg>
            )}
            {toast.type === 'error' && (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M8 14.667C11.682 14.667 14.667 11.682 14.667 8C14.667 4.318 11.682 1.333 8 1.333C4.318 1.333 1.333 4.318 1.333 8C1.333 11.682 4.318 14.667 8 14.667Z" fill="#F75F5F" stroke="#F75F5F" strokeWidth="1.333" strokeLinejoin="round"/><path d="M5.333 5.333L10.667 10.667M10.667 5.333L5.333 10.667" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round"/></svg>
            )}
            <span style={{ fontSize: '14px', color: '#FFFFFF', fontFamily: FONT }}>{toast.msg}</span>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
