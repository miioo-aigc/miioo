import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { apiDeleteCreationImage, apiDeleteCreationVideo, apiBatchDeleteImages, apiBatchDeleteVideos, apiToggleImageFavorite, apiToggleVideoFavorite, apiListCreationImages, apiListCreationVideos, apiListCreationAudios, apiDownloadCreationImage, apiDownloadCreationVideo, apiDownloadCreationAudio } from '../../api/creation';
import { useCreationStore } from '../../stores/creationStore';
import { useAssetSelection } from '../../hooks/useAssetSelection';
import { generationsToDays } from '../../utils/creativeDaysAdapter';
import { normalizeImageUrl } from '../../utils/imageUrl';
import { getCreativeBatchDeleteRequest } from '../../utils/assetsBatchAdapter';
import { downloadMediaUrl } from '../../utils/downloadMediaUrl';
import { downloadBlob } from '../../utils/downloadBlob';
import { getCreativeAssetDownloadInfo } from '../../utils/creativeAssetDownload';
import ConfirmDialog from '../ConfirmDialog';
import { AssetsTabBar } from './AssetsTabs';
import AssetsBatchToolbar from './AssetsBatchToolbar';
import { EmptyCreativeAssets } from './AssetsEmptyState';
import AssetsAudioCard from './AssetsAudioCard';
import { AssetCard } from './AssetsCards';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const CREATIVE_TYPE_TABS = [
  { key: 'image', label: '图片' },
  { key: 'video', label: '视频' },
  { key: 'dubbing', label: '配音' },
];

export default function AssetsCreativePanel({ isLoggedIn }) {
  const [activeType, setActiveType] = useState('image');
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
        : (item.original_url || item.file_url || item.url || item.thumbnail_url || item.thumbnailUrl || '');
    const url = normalizeImageUrl(rawUrl) || rawUrl;
    return {
      id,
      backendId: item.id,
      ratio: item.ratio || item.aspect_ratio || '16:9',
     resolution: item.resolution || item.size || '',
     duration: item.duration || undefined,
     model: item.model || '',
     input_prompt: item.input_prompt || item.inputPrompt || '',
     prompt: item.prompt || item.input_prompt || item.inputPrompt || '',
     refImages: (item.reference_images || item.referenceImages || []).map((img) => {
        const imgUrl = typeof img === 'string' ? img : (img?.url || img?.original_url || '');
        return { url: imgUrl, previewUrl: imgUrl, isAsset: true, name: imgUrl.split('/').pop() || 'ref.png', size: 0 };
      }),
      createdAt: item.created_at || new Date().toISOString(),
      cards: [{
        id: item.id,
        type,
        status: 'done',
        imageUrl: type === 'image' ? url : null,
        originalUrl: type === 'image' ? url : null,
        videoUrl: type === 'video' ? url : null,
        audioUrl: type === 'audio' ? url : null,
        isFavorite: item.is_favorite ?? item.is_liked ?? item.isLiked ?? false,
      }],
    };
  }

  // 根据视口计算首屏所需条数
  // 创作资产卡片：图片/视频 320×180，gap 16，左右 padding 32；配音列表布局直接给 50
  function calcCreativePageSize(tab) {
    if (tab === 'dubbing') return 50;
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
    if (meta.loading || !meta.hasMore) return;

    setCreationHistoryMeta((prev) => ({ ...prev, [tab]: { ...prev[tab], loading: true } }));
    const nextPage = meta.page + 1;
    const pageSize = calcCreativePageSize(tab);

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
      const list = Array.isArray(resp) ? resp : (resp?.list ?? resp?.items ?? resp?.data ?? []);
      const hasMore = list.length >= pageSize;
      const normalized = list.map((item) => normalizeHistoryItem(item, type));
      // 合并到本地创作资产列表（按卡片后端ID去重，后端最新在前则反转后前置）
      const existing = creationGenerationsRef.current[tab] ?? [];
      const existingCardIds = new Set(
        existing.flatMap((g) => g.cards.map((c) => c.id).filter(Boolean))
      );
      const toAdd = normalized.filter((g) =>
        g.cards.every((c) => !c.id || !existingCardIds.has(c.id))
      );
      const mergedGens = toAdd.length > 0 ? [...toAdd.reverse(), ...existing] : existing;
      setCreationGenerationsByTab((prev) => ({ ...prev, [tab]: mergedGens }));

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
  const days = generationsToDays(generations);

  function selectAll() {
    const allIds = days.flatMap((d) => d.cards.map((c) => c.id));
    selectAllAssets(allIds);
  }

  function deleteSelected() {
    const { kind, ids: cardIds } = getCreativeBatchDeleteRequest({
      activeType,
      selectedIds: selected,
    });
    // 仅从本地创作资产列表移除（不回写共享 store），后端已删除；
    // 创作页下次以 exclude_hidden=true 拉取时不会再返回该记录。
    setCreationGenerationsByTab((prev) => {
      const toDelete = {};
      cardIds.forEach((key) => {
        const lastDash = key.lastIndexOf('-');
        const genId = key.slice(0, lastDash);
        const cardIdx = parseInt(key.slice(lastDash + 1), 10);
        if (!toDelete[genId]) toDelete[genId] = new Set();
        toDelete[genId].add(cardIdx);
      });
      return {
        ...prev,
        [activeType]: prev[activeType]
          .map((gen) =>
            toDelete[gen.id]
              ? { ...gen, cards: gen.cards.filter((_, i) => !toDelete[gen.id].has(i)) }
              : gen
          )
          .filter((gen) => gen.cards.length > 0),
      };
    });
    if (kind === 'image') apiBatchDeleteImages(cardIds);
    else if (kind === 'video') apiBatchDeleteVideos(cardIds);
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
      : apiToggleImageFavorite(backendId, !isLiked);
    apiCall.catch(() => storeToggleFavorite(cardKey)); // rollback on failure
  }

  function deleteSingle(card) {
    setCreationGenerationsByTab((prev) => ({
      ...prev,
      [activeType]: prev[activeType]
        .map((gen) =>
          gen.id !== card.genId
            ? gen
            : { ...gen, cards: gen.cards.filter((_, i) => i !== card.cardIdx) }
        )
        .filter((gen) => gen.cards.length > 0),
    }));
    if (activeType === 'image') apiDeleteCreationImage(card.id);
    else if (activeType === 'video') apiDeleteCreationVideo(card.id);
  }

  function downloadCreativeAsset(card, options) {
    const downloadInfo = getCreativeAssetDownloadInfo(card, options);
    if (!downloadInfo) return Promise.resolve(false);

    const downloadApi = card.type === 'image'
      ? apiDownloadCreationImage
      : card.type === 'video'
        ? apiDownloadCreationVideo
        : apiDownloadCreationAudio;

    // 优先走鉴权下载接口，媒体地址下载作为兼容旧数据的回退路径。
    if (card.backendId) {
      return downloadApi(card.backendId)
        .then((blob) => {
          downloadBlob(blob, downloadInfo.filename);
          return true;
        })
        .catch(() => downloadMediaUrl(downloadInfo.url, downloadInfo.filename));
    }
    return downloadInfo.url
      ? downloadMediaUrl(downloadInfo.url, downloadInfo.filename)
      : Promise.resolve(false);
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
          onEnterBatch={enterBatch}
          onSelectAll={selectAll}
          onDownload={downloadSelected}
          onDelete={() => setBatchDeleteConfirm(true)}
          onCancel={exitBatch}
        />
      </div>

      <div style={{
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
            <div style={activeType === 'dubbing' ? { display: 'flex', flexDirection: 'column', gap: '8px' } : { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
              {day.cards.map((card) => {
                const isStarred = favorites.has(card.id);
                return activeType === 'dubbing' ? (
                  <AssetsAudioCard
                    key={card.id}
                    name={card.name}
                    duration={card.duration}
                    starred={isStarred}
                    selected={batchMode && selected.has(card.id)}
                    batchMode={batchMode}
                    onSelect={() => toggleSelect(card.id)}
                    onStar={() => toggleStar(card.id, card.backendId, card.type)}
                    onDownload={() => downloadCreativeAsset(card)}
                    onDelete={() => deleteSingle(card)}
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
            exitBatch();
          }}
          zIndex={100}
        />
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
