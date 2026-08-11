/**
 * @file CreationPage.jsx
 * @structure-index
 *
 * ─── 全局常量与工具函数 ─────────────────────────────── L109–L122
 *   FONT / FONT_MEDIUM、图片下载、动画注入
 *   filenameFromPrompt                                      utils/creationFilename.js
 *   生成类型到任务轮询类型的适配                     utils/creationTaskAdapter.js
 *   文件类型常量与判断工具                               components/creation/CreationFileUtils.js
 *   历史响应、记录标准化与缓存载荷适配                     utils/creationHistoryAdapter.js
 *   刷新任务快照、占位卡片和轮询结果适配                   utils/creationTaskAdapter.js
 *   视频详情 asset_bindings 适配和详情卡片合并                    utils/creationDetailAdapter.js
 *
 * ─── 页面入口与状态编排 ──────────────────────────────── L123–L596
 *   CreationPage 状态、Store、历史缓存和分页                       L123–L268
 *   Session 初始化、刷新任务恢复和收藏动作                           L271–L385
 *   模型能力、参数加载、Tab 和批量操作                               L387–L562
 *   useCreationGeneration 生成请求、占位卡和结果写回                  L562–L577
 *   模型入口检查、输入卡渲染和视频详情回调                            L579–L598
 *   CreationInputCard 已迁移至 components/creation/，页面通过 renderInputCard 显式接入
 *
 * ─── 页面渲染结构 ────────────────────────────────────── L601–L712
 *   CreationPageOverlays（确认弹窗和视频详情 Portal）         components/creation/CreationPageOverlays.jsx
 *   CreationWorkspace（主体卡片、工具栏和结果/空态组合）       components/creation/CreationWorkspace.jsx
 *   CreationToast（Toast 展示）                              components/creation/CreationToast.jsx
 *   handleBeforeModelOpen / renderInputCard                     页面级显式接线辅助
 *   页面只负责区块组合和显式 renderInputCard 接线
 *
 * ─── 页面级副作用边界 ──────────────────────────────────
 *   历史 API、Session、刷新任务恢复、模型/参数加载、轮询、缓存、Toast 和 Store 写回均保留在 CreationPage；
 *   生成 API、占位卡和生成结果写回由 useCreationGeneration 负责，页面通过显式依赖接入。
 *   CreationResultState 负责结果展示、分页触发和结果卡回填；结果卡编辑/尾帧操作所需的详情读取 API 由组件显式调用，页面业务状态和生成编排仍由 CreationPage 持有。
 *   CreationEmptyState 只负责空态展示和 CreationInputCard 的显式渲染接线，不调用 API、Store 或生成请求。
 *   CreationInputSurface 只负责输入卡片布局、悬浮反馈和子组件接线，不拥有生成状态或业务副作用。
 *   CreationInputCard（components/creation/）负责提示词、参数、素材 Hook、弹窗接线和生成请求参数组装；不调用页面 API、Store 或缓存。
 *   useCreationInputFiles 负责 files、首尾帧、模型素材上限、文件切换和 Blob URL 生命周期；
 *   useCreationPromptInteraction 负责 contentEditable、@素材标签、光标、粘贴、预填充和失败恢复；CreationInputCard 负责参数状态、素材弹窗和生成参数组装。
 *   useCreationParamsState 负责参数默认值、比例/分辨率兼容联动、模型能力变化后的参数重置和预填充参数回填；不负责生成 API、任务轮询或页面副作用。
 *   creationHistoryAdapter 只负责历史响应解包、记录标准化和缓存载荷裁剪；不调用 API、Store、缓存或 React 状态。
 *   creationTaskAdapter 只负责刷新任务快照、占位 generation 和轮询结果字段适配；不调用 API、Store、缓存、Toast 或 React 状态。
 *   CreationPageOverlays 只负责确认弹窗和视频详情 Portal 的展示组合；下载、删除、收藏和历史清理通过显式回调回到页面。
 *   creationDetailAdapter 只负责视频详情素材字段转换和轻量卡片合并；不调用 API、Store、缓存或 React 状态。
 *   downloadMediaUrl 只负责媒体 URL 的 Blob 下载和失败回退；页面继续决定文件名和触发时机。
 *
 * ─── 更新记录 ───────────────────────────────────────────
 *   2026-05-28  初始结构索引建立
 *   2026-07-09  新增清空创作历史按钮及后端持久隐藏接口
 *   2026-07-13  修复创作历史刷新、覆盖和排序问题
 *   2026-07-15  迁移工具栏、提示词编辑、上传区、文件卡片、参数选择器和基础按钮
 *   2026-07-16  迁移图片/配音结果卡、CreationResultState 和 CreationEmptyState；同步为当前真实行号
 *   2026-07-16  迁移真人素材弹窗；页面保留 InputCard 状态、弹窗接线和生成编排
 *   2026-07-16  迁移资产选择与配音选择弹窗接线；页面保留素材状态和生成编排
 *   2026-07-16  提取文件类型、容量和模型素材上限适配纯函数；页面继续保留素材状态与副作用
 *   2026-07-16  抽离 useCreationInputFiles，统一素材状态与 Blob URL 生命周期；页面保留生成编排
 *   2026-07-16  抽离 CreationInputOverlays，统一输入区三个弹窗的显式 props 接线
 *   2026-07-16  抽离 useCreationPromptInteraction，统一提示词编辑、@素材标签、粘贴、预填充和失败恢复
 *   2026-07-16  抽离 useCreationParamsState，统一参数默认值、联动和参数状态
 *   2026-07-16  清理页面入口历史 ESLint 问题，完成定向静态验收并同步当前真实行号
 *   2026-07-16  修复刷新恢复的配音轮询类型、视频重新编辑参考模式/比例回填、配音失败参数恢复和任务计数重复递减
 *   2026-07-16  抽离 creationHistoryAdapter；页面保留历史 API、缓存、分页和 Store 副作用
 *   2026-07-16  抽离 creationTaskAdapter；页面保留轮询、Store、缓存、Toast 和生命周期副作用
 *   2026-07-16  复跑全仓库 lint、构建、架构检查和差异检查；同步当前真实行号与验收边界
 *   2026-07-16  刷新任务恢复增加登录态边界；未登录时保留任务快照，登录后再恢复
 *   2026-07-16  抽离 CreationLoginEmptyState；页面仅通过 onLoginClick 接线，当前实际行数 1886
 *   2026-07-16  抽离 CreationSendButton；页面仅通过显式动作 props 接线，当前实际行数 1748，架构统计 1749
 *   2026-07-16  抽离 CreationToast；Toast 状态和定时器仍由页面持有，清理重复确认弹窗，当前实际行数 1700
 *   2026-07-16  抽离 CreationInputSurface；页面保留 InputCard 状态、参数组装、素材状态和失败恢复，当前实际行数 1584
 *   2026-07-16  抽离 CreationPageOverlays；页面保留删除、清空历史、视频下载/删除/收藏副作用
 *   2026-07-16  抽离 CreationInputCard；页面保留生成 API、任务轮询、缓存、Toast 和 Store 副作用，当前实际行数 1093
 *   2026-07-16  完成未登录创作页基础运行复验；Tab、清空、批量操作和登录弹窗正常，页面日志无项目级错误或警告
 *   2026-07-16  抽离 filenameFromPrompt 至 utils/creationFilename.js；页面保留下载副作用
 *   2026-07-16  抽离 creationDetailAdapter；页面保留详情 API 请求、弹窗状态和错误提示副作用
 *   2026-07-16  统一结果区与空态的模型入口和 InputCard 渲染回调，避免重复接线
 *   2026-07-17  抽离 CreationWorkspace；页面保留状态、副作用和所有显式回调接线
 *   2026-07-17  复用 downloadMediaUrl，统一图片/视频 Blob 下载和失败回退生命周期
 *   2026-07-29  图片创作结果与历史记录按媒体地址去重，避免同图重复展示并保留创作提示词
 *   2026-08-03  抽离 useCreationGeneration；页面保留生成依赖、计数和区块接线，生成流程行为保持不变
 *   2026-08-07  配音生成接入 600 秒轮询上限、提示词保留和再次点击发送停止前端请求/轮询
 *   2026-08-11  修复不同创作 Tab 的生成禁用状态串扰，输入区按当前创作类型隔离
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { apiPollCreationTask, apiGetCreationVideo, apiDeleteCreationImage, apiDeleteCreationVideo, apiDeleteCreationAudio, apiToggleImageFavorite, apiToggleVideoFavorite, apiBatchDeleteImages, apiBatchDeleteVideos, apiBatchDeleteAudios, apiCreateSession, apiGetSession, apiListCreationImages, apiListCreationVideos, apiListCreationAudios, apiHideCreationHistory } from '../api/creation';
import { useCreationStore } from '../stores/creationStore';
import { apiListModels } from '../api/config';
import { adaptModels, getModelParams } from '../utils/modelAdapter';
import { mergeCreationVideoDetail } from '../utils/creationDetailAdapter';
import {
  buildCreationHistoryCachePayload,
  dedupeCreationHistoryList,
  getCreationHistoryList,
  normalizeCreationHistoryItem,
} from '../utils/creationHistoryAdapter';
import {
  createCreationTaskPlaceholder,
  getCreationTaskType,
  normalizeCreationPendingTask,
  normalizeCreationTaskResult,
} from '../utils/creationTaskAdapter';
import { invalidate, peekCacheEntry, setCache } from '../utils/cache';
import {
  CreationToast,
  CreationInputCard,
  CreationPageOverlays,
  CreationWorkspace,
  CREATION_TABS,
  useCreationGeneration,
} from '../components/creation';
import { filenameFromPrompt } from '../utils/creationFilename';
import { downloadMediaUrl } from '../utils/downloadMediaUrl';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

// ─── Confirm delete modal ────────────────────────────────────────────────────
// ConfirmDeleteModal 已迁移至 ConfirmDialog 共享组件

// 顶部 Tab、批量操作和清空历史展示层已迁移至 components/creation/CreationToolbar。

// 模块级常量和 ref：组件卸载重挂载不重置，避免 session 重复恢复导致数据叠加
const SESSION_KEY = 'miioo_creation_session_id';
const PENDING_CREATION_TASKS_KEY = 'miioo_pending_tasks';
const _sessionIdRef = { current: localStorage.getItem(SESSION_KEY) };
const _sessionInitRef = { current: false };

export default function CreationPage({ isLoggedIn, onLoginClick, apiConfigured = true, onShowNoModelNotice }) {  const [activeTab, setActiveTab] = useState('image');
  const saveActiveDraftRef = useRef(null);
  const [genType, setGenType] = useState('image');
  const [activeCountByTab, setActiveCountByTab] = useState({ image: 0, video: 0, dubbing: 0 });
  const incrementActive = (tab) => setActiveCountByTab(prev => ({ ...prev, [tab]: (prev[tab] || 0) + 1 }));
  const decrementActive = (tab) => setActiveCountByTab(prev => ({ ...prev, [tab]: Math.max(0, (prev[tab] || 0) - 1) }));
  const {
    generationsByTab, addGeneration, deleteCard: storeDeleteCard, deleteGeneration: storeDeleteGeneration, deleteSelectedCards,
    updateCardIds: storeUpdateCardIds, syncFavorites: storeSyncFavorites,
    favorites, toggleFavorite: storeToggleFavorite,
    confirmFavoriteToggle: storeConfirmFavoriteToggle,
    rollbackFavoriteToggle: storeRollbackFavoriteToggle,
    historyMeta, mergeHistoryGenerations, setHistoryPage1, updateHistoryMeta,
    clearHistoryTab,
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
  const sessionIdRef = _sessionIdRef;
  const sessionInitRef = _sessionInitRef;

  // ── 历史数据加载：页面保留缓存、Store 和请求副作用，字段转换由纯适配工具负责。
  const hydrateHistoryFromCache = useCallback((tab) => {
    const cacheKey = `creation_history:${tab}:page1`;
    const cacheEntry = peekCacheEntry(cacheKey, 'local');
    if (!cacheEntry?.d) {
      return false;
    }

    const list = getCreationHistoryList(cacheEntry.d);
    const type = tab === 'dubbing' ? 'audio' : tab;
    const normalized = dedupeCreationHistoryList([...list], type).map((item) => normalizeCreationHistoryItem(item, type));
    mergeHistoryGenerations(tab, normalized);

    return true;
  }, [mergeHistoryGenerations]);

  const syncHistoryFavorites = useCallback((tab) => {
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
  }, [storeSyncFavorites]);

  // 拉取一页历史数据，自动填满视口逻辑由 CreationResultState 触发
  const loadHistoryPage = useCallback(async (tab) => {
    if (!isLoggedIn) return;
    const meta = useCreationStore.getState().historyMeta[tab];
    if (meta.loading || !meta.hasMore) {
      return;
    }

    updateHistoryMeta(tab, { loading: true });
    const nextPage = meta.page + 1;
    const PAGE_SIZE = tab === 'video' ? 6 : 18;

    try {
      let list;
      let pageResp;
      const apiMap = {
        image: apiListCreationImages,
        video: apiListCreationVideos,
        dubbing: apiListCreationAudios,
      };
      if (nextPage === 1) {
        const cacheKey = `creation_history:${tab}:page1`;
        const cacheEntry = peekCacheEntry(cacheKey, 'local');
        const cacheList = cacheEntry?.d ? getCreationHistoryList(cacheEntry.d) : [];
        // 第 1 页始终向服务端拉取最新数据，再写回本地缓存：
        // 本地缓存只用于「秒开」(hydrateHistoryFromCache)，不能作为权威数据。
        // 否则刚创作完成、但缓存尚未包含的新内容会在刷新后被旧缓存覆盖而「凭空消失」。
        const networkResp = await apiMap[tab]({ page: 1, page_size: PAGE_SIZE, exclude_hidden: true });
        pageResp = networkResp;
        const resp = tab === 'video' ? buildCreationHistoryCachePayload(tab, networkResp) : networkResp;
        setCache(cacheKey, resp, { medium: 'local' });
        list = getCreationHistoryList(resp);

        const isSameAsHydratedCache = cacheEntry?.d && JSON.stringify(list) === JSON.stringify(cacheList);
        if (isSameAsHydratedCache) {
          const explicitHasMore = networkResp?.has_more ?? networkResp?.hasMore;
          const hasMore = explicitHasMore !== undefined
            ? Boolean(explicitHasMore)
            : list.length >= PAGE_SIZE;
          syncHistoryFavorites(tab);
          updateHistoryMeta(tab, { page: nextPage, hasMore, loading: false, initialized: true });
          return;
        }
      } else {
        pageResp = await apiMap[tab]({ page: nextPage, page_size: PAGE_SIZE, exclude_hidden: true });
        list = getCreationHistoryList(pageResp);
      }

      const type = tab === 'dubbing' ? 'audio' : tab;
      const rawListLength = list.length;
      list = dedupeCreationHistoryList([...list], type);
      const explicitHasMore = pageResp?.has_more ?? pageResp?.hasMore;
      const hasMore = explicitHasMore !== undefined
        ? Boolean(explicitHasMore)
        : rawListLength >= PAGE_SIZE;

      const normalized = list.map((item) => normalizeCreationHistoryItem(item, type));
      if (nextPage === 1) {
        // 第 1 页为权威最新数据：直接覆盖（而非合并），避免 hydrate 旧缓存后再合并导致排序错乱。
        // list 来自服务端、最新在前，反转成 store 约定「越靠后越新」，display 再 reverse 展示最新在最前。
        setHistoryPage1(tab, normalized.reverse());
      } else {
        // 后续页（加载更多 / 自动填满视口）只能合并追加，否则会覆盖已加载的第 1 页内容导致整体错乱。
        mergeHistoryGenerations(tab, normalized);
      }

      // 同步后端收藏状态到本地 favorites Set
      syncHistoryFavorites(tab);

      updateHistoryMeta(tab, { page: nextPage, hasMore, loading: false, initialized: true });
    } catch (err) {
      console.error('[CreationPage] 历史数据加载失败:', err);
      updateHistoryMeta(tab, { loading: false, initialized: true });
    }
  }, [
    isLoggedIn,
    mergeHistoryGenerations,
    setHistoryPage1,
    syncHistoryFavorites,
    updateHistoryMeta,
  ]);

  // 登录后 / 切换 tab 时，若当前 tab 未初始化则拉第一页
  useEffect(() => {
    if (!isLoggedIn) return;
    const meta = historyMeta[activeTab];
    if (!meta.initialized && !meta.loading) {
      hydrateHistoryFromCache(activeTab);
      loadHistoryPage(activeTab);
    }
  }, [isLoggedIn, activeTab, historyMeta, generationsByTab, hydrateHistoryFromCache, loadHistoryPage]);

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
  }, [isLoggedIn, sessionIdRef, sessionInitRef]);

  // 刷新恢复：检测 localStorage 中未完成的创作任务，重建占位卡片并继续轮询（支持图片/视频/配音）
  useEffect(() => {
    // 未登录时保留快照，避免调用需要鉴权的轮询接口；登录后再执行恢复。
    if (!isLoggedIn) return;

    let pending;
    try {
      pending = JSON.parse(localStorage.getItem(PENDING_CREATION_TASKS_KEY) || '[]');
    } catch {
      pending = [];
    }
    if (!pending.length) return;

    // 清掉已恢复的，避免重复
    localStorage.setItem(PENDING_CREATION_TASKS_KEY, JSON.stringify([]));

    pending
      .map(normalizeCreationPendingTask)
      .filter(Boolean)
      .forEach((task) => {
      const { taskId, genId, tab, genType } = task;

      // 先删除 store 中可能残留的同 genId 旧条目
      storeDeleteGeneration(tab, genId);

      // 重建占位卡片（按类型生成对应数量的占位）
      addGeneration(tab, createCreationTaskPlaceholder(task));
      incrementActive(genType === 'video' ? 'video' : genType === 'dubbing' ? 'dubbing' : 'image');

      // 重新轮询
      apiPollCreationTask(getCreationTaskType(genType), taskId)
        .then((result) => {
          const { mediaUrls, cardIds, generation } = normalizeCreationTaskResult(result, task);

          if (!mediaUrls.length) {
            showToast('error', '生成失败，请稍后重试');
            storeDeleteGeneration(tab, genId);
            return;
          }
          storeDeleteGeneration(tab, genId);
          addGeneration(tab, generation);
          if (cardIds?.length) storeUpdateCardIds(tab, genId, cardIds);
          // 新创作完成 → 清除历史缓存，下次刷新时能拿到新数据
          invalidate(`creation_history:${tab}:`, 'local');
        })
        .catch((err) => {
          showToast('error', err?.message || '生成失败，请稍后重试');
          storeDeleteGeneration(tab, genId);
        })
        .finally(() => {
          decrementActive(genType === 'video' ? 'video' : genType === 'dubbing' ? 'dubbing' : 'image');
        });
    });
  // 仅在登录状态变化时执行，避免未登录首次挂载消费任务快照。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  

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
  const [capabilitiesMap, setCapabilitiesMap] = useState({});

  const [batchMode, setBatchMode] = useState(false);
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);
  const [clearHistoryConfirm, setClearHistoryConfirm] = useState(false);
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
        setCapabilitiesMap(capabilitiesMap);
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
        setCapabilitiesMap(capabilitiesMap);
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
    saveActiveDraftRef.current?.();
    setActiveTab(tab);
    setGenType(tab);
    setBatchMode(false);
    setSelected(new Set());
  };
  const handleGenTypeChange = (type) => {
    saveActiveDraftRef.current?.();
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
        isDone: card.status === 'done' && (!!card.imageUrl || !!card.videoUrl || !!card.audioUrl)
      }))
    ).filter(({ isDone }) => isDone).map(({ key }) => key);
    const isAllSelected = allDoneKeys.length > 0 && allDoneKeys.every((k) => selected.has(k));
    setSelected(isAllSelected ? new Set() : new Set(allDoneKeys));
  }

  function deleteSelected() {
    // Collect backend IDs by type for API calls
    const imageIds = [];
    const videoIds = [];
    const audioIds = [];
    selected.forEach((key) => {
      const lastDash = key.lastIndexOf('-');
      const genId = key.slice(0, lastDash);
      const cardIdx = parseInt(key.slice(lastDash + 1));
      const gen = generationsByTab[activeTab]?.find((g) => g.id === genId);
      const card = gen?.cards?.[cardIdx];
      const cardId = card?.id || card?.audioId;
      if (cardId) {
        if (card.type === 'video') videoIds.push(cardId);
        else if (card.type === 'audio') audioIds.push(cardId);
        else imageIds.push(cardId);
      }
    });
    // Call backend APIs
    if (imageIds.length > 0) apiBatchDeleteImages(imageIds).catch(() => {});
    if (videoIds.length > 0) apiBatchDeleteVideos(videoIds).catch(() => {});
    if (audioIds.length > 0) apiBatchDeleteAudios(audioIds).catch(() => {});
    // Update local store
    deleteSelectedCards(activeTab, selected);
    invalidate(`creation_history:${activeTab}:`, 'local');
    setSelected(new Set());
  }

  function downloadSelected() {
    [...generations].reverse().forEach((gen) => {
      gen.cards.forEach((card, i) => {
        const key = `${gen.id}-${i}`;
        if (selected.has(key)) {
          if (card.imageUrl) downloadMediaUrl(card.originalUrl || card.imageUrl, filenameFromPrompt(card.prompt, 'png'));
          if (card.audioUrl && !card.imageUrl && !card.videoUrl) {
            const a = document.createElement('a');
            a.href = card.audioUrl;
            a.download = filenameFromPrompt(card.prompt, 'wav', 'dubbing');
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }
          if (card.videoUrl) {
            // 下载视频
            downloadMediaUrl(card.videoUrl, filenameFromPrompt(card.prompt, 'mp4'));
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
    const cardId = card?.id || card?.audioId;
    if (cardId) {
      if (card.type === 'video') {
        apiDeleteCreationVideo(cardId).catch(() => {});
      } else if (card.type === 'audio') {
        apiDeleteCreationAudio(cardId).catch(() => {});
      } else {
        apiDeleteCreationImage(cardId).catch(() => {});
      }
    }
    storeDeleteCard(activeTab, genId, cardIdx);
    invalidate(`creation_history:${activeTab}:`, 'local');
  };

  // 清空当前 Tab 的创作历史：调用后端持久隐藏，重置本 Tab 展示与分页，并失效本地缓存
  async function handleClearHistory() {
    setClearHistoryConfirm(false);
    try {
      const res = await apiHideCreationHistory(activeTab);
      const hiddenCount = res?.hiddenCount ?? res?.hidden_count ?? 0;
      clearHistoryTab(activeTab);
      invalidate(`creation_history:${activeTab}:`, 'local');
      if (hiddenCount > 0) {
        showToast('success', `已清空 ${hiddenCount} 条创作历史`);
      } else {
        showToast('success', '本页创作历史已清空');
      }
    } catch (err) {
      console.error('[CreationPage] 清空创作历史失败:', err);
      showToast('error', '清空失败，请重试');
    }
  }

  const {
    generateCreation: handleGenerate,
    cancelGeneration,
  } = useCreationGeneration({
    activeTab,
    isLoggedIn,
    sessionIdRef,
    addGeneration,
    storeDeleteGeneration,
    storeUpdateCardIds,
    incrementActive,
    decrementActive,
    showToast,
  });

  const handleBeforeModelOpen = () => {
    if (!apiConfigured) {
      onShowNoModelNotice?.();
      return false;
    }
    return true;
  };

  const renderInputCard = (inputCardProps) => (
    <CreationInputCard
      {...inputCardProps}
      onRegisterSaveDraft={(saveDraft) => {
        saveActiveDraftRef.current = saveDraft;
      }}
      onCancelGeneration={cancelGeneration}
    />
  );

  const handleVideoCardClick = (card) => {
    setVideoDetailModal(card);
    if (card._needsDetail && card.backendId) {
      apiGetCreationVideo(card.backendId).then((detail) => {
        setVideoDetailModal((prev) => prev ? mergeCreationVideoDetail(prev, detail) : null);
      }).catch((error) => {
        console.warn('[CreationPage] detail modal: failed to fetch video detail', error);
      });
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
      <CreationToast toasts={toasts} />
      <CreationPageOverlays
        batchDeleteConfirm={batchDeleteConfirm}
        onBatchDeleteConfirm={() => { setBatchDeleteConfirm(false); deleteSelected(); }}
        onBatchDeleteCancel={() => setBatchDeleteConfirm(false)}
        clearHistoryConfirm={clearHistoryConfirm}
        clearHistoryDescription={`仅清空当前页（${CREATION_TABS.find((t) => t.key === activeTab)?.label ?? activeTab}）的历史记录，创作资产仍可在资产库找到。确定继续吗？`}
        onClearHistoryConfirm={handleClearHistory}
        onClearHistoryCancel={() => setClearHistoryConfirm(false)}
        videoDetail={videoDetailModal}
        onVideoDetailClose={() => setVideoDetailModal(null)}
        onVideoDetailDownload={() => {
          downloadMediaUrl(videoDetailModal.videoUrl, filenameFromPrompt(videoDetailModal.prompt, 'mp4'));
        }}
        onVideoDetailDelete={() => {
          handleDeleteCard(videoDetailModal.genId, videoDetailModal.cardIndex);
          setVideoDetailModal(null);
        }}
        videoDetailFavorited={videoDetailModal ? favorites.has(videoDetailModal.key) : false}
        onVideoDetailFavorite={() => handleToggleFavorite(videoDetailModal.key)}
      />
      <CreationWorkspace
        isLoggedIn={isLoggedIn}
        onLoginClick={onLoginClick}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        batchMode={batchMode}
        selectedCount={selected.size}
        onEnterBatch={() => setBatchMode(true)}
        onSelectAll={selectAll}
        onDownload={downloadSelected}
        onDelete={() => setBatchDeleteConfirm(true)}
        onCancelBatch={exitBatch}
        onClearHistory={() => setClearHistoryConfirm(true)}
        font={FONT}
        fontMedium={FONT_MEDIUM}
        generations={generations}
        onGenerate={handleGenerate}
        genType={genType}
        isGenerating={(activeCountByTab[genType] ?? 0) > 0}
        onGenTypeChange={handleGenTypeChange}
        model={model}
        onModelChange={setModel}
        modelOptions={modelOptions}
        creationParams={creationParams}
        capabilitiesMap={capabilitiesMap}
        onDeleteCard={handleDeleteCard}
        selected={selected}
        onToggleSelect={toggleSelect}
        onSwitchToFrameMode={handleSwitchToFrameMode}
        onVideoCardClick={handleVideoCardClick}
        favorites={favorites}
        toggleFavorite={handleToggleFavorite}
        showToast={showToast}
        historyLoading={historyMeta[activeTab]?.loading}
        historyHasMore={historyMeta[activeTab]?.hasMore}
        onLoadMore={() => loadHistoryPage(activeTab)}
        autoFillLimit={activeTab === 'video' ? 2 : Infinity}
        activeCount={activeCountByTab[genType] ?? 0}
        onBeforeModelOpen={handleBeforeModelOpen}
        onCancelGeneration={cancelGeneration}
        renderInputCard={renderInputCard}
      />
    </>
  );
}
