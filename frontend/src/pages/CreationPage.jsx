import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useModalSize } from '../utils/useModalSize';
import { createPortal } from 'react-dom';
import { PulsingBorder } from '@paper-design/shaders-react';
import { apiGenerateCreation, apiPollVideoTask, apiGetVideoLastFrame, apiDeleteCreationImage, apiDeleteCreationVideo, apiToggleImageFavorite, apiToggleVideoFavorite, apiBatchDeleteImages, apiBatchDeleteVideos, apiCreateSession, apiGetSession, apiListShots, apiCreateShot, apiUpdateShot, apiListCreationImages, apiListCreationVideos, apiListCreationAudios } from '../api/creation';
import { useCreationStore } from '../stores/creationStore';
import { apiListModels } from '../api/config';
import { adaptModels, getModelParams } from '../utils/modelAdapter';
import { normalizeImageUrl } from '../utils/imageUrl';
import AssetPickerModal from '../components/AssetPickerModal';
import DubbingVoiceModal, { DubbingVoiceFileCard } from './DubbingVoiceModal';
import CreationVideoDetailModal from '../components/CreationVideoDetailModal';
import ConfirmDialog from '../components/ConfirmDialog';
import StarIcon from '../components/StarIcon';
import RatioIcon from '../components/RatioIcon';
import DubbingEqIcon from '../components/DubbingEqIcon';
import EmptyIconShell from './creation/EmptyIconShell';
import CreationEmptyIconImage from './creation/CreationEmptyIconImage';
import CreationEmptyIconVideo from './creation/CreationEmptyIconVideo';
import CreationEmptyIconDubbing from './creation/CreationEmptyIconDubbing';
import downloadImage from '../utils/downloadImage';

import UploadMenuItem from '../components/UploadMenuItem';
import GenTypeDropdownItem from '../components/GenTypeDropdownItem';
import DropdownItem from '../components/DropdownItem';
import RefModeDropdownItem from '../components/RefModeDropdownItem';
import CardActionBtn from '../components/CardActionBtn';
import ModalActionBtn from '../components/ModalActionBtn';
import CreationGhostBtn from './creation/CreationGhostBtn';
import CreationPlainBtn from './creation/CreationPlainBtn';
import CopyPromptButton from '../components/CopyPromptButton';
import Toast from '../components/Toast';
import SoundToggle from '../components/SoundToggle';
import CreationTabBar from './creation/CreationTabBar';
import BatchButton from '../components/BatchButton';
import CreationLoginEmptyState from './creation/CreationLoginEmptyState';
import formatMentionLabel from '../utils/formatMentionLabel';
import formatCreationDate from '../utils/formatCreationDate';

import Dropdown from '../components/Dropdown';
import GenTypeSelector from '../components/GenTypeSelector';
import ModelSelector from '../components/ModelSelector';
import ParamsSelector from '../components/ParamsSelector';
import VideoParamsSelector from '../components/VideoParamsSelector';
import RefModeSelector from '../components/RefModeSelector';
import DubbingAdjust from '../components/DubbingAdjust';
import UploadPlaceholder from '../components/UploadPlaceholder';
import FrameUploader from '../components/FrameUploader';
import ImageViewModal from '../components/ImageViewModal';
import FilePreviewTooltip from '../components/FilePreviewTooltip';
import FileCard from '../components/FileCard';
import SendButton from '../components/SendButton';
import isImageFile from '../utils/isImageFile';
import isVideoFile from '../utils/isVideoFile';
import { ALLOWED_EXTS, ALLOWED_IMAGE_EXTS, ALLOWED_VIDEO_EXTS, ALLOWED_AUDIO_EXTS, ALLOWED_MEDIA_EXTS } from '../utils/fileTypes';
import InputCard from '../components/InputCard';
import CreationResultState from './creation/CreationResultState';
import CreationEmptyState from './creation/CreationEmptyState';


const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";


export default function CreationPage({ isLoggedIn, onLoginClick, apiConfigured = true, onShowNoModelNotice }) {  const [activeTab, setActiveTab] = useState('image');
  const [genType, setGenType] = useState('image');
  const [generating, setGenerating] = useState(false); // kept for isGenerating prop (skeleton)
  const [activeCountByTab, setActiveCountByTab] = useState({ image: 0, video: 0, dubbing: 0 });
  const incrementActive = (tab) => setActiveCountByTab(prev => ({ ...prev, [tab]: (prev[tab] || 0) + 1 }));
  const decrementActive = (tab) => setActiveCountByTab(prev => ({ ...prev, [tab]: Math.max(0, (prev[tab] || 0) - 1) }));
  const {
    generationsByTab, addGeneration, deleteCard: storeDeleteCard, deleteGeneration: storeDeleteGeneration, deleteSelectedCards,
    updateCardIds: storeUpdateCardIds, syncFavorites: storeSyncFavorites,
    favorites, toggleFavorite: storeToggleFavorite,
    confirmFavoriteToggle: storeConfirmFavoriteToggle,
    rollbackFavoriteToggle: storeRollbackFavoriteToggle,
    historyMeta, mergeHistoryGenerations, updateHistoryMeta,
  } = useCreationStore();
  const generations = generationsByTab[activeTab] ?? [];

  // Toast state
  const [toasts, setToasts] = useState([]);
  const showToast = (type, message) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  };


  // Session state for backend persistence
  const SESSION_KEY = 'miioo_creation_session_id';
  const sessionIdRef = _sessionIdRef;
  const sessionInitRef = _sessionInitRef;
  // Prevent duplicate restored shots on re-mount
  const restoredShotIdsRef = _restoredShotIdsRef;

  // ── 历史数据加载 ──────────────────────────────────────────────────────────────
  // 将后端返回的 image/video/audio 列表项转换为 generation 格式
  function normalizeHistoryItem(item, type) {
    const id = `history-${item.id}`;

    // video 类型优先取 video_url/videoUrl，图片/音频沿用 original_url/file_url/url
    const rawUrl =
      type === 'video'
        ? (item.video_url || item.videoUrl || item.preview_video_url || item.previewVideoUrl || item.original_url || item.file_url || item.url || '')
        : (item.original_url || item.file_url || item.url || item.thumbnail_url || item.thumbnailUrl || '');
    const url = normalizeImageUrl(rawUrl) || '';

    // 图片类型单独保存缩略图（仅用于低流量预览），原图用于展示和下载
    const rawThumbUrl = type === 'image'
      ? (item.thumbnail_url || item.thumbnailUrl || rawUrl)
      : '';
    const thumbnailUrl = normalizeImageUrl(rawThumbUrl) || url;

    // video 类型从 asset_bindings 提取参考图（首帧/尾帧等），其他类型沿用 reference_images
    const assetBindings = item.asset_bindings || item.assetBindings || [];
    const refImages =
      type === 'video'
        ? assetBindings
            .filter((b) => b.asset_type === 'image')
            .map((b) => {
              const imgUrl = b.preview_url || b.previewUrl || b.url || '';
              const normalized = normalizeImageUrl(imgUrl) || imgUrl;
              return { url: normalized, previewUrl: normalized, isAsset: true, name: b.asset_name || 'ref.png', size: 0 };
            })
        : (item.reference_images || item.referenceImages || []).map((img) => {
            const imgUrl = typeof img === 'string' ? img : (img?.url || img?.original_url || '');
            const normalized = normalizeImageUrl(imgUrl) || imgUrl;
            return { url: normalized, previewUrl: normalized, isAsset: true, name: normalized.split('/').pop() || 'ref.png', size: 0 };
          });

    // poster：视频封面图
    const posterUrl = normalizeImageUrl(item.poster_url || item.posterUrl || '') || undefined;

    return {
      id,
      backendId: item.id,
      ratio: item.ratio || item.aspect_ratio || '16:9',
      resolution: item.resolution || item.size || '',
      duration: item.duration || undefined,
      model: item.model || '',
      prompt: item.prompt || '',
      refImages,
      createdAt: item.created_at || new Date().toISOString(),
      cards: [{
        id: item.id,
        type,
        status: 'done',
        imageUrl: type === 'image' ? url : null,
        originalUrl: type === 'image' ? url : null,      // 原图，用于展示和下载
        thumbnailUrl: type === 'image' ? thumbnailUrl : null, // 缩略图（备用）
        videoUrl: type === 'video' ? url : null,
        audioUrl: type === 'audio' ? url : null,
        posterUrl: type === 'video' ? posterUrl : undefined,
        isFavorite: item.is_favorite ?? item.is_liked ?? item.isLiked ?? false,
      }],
    };
  }

  // 拉取一页历史数据，自动填满视口逻辑由 CreationResultState 触发
  const loadHistoryPage = useCallback(async (tab) => {
    if (!isLoggedIn) return;
    const meta = useCreationStore.getState().historyMeta[tab];
    if (meta.loading || !meta.hasMore) return;

    updateHistoryMeta(tab, { loading: true });
    const nextPage = meta.page + 1;
    const PAGE_SIZE = 18; // 比默认9大，保证大屏填满

    try {
      let resp;
      if (tab === 'image') {
        resp = await apiListCreationImages({ page: nextPage, page_size: PAGE_SIZE });
      } else if (tab === 'video') {
        resp = await apiListCreationVideos({ page: nextPage, page_size: PAGE_SIZE });
      } else {
        resp = await apiListCreationAudios({ page: nextPage, page_size: PAGE_SIZE });
      }

      const type = tab === 'dubbing' ? 'audio' : tab;
      const list = Array.isArray(resp) ? resp : (resp?.list ?? resp?.items ?? resp?.data ?? []);
      const hasMore = list.length >= PAGE_SIZE;

     const normalized = list.map((item) => normalizeHistoryItem(item, type));
     mergeHistoryGenerations(tab, normalized);

      // 同步后端收藏状态到本地 favorites Set
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
      if (syncItems.length > 0) {
        storeSyncFavorites(syncItems);
      }

     updateHistoryMeta(tab, { page: nextPage, hasMore, loading: false, initialized: true });
    } catch (err) {
      console.error('[CreationPage] 历史数据加载失败:', err);
      updateHistoryMeta(tab, { loading: false, initialized: true });
    }
  }, [isLoggedIn, mergeHistoryGenerations, updateHistoryMeta, storeSyncFavorites]);

  // 登录后 / 切换 tab 时，若当前 tab 未初始化则拉第一页
  useEffect(() => {
    if (!isLoggedIn) return;
    const meta = historyMeta[activeTab];
    if (!meta.initialized && !meta.loading) {
      loadHistoryPage(activeTab);
    }
  }, [isLoggedIn, activeTab]);

  // Video detail modal state

  // Session init: create or resume backend session when logged in
  // 注意：shot 历史数据现在由 apiListCreationImages/Videos/Audios 提供，不再从 apiListShots 恢复
  useEffect(() => {
    if (!isLoggedIn || sessionInitRef.current) return;
    sessionInitRef.current = true;

    const initSession = async () => {
      try {
        let sid = sessionIdRef.current;
        if (sid) {
          try { await apiGetSession(sid); } catch { sid = null; }
        }
        if (!sid) {
          const now = new Date();
          const pad = (n) => String(n).padStart(2, '0');
          const title = `创作 - ${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
          const session = await apiCreateSession({ title });
          sid = session.id;
          sessionIdRef.current = sid;
          localStorage.setItem(SESSION_KEY, sid);
        } else if (sid !== sessionIdRef.current) {
          sessionIdRef.current = sid;
          localStorage.setItem(SESSION_KEY, sid);
        }
      } catch { /* session init fails silently; local-only mode */ }
    };
    initSession();
  }, [isLoggedIn]);

  // 刷新恢复：检测 localStorage 中未完成的视频任务，重建占位卡片并继续轮询
  useEffect(() => {
    let pending;
    try {
      pending = JSON.parse(localStorage.getItem(PENDING_VIDEO_TASKS_KEY) || '[]');
    } catch {
      pending = [];
    }
    if (!pending.length) return;

    // 清掉已恢复的，避免重复
    localStorage.setItem(PENDING_VIDEO_TASKS_KEY, JSON.stringify([]));

    pending.forEach((task) => {
      const { taskId, genId, shotId, tab, prompt, promptHTML, model, ratio, resolution, duration, createdAt } = task;

      // 先删除 store 中可能残留的同 genId 旧条目（Zustand store 是内存单例，页面导航不清空）
      storeDeleteGeneration(tab, genId);

      // 重建占位卡片
      addGeneration(tab, {
        id: genId,
        shot_id: shotId || undefined,
        ratio,
        resolution,
        duration,
        model,
        prompt,
        promptHTML: promptHTML || '',
        refImages: [],
        createdAt,
        cards: [{ id: null, type: 'video', status: 'loading', imageUrl: null, videoUrl: null, audioUrl: null }],
      });
      incrementActive('video');

      // 重新轮询
      apiPollVideoTask(taskId)
        .then(({ videos, cardIds }) => {
          const mediaUrls = (videos || []).map((u) => normalizeImageUrl(u) || u);
          if (!mediaUrls.length) {
            showToast('error', '生成失败，请稍后重试');
            storeDeleteGeneration(tab, genId);
            return;
          }
          storeDeleteGeneration(tab, genId);
          addGeneration(tab, {
            id: genId,
            shot_id: shotId || undefined,
            ratio, resolution, duration, model, prompt,
            promptHTML: promptHTML || '',
            refImages: [],
            createdAt,
            cards: mediaUrls.map((url) => ({
              id: null, type: 'video', status: 'done',
              imageUrl: null, videoUrl: url, audioUrl: null,
            })),
          });
          if (cardIds?.length) storeUpdateCardIds(tab, genId, cardIds);
          // 写回 localStorage（此时任务已完成，不需要重新存）
        })
        .catch((err) => {
          showToast('error', err?.message || '生成失败，请稍后重试');
          storeDeleteGeneration(tab, genId);
        })
        .finally(() => {
          decrementActive('video');
        });
    });
  // 只在挂载时执行一次
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [videoDetailModal, setVideoDetailModal] = useState(null);

  // Toggle favorite with API linkage (optimistic update + rollback on failure)
  function handleToggleFavorite(cardKey) {
    const wasFav = favorites.has(cardKey);
    // Optimistically update local state first
    storeToggleFavorite(cardKey);
    showToast('success', wasFav ? '取消收藏' : '收藏成功');
    // Find the card to get its backend ID and type
    const lastDash = cardKey.lastIndexOf('-');
    const genId = cardKey.slice(0, lastDash);
    const cardIdx = parseInt(cardKey.slice(lastDash + 1));
    const gen = generationsByTab[activeTab]?.find((g) => g.id === genId);
    const card = gen?.cards?.[cardIdx];
    if (card?.id) {
      const apiCall = card.type === 'video'
        ? apiToggleVideoFavorite(card.id, !wasFav)
        : apiToggleImageFavorite(card.id, !wasFav);
      apiCall
        .then(() => storeConfirmFavoriteToggle(cardKey))
        .catch(() => storeRollbackFavoriteToggle(cardKey));
    } else {
      storeConfirmFavoriteToggle(cardKey);
    }
  }

  // Models and params are backend-driven; loaded on genType change and model change
  const [modelOptions, setModelOptions] = useState([]);
  const [model, setModel] = useState('');
  const [creationParams, setCreationParams] = useState(null);
  const capabilitiesMapRef = useRef({});

  const [batchMode, setBatchMode] = useState(false);
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);
  const [selected, setSelected] = useState(new Set());

  // Load model list from backend (fallback to local config) when genType changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const models = await apiListModels({ category: genType === 'dubbing' ? 'voice' : genType });
        const { modelOptions: opts, capabilitiesMap } = adaptModels(models, genType);
        if (cancelled) return;
        capabilitiesMapRef.current = capabilitiesMap;
        setModelOptions(opts);
        // 优先使用用户在 API 配置中设置的默认模型（is_default: true），
        // 若未设置则回退到列表第一个
        const defaultFromConfig = Array.isArray(models)
          ? models.find((m) => m.is_default && m.is_enabled && opts.some((o) => o.value === m.model_id))
          : null;
        setModel(defaultFromConfig?.model_id ?? opts[0]?.value ?? '');
      } catch {
        if (cancelled) return;
        const { modelOptions: opts, capabilitiesMap } = adaptModels([], genType);
        capabilitiesMapRef.current = capabilitiesMap;
        setModelOptions(opts);
        setModel(opts[0]?.value ?? '');
      }
    })();
    return () => { cancelled = true; };
  }, [genType]);

  // Load params when model changes (backend-first, local fallback)
  useEffect(() => {
    if (!model) return;
    const params = getModelParams(genType, model, capabilitiesMapRef.current);
    setCreationParams(params);
  }, [genType, model]);

  // 切换到首尾帧模式的回调
  const handleSwitchToFrameMode = () => {
    if (genType === 'video' && creationParams?.refModes) {
      const frameMode = creationParams.refModes.find((m) => m.value === 'frame');
      if (frameMode) {
        // 这里不需要手动设置 refMode，因为 InputCard 内部会通过 creationParams.defaults 或 refModes[0] 自动设置
        // 但我们需要确保用户看到的是首尾帧模式，所以这里不做任何操作
        // prefillData 中的 firstFrameFile 会在 InputCard 的 useEffect 中被应用
      }
    }
  };

  // Tab 和 genType 完全对应，切一个另一个跟着变
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setGenType(tab);
    setBatchMode(false);
    setSelected(new Set());
  };
  const handleGenTypeChange = (type) => {
    setGenType(type);
    setActiveTab(type);
    setBatchMode(false);
    setSelected(new Set());
  };

  function exitBatch() {
    setBatchMode(false);
    setSelected(new Set());
  }

  function selectAll() {
    const allDoneKeys = [...generations].reverse().flatMap((gen) =>
      gen.cards.map((card, i) => ({
        key: `${gen.id}-${i}`,
        isDone: card.status === 'done' && (!!card.imageUrl || !!card.videoUrl)
      }))
    ).filter(({ isDone }) => isDone).map(({ key }) => key);
    const isAllSelected = allDoneKeys.length > 0 && allDoneKeys.every((k) => selected.has(k));
    setSelected(isAllSelected ? new Set() : new Set(allDoneKeys));
  }

  function deleteSelected() {
    // Collect backend IDs by type for API calls
    const imageIds = [];
    const videoIds = [];
    selected.forEach((key) => {
      const lastDash = key.lastIndexOf('-');
      const genId = key.slice(0, lastDash);
      const cardIdx = parseInt(key.slice(lastDash + 1));
      const gen = generationsByTab[activeTab]?.find((g) => g.id === genId);
      const card = gen?.cards?.[cardIdx];
      if (card?.id) {
        if (card.type === 'video') videoIds.push(card.id);
        else imageIds.push(card.id);
      }
    });
    // Call backend APIs
    if (imageIds.length > 0) apiBatchDeleteImages(imageIds).catch(() => {});
    if (videoIds.length > 0) apiBatchDeleteVideos(videoIds).catch(() => {});
    // Update local store
    deleteSelectedCards(activeTab, selected);
    setSelected(new Set());
  }

  function downloadSelected() {
    [...generations].reverse().forEach((gen) => {
      gen.cards.forEach((card, i) => {
        const key = `${gen.id}-${i}`;
        if (selected.has(key)) {
          if (card.imageUrl) downloadImage(card.originalUrl || card.imageUrl);
          if (card.audioUrl && !card.imageUrl && !card.videoUrl) {
            const a = document.createElement('a');
            a.href = card.audioUrl;
            a.download = 'dubbing.wav';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }
          if (card.videoUrl) {
            // 下载视频
            fetch(card.videoUrl)
              .then((res) => res.blob())
              .then((blob) => {
                const objUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = objUrl;
                a.download = 'creation.mp4';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(objUrl);
              })
              .catch(() => window.open(card.videoUrl, '_blank'));
          }
        }
      });
    });
  }

  function toggleSelect(key) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const handleDeleteCard = (genId, cardIdx) => {
    const gen = generationsByTab[activeTab]?.find((g) => g.id === genId);
    const card = gen?.cards?.[cardIdx];
    if (card?.id) {
      if (card.type === 'video') {
        apiDeleteCreationVideo(card.id).catch(() => {});
      } else {
        apiDeleteCreationImage(card.id).catch(() => {});
      }
    }
    storeDeleteCard(activeTab, genId, cardIdx);
  };

  const handleGenerate = async (params) => {
    setGenerating(true);
    incrementActive(params.genType === 'video' ? 'video' : params.genType === 'dubbing' ? 'dubbing' : 'image');
    // Parse count: '2张' → 2, fallback to 1
    const countNum = parseInt(params.count) || 1;
    let shotId = null;

    // Create a backend shot if session is active
    if (isLoggedIn && sessionIdRef.current) {
      try {
        const now = new Date();
        const ts = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const shotTitle = (isVideoGen ? '视频' : '图片') + ' - ' + ts;
        const shot = await apiCreateShot(sessionIdRef.current, {
          title: shotTitle,
          prompt: params.prompt || undefined,
          duration: isVideoGen ? (parseInt(params.videoDuration) || 5) : undefined,
        });
        shotId = shot.id;
        params.session_id = sessionIdRef.current;
        params.shot_id = shotId;
      } catch (e) { /* shot creation fails silently; generation still proceeds */ }
    }
    const genId = `gen-${Date.now()}`;
    const currentTab = activeTab;
    const isVideoGen = params.genType === 'video';
    const isDubbingGen = params.genType === 'dubbing';

    // 立即添加 loading 占位卡片（按数量生成）
    const placeholderCardId = `placeholder-${Date.now()}`;
    addGeneration(currentTab, {
      id: genId,
      shot_id: shotId || undefined,
      ratio: params.ratio || (isVideoGen ? params.videoRatio : '') || '16:9',
      resolution: params.resolution || (isVideoGen ? params.videoResolution : '') || '',
      duration: isVideoGen ? params.videoDuration : undefined,
      model: params.model || '',
      prompt: params.prompt || '',
      promptHTML: params.promptHTML || '',
      refImages: [],
      createdAt: new Date().toISOString(),
      cards: Array.from({ length: isVideoGen || isDubbingGen ? 1 : countNum }, (_, i) => ({
        id: null,
        type: isVideoGen ? 'video' : isDubbingGen ? 'audio' : 'image',
        status: 'loading',
        imageUrl: null,
        videoUrl: null,
        audioUrl: null,
        placeholderId: `${placeholderCardId}-${i}`,
      })),
    });

    try {
      const result = await apiGenerateCreation(params, {
        onTaskCreated: ({ taskId }) => {
          if (params.genType !== 'video') return;
          try {
            const pending = JSON.parse(localStorage.getItem(PENDING_VIDEO_TASKS_KEY) || '[]');
            pending.push({
              taskId,
              genId,
              shotId: shotId || null,
              tab: currentTab,
              prompt: params.prompt || '',
              promptHTML: params.promptHTML || '',
              model: params.model || '',
              ratio: params.ratio || params.videoRatio || '16:9',
              resolution: params.resolution || params.videoResolution || '',
              duration: params.videoDuration || '5s',
              createdAt: new Date().toISOString(),
            });
            localStorage.setItem(PENDING_VIDEO_TASKS_KEY, JSON.stringify(pending));
          } catch {}
        },
      });
      const rawMediaUrls = isVideoGen ? (result.videos ?? []) : isDubbingGen ? (result.audios ?? []) : (result.images ?? []);
      const mediaUrls = rawMediaUrls.map((u) => normalizeImageUrl(u) || u);

      // 如果生成失败，删除占位卡片并回退文本
      if (!mediaUrls || mediaUrls.length === 0) {
        showToast('error', '生成失败，请稍后重试');
        // 删除刚添加的占位卡片
        storeDeleteGeneration(currentTab, genId);
        // 通知 InputCard 回退文本
        params.onFail?.(params.prompt);
        setGenerating(false);
        decrementActive(params.genType === 'video' ? 'video' : params.genType === 'dubbing' ? 'dubbing' : 'image');
        return { success: false };
      }

      const genMeta = {
        prompt: params.prompt || '',
        model: params.model || '',
        ratio: params.ratio || (isVideoGen ? params.videoRatio : '') || '16:9',
        resolution: params.resolution || (isVideoGen ? params.videoResolution : '') || '',
        duration: isVideoGen ? params.videoDuration : undefined,
        createdAt: new Date().toISOString(),
        genType: params.genType || 'image',
      };

      // 更新占位卡片为实际结果（替换而不是新增）
      // 先删除占位卡片
      storeDeleteGeneration(currentTab, genId);
      // 再添加实际结果卡片
      addGeneration(currentTab, {
        id: genId,
        shot_id: shotId || undefined,
        ratio: genMeta.ratio,
        resolution: genMeta.resolution,
        duration: genMeta.duration,
        model: genMeta.model,
        prompt: genMeta.prompt,
        promptHTML: params.promptHTML || '',
        refImages: (result.referenceImages || []).map((url) => ({
          url: normalizeImageUrl(url) || url,
          previewUrl: normalizeImageUrl(url) || url,
          isAsset: true,
          name: (url || '').split('/').pop() || 'ref.png',
          size: 0,
        })),
        createdAt: genMeta.createdAt,
        cards: mediaUrls.map((url) => ({
          id: null,  // 后端 ID，待轮询返回后回写
          type: isVideoGen ? 'video' : isDubbingGen ? 'audio' : 'image',
          status: 'done',
          imageUrl: isDubbingGen ? null : (isVideoGen ? null : url),
          videoUrl: isVideoGen ? url : null,
          audioUrl: isDubbingGen ? url : null,
       })),
     });

      // 回写后端卡片 ID，使收藏功能可用
      if (!isDubbingGen && result.cardIds && result.cardIds.length > 0) {
        storeUpdateCardIds(currentTab, genId, result.cardIds);
      }

     // Update backend shot with result URLs
      if (shotId) {
        try {
          const updateData = {};
          if (isVideoGen && mediaUrls.length > 0) {
            updateData.video_url = mediaUrls[0];
          } else if (!isDubbingGen && mediaUrls.length > 0) {
            updateData.image_url = mediaUrls[0];
          }
          if (Object.keys(updateData).length > 0) {
            await apiUpdateShot(shotId, updateData);
          }
        } catch { /* shot update fails silently */ }
      }
      // 清除 pending task 记录
      try {
        const pending = JSON.parse(localStorage.getItem(PENDING_VIDEO_TASKS_KEY) || '[]');
        const filtered = pending.filter((t) => t.genId !== genId);
        localStorage.setItem(PENDING_VIDEO_TASKS_KEY, JSON.stringify(filtered));
      } catch {}
      return { success: true };
    } catch (error) {
      try {
        const pending = JSON.parse(localStorage.getItem(PENDING_VIDEO_TASKS_KEY) || '[]');
        const filtered = pending.filter((t) => t.genId !== genId);
        localStorage.setItem(PENDING_VIDEO_TASKS_KEY, JSON.stringify(filtered));
      } catch {}
      showToast('error', error?.message || '生成失败，请稍后重试');
      // 删除占位卡片
      storeDeleteGeneration(currentTab, genId);
      // 通知 InputCard 回退文本
      params.onFail?.(params.prompt);
      return { success: false };
    } finally {
      setGenerating(false);
      decrementActive(params.genType === 'video' ? 'video' : params.genType === 'dubbing' ? 'dubbing' : 'image');
    }
  };

  return (
    /*
     * ┌─ Home.jsx 右侧内容区 ──────────────────────────────────────────────────┐
     * │  flex:1, overflow:hidden, position:relative                           │
     * │                                                                        │
     * │  ┌─ CreationPage 最外层 ──────────────────────────────────────────────┐│
     * │  │  flex column, flex:1, overflow:clip, pb:24px pr:24px              ││
     * │  │                                                                    ││
     * │  │  ┌─ rounded card ───────────────────────────────────────────────┐ ││
     * │  │  │  flex column, flex:1, borderRadius:16px, overflow:clip       │ ││
     * │  │  │                                                               │ ││
     * │  │  │  ┌─ top bar (tabs + batch btn) ──────────────────────────┐   │ ││
     * │  │  │  │  flex row, flex-shrink:0, alignSelf:stretch           │   │ ││
     * │  │  │  └───────────────────────────────────────────────────────┘   │ ││
     * │  │  │                                                               │ ││
     * │  │  │  ┌─ content area ────────────────────────────────────────┐   │ ││
     * │  │  │  │  flex column, flex:1, overflow:clip                   │   │ ││
     * │  │  │  │                                                        │   │ ││
     * │  │  │  │  ┌─ CreationResultState / CreationEmptyState ───────┐ │   │ ││
     * │  │  │  │  │  flex column, flex:1, minHeight:0                │ │   │ ││
     * │  │  │  │  │                                                   │ │   │ ││
     * │  │  │  │  │  ┌─ 图片滚动区 ──────────────────────────────┐   │ │   │ ││
     * │  │  │  │  │  │  flex:1, minHeight:0, overflowY:auto      │   │ │   │ ││
     * │  │  │  │  │  │  图片超出时在此区域内向上滚动              │   │ │   │ ││
     * │  │  │  │  │  └───────────────────────────────────────────┘   │ │   │ ││
     * │  │  │  │  │                                                   │ │   │ ││
     * │  │  │  │  │  ┌─ InputCard ───────────────────────────────┐   │ │   │ ││
     * │  │  │  │  │  │  flexShrink:0，flow 布局，始终在底部       │   │ │   │ ││
     * │  │  │  │  │  └───────────────────────────────────────────┘   │ │   │ ││
     * │  │  │  │  └─────────────────────────────────────────────────┘ │   │ ││
     * │  │  │  └───────────────────────────────────────────────────────┘   │ ││
     * │  │  └─────────────────────────────────────────────────────────────┘ ││
     * │  └────────────────────────────────────────────────────────────────────┘│
     * └────────────────────────────────────────────────────────────────────────┘
     */
    <>
      <Toast toasts={toasts} />
      {batchDeleteConfirm && (
        <ConfirmDialog
          title="确认删除"
          description="删除后无法恢复，确定要删除这张图片吗？"
          confirmText="删除"
          onConfirm={() => { setBatchDeleteConfirm(false); deleteSelected(); }}
          onCancel={() => setBatchDeleteConfirm(false)}
          zIndex={1100}
        />
      )}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          flexShrink: 1,
          flexBasis: '0%',
          minHeight: 0,
          height: '100%',
          overflow: 'clip',
          alignSelf: 'stretch',
          paddingBottom: '24px',
          paddingRight: '24px',
          fontSize: '12px',
          lineHeight: '16px',
          WebkitFontSmoothing: 'antialiased',
        }}
      >
      {/* rounded card */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          flex: 1,
          minHeight: 0,
          borderRadius: '16px',
          overflow: 'clip',
          alignSelf: 'stretch',
          backgroundColor: '#161616',
          border: '1px solid #FFFFFF14',
        }}
      >
        {/* top bar: tabs + batch button */}
        <div style={{ display: 'flex', flexDirection: 'column', alignSelf: 'stretch', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <CreationTabBar activeTab={activeTab} onChange={handleTabChange} />
            {batchMode ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingLeft: '24px', paddingRight: '32px', gap: '16px', flex: 1, paddingTop: '6px', paddingBottom: '6px' }}>
                <span style={{ fontFamily: FONT, fontSize: '14px', color: '#FFFFFF99' }}>已选 {selected.size} 项</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CreationGhostBtn onClick={selectAll}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                      <path d="M14 6.667V13C14 13.552 13.552 14 13 14H3C2.448 14 2 13.552 2 13V3C2 2.448 2.448 2 3 2H10" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M5.333 6.667L8.667 9.333L13.667 2.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span style={{ fontFamily: FONT, fontSize: '14px', color: '#FFFFFF', whiteSpace: 'nowrap' }}>全选</span>
                  </CreationGhostBtn>
                  <CreationGhostBtn onClick={downloadSelected}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, rotate: '180deg', transformOrigin: '50% 50%' }}>
                      <path d="M8.003 4.7V14" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M4 8.667L8 4.667L12 8.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M4 2H12" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span style={{ fontFamily: FONT, fontSize: '14px', color: '#FFFFFF', whiteSpace: 'nowrap' }}>下载</span>
                  </CreationGhostBtn>
                  <CreationPlainBtn onClick={() => setBatchDeleteConfirm(true)}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                      <path d="M3 3.333V14.667H13V3.333H3Z" stroke="#F75F5F" strokeLinejoin="round" />
                      <path d="M6.667 6.667V11" stroke="#F75F5F" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M9.333 6.667V11" stroke="#F75F5F" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M1.333 3.333H14.667" stroke="#F75F5F" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M5.333 3.333L6.43 1.333H9.592L10.667 3.333H5.333Z" stroke="#F75F5F" strokeLinejoin="round" />
                    </svg>
                    <span style={{ fontFamily: FONT, fontSize: '14px', color: '#F75F5F', whiteSpace: 'nowrap' }}>删除</span>
                  </CreationPlainBtn>
                  <CreationPlainBtn onClick={exitBatch}>
                    <span style={{ fontFamily: FONT, fontSize: '14px', color: '#FFFFFFCC', whiteSpace: 'nowrap' }}>取消</span>
                  </CreationPlainBtn>
                </div>
              </div>

            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, justifyContent: 'flex-end', paddingRight: '24px', paddingTop: '6px', paddingBottom: '6px' }}>
                <BatchButton onClick={() => setBatchMode(true)} />
              </div>
            )}
          </div>
        </div>

        {/* content area */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: '1 1 0%',
            minHeight: 0,
            padding: '0px',
            overflow: 'clip',
            alignSelf: 'stretch',
            position: 'relative',
          }}
        >
          {isLoggedIn === false ? (
            <CreationLoginEmptyState onLoginClick={onLoginClick} />
          ) : generations.length > 0 || historyMeta[activeTab]?.loading ? (
            <CreationResultState
              generations={generations}
              onGenerate={handleGenerate}
              genType={genType}
              onGenTypeChange={handleGenTypeChange}
              model={model}
              onModelChange={setModel}
              modelOptions={modelOptions}
              creationParams={creationParams}
              onDeleteCard={handleDeleteCard}
              batchMode={batchMode}
              selected={selected}
              onToggleSelect={toggleSelect}
              onSwitchToFrameMode={handleSwitchToFrameMode}
              onVideoCardClick={(card) => setVideoDetailModal(card)}
              favorites={favorites}
              toggleFavorite={handleToggleFavorite}
              showToast={showToast}
              historyLoading={historyMeta[activeTab]?.loading}
              historyHasMore={historyMeta[activeTab]?.hasMore}
              onLoadMore={() => loadHistoryPage(activeTab)}
              activeCount={activeCountByTab[genType] ?? 0}
              onBeforeModelOpen={() => {
                if (!apiConfigured) { onShowNoModelNotice?.(); return false; }
              }}
            />
          ) : (
            <CreationEmptyState onGenerate={handleGenerate} genType={genType} onGenTypeChange={handleGenTypeChange} showToast={showToast} activeCount={activeCountByTab[genType] ?? 0}
              model={model} onModelChange={setModel} modelOptions={modelOptions} creationParams={creationParams}
              onBeforeModelOpen={() => {
                if (!apiConfigured) { onShowNoModelNotice?.(); return false; }
              }}
            />
          )}
        </div>
      </div>
    </div>
    {videoDetailModal && createPortal(
      <CreationVideoDetailModal
        videoUrl={videoDetailModal.videoUrl}
        prompt={videoDetailModal.prompt}
        promptHTML={videoDetailModal.promptHTML}
        model={videoDetailModal.model}
        ratio={videoDetailModal.ratio}
        resolution={videoDetailModal.resolution}
        duration={videoDetailModal.duration}
        refMode={videoDetailModal.refMode}
        refImages={videoDetailModal.refImages}
        refVideos={videoDetailModal.refVideos}
        refAudios={videoDetailModal.refAudios}
        createdAt={videoDetailModal.createdAt}
        onClose={() => setVideoDetailModal(null)}
        onDownload={() => {
          fetch(videoDetailModal.videoUrl)
            .then((res) => res.blob())
            .then((blob) => {
              const objUrl = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = objUrl;
              a.download = 'creation.mp4';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(objUrl);
            })
            .catch(() => window.open(videoDetailModal.videoUrl, '_blank'));
        }}
        onDelete={() => {
          handleDeleteCard(videoDetailModal.genId, videoDetailModal.cardIndex);
          setVideoDetailModal(null);
        }}
        favorited={favorites.has(videoDetailModal.key)}
        onFavorite={() => handleToggleFavorite(videoDetailModal.key)}
      />,
      document.body
    )}
    <Toast toasts={toasts} />
      {batchDeleteConfirm && (
        <ConfirmDialog
          title="确认删除"
          description="删除后无法恢复，确定要删除这张图片吗？"
          confirmText="删除"
          onConfirm={() => { setBatchDeleteConfirm(false); deleteSelected(); }}
          onCancel={() => setBatchDeleteConfirm(false)}
          zIndex={1100}
        />
      )}
    </>
  );
}
