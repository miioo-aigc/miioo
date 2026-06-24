import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useModalSize } from '../utils/useModalSize';
import placeholderFlowers from '../assets/placeholder-flowers.webp';
import { apiGetAssetDetail, apiGetShotDetail, apiGetShotVideoDetail, apiGetProjectAssets, apiGetProjectAssetsPage, groupByCategory, calcProjectAssetsLimit, apiDeleteAsset, apiBatchDeleteAssets, apiUpdateAsset, apiDownloadAsset } from '../api/assets';
import { apiGetSubjects, apiDeleteSubject } from '../api/subject';
import { apiDeleteCreationImage, apiDeleteCreationVideo, apiBatchDeleteImages, apiBatchDeleteVideos, apiToggleImageFavorite, apiToggleVideoFavorite, apiListCreationImages, apiListCreationVideos, apiListCreationAudios } from '../api/creation';
import { useCreationStore } from '../stores/creationStore';
import { generationsToDays } from '../utils/creativeDaysAdapter';
import { apiGetProjects, apiDeleteProject, apiUpdateProject, apiDownloadProjectAssets } from '../api/project';
import { invalidate } from '../utils/cache';
import { K } from '../utils/cacheKeys';
import ImageDetailModal from '../components/ImageDetailModal';
import CreationVideoDetailModal from '../components/CreationVideoDetailModal';
import ConfirmDialog from '../components/ConfirmDialog';
import DownloadIcon from './assets/DownloadIcon';
import TrashIcon from './assets/TrashIcon';
import StarIcon from '../components/StarIcon';
import GhostButton from './assets/GhostButton';
import PlainBtn from './assets/PlainBtn';
import MoreMenu from './assets/MoreMenu';
import WaveformBars from '../components/WaveformBars';
import AudioCard from './assets/AudioCard';
import SubjectAssetDetailModal from './assets/SubjectAssetDetailModal';
import AssetDetailModal from './assets/AssetDetailModal';
import ShotDetailModal from './assets/ShotDetailModal';
import VideoFrameThumbnail from './assets/VideoFrameThumbnail';
import ShotVideoDetailModal from './assets/ShotVideoDetailModal';
import AssetCard from './assets/AssetCard';
import ProjectAssetCard from './assets/ProjectAssetCard';
import TabBar from './assets/TabBar';
import ModuleTabBar from './assets/ModuleTabBar';
import FavFilterCheckbox from './assets/FavFilterCheckbox';
import ProjectListItem from './assets/ProjectListItem';
import { EmptyIconImage, EmptyIconVideo, EmptyIconAudio, EmptyAssetState, categoryToMediaType, EmptyProjectAssets, EmptyCreativeAssets } from './assets/EmptyAssetState';
import ProjectAssetsPanel from './assets/ProjectAssetsPanel';


const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";




// GhostButton — matches design system ghost button style



// DeleteConfirmModal 已迁移至 ConfirmDialog 共享组件




const MOCK_DETAIL = {
  name: '小虎',
  description: '一只雄性成年孟加拉虎，大型健壮体型，肩背宽厚，四肢粗壮，橘黄色短毛，黑色条纹较粗且分布稳定，右眼上方有一道浅色旧疤，颈部一圈深棕色较长鬃毛，头部较大，口鼻宽，尾巴中等长度，站姿平稳。',
  prompt: 'A lone detective walks through a rain-soaked alley at night, neon reflections shimmering on wet cobblestones, cinematic wide shot, shallow depth of field, moody noir atmosphere',
  model: 'Kling 2.1 Pro',
  ratio: '16:9',
  resolution: '1920 × 1080',
  generatedAt: '2026-04-21 15:30:09',
  // index 0 is the finalized image
  images: [
    { id: 'i1', src: placeholderFlowers, finalized: true },
    { id: 'i2', src: placeholderFlowers, finalized: false },
    { id: 'i3', src: placeholderFlowers, finalized: false },
  ],
};

const MOCK_SHOT_DETAIL = {
  shotNumber: '01',
  prompt: 'A lone detective walks through a rain-soaked alley at night, neon reflections shimmering on wet cobblestones, cinematic wide shot, shallow depth of field, moody noir atmosphere',
  model: 'Kling 2.1 Pro',
  resolution: '1920 × 1080',
  generatedAt: '2026-04-21 15:30:09',
  images: [
    { id: 's1', src: placeholderFlowers, finalized: true },
    { id: 's2', src: placeholderFlowers, finalized: false },
    { id: 's3', src: placeholderFlowers, finalized: false },
  ],
};

const MOCK_SHOT_VIDEO_DETAIL = {
  shotNumber: '03',
  prompt: 'A lone detective walks through a rain-soaked alley at night, neon reflections shimmering on wet cobblestones, cinematic wide shot, shallow depth of field, moody noir atmosphere',
  model: 'Kling 2.1 Pro',
  resolution: '1920 × 1080',
  duration: '0:24',
  ratio: '16:9',
  generatedAt: '2026-04-21 15:30:09',
  videoSrc: 'https://www.w3schools.com/html/mov_bbb.mp4',
  frames: [
    { id: 'v1', src: placeholderFlowers, finalized: true },
    { id: 'v2', src: placeholderFlowers, finalized: false },
    { id: 'v3', src: placeholderFlowers, finalized: false },
  ],
};

// 主体资产详情弹窗 — 图片列表（角色/场景/道具的多张图聚合）

// Props: name, description, prompt, model, ratio, resolution, images (array of {id, src, finalized})
// images[0] should be the finalized image; default activeImg = index of first finalized image

// Props: shotNumber, prompt, model, resolution, images (array of {id, src, finalized})




const SUBJECT_CARD_CATEGORIES = new Set(['chars', 'scenes', 'props', 'storyboard_img', 'storyboard_video']);





const MOCK_PROJECTS = [
  { id: 'p1', name: '星际迷途', count: 24 },
  { id: 'p2', name: '暗夜追踪', count: 18 },
  { id: 'p3', name: '光影之间', count: 31 },
  { id: 'p4', name: '未来边界', count: 9 },
];


const CREATIVE_TYPE_TABS = [
  { key: 'image', label: '图片' },
  { key: 'video', label: '视频' },
  { key: 'dubbing', label: '配音' },
];


const MOCK_PROJECT_ASSETS = {
  chars: [
    { id: 'c1', name: '老虎主角', starred: true, bgColor: '#252525' },
    { id: 'c2', name: '老虎姈姈', starred: false, bgColor: '#1F2320' },
    { id: 'c3', name: '老虎弟弟', starred: false, bgColor: '#20201F' },
    { id: 'c4', name: '老虎妹妹', starred: false, bgColor: '#202024' },
    { id: 'c5', name: '小老虎 A', starred: false, bgColor: '#1F2020' },
    { id: 'c6', name: '反派狼', starred: false, bgColor: '#1D2020' },
    { id: 'c7', name: '猎人爷爷', starred: false, bgColor: '#21201D' },
    { id: 'c8', name: '神秘猫咪', starred: false, bgColor: '#1E1E22' },
  ],
  scenes: [
    { id: 's1', name: '森林入口', starred: false, bgColor: '#1A2018' },
    { id: 's2', name: '老虎洞穴', starred: true, bgColor: '#1E2020' },
    { id: 's3', name: '山顶瞭望台', starred: false, bgColor: '#1C1E1A' },
    { id: 's4', name: '村庄广场', starred: false, bgColor: '#201E1A' },
  ],
  props: [
    { id: 'p1', name: '猎人陷阱', starred: false, bgColor: '#201E1A' },
    { id: 'p2', name: '老虎项圈', starred: true, bgColor: '#1E1E22' },
    { id: 'p3', name: '神秘宝箱', starred: false, bgColor: '#1A1E20' },
  ],
  storyboard_img: [
    { id: 'si1', name: '第1集_镜头01', starred: false, bgColor: '#1E2022' },
    { id: 'si2', name: '第1集_镜头02', starred: false, bgColor: '#201E22' },
    { id: 'si3', name: '第1集_镜头03', starred: true, bgColor: '#1E2020' },
    { id: 'si4', name: '第2集_镜头01', starred: false, bgColor: '#22201E' },
    { id: 'si5', name: '第2集_镜头02', starred: false, bgColor: '#1E2220' },
  ],
  storyboard_video: [
    { id: 'sv1', name: '第1集_预览', starred: false, bgColor: '#1A1E24' },
    { id: 'sv2', name: '第2集_预览', starred: false, bgColor: '#1E1A24' },
  ],
  audio: [
    { id: 'au1', name: '主题曲_片头', starred: true, duration: '2:34' },
    { id: 'au2', name: '背景音乐_森林', starred: false, duration: '4:12' },
    { id: 'au3', name: '音效_老虎吼叫', starred: false, duration: '0:08' },
  ],
  final: [
    { id: 'f1', name: '第1集_成片', starred: true, bgColor: '#1A1E22' },
    { id: 'f2', name: '第2集_成片', starred: false, bgColor: '#1E1A22' },
  ],
};



// 图片空状态 — 面性风景图占位

// 视频空状态 — 面性播放器占位

// 音频空状态 — 面性音波占位

// 根据 mediaType 选图标

// category → mediaType 映射



function notifyProjectAssetsDeleted(projectId) {
  if (!projectId) return;
  window.dispatchEvent(new CustomEvent('project-assets:deleted', { detail: { projectId } }));
}


function CreativeAssetsPanel({ isLoggedIn }) {
  const [activeType, setActiveType] = useState('image');
  const [batchMode, setBatchMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [toast, setToast] = useState(null);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);
  const generationsByTab = useCreationStore((s) => s.generationsByTab);
  const favorites = useCreationStore((s) => s.favorites);
  const storeDeleteCard = useCreationStore((s) => s.deleteCard);
  const storeDeleteSelectedCards = useCreationStore((s) => s.deleteSelectedCards);
  const storeToggleFavorite = useCreationStore((s) => s.toggleFavorite);
  const storeConfirmFavoriteToggle = useCreationStore((s) => s.confirmFavoriteToggle);
  const storeRollbackFavoriteToggle = useCreationStore((s) => s.rollbackFavoriteToggle);
  const historyMeta = useCreationStore((s) => s.historyMeta);
  const mergeHistoryGenerations = useCreationStore((s) => s.mergeHistoryGenerations);
  const updateHistoryMeta = useCreationStore((s) => s.updateHistoryMeta);
  const storeSyncFavorites = useCreationStore((s) => s.syncFavorites);

  // 与 CreationPage 共用同一套 normalizeHistoryItem 逻辑
  function normalizeHistoryItem(item, type) {
    const id = `history-${item.id}`;
    const rawUrl = item.original_url || item.file_url || item.url || '';
    return {
      id,
      backendId: item.id,
      ratio: item.ratio || item.aspect_ratio || '16:9',
      resolution: item.resolution || item.size || '',
      duration: item.duration || undefined,
      model: item.model || '',
      prompt: item.prompt || '',
      refImages: (item.reference_images || item.referenceImages || []).map((img) => {
        const imgUrl = typeof img === 'string' ? img : (img?.url || img?.original_url || '');
        return { url: imgUrl, previewUrl: imgUrl, isAsset: true, name: imgUrl.split('/').pop() || 'ref.png', size: 0 };
      }),
      createdAt: item.created_at || new Date().toISOString(),
      cards: [{
        id: item.id,
        type,
        status: 'done',
        imageUrl: type === 'image' ? rawUrl : null,
        videoUrl: type === 'video' ? rawUrl : null,
        audioUrl: type === 'audio' ? rawUrl : null,
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

  const loadHistoryPage = useCallback(async (tab) => {
    if (!isLoggedIn) return;
    const meta = useCreationStore.getState().historyMeta[tab];
    if (meta.loading || !meta.hasMore) return;

    updateHistoryMeta(tab, { loading: true });
    const nextPage = meta.page + 1;
    const pageSize = calcCreativePageSize(tab);

    try {
      let resp;
      if (tab === 'image') {
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
      mergeHistoryGenerations(tab, normalized);

      // 同步收藏状态
      const latestGens = useCreationStore.getState().generationsByTab[tab] ?? [];
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

      updateHistoryMeta(tab, { page: nextPage, hasMore, loading: false, initialized: true });
    } catch {
      updateHistoryMeta(tab, { loading: false, initialized: true });
    }
  }, [isLoggedIn, mergeHistoryGenerations, updateHistoryMeta, storeSyncFavorites]);

  // 登录后 / 切换 tab 时，若当前 tab 未初始化则拉第一页
  useEffect(() => {
    if (!isLoggedIn) return;
    const meta = useCreationStore.getState().historyMeta[activeType];
    if (!meta.initialized && !meta.loading) {
      loadHistoryPage(activeType);
    }
  }, [isLoggedIn, activeType, loadHistoryPage]);

  const generations = generationsByTab[activeType] ?? [];
  const days = generationsToDays(generations);

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    const allIds = days.flatMap((d) => d.cards.map((c) => c.id));
    const isAllSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
    setSelected(isAllSelected ? new Set() : new Set(allIds));
  }

  function deleteSelected() {
    const ids = selected;
    const cardIds = [...ids];
    storeDeleteSelectedCards(activeType, ids);
    if (activeType === 'image') apiBatchDeleteImages(cardIds);
    else if (activeType === 'video') apiBatchDeleteVideos(cardIds);
    setSelected(new Set());
  }

  function toggleStar(cardKey, backendId, cardType) {
    const isLiked = favorites.has(cardKey);
    storeToggleFavorite(cardKey);
    showToast(isLiked ? '取消收藏' : '收藏成功');
    if (!backendId) {
      // No backend ID yet; clear from pending so syncFavorites can take over later
      storeConfirmFavoriteToggle(cardKey);
      return;
    }
    const type = cardType || activeType;
    const apiCall = type === 'video'
      ? apiToggleVideoFavorite(backendId, !isLiked)
      : apiToggleImageFavorite(backendId, !isLiked);
    apiCall
      .then(() => storeConfirmFavoriteToggle(cardKey))
      .catch(() => storeRollbackFavoriteToggle(cardKey));
  }

  function deleteSingle(card) {
    storeDeleteCard(activeType, card.genId, card.cardIdx);
    if (activeType === 'image') apiDeleteCreationImage(card.id);
    else if (activeType === 'video') apiDeleteCreationVideo(card.id);
  }

  function exitBatch() {
    setBatchMode(false);
    setSelected(new Set());
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <TabBar tabs={CREATIVE_TYPE_TABS} active={activeType} onChange={(k) => { setActiveType(k); exitBatch(); }} />
        {batchMode ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingLeft: '24px', paddingRight: '24px', gap: '8px', flex: 1, height: '48px' }}>
            <span style={{ fontFamily: FONT, fontSize: '14px', color: '#FFFFFF99' }}>已选 {selected.size} 项</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <GhostButton onClick={selectAll}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M14 6.667V13C14 13.552 13.552 14 13 14H3C2.448 14 2 13.552 2 13V3C2 2.448 2.448 2 3 2H10" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M5.333 6.667L8.667 9.333L13.667 2.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ fontFamily: FONT, fontSize: '14px', color: '#FFFFFF', whiteSpace: 'nowrap' }}>全选</span>
              </GhostButton>
              <GhostButton onClick={() => {}}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, rotate: '180deg', transformOrigin: '50% 50%' }}>
                  <path d="M8.003 4.7V14" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 8.667L8 4.667L12 8.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 2H12" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ fontFamily: FONT, fontSize: '14px', color: '#FFFFFF', whiteSpace: 'nowrap' }}>下载</span>
              </GhostButton>
              <PlainBtn onClick={() => setBatchDeleteConfirm(true)} danger>
                <TrashIcon color="#F75F5F" />
                <span style={{ fontFamily: FONT, fontSize: '14px', color: '#F75F5F', whiteSpace: 'nowrap' }}>删除</span>
              </PlainBtn>
              <PlainBtn onClick={exitBatch}>
                <span style={{ fontFamily: FONT, fontSize: '14px', color: '#FFFFFFCC', whiteSpace: 'nowrap' }}>取消</span>
              </PlainBtn>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '24px', paddingRight: '24px', height: '48px', flexShrink: 0 }}>
            <GhostButton onClick={() => setBatchMode(true)}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                <path d="M11.333 1.667H2.667C2.114 1.667 1.667 2.114 1.667 2.667V11.333C1.667 11.886 2.114 12.333 2.667 12.333H11.333C11.886 12.333 12.333 11.886 12.333 11.333V2.667C12.333 2.114 11.886 1.667 11.333 1.667Z" stroke="#FFFFFF" strokeLinejoin="round" />
                <path d="M14.667 4.334V14C14.667 14.368 14.368 14.667 14 14.667H4.334" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4.333 6.829L6.333 8.67L9.667 5.24" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ fontFamily: FONT, fontSize: '14px', color: '#FFFFFF', whiteSpace: 'nowrap' }}>批量操作</span>
            </GhostButton>
          </div>
        )}
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
                  <AudioCard
                    key={card.id}
                    name={card.name}
                    duration={card.duration}
                    starred={isStarred}
                    selected={batchMode && selected.has(card.id)}
                    batchMode={batchMode}
                    onSelect={() => toggleSelect(card.id)}
                    onStar={() => toggleStar(card.id, card.backendId, card.type)}
                    onDownload={() => {}}
                    onDelete={() => deleteSingle(card)}
                  />
                ) : (
                  <AssetCard
                    key={card.id}
                    name={card.name}
                    bgColor="#1F2324"
                    url={card.url || null}
                    starred={isStarred}
                    selected={batchMode && selected.has(card.id)}
                    batchMode={batchMode}
                    showStar
                    onSelect={() => toggleSelect(card.id)}
                    onStar={() => toggleStar(card.id, card.backendId, card.type)}
                    onDownload={() => {}}
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

const MODULE_TABS = [
  { key: 'project', label: '项目资产' },
  { key: 'creative', label: '创作资产' },
];

export default function AssetsPage({ projects, isLoggedIn }) {  const [activeModule, setActiveModule] = useState('project');

  return (
    <div style={{
      flex: '1 1 0%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      height: '100%',
      paddingBottom: '24px',
      paddingRight: '24px',
    }}>
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '16px',
        border: '1px solid #FFFFFF14',
        backgroundColor: '#161616',
        overflow: 'hidden',
      }}>
        <ModuleTabBar tabs={MODULE_TABS} active={activeModule} onChange={setActiveModule} />
        {activeModule === 'project' ? <ProjectAssetsPanel /> : <CreativeAssetsPanel isLoggedIn={isLoggedIn} />}
      </div>
    </div>
  );
}
