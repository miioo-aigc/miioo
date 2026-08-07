/**
 * @file StoryboardPage.jsx
 * @structure-index
 *
 * ─── 全局常量与工具函数 ───────────────────────────────────── L95–L143
 *   normalizeStoryboard / normalizeStoryboardList / toBackendStoryboard  utils/storyboardDataAdapter.js
 *   buildStoryboardPrompt                      utils/buildStoryboardPrompt.js
 *   enrichMainRefs / buildStoryboardRefFromAsset         适配工具：主体参考图补全与资产映射
 *   PARAM_OPTIONS / PARAM_LABELS               镜头参数枚举
 *   storyboardTaskAdapter.js                   任务状态与媒体结果读取适配
 *   storyboardCandidateAdapter.js              候选媒体字段与生成参数适配
 *   storyboardShotUtils.js                     镜头数组插入、删除、排序与重编号
 *
 * ─── 页面内稳定组件 ───────────────────────────────────────── L144–L265
 *   EpisodeSelector / ModalCloseBtn             components/storyboard/StoryboardControls.jsx
 *   ParamSelect / ParamTrigger / DescriptionCol  components/storyboard/DescriptionCol.jsx
 *   CharTag / AddSlotBtn                       components/storyboard/NarrationAtoms.jsx
 *   VoiceDubModal                             components/storyboard/VoiceDubModal.jsx
 *   NarrationItem                              components/storyboard/NarrationItems.jsx
 *   NarrationAddButton                         components/storyboard/NarrationAddButton.jsx
 *   NarrationColWrapper                         components/storyboard/NarrationCol.jsx
 *   ShotRow                                      页面业务桥接 L196–L265
 *   ShotNumberColumn                            components/storyboard/ShotNumberColumn.jsx
 *   StoryboardToast / StoryboardHeader            components/storyboard/
 *   makeStoryboardShot                           utils/storyboardDataAdapter.js
 *   PanelSelect / ModalSelectItem 已迁移至 components/storyboard/PanelSelect.jsx
 *
 * ─── 外部业务域组件 ────────────────────────────────────────
 *   BatchImageModal / BatchVideoModal          components/storyboard/BatchGenerateModals.jsx
 *   StoryboardBatchToolbar                     components/storyboard/StoryboardBatchToolbar.jsx
 *   StoryboardEmptyState                       components/storyboard/StoryboardEmptyState.jsx
 *   StoryboardLoadingState                     components/storyboard/StoryboardLoadingState.jsx
 *   StoryboardShotList                         components/storyboard/StoryboardShotList.jsx
 *   StoryboardShotRowContent                   components/storyboard/StoryboardShotRowContent.jsx
 *   StoryboardShotRow                          components/storyboard/StoryboardShotRow.jsx
 *   MediaCol / MainRefCol / TextEditCol        components/storyboard/
 *   ShotNumberColumn                            components/storyboard/ShotNumberColumn.jsx
 *   GenerateImagePanel                         components/storyboard/GenerateImagePanel.jsx
 *   GenerateVideoPanel / ReferenceMediaEditor  components/storyboard/
 *
 * ─── 主页面入口 ──────────────────────────────────────────── L196–L2586
 *   [状态与副作用] 分镜数据、API、任务轮询、缓存和持久化
 *   [加载与错误态] LoadingAnimation、DotsLoading、失败操作和统计
 *   [镜头 CRUD] 上传、编辑、复制、删除、排序
 *   [渲染] 状态结果、内容区（列表/时间轴）、生成面板和 Toast
 *   [边界] 页面保留 API、轮询循环、状态写回、缓存、持久化、Toast 和页面编排；任务恢复由 useStoryboardTaskRecovery 负责流程，页面通过显式回调接收结果
 *   [外部上传] ReferenceMediaEditor 直接引入 StoryboardUploadSlots，页面不转发上传槽位
 *
 * ─── 更新记录 ───────────────────────────────────────────────
 *   2026-08-06  主体参考列增删时同步创作表单主体集合，处理关闭/卸载旧快照、刷新多来源和版本滞后覆盖
 *   2026-08-05  修复创作面板异步恢复期间的空表单覆盖：打开面板优先使用镜头快照，待参考图表单恢复完成后才允许持久化
 *   2026-08-05  创作面板参考主体变更时同步写回当前镜头 mainRefs，保持创作面板与主体参考列一致
 *   2026-08-05  视频创作面板表单仅在内容变化时回写，避免提示词删除标签触发父子状态循环
 *   2026-08-06  分镜读取绕过旧分页缓存，提示词绑定自动修复不再携带普通参考图快照
 *   2026-08-06  画面描述列与创作面板时长按后端默认值、用户修改值分层处理并双向同步；收敛表单回写范围，修复时长切换循环闪烁
 *   2026-08-06  画面描述列时长选项复用视频模型能力，并与创作面板时长双向同步
 *   2026-08-07  分镜视频结果按多字段 ID/地址交叉去重，统一候选展示和视频历史写入口，修复异步刷新重复卡片
 *   2026-08-04  空分镜直接标记无候选媒体，跳过 media-candidates 请求并保留生成/上传后的刷新路径
 *   2026-08-03  主体删除兼容类型退化的旧引用，并在缓存/接口刷新期间持续过滤已删除主体，避免问号占位框复现
 *   2026-08-04  候选媒体按分镜缓存轻量封面与状态；无封面时恢复图片原图/视频首帧兜底
 *   2026-08-03  分镜参考主体、参考图、参考视频和参考音频按类型归一化，并串行保存创作表单最新快照
 *   2026-08-03  完成 P0–P3 拆分并修复当前 React ESLint 规则问题：候选媒体适配、加载态、镜头纯函数与跨刷新任务恢复迁移至独立模块；
 *              页面保留 API、轮询、缓存、持久化、状态写回、Toast 和页面编排，当前 2133 行规模提醒不构成阻断。
 *   2026-07-30  完成任务响应适配、重新分镜任务恢复和时间轴候选媒体兼容修复。
 *   2026-07-15  完成主要稳定 UI 区块迁移：镜头行、媒体列、主体参考列、生成面板、批量工具栏和弹窗。
 *   2026-07-01  建立页面结构索引；详细迁移历史见 docs/refactor/component-inventory.md 与 OpenSpec 任务清单。
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ModalCloseBtn } from '../components/storyboard/StoryboardControls';
import StoryboardToast from '../components/storyboard/StoryboardToast';
import StoryboardHeader from '../components/storyboard/StoryboardHeader';
import { getEpisodeId } from '../components/storyboard/storyboardControlUtils';
import { apiUploadStoryboardImage, apiUploadStoryboardVideo, apiGenerateStoryboardImage, apiGenerateStoryboardVideo, apiGenerateStoryboardsFromEpisode, apiCreateStoryboard, apiUpdateStoryboard, apiUpdateStoryboardCreationForm, apiDeleteStoryboard, apiReorderStoryboards, apiGetStoryboards, apiBatchDownloadStoryboardImages, apiBatchDownloadStoryboardVideos, apiGetTask, apiListStoryboardMediaCandidates, apiCreateStoryboardMediaCandidate, apiUpdateStoryboardMediaCandidate, apiDownloadStoryboardMediaCandidate } from '../api/storyboard';
import { apiGetEpisodes, normalizeEpisodeListResponse } from '../api/subject';
import { apiUploadCreationImage } from '../api/creation';
import { apiListModels } from '../api/config';
import DotsLoading from '../components/DotsLoading';
import { normalizeImageUrl, toAbsoluteUrl } from '../utils/imageUrl';
import { normalizeStoryboardModelList, normalizeStoryboardDurationOptions } from '../utils/storyboardModelAdapter';
import { repairStoryboardPromptBindings } from '../utils/storyboardPromptBindingRepair';
import {
  extractStoryboardImageUrl,
  extractStoryboardVideoUrl,
  getStoryboardTaskId as getTaskIdFromAdapter,
  getStoryboardTaskStatus,
  hasStoryboardImageTaskResult,
  hasStoryboardVideoTaskResult,
  isStoryboardTaskInProgress,
} from '../utils/storyboardTaskAdapter';

function areCreationFormStatesEqual(previous, next) {
  if (previous === next) return true;
  if (!previous || !next) return false;
  return JSON.stringify(previous) === JSON.stringify(next);
}

function getStoryboardTaskId(task) {
  return getTaskIdFromAdapter(task);
}

function unwrapStoryboardTaskResponse(value) {
  let payload = value?.data ?? value?.payload ?? value;
  if (payload?.task && typeof payload.task === 'object') return payload.task;
  if (payload && typeof payload === 'object' && (
    payload.id || payload.task_id || payload.taskId || payload.status || payload.raw_status
  )) return payload;
  if (payload?.result && typeof payload.result === 'object') {
    payload = payload.result;
    if (payload.task && typeof payload.task === 'object') return payload.task;
  }
  return payload;
}

function getStoryboardTaskError(task, fallback) {
  const detail = task?.detail;
  const detailMessage = typeof detail === 'string' ? detail : detail?.message || detail?.detail;
  return task?.status_message
    || task?.statusMessage
    || task?.params?.status_message
    || task?.params?.statusMessage
    || detailMessage
    || task?.error?.message
    || task?.error?.detail
    || task?.error
    || task?.message
    || task?.params?.error
    || fallback;
}

function hasBackendStoryboardIds(items) {
  return Array.isArray(items) && items.every((item) => isBackendStoryboardId(
    item?.id ?? item?.storyboard_id ?? item?.storyboardId ?? item?.uuid
  ));
}

import { subscribe, peekCache, invalidate } from '../utils/cache';
import { K, MEDIUM } from '../utils/cacheKeys';
import { buildStoryboardRefFromAsset, getUploadedImageId, getUploadedImageUrl, toSafeStoryboardReferenceUrls } from '../utils/storyboardReferenceAdapter';
import { buildStoryboardCandidatePayload, normalizeSavedStoryboardCandidate } from '../utils/storyboardCandidateAdapter';
import { areStoryboardMediaSame, mergeStoryboardMediaItems } from '../utils/storyboardMediaDedup';
import { insertStoryboardShot, moveStoryboardShot, removeStoryboardShot, renumberStoryboardShots } from '../utils/storyboardShotUtils';
import useStoryboardTaskRecovery from '../hooks/useStoryboardTaskRecovery';
import { enrichMainRefs, isBackendStoryboardId, makeStoryboardShot, normalizeStoryboard, normalizeStoryboardList, setStoryboardSubjectSnapshot, toBackendStoryboard } from '../utils/storyboardDataAdapter';
import buildStoryboardPrompt from '../utils/buildStoryboardPrompt';
import { addPendingTask, removePendingTask } from '../utils/taskPersistence';
import { downloadBlob } from '../utils/downloadBlob';
import { createLatestPersistenceQueue } from '../utils/referenceMediaPersistence';
import {
  BatchImageModal,
  BatchVideoModal,
  GenerateImagePanel,
  GenerateVideoPanel,
  PanelPromptInput,
  StoryboardContentArea,
  StoryboardEmptyState,
  StoryboardLoadingState,
  StoryboardShotList,
  StoryboardShotRowContent,
  StoryboardFinalizedTimeline,
  StoryboardCreationPanel,
  StoryboardMediaDetailModal,
  AIRegenerateStoryboardModal,
} from '../components/storyboard';

// ─── 后端/前端数据模型双向映射 ───────────────────────────────────────────────


// ─── 集数选择器（面包屑下拉）─────────────────────────────────────────────────

// ─── 生成分镜图面板 ────────────────────────────────────────────────────────────

// ─── 删除确认弹窗 ─────────────────────────────────────────────────────────────
// DeleteConfirmModal 已迁移至 ConfirmDialog 共享组件（接受 description 参数渲染镜头编号）

// 资产 category → 主体参考 _type：仅角色/场景/道具为真实主体类型，其余（分镜图/参考图/创作资产/本地上传）统一为 other
// ─── 角色 Tag（旁白列展示用）───────────────────────────────────────────────────

// ─── 旁白配音弹窗 ─────────────────────────────────────────────────────────────

// ─── 旁白配音列 ───────────────────────────────────────────────────────────────

// ─── (旧版内联编辑已废弃，保留以备参考) ─────────────────────────────────────

// ─── 主体参考列 ───────────────────────────────────────────────────────────────

// ─── 媒体列（分镜图 / 分镜视频）已迁移至 components/storyboard/MediaCol.jsx ─────────

// ─── 镜头编号列已迁移至 components/storyboard/ShotNumberColumn.jsx ───────────

// ─── 旁白配音列容器 ───────────────────────────────────────────────────────────

// ─── 主体参考列容器 ───────────────────────────────────────────────────────────

// 新增分镜默认数据由纯适配工具提供，页面只负责调用和提交。

const EPISODES = ['第一集', '第二集'];
const STORYBOARD_PAGE_SIZE = 10;

export default function StoryboardPage({ projectId, projectName = '两只老虎的奇遇', projectRatio, chars = [], scenes = [], props = [], episodes = EPISODES, initialEpisodeIndex = null, onUnlockStep, onGenerateStoryboards, onRetryGenerateStoryboards, generateError = null, isGenerating: homeIsGenerating = false, completedEpisodesCount = 0, statusMessage = '' }) {

  // 分镜主体参考可能同时包含角色、场景和道具；旁白列仍只使用 chars。
  const storyboardSubjects = useMemo(() => {
    const seen = new Set();
    return [...chars, ...scenes, ...props].filter((subject) => {
      const key = subject?.id;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [chars, scenes, props]);

  // 页面级绑定修复需要知道主体类型；主体列表本身的历史数据不一定携带 type。
  const storyboardBindingSubjects = useMemo(() => [
    ...chars.map((subject) => ({ ...subject, type: subject.type || 'char' })),
    ...scenes.map((subject) => ({ ...subject, type: subject.type || 'scene' })),
    ...props.map((subject) => ({ ...subject, type: subject.type || 'prop' })),
  ], [chars, scenes, props]);

  // 选择器的唯一数据源是剧本分集，不根据当前分镜接口返回结果裁剪列表。
  const [scriptEpisodes, setScriptEpisodes] = useState(() => episodes.length > 0 ? episodes : []);
  const activeEpisodes = scriptEpisodes.length > 0 ? scriptEpisodes : EPISODES;
  // 用 peekCache 同步读取缓存，第一次渲染直接呈现旧数据，避免空状态闪烁
  const [shots, setShots] = useState(() => {
    if (!projectId) return [];
    const cachedEpisodes = episodes.length > 0
      ? episodes
      : (peekCache(K.episodes(projectId), MEDIUM.CONTENT) ?? []);
    const targetIdx = (initialEpisodeIndex != null && initialEpisodeIndex >= 0 && initialEpisodeIndex < cachedEpisodes.length)
      ? initialEpisodeIndex : 0;
    const initialEpisode = cachedEpisodes[targetIdx];
    if (!initialEpisode || typeof initialEpisode === 'string') return [];
    const episodeId = initialEpisode?.id ?? '';
    if (!episodeId) return [];
    // 先找 episode 级缓存，找不到 fallback 到 :all（:all 是项目全量分镜，同样可用）
    const raw =
      peekCache(K.storyboards(projectId, episodeId), MEDIUM.CONTENT) ??
      peekCache(K.storyboards(projectId), MEDIUM.CONTENT);
    if (!raw || !Array.isArray(raw)) return [];
    const currentEpisodeRaw = raw.filter((item) => (item.episode_id ?? item.episodeId) === episodeId);
    return normalizeStoryboardList(currentEpisodeRaw, storyboardSubjects, 0, projectId).slice(0, STORYBOARD_PAGE_SIZE);
  });
  const [globalVoiceParams, setGlobalVoiceParams] = useState({});
  const [episode, setEpisode] = useState(() => {
    const idx = (initialEpisodeIndex != null && initialEpisodeIndex >= 0 && initialEpisodeIndex < activeEpisodes.length)
      ? initialEpisodeIndex : 0;
    return activeEpisodes[idx] ?? '第一集';
  });
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [episodeGenerationError, setEpisodeGenerationError] = useState(false);
  const [isLoadingEpisode, setIsLoadingEpisode] = useState(() => shots.length === 0);
  const [hasLoadedEpisodeData, setHasLoadedEpisodeData] = useState(false);
  const [loadedEpisodeDataKey, setLoadedEpisodeDataKey] = useState(null);
  const [storyboardLoadError, setStoryboardLoadError] = useState(false);
  const appliedInitialEpisodeIndexRef = useRef(null);
  const deletedSubjectIdsRef = useRef(new Set());
  const deletedAssetIdsRef = useRef(new Set());
  const [hasMoreShots, setHasMoreShots] = useState(true);
  const [isLoadingMoreShots, setIsLoadingMoreShots] = useState(false);
  const generatingEpisodeRef = useRef(null);
  const generatedEpisodeIdsRef = useRef(new Set());
  const loadedEpisodeRef = useRef(null);
  const shotListRef = useRef(null);
  const removeDeletedSubjectRefs = useCallback((shot) => {
    const deletedIds = deletedSubjectIdsRef.current;
    if (!shot?.mainRefs || deletedIds.size === 0) return shot;
    const nextRefs = shot.mainRefs.filter((ref) => {
      const subjectId = ref?.subjectId || ref?.subject_id;
      const refId = ref?.id;
      const assetId = ref?.assetId || ref?.asset_id;
      return !deletedIds.has(String(subjectId))
        && !deletedIds.has(String(refId))
        && !deletedAssetIdsRef.current.has(String(assetId));
    });
    return nextRefs.length === shot.mainRefs.length ? shot : { ...shot, mainRefs: nextRefs };
  }, []);

  const storyboardPageRef = useRef(null);
  const [activeShotId, setActiveShotId] = useState(null);

  useEffect(() => {
    function handleOutsideStoryboardClick(event) {
      if (storyboardPageRef.current?.contains(event.target)) return;
      if (event.target.closest('[role="dialog"], [data-storyboard-overlay="true"]')) return;
      setActiveShotId(null);
    }

    document.addEventListener('mousedown', handleOutsideStoryboardClick);
    return () => document.removeEventListener('mousedown', handleOutsideStoryboardClick);
  }, []);

  // 用户是否手动操作过（添加/删除分镜），如果操作过就不再展示智能分镜失败的错误态
  const [hasManuallyInteracted, setHasManuallyInteracted] = useState(false);

  const [loadingTextIndex, setLoadingTextIndex] = useState(0);
  const loadingTexts = ['正在智能分镜中', '请稍等', '等待时间大约5分钟', '请耐心等待'];

  useEffect(() => {
    if (!isGenerating && !homeIsGenerating) return;
    const timer = setInterval(() => {
      setLoadingTextIndex(prev => (prev + 1) % loadingTexts.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [isGenerating, homeIsGenerating, loadingTexts.length]);

  const [generatingImages, setGeneratingImages] = useState(false);
  const [generatingVideos, setGeneratingVideos] = useState(false);
  const [generatingImageShotIds, setGeneratingImageShotIds] = useState(new Set());
  const [generatingVideoShotIds, setGeneratingVideoShotIds] = useState(new Set());
  const [toast, setToast] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [downloadMode, setDownloadMode] = useState(false);
  const [selectedShotIds, setSelectedShotIds] = useState(new Set());
  // 单镜头生成面板
  const [imagePanel, setImagePanel] = useState(null); // { shot }
  const [videoPanel, setVideoPanel] = useState(null); // { shot, nextShot }
  const [genImageHistoryMap, setGenImageHistoryMap] = useState({}); // { [shotId]: generatedImages[] }
  const [genVideoHistoryMap, setGenVideoHistoryMap] = useState({}); // { [shotId]: generatedVideos[] }
  const [imageFormStateMap, setImageFormStateMap] = useState({}); // { [shotId]: image creation form state }
  const [videoFormStateMap, setVideoFormStateMap] = useState({}); // { [shotId]: video creation form state }
  const [videoModels, setVideoModels] = useState([]);
  const imageFormStateRef = useRef({});
  const videoFormStateRef = useRef({});
  const creationFormSaveTimersRef = useRef(new Map());
  const creationFormSaveQueuesRef = useRef(new Map());
  const dirtyCreationFormShotIdsRef = useRef(new Set());
  const promptBindingRepairRef = useRef(new Map());
  const userEditedVideoPromptRef = useRef(new Set());
  const shotsRef = useRef(shots);
  useEffect(() => {
    shotsRef.current = shots;
  }, [shots]);

  useEffect(() => {
    let cancelled = false;
    apiListModels({ category: 'video' })
      .then((data) => {
        if (!cancelled) setVideoModels(normalizeStoryboardModelList(data, 'video'));
      })
      .catch((error) => {
        console.warn('[StoryboardPage] 获取视频模型时长能力失败:', error);
        if (!cancelled) setVideoModels([]);
      });
    return () => { cancelled = true; };
  }, []);

  const getShotDurationOptions = useCallback((shot) => {
    const form = videoFormStateRef.current[shot?.id]
      || videoFormStateMap[shot?.id]
      || shot?.creationForm?.video
      || {};
    const fullModels = videoModels.filter((model) => {
      const modes = model.capabilities?.reference_modes || [];
      return modes.length === 0 || modes.some((mode) => !['first_frame', 'last_frame', 'start_end', 'multiframe'].includes(mode));
    });
    const selected = fullModels.find((model) => model.value === form.model)
      || fullModels.find((model) => model.is_default)
      || fullModels[0];
    const backendDuration = shot?.params?.duration || form.duration || null;
    const options = normalizeStoryboardDurationOptions([
      backendDuration,
      ...(selected?.durationRange || selected?.capabilities?.supported_durations || []),
    ].filter((value) => value != null && value !== ''));
    return options.length > 0 ? options : ['5s'];
  }, [videoFormStateMap, videoModels]);
  const [candidateMediaMap, setCandidateMediaMap] = useState({});
  const [pendingCandidateMap, setPendingCandidateMap] = useState({});
  const [finalizedMediaMap, setFinalizedMediaMap] = useState({});
  const [mediaLoadingMap, setMediaLoadingMap] = useState({});
  const candidateMediaMapRef = useRef(candidateMediaMap);
  const pendingCandidateMapRef = useRef(pendingCandidateMap);
  const generatingImageShotIdsRef = useRef(generatingImageShotIds);
  const generatingVideoShotIdsRef = useRef(generatingVideoShotIds);
  useEffect(() => { candidateMediaMapRef.current = candidateMediaMap; }, [candidateMediaMap]);
  useEffect(() => { pendingCandidateMapRef.current = pendingCandidateMap; }, [pendingCandidateMap]);
  useEffect(() => { generatingImageShotIdsRef.current = generatingImageShotIds; }, [generatingImageShotIds]);
  useEffect(() => { generatingVideoShotIdsRef.current = generatingVideoShotIds; }, [generatingVideoShotIds]);
  const mediaRequestVersionRef = useRef(new Map());
  const [timelinePreviewMedia, setTimelinePreviewMedia] = useState(null);
  const [creationPanel, setCreationPanel] = useState(null); // { shot, tab }
  const [regenerateModalOpen, setRegenerateModalOpen] = useState(false);
  const [regenerateModalKey, setRegenerateModalKey] = useState(0);
  const [regenerateModalError, setRegenerateModalError] = useState('');

  function addPendingCandidate(shotId, type, taskId, clientId = `pending-${type}-${shotId}-${Date.now()}`) {
    const item = { id: clientId, taskId, shotId, media_type: type, pending: true };
    setPendingCandidateMap((prev) => ({
      ...prev,
      [shotId]: [...(prev[shotId] || []).filter((candidate) => candidate.taskId !== taskId && candidate.id !== clientId), item],
    }));
    return clientId;
  }

  function bindPendingCandidate(shotId, clientId, taskId) {
    setPendingCandidateMap((prev) => ({
      ...prev,
      [shotId]: (prev[shotId] || []).map((item) => item.id === clientId ? { ...item, taskId, id: `pending-${taskId}` } : item),
    }));
  }

  function removePendingCandidate(taskId, shotId) {
    setPendingCandidateMap((prev) => {
      const next = { ...prev };
      const removeFromList = (list) => list.filter((item) => item.taskId !== taskId && item.id !== taskId);
      if (shotId) {
        const remaining = removeFromList(next[shotId] || []);
        if (remaining.length > 0) next[shotId] = remaining;
        else delete next[shotId];
      } else {
        Object.keys(next).forEach((key) => {
          const remaining = removeFromList(next[key]);
          if (remaining.length > 0) next[key] = remaining;
          else delete next[key];
        });
      }
      return next;
    });
  }

  function hydrateCreationForms(nextShots) {
    const backendImages = {};
    const backendVideos = {};
    (nextShots || []).forEach((shot) => {
      if (shot.creationForm?.image) backendImages[shot.id] = shot.creationForm.image;
      if (shot.creationForm?.video) backendVideos[shot.id] = shot.creationForm.video;
    });
    const dirtyIds = dirtyCreationFormShotIdsRef.current;
    const preserveDirtyState = (backend, local) => Object.keys(backend).reduce((result, shotId) => {
      result[shotId] = dirtyIds.has(String(shotId)) && local[shotId]
        ? local[shotId]
        : backend[shotId];
      return result;
    }, { ...local });
    imageFormStateRef.current = preserveDirtyState(backendImages, imageFormStateRef.current);
    videoFormStateRef.current = preserveDirtyState(backendVideos, videoFormStateRef.current);
    setImageFormStateMap(imageFormStateRef.current);
    setVideoFormStateMap(videoFormStateRef.current);
  }

  const enqueueCreationFormSave = useCallback((shotId, image, video, mainRefs) => {
    const shot = shotsRef.current.find((item) => item.id === shotId);
    // 图片/视频面板分别触发状态变化；任一侧未传入时必须沿用当前快照，
    // 不能让一次单侧编辑把另一侧已保存的参考素材覆盖成空对象。
    const currentCreationForm = shot?.creationForm || {};
    const imageState = image ?? imageFormStateRef.current[shotId] ?? currentCreationForm.image;
    const videoState = video ?? videoFormStateRef.current[shotId] ?? currentCreationForm.video;
    // 关闭/卸载时 shotsRef 可能还没完成 React 状态回写，优先使用表单内最新 refSubjects，
    // 最后才回退到镜头快照，避免删除后把旧主体集合重新提交。
    const subjectRefs = Array.isArray(mainRefs)
      ? mainRefs
      : (Array.isArray(videoState?.refSubjects) ? videoState.refSubjects : shot?.mainRefs);
    const shouldForceSubjectPatch = Array.isArray(mainRefs);
    const persistedVideoState = Array.isArray(subjectRefs) && videoState && typeof videoState === 'object'
      ? { ...videoState, refSubjects: subjectRefs }
      : videoState;
    if (!creationFormSaveQueuesRef.current.has(shotId)) {
      creationFormSaveQueuesRef.current.set(shotId, createLatestPersistenceQueue((value) => (
        (async () => {
          const result = await apiUpdateStoryboardCreationForm(projectId, shotId, value);
          if (!value.forceSubjectPatch) return result;

          // 主体删除是覆盖语义。创作表单接口成功后，再用同一份完整镜头快照
          // 写标准分镜字段，确保后端不会继续保留旧 subject_references/character_ids。
          const latestShot = shotsRef.current.find((item) => item.id === shotId) || shot;
          const subjectShot = {
            ...latestShot,
            mainRefs: value.mainRefs,
            creationForm: {
              ...(latestShot?.creationForm || {}),
              image: value.image,
              video: value.video,
            },
          };
          return apiUpdateStoryboard(projectId, shotId, toBackendStoryboard(subjectShot));
        })()
      )));
    }
    creationFormSaveQueuesRef.current.get(shotId).enqueue({
      image: imageState,
      video: persistedVideoState,
      genParams: shot?.genParams,
      mainRefs: subjectRefs,
      forceSubjectPatch: shouldForceSubjectPatch,
    }).catch((error) => {
      console.error('[StoryboardPage] 保存创作面板状态失败:', error);
    });
  }, [projectId]);

  const scheduleCreationFormSave = useCallback((shotId, image, video) => {
    const timer = creationFormSaveTimersRef.current.get(shotId);
    if (timer) clearTimeout(timer);
    const nextTimer = setTimeout(() => {
      enqueueCreationFormSave(shotId, image, video);
      creationFormSaveTimersRef.current.delete(shotId);
    }, 450);
    creationFormSaveTimersRef.current.set(shotId, nextTimer);
  }, [enqueueCreationFormSave]);

  const flushCreationFormSave = useCallback((shotId) => {
    if (!shotId) return;
    const timer = creationFormSaveTimersRef.current.get(shotId);
    if (timer) {
      clearTimeout(timer);
      creationFormSaveTimersRef.current.delete(shotId);
    }
    enqueueCreationFormSave(
      shotId,
      imageFormStateRef.current[shotId],
      videoFormStateRef.current[shotId],
      videoFormStateRef.current[shotId]?.refSubjects
        || shotsRef.current.find((shot) => shot.id === shotId)?.mainRefs,
    );
  }, [enqueueCreationFormSave]);

  const getLatestShot = useCallback((shotId) => (
    shotsRef.current.find((item) => item.id === shotId) || null
  ), []);

  // 分镜数据和主体数据都准备好后，提前修复后端生成提示词中缺失的主体绑定。
  // 这里不依赖创作弹窗，用户打开第 N 个镜头时可以直接看到修复后的状态。
  useEffect(() => {
    if (!hasLoadedEpisodeData || loadedEpisodeDataKey !== getEpisodeId(episode)) return;
    if (isGenerating || homeIsGenerating) return;

    const repairs = [];
    shots.forEach((shot) => {
      const backendId = shot?.backendId || shot?.id;
      if (!isBackendStoryboardId(backendId)) return;
      if (userEditedVideoPromptRef.current.has(String(backendId))) return;
      const prompt = shot?.creationForm?.video?.prompt
        || shot?.creationForm?.video?.video_prompt
        || '';
      if (!prompt) return;
      // 接口返回的 subject_references 是当前镜头的权威主体集合；
      // 与全局主体列表合并，兼容主体列表尚未完成回填或名称版本暂时不同的情况。
      const shotSubjects = (shot.mainRefs || [])
        .filter((ref) => ref?.type === 'char' || ref?.type === 'scene' || ref?.type === 'prop')
        .map((ref) => ({
          ...ref,
          subjectId: ref.subjectId || ref.subject_id || ref.id,
          type: ref.type,
        }));
      const subjectsById = new Map();
      [...storyboardBindingSubjects, ...shotSubjects].forEach((subject) => {
        const id = subject?.subjectId || subject?.subject_id || subject?.id;
        if (id && !subjectsById.has(String(id))) subjectsById.set(String(id), subject);
      });
      const repair = repairStoryboardPromptBindings(shot, [...subjectsById.values()]);
      if (!repair) return;
      const signature = `${backendId}:${prompt}:${repair.mentions.map((item) => item.subject_id).join(',')}`;
      if (promptBindingRepairRef.current.get(backendId) === signature) return;
      promptBindingRepairRef.current.set(backendId, signature);
      repairs.push({ shot, backendId, repair });
    });

    if (repairs.length === 0) return;
    repairs.forEach(({ shot, backendId, repair }) => {
      const currentVideo = shot.creationForm?.video || {};
      const nextVideo = {
        ...currentVideo,
        prompt: repair.prompt,
        video_prompt_mentions: repair.mentions,
      };
      const nextShot = {
        ...shot,
        creationForm: {
          ...(shot.creationForm || {}),
          video: nextVideo,
        },
      };
      videoFormStateRef.current = { ...videoFormStateRef.current, [backendId]: nextVideo };
      setVideoFormStateMap((prev) => ({ ...prev, [backendId]: nextVideo }));
      setShots((prev) => prev.map((item) => item.id === shot.id ? nextShot : item));
      // 自动修复只更新提示词和 mentions。普通参考图属于独立编辑状态，
      // 不能因为绑定修复拿到旧快照而被一并写回为空。
      apiUpdateStoryboard(projectId, backendId, {
        video_prompt: nextVideo.prompt ?? null,
        video_prompt_mentions: nextVideo.video_prompt_mentions,
      }).catch((error) => {
        console.error('[StoryboardPage] 自动修复提示词绑定失败:', error);
      });
    });
  }, [
    episode,
    hasLoadedEpisodeData,
    homeIsGenerating,
    isGenerating,
    loadedEpisodeDataKey,
    projectId,
    shots,
    storyboardBindingSubjects,
  ]);

  useEffect(() => () => {
    creationFormSaveTimersRef.current.forEach((timer, shotId) => {
      clearTimeout(timer);
      const image = imageFormStateRef.current[shotId];
      const video = videoFormStateRef.current[shotId];
      if (image || video) {
        enqueueCreationFormSave(
          shotId,
          image,
          video,
          video?.refSubjects || shotsRef.current.find((shot) => shot.id === shotId)?.mainRefs,
        );
      }
    });
    creationFormSaveTimersRef.current.clear();
  }, [enqueueCreationFormSave]);

function fallbackCandidates(shot) {
    const fallbackMedia = [shot.storyboardImage, shot.storyboardVideo].filter(Boolean);
    const finalizedId = fallbackMedia[0]?.id || fallbackMedia[0]?.url;
    return fallbackMedia.map((media) => ({
      ...media,
      id: media.id || media.url,
      url: media.url,
      media_type: media.type?.startsWith('video') ? 'video' : 'image',
      is_finalized: (media.id || media.url) === finalizedId,
      source: media.source || 'storyboard-existing',
  }));
}

function hasStoryboardMediaHint(shot = {}) {
  const hasUrl = (value) => {
    if (typeof value === 'string') return value.trim().length > 0;
    return Boolean(value?.url || value?.src || value?.image_url || value?.video_url);
  };
  const mediaObjects = [
    shot.storyboardImage,
    shot.storyboardVideo,
    shot.image,
    shot.video,
  ];
  const mediaFields = [
    shot.image_url,
    shot.imageUrl,
    shot.thumbnail_url,
    shot.thumbnailUrl,
    shot.preview_url,
    shot.previewUrl,
    shot.video_url,
    shot.videoUrl,
    shot.video_thumbnail_url,
    shot.videoThumbnailUrl,
    shot.poster_url,
    shot.posterUrl,
    shot.preview_video_url,
    shot.previewVideoUrl,
  ];
  return mediaObjects.some(hasUrl) || mediaFields.some(hasUrl);
}

  const loadShotCandidates = useCallback(async (currentShots) => {
    const validShots = (currentShots || []).filter((shot) => isBackendStoryboardId(shot?.backendId || shot?.id));
    const shotsWithoutMedia = validShots.filter((shot) => (
      !hasStoryboardMediaHint(shot)
      && !Object.prototype.hasOwnProperty.call(candidateMediaMapRef.current, shot.id)
      && !pendingCandidateMapRef.current[shot.id]?.length
      && !generatingImageShotIdsRef.current.has(shot.id)
      && !generatingVideoShotIdsRef.current.has(shot.id)
    ));
    const shotsToRequest = validShots.filter((shot) => !shotsWithoutMedia.includes(shot));
    const loadingIds = shotsToRequest.map((shot) => shot.id);
    const skippedIds = shotsWithoutMedia.map((shot) => shot.id);
    const requestVersions = new Map(loadingIds.map((id) => {
      const nextVersion = (mediaRequestVersionRef.current.get(id) || 0) + 1;
      mediaRequestVersionRef.current.set(id, nextVersion);
      return [id, nextVersion];
    }));
    setMediaLoadingMap((prev) => ({
      ...prev,
      ...Object.fromEntries(loadingIds.map((id) => [id, true])),
      ...Object.fromEntries(skippedIds.map((id) => [id, false])),
    }));
    if (skippedIds.length > 0) {
      setCandidateMediaMap((prev) => {
        const next = { ...prev };
        skippedIds.forEach((id) => {
          if (!Object.prototype.hasOwnProperty.call(next, id)) next[id] = [];
        });
        return next;
      });
      setFinalizedMediaMap((prev) => {
        const next = { ...prev };
        skippedIds.forEach((id) => {
          if (!Object.prototype.hasOwnProperty.call(next, id)) next[id] = null;
        });
        return next;
      });
    }
    const entries = await Promise.all(shotsToRequest.map(async (shot) => {
      const backendId = shot.backendId || shot.id;
      try {
        const items = await apiListStoryboardMediaCandidates(projectId, backendId);
        return [shot.id, items, shot];
      } catch {
        return [shot.id, fallbackCandidates(shot), shot];
      }
    }));
    const nextCandidates = Object.fromEntries(entries.map(([id, items]) => [id, items]));
    const nextFinalized = Object.fromEntries(entries.map(([id, items, shot]) => {
      const explicitFinalized = items.find((item) => item.is_finalized || item.isFinalized);
      if (explicitFinalized) return [id, explicitFinalized];

      // 兼容后端候选接口暂未返回 is_finalized，但分镜主记录已有定稿地址的情况。
      const storyboardMedia = [shot.storyboardImage, shot.storyboardVideo].filter(Boolean);
      const matched = storyboardMedia.find((media) => {
        return items.some((item) => areStoryboardMediaSame(item, media));
      });
      if (!matched) return [id, null];
      return [id, items.find((item) => areStoryboardMediaSame(item, matched)) || null];
    }));
    setCandidateMediaMap((prev) => {
      const merged = { ...prev };
      Object.entries(nextCandidates).forEach(([shotId, items]) => {
        const finalized = nextFinalized[shotId];
        merged[shotId] = mergeStoryboardMediaItems(prev[shotId] || [], items).map((item) => ({
          ...item,
          is_finalized: finalized ? areStoryboardMediaSame(item, finalized) : Boolean(item.is_finalized),
        }));
      });
      return merged;
    });
    setFinalizedMediaMap((prev) => ({ ...prev, ...nextFinalized }));
    setMediaLoadingMap((prev) => {
      const next = { ...prev };
      loadingIds.forEach((id) => {
        if (mediaRequestVersionRef.current.get(id) === requestVersions.get(id)) next[id] = false;
      });
      return next;
    });
  }, [projectId]);

  async function loadMoreShots() {
    const episodeId = getEpisodeId(episode);
    if (!episodeId || isLoadingMoreShots || !hasMoreShots || isGenerating || homeIsGenerating) return;
    setIsLoadingMoreShots(true);
    try {
      const nextPage = await apiGetStoryboards(projectId, {
        episode_id: episodeId,
        limit: STORYBOARD_PAGE_SIZE,
        offset: shotsRef.current.length,
        skipCache: true,
      });
      if (getEpisodeId(episode) !== episodeId || loadedEpisodeRef.current !== episodeId) return;
      const normalized = normalizeStoryboardList(nextPage, storyboardSubjects, shotsRef.current.length, projectId);
      setShots((prev) => {
        const existingIds = new Set(prev.map((shot) => shot.id));
        const additions = normalized.filter((shot) => !existingIds.has(shot.id));
        if (additions.length > 0) {
          hydrateCreationForms(additions);
          loadShotCandidates(additions);
        }
        return [...prev, ...additions];
      });
      setHasMoreShots(nextPage.length >= STORYBOARD_PAGE_SIZE);
    } catch (error) {
      console.warn('[StoryboardPage] 加载更多分镜失败:', error);
    } finally {
      setIsLoadingMoreShots(false);
    }
  }

  const refreshCandidateForShot = useCallback(async (shot) => {
    const backendId = shot?.backendId || shot?.id;
    if (!isBackendStoryboardId(backendId)) return;
    try {
      const items = await apiListStoryboardMediaCandidates(projectId, backendId);
      setCandidateMediaMap((prev) => ({
        ...prev,
        [shot.id]: mergeStoryboardMediaItems(prev[shot.id] || [], items),
      }));
      setFinalizedMediaMap((prev) => ({ ...prev, [shot.id]: items.find((item) => item.is_finalized) || null }));
    } catch (error) {
      console.warn('[StoryboardPage] 刷新分镜候选媒体失败:', error);
    }
  }, [projectId]);

  async function saveCandidateMedia(shotId, media) {
    const { payload, mediaUrl } = buildStoryboardCandidatePayload(media);
    if (!mediaUrl) return null;
    try {
      const saved = await apiCreateStoryboardMediaCandidate(projectId, shotId, payload);
      const candidate = normalizeSavedStoryboardCandidate(payload, saved);
      setCandidateMediaMap((prev) => {
        const current = prev[shotId] || [];
        return {
          ...prev,
          [shotId]: mergeStoryboardMediaItems(current, [candidate]),
        };
      });
      setFinalizedMediaMap((prev) => ({ ...prev, [shotId]: candidate.is_finalized ? candidate : (prev[shotId] || null) }));
      return candidate;
    } catch (error) {
      console.warn('[StoryboardPage] 候选媒体接口暂不可用，保留兼容媒体字段:', error);
      return null;
    }
  }

  // 从剧本分集接口兜底同步列表。分镜接口只用于读取镜头，不负责提供分集选择项。
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    apiGetEpisodes(projectId).then((data) => {
      if (!cancelled && Array.isArray(data) && data.length > 0) setScriptEpisodes(data);
    }).catch((err) => {
      console.warn('[StoryboardPage] 同步剧本分集失败，继续使用页面传入分集:', err);
    });
    return () => { cancelled = true; };
  }, [projectId]);

  // apiGetEpisodes 使用 SWR 时可能先返回旧缓存，订阅缓存更新后立即替换下拉列表。
  useEffect(() => {
    if (!projectId) return undefined;
    return subscribe(K.episodes(projectId), (data) => {
      const nextEpisodes = normalizeEpisodeListResponse(data);
      if (nextEpisodes.length > 0) setScriptEpisodes(nextEpisodes);
    });
  }, [projectId]);

  // 页面加载时从后端获取剧本数据
  useEffect(() => {
    if (!projectId) return;
    if (typeof episode === 'string') return;

    const episodeId = getEpisodeId(episode);
    if (!episodeId) return;

    // 分集对象可能晚于页面首次渲染到达，因此不能只依赖 useState 初始化时的缓存读取。
    // 在当前分集 effect 内再次同步读取，确保文字缓存先展示，后台请求只负责校验更新。
    const cacheKey = K.storyboards(projectId, episodeId);
    const cacheKeyAll = K.storyboards(projectId);
    const cachedEpisodeData = peekCache(cacheKey, MEDIUM.CONTENT);
    const cachedAllData = peekCache(cacheKeyAll, MEDIUM.CONTENT);
    const cachedRaw = Array.isArray(cachedEpisodeData)
      ? cachedEpisodeData
      : (Array.isArray(cachedAllData)
        ? cachedAllData.filter((item) => (item.episode_id ?? item.episodeId) === episodeId)
        : []);
    const cachedShots = normalizeStoryboardList(cachedRaw, storyboardSubjects, 0, projectId).slice(0, STORYBOARD_PAGE_SIZE);
    const hasCachedShots = cachedShots.length > 0;
    const currentEpisode = activeEpisodes.find((item) => getEpisodeId(item) === episodeId);
    const episodeStatus = String(
      currentEpisode?.status
      ?? currentEpisode?.storyboard_status
      ?? currentEpisode?.storyboardStatus
      ?? '',
    ).toLowerCase();
    const episodeStoryboardCount = Number(
      currentEpisode?.storyboard_count
      ?? currentEpisode?.storyboardCount
      ?? currentEpisode?.shot_count
      ?? currentEpisode?.shotCount
      ?? 0,
    );
    const episodeHasKnownStoryboard = episodeStoryboardCount > 0
      || ['storyboarded', 'generated', 'videos_ready', 'no_image', 'images_ready', 'edited'].includes(episodeStatus);
    const episodeIsExplicitlyUngenerated = ['pending', 'draft', 'initial', 'not_started', 'not-started'].includes(episodeStatus);
    const shouldTreatEmptyAsLoadError = !episodeIsExplicitlyUngenerated
      && (episodeHasKnownStoryboard || !currentEpisode);
    let cancelled = false;

    // 切换分集时清空上一集镜头，避免第二集尚未返回时继续显示第一集内容。
    if (loadedEpisodeRef.current !== episodeId) {
      loadedEpisodeRef.current = episodeId;
      setHasLoadedEpisodeData(false);
      setLoadedEpisodeDataKey(null);
      if (hasCachedShots) {
        requestAnimationFrame(() => {
          if (cancelled) return;
          setShots(cachedShots);
          hydrateCreationForms(cachedShots);
          setIsLoadingEpisode(false);
          setStoryboardLoadError(false);
          loadShotCandidates(cachedShots);
        });
      } else {
        requestAnimationFrame(() => {
          if (cancelled) return;
          setShots([]);
          setIsLoadingEpisode(true);
          setStoryboardLoadError(false);
        });
      }
      requestAnimationFrame(() => {
        if (cancelled) return;
        setHasMoreShots(true);
        setIsLoadingMoreShots(false);
      });
      requestAnimationFrame(() => setEpisodeGenerationError(false));
    }

    const onlyCurrentEpisode = (data) => {
      if (!Array.isArray(data)) return [];
      return data.filter((item) => (item.episode_id ?? item.episodeId) === episodeId);
    };

    const loadStoryboardData = async () => {
      const currentData = await apiGetStoryboards(projectId, {
        episode_id: episodeId,
        limit: STORYBOARD_PAGE_SIZE,
        offset: 0,
        include_gen_params: true,
        skipCache: true,
      });
      if (currentData.length > 0) return currentData;

      // 当前集返回空数组不能直接判定为“未生成”：缓存失效、分集 ID 切换，
      // 或后端按集过滤异常时，都可能只让按集请求返回空结果。再查一次项目级
      // 轻量分镜列表，避免已有数据被误判为空态；生成参数由创作弹窗按需读取。
      const allData = await apiGetStoryboards(projectId, {
        limit: 200,
        offset: 0,
        include_gen_params: false,
        skipCache: true,
      });
      return allData.filter((item) => (item.episode_id ?? item.episodeId) === episodeId);
    };

    loadStoryboardData()
      .then((data) => {
        if (cancelled || !Array.isArray(data)) return;
        // 重新分镜期间保持加载态，避免请求完成后把旧缓存再次显示出来。
        // 任务结束后 homeIsGenerating 变化会重新触发本 effect，再读取最新结果。
        if (isGenerating || homeIsGenerating) return;
        const normalized = normalizeStoryboardList(data, storyboardSubjects, 0, projectId);
        setHasMoreShots(data.length >= STORYBOARD_PAGE_SIZE);
        if (normalized.length > 0) {
          // 有数据：直接覆盖（正常加载 / 刷新场景）
          const visible = normalized.slice(0, STORYBOARD_PAGE_SIZE);
          setShots(visible);
          hydrateCreationForms(visible);
          loadShotCandidates(visible);
          setStoryboardLoadError(false);
        } else {
          // 空数组：只有在当前 shots 也为空时才清空，避免剧本定稿后
          // episode ID 变更导致 API 用新 ID 查不到数据而误清已有分镜
          setShots((prev) => (prev.length > 0 ? prev : normalized));
          if (shouldTreatEmptyAsLoadError) setStoryboardLoadError(true);
        }
        if (!cancelled) setIsLoadingEpisode(false);
        if (!cancelled) {
          setHasLoadedEpisodeData(true);
          setLoadedEpisodeDataKey(episodeId);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[StoryboardPage] 加载分镜失败:', err);
          setIsLoadingEpisode(false);
          setHasLoadedEpisodeData(true);
          setLoadedEpisodeDataKey(episodeId);
          setStoryboardLoadError(true);
        }
      });

    const unsub1 = subscribe(cacheKey, (data) => {
      if (!Array.isArray(data)) return;
      if (isGenerating || homeIsGenerating) return;
      const normalized = normalizeStoryboardList(data, storyboardSubjects, 0, projectId);
      if (normalized.length > 0) {
        const visible = normalized.slice(0, STORYBOARD_PAGE_SIZE);
        setHasMoreShots(normalized.length >= STORYBOARD_PAGE_SIZE);
        setShots(visible);
        hydrateCreationForms(visible);
        setIsLoadingEpisode(false);
        setHasLoadedEpisodeData(true);
        setLoadedEpisodeDataKey(episodeId);
        setStoryboardLoadError(false);
        loadShotCandidates(visible);
      } else {
        // 空缓存不是“加载完成”：缓存可能刚被清理、持久化失败，或仍在等待接口校验。
        // 保持 loading，避免缓存订阅先发 [] 时误显示「开始智能分镜」。
        setShots((prev) => (prev.length > 0 ? prev : normalized));
      }
    });
    const unsub2 = subscribe(cacheKeyAll, (data) => {
      if (!Array.isArray(data)) return;
      if (isGenerating || homeIsGenerating) return;
      const normalized = normalizeStoryboardList(onlyCurrentEpisode(data), storyboardSubjects, 0, projectId);
      if (normalized.length > 0) {
        const visible = normalized.slice(0, STORYBOARD_PAGE_SIZE);
        setHasMoreShots(normalized.length >= STORYBOARD_PAGE_SIZE);
        setShots(visible);
        setIsLoadingEpisode(false);
        setHasLoadedEpisodeData(true);
        setLoadedEpisodeDataKey(episodeId);
        setStoryboardLoadError(false);
        loadShotCandidates(visible);
      } else {
        // :all 缓存同样不能用空数组结束当前分集的加载状态，交给接口请求确认。
        setShots((prev) => (prev.length > 0 ? prev : normalized));
      }
    });

    return () => {
      cancelled = true;
      unsub1();
      unsub2();
    };
  }, [projectId, episode, activeEpisodes, storyboardSubjects, homeIsGenerating, isGenerating, generateError, episodeGenerationError, loadShotCandidates]);

  // 当主体数据变化时（如主体页修改了定稿图），一次性用三类主体重新富化已有 shots。
  useEffect(() => {
    if (!storyboardSubjects.length) return;
    const frameId = requestAnimationFrame(() => {
      setShots(prev => prev.map(shot => enrichMainRefs({ ...shot }, storyboardSubjects)));
    });
    return () => cancelAnimationFrame(frameId);
  }, [storyboardSubjects]);

  // 主体页删除主体后，当前分镜页不能继续展示旧主体引用。
  // Home 的共享主体列表随后会刷新；这里先即时移除本地引用，避免出现旧图或空占位。
  useEffect(() => {
    const handleSubjectDeleted = (event) => {
      const deletedProjectId = event.detail?.projectId;
      const deletedSubjectId = event.detail?.subjectId;
      if (!deletedSubjectId || (deletedProjectId && deletedProjectId !== projectId)) return;
      deletedSubjectIdsRef.current.add(String(deletedSubjectId));
      const deletedAssetIds = new Set((event.detail?.assetIds || []).map((id) => String(id)));
      deletedAssetIds.forEach((id) => deletedAssetIdsRef.current.add(id));
      setShots((prev) => prev.map((shot) => {
        const currentRefs = shot.mainRefs || [];
        const nextRefs = currentRefs.filter((ref) => {
          const refSubjectId = ref?.subjectId
            || ref?.subject_id
            || ((ref?.type === 'char' || ref?.type === 'scene' || ref?.type === 'prop') ? ref.id : null);
          const refAssetId = ref?.assetId || ref?.asset_id;
          const refId = ref?.id;
          // 部分旧分镜数据会把主体引用归一成 type=image，主体 ID仍保留在 ref.id；
          // 删除主体事件已明确限定了目标，因此这里无需再依赖 type 判断。
          const belongsToDeletedSubject = String(refSubjectId) === String(deletedSubjectId)
            || String(refId) === String(deletedSubjectId);
          const usesDeletedAsset = (refAssetId != null && deletedAssetIds.has(String(refAssetId)))
            || (refAssetId == null && refId != null && deletedAssetIds.has(String(refId)));
          return !belongsToDeletedSubject && !usesDeletedAsset;
        });
        return nextRefs.length === currentRefs.length ? shot : { ...shot, mainRefs: nextRefs };
      }));
    };
    window.addEventListener('subject:deleted', handleSubjectDeleted);
    return () => window.removeEventListener('subject:deleted', handleSubjectDeleted);
  }, [projectId]);

  // 资产库直接删除主体图片时，只移除引用了该资产的主体参考图；
  // 同一主体可能还有其他参考图，不能按 subjectId 整体清空。
  useEffect(() => {
    const handleAssetsDeleted = (event) => {
      const deletedProjectId = event.detail?.projectId;
      if (deletedProjectId && deletedProjectId !== projectId) return;
      const deletedIds = new Set((event.detail?.assetIds || []).map((id) => String(id)));
      if (deletedIds.size === 0) return;
      deletedIds.forEach((id) => deletedAssetIdsRef.current.add(id));
      setShots((prev) => prev.map((shot) => {
        const currentRefs = shot.mainRefs || [];
        const nextRefs = currentRefs.filter((ref) => {
          const assetId = ref?.assetId || ref?.asset_id;
          return !assetId || !deletedIds.has(String(assetId));
        });
        return nextRefs.length === currentRefs.length ? shot : { ...shot, mainRefs: nextRefs };
      }));
    };
    window.addEventListener('project-assets:deleted', handleAssetsDeleted);
    return () => window.removeEventListener('project-assets:deleted', handleAssetsDeleted);
  }, [projectId]);


  useEffect(() => {
    if (activeEpisodes.length > 0 && !activeEpisodes.some(ep => getEpisodeId(ep) === getEpisodeId(episode))) {
      const frameId = requestAnimationFrame(() => setEpisode(activeEpisodes[0]));
      return () => cancelAnimationFrame(frameId);
    }
    const currentEpisode = activeEpisodes.find(ep => getEpisodeId(ep) === getEpisodeId(episode));
    if (currentEpisode && currentEpisode !== episode) {
      const frameId = requestAnimationFrame(() => setEpisode(currentEpisode));
      return () => cancelAnimationFrame(frameId);
    }
  }, [activeEpisodes, episode]);

  // 从项目总览点击剧集卡片进入时，按卡片传入的索引定位对应分集；
  // 分集数据异步到达后也要重新应用目标索引，避免默认停留在第一集。
  useEffect(() => {
    if (initialEpisodeIndex == null || initialEpisodeIndex < 0 || initialEpisodeIndex >= activeEpisodes.length) return;
    if (appliedInitialEpisodeIndexRef.current === initialEpisodeIndex) return;
    appliedInitialEpisodeIndexRef.current = initialEpisodeIndex;
    const targetEpisode = activeEpisodes[initialEpisodeIndex];
    if (!targetEpisode || getEpisodeId(targetEpisode) === getEpisodeId(episode)) return;
    const frameId = requestAnimationFrame(() => setEpisode(targetEpisode));
    return () => cancelAnimationFrame(frameId);
  }, [initialEpisodeIndex, activeEpisodes, episode]);

  // episode 还是字符串（episodes prop 尚未到位）时，订阅 :all key
  // 一旦有数据写入就尝试把 episode 切换到真实对象
  useEffect(() => {
    if (typeof episode !== 'string') return;
    if (!projectId) return;
    const unsub = subscribe(K.storyboards(projectId), () => {
      if (activeEpisodes.length > 0) {
        setEpisode(activeEpisodes[0]);
      }
    });
    return unsub;
  }, [projectId, episode, activeEpisodes]);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  // 轮询任务直到完成或超时
  // isSuccessPayload: 可选谓词，若返回 true 则即使 status 为 running 也停止轮询
  async function pollTask(taskId, isSuccessPayload) {
    const MAX_POLLS = 150;
    const INTERVAL = 3000;
    for (let i = 0; i < MAX_POLLS; i++) {
      // 提交生成任务后立即读取一次，避免任务已经创建但页面在首个 3 秒窗口内
      // 没有任何网络活动；后续请求再按固定间隔进行。
      if (i > 0) await new Promise(r => setTimeout(r, INTERVAL));
      const t = await apiGetTask(taskId);
      // 终态
      if (!isStoryboardTaskInProgress(t)) return t;
      // 后端修复后 running 态也可携带 results：有可播放视频就提前返回
      if (typeof isSuccessPayload === 'function' && isSuccessPayload(t)) return t;
    }
    throw new Error('任务超时，请重试');
  }

  const recoverStoryboardTask = useCallback(async (episodeId) => {
    invalidate(K.storyboards(projectId, episodeId));
    invalidate(K.storyboards(projectId));
    const latest = await apiGetStoryboards(projectId, {
      episode_id: episodeId,
      limit: STORYBOARD_PAGE_SIZE,
      offset: 0,
      include_gen_params: true,
    });
    const normalizedLatest = normalizeStoryboardList(latest, storyboardSubjects, 0, projectId).slice(0, STORYBOARD_PAGE_SIZE);
    setHasMoreShots(Array.isArray(latest) && latest.length >= STORYBOARD_PAGE_SIZE);
    setShots(normalizedLatest);
    loadShotCandidates(normalizedLatest);
    generatedEpisodeIdsRef.current.add(episodeId);
  }, [projectId, storyboardSubjects, loadShotCandidates]);

  const recoverVideoTask = useCallback(async (shotId, url) => {
    const normalizedUrl = normalizeImageUrl(url);
    setShots((prev) => prev.map((shot) => shot.id === shotId && !shot.storyboardVideo
      ? { ...shot, storyboardVideo: { id: `vid-${shotId}`, url: normalizedUrl, name: 'generated.mp4', type: 'video/mp4' } }
      : shot));
    apiUpdateStoryboard(projectId, shotId, { video_url: normalizedUrl }).catch(console.error);
    setGenVideoHistoryMap((prev) => {
      const list = prev[shotId] ?? [];
      return {
        ...prev,
        [shotId]: mergeStoryboardMediaItems(
          list.filter((item) => !String(item.id).startsWith('pending-resume-')),
          [{ url: normalizedUrl, settled: false, id: `vid-${shotId}-resumed` }],
        ),
      };
    });
  }, [projectId]);

  const recoverImageTask = useCallback(async (shotId, url) => {
    const normalizedUrl = normalizeImageUrl(url);
    setShots((prev) => prev.map((shot) => shot.id === shotId && !shot.storyboardImage
      ? { ...shot, storyboardImage: { id: normalizedUrl, url: normalizedUrl, name: 'generated.jpg', type: 'image/jpeg' } }
      : shot));
    setGenImageHistoryMap((prev) => {
      const list = prev[shotId] ?? [];
      return { ...prev, [shotId]: [{ url: normalizedUrl, settled: false, id: `img-${shotId}-resumed` }, ...list.filter((item) => !String(item.id).startsWith('pending-resume-'))] };
    });
  }, []);

  useStoryboardTaskRecovery({
    projectId,
    episode,
    pollTask,
    showToast,
    setIsGenerating,
    setEpisodeGenerationError,
    setGeneratingVideoShotIds,
    setGeneratingImageShotIds,
    addPendingCandidate,
    removePendingCandidate,
    setGenVideoHistoryMap,
    setGenImageHistoryMap,
    onStoryboardRecovered: recoverStoryboardTask,
    onVideoRecovered: recoverVideoTask,
    onImageRecovered: recoverImageTask,
  });

  async function startBatchGenImages(params) {
    if (generatingImages) return;
    setGeneratingImages(true);
    const episodeId = getEpisodeId(episode);
    const targetShots = params?.only_undrafted
      ? shots.filter((shot) => !finalizedMediaMap[shot.id] && !shot.storyboardImage && !shot.storyboardVideo)
      : shots;
    let successCount = 0;
    let failCount = 0;

    for (const shot of targetShots) {
      setGeneratingImageShotIds(prev => new Set([...prev, shot.id]));
      let taskId = null;
      const pendingClientId = addPendingCandidate(shot.id, 'image');
      try {
        const taskResp = await apiGenerateStoryboardImage(projectId, shot.id, {
          model: params.model,
          resolution: params.resolution,
          prompt: params.prompt,
          aspect_ratio: projectRatio,
          reference_images: toSafeStoryboardReferenceUrls(params.refImages),
        });
        taskId = getStoryboardTaskId(taskResp);
        if (!taskId) throw new Error('分镜图生成接口未返回任务 ID');
        bindPendingCandidate(shot.id, pendingClientId, taskId);
        addPendingTask(projectId, { taskId, shotId: shot.id, episodeId, type: 'image' });
        const task = await pollTask(taskId, hasStoryboardImageTaskResult);
        if ((getStoryboardTaskStatus(task) === 'completed' || getStoryboardTaskStatus(task) === 'partial') || hasStoryboardImageTaskResult(task)) {
          const imageUrl = extractStoryboardImageUrl(task);
          if (imageUrl) {
            const normalizedUrl = normalizeImageUrl(imageUrl);
            setShots((prev) => prev.map((s) => s.id === shot.id
              ? { ...s, storyboardImage: { id: normalizedUrl, url: normalizedUrl, name: 'generated.jpg', type: 'image/jpeg' } }
              : s
            ));
            await saveCandidateMedia(shot.id, {
              id: normalizedUrl,
              url: normalizedUrl,
              name: 'generated.jpg',
              type: 'image/jpeg',
              media_type: 'image',
              source: 'ai-generated',
              prompt: params.prompt,
              model: params.model,
              resolution: params.resolution,
              ratio: projectRatio,
              referenceImages: toSafeStoryboardReferenceUrls(params.refImages),
              genParams: {
                model: params.model,
                resolution: params.resolution,
                ratio: projectRatio,
                reference_images: toSafeStoryboardReferenceUrls(params.refImages),
              },
            });
            successCount++;
          } else {
            failCount++;
          }
        } else {
          failCount++;
        }
      } catch (err) {
        console.error('[StoryboardPage] 生成分镜图失败:', err);
        failCount++;
      } finally {
        if (taskId) removePendingTask(projectId, taskId);
        removePendingCandidate(taskId || pendingClientId, shot.id);
        setGeneratingImageShotIds(prev => {
          const next = new Set(prev);
          next.delete(shot.id);
          return next;
        });
      }
    }
    setGeneratingImages(false);
    if (failCount > 0) {
      showToast(`分镜图生成完成，成功 ${successCount} 个，失败 ${failCount} 个`, 'warning');
    } else {
      showToast('分镜图生成完成');
    }
  }

  async function startBatchGenVideos(params) {
    if (generatingVideos) return;
    setGeneratingVideos(true);
    const episodeId = getEpisodeId(episode);
    const targetShots = params?.only_undrafted
      ? shots.filter((shot) => !finalizedMediaMap[shot.id] && !shot.storyboardImage && !shot.storyboardVideo)
      : shots;
    let successCount = 0;
    let failCount = 0;

    for (const shot of targetShots) {
      setGeneratingVideoShotIds(prev => new Set([...prev, shot.id]));
      let taskId = null;
      const pendingClientId = addPendingCandidate(shot.id, 'video');
      try {
        const durationValue = (() => {
          if (!params.duration) return undefined;
          const parsed = parseFloat(params.duration);
          return isNaN(parsed) ? undefined : parsed;
        })();
        const taskResp = await apiGenerateStoryboardVideo(projectId, shot.id, {
          model: params.model,
          resolution: params.resolution,
          duration: durationValue,
          sound_effect: params.sound,
          prompt: params.prompt,
          ratio: projectRatio,
          reference_images: toSafeStoryboardReferenceUrls(params.refImages),
        });
        taskId = getStoryboardTaskId(taskResp);
        if (!taskId) throw new Error('分镜视频生成接口未返回任务 ID');
        bindPendingCandidate(shot.id, pendingClientId, taskId);
        addPendingTask(projectId, { taskId, shotId: shot.id, episodeId, type: 'video' });
        const task = await pollTask(taskId, hasStoryboardVideoTaskResult);
        const videoUrl = extractStoryboardVideoUrl(task);
        if (videoUrl) {
          const normalizedUrl = normalizeImageUrl(videoUrl);
          // 任务已有可播放结果时立即移除占位，候选保存接口较慢也不能并排渲染两张卡片。
          removePendingCandidate(taskId || pendingClientId, shot.id);
          const updatedVideo = { id: `vid-${shot.id}`, url: normalizedUrl, name: 'generated.mp4', type: 'video/mp4' };
          setShots((prev) => prev.map((s) => s.id === shot.id
            ? { ...s, storyboardVideo: updatedVideo }
            : s
          ));
          // 持久化到后端，避免刷新后视频列消失
          apiUpdateStoryboard(projectId, shot.id, { video_url: normalizedUrl }).catch(console.error);
          await saveCandidateMedia(shot.id, {
            id: `vid-${shot.id}`,
            url: normalizedUrl,
            name: 'generated.mp4',
            type: 'video/mp4',
            media_type: 'video',
            source: 'ai-generated',
            prompt: params.prompt,
            model: params.model,
            resolution: params.resolution,
            duration: durationValue,
            ratio: projectRatio,
            referenceImages: toSafeStoryboardReferenceUrls(params.refImages),
            genParams: {
              model: params.model,
              resolution: params.resolution,
              duration: durationValue,
              sound_effect: params.sound,
              ratio: projectRatio,
              reference_images: toSafeStoryboardReferenceUrls(params.refImages),
            },
          });
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        console.error('[StoryboardPage] 生成分镜视频失败:', err);
        failCount++;
      } finally {
        if (taskId) removePendingTask(projectId, taskId);
        removePendingCandidate(taskId || pendingClientId, shot.id);
        setGeneratingVideoShotIds(prev => {
          const next = new Set(prev);
          next.delete(shot.id);
          return next;
        });
      }
    }
    setGeneratingVideos(false);
    if (failCount > 0) {
      showToast(`分镜视频生成完成，成功 ${successCount} 个，失败 ${failCount} 个`, 'warning');
    } else {
      showToast('分镜视频生成完成');
    }
  }

  /* ── 批量下载模式 ── */
  function enterDownloadMode() {
    setDownloadMode(true);
    setSelectedShotIds(new Set());
  }

  function exitDownloadMode() {
    setDownloadMode(false);
    setSelectedShotIds(new Set());
  }

  function toggleSelectAll() {
    setSelectedShotIds(prev => {
      if (prev.size === shots.length) return new Set();
      return new Set(shots.map(s => s.id));
    });
  }

  function toggleShotSelection(id) {
    setSelectedShotIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleDownload() {
    const ids = [...selectedShotIds];
    if (ids.length === 0) {
      showToast('暂无可下载的分镜素材', 'warning');
      return;
    }

    const selectedShots = shots.filter((shot) => selectedShotIds.has(shot.id));
    const hasImages = selectedShots.some((shot) => (
      Boolean(shot.storyboardImage)
      || candidateMediaMap[shot.id]?.some((media) => media.media_type === 'image')
      || finalizedMediaMap[shot.id]?.media_type === 'image'
    ));
    const hasVideos = selectedShots.some((shot) => (
      Boolean(shot.storyboardVideo)
      || candidateMediaMap[shot.id]?.some((media) => media.media_type === 'video')
      || finalizedMediaMap[shot.id]?.media_type === 'video'
    ));

    if (!hasImages && !hasVideos) {
      showToast('暂无可下载的分镜素材', 'warning');
      return;
    }

    const downloads = [];
    if (hasImages) {
      downloads.push({
        filename: 'storyboard-images.zip',
        promise: apiBatchDownloadStoryboardImages(projectId, ids),
        label: '图片',
      });
    }
    if (hasVideos) {
      downloads.push({
        filename: 'storyboard-videos.zip',
        promise: apiBatchDownloadStoryboardVideos(projectId, ids),
        label: '视频',
      });
    }

    const results = await Promise.allSettled(downloads.map((item) => item.promise));
    let successCount = 0;
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        downloadBlob(result.value, downloads[index].filename);
        successCount += 1;
      } else {
        console.error(`批量下载${downloads[index].label}失败:`, result.reason);
      }
    });

    if (successCount === downloads.length) {
      showToast('分镜素材下载成功', 'success');
    } else if (successCount > 0) {
      showToast('部分分镜素材下载成功', 'warning');
    } else {
      showToast('批量下载分镜素材失败', 'error');
    }
  }

  function handleStartEdit() {
    onUnlockStep?.('edit');
    showToast('已进入剪辑流程', 'success');
  }

  function openRegenerateModal() {
    if (isGenerating || homeIsGenerating) return;
    setRegenerateModalError('');
    setRegenerateModalKey((key) => key + 1);
    setRegenerateModalOpen(true);
  }

  function openTimelinePreview(media, shot) {
    if (!media?.url) return;
    const isVideo = media.media_type === 'video' || media.type?.startsWith('video');
    setTimelinePreviewMedia({
      media,
      shot,
      isVideo,
      finalized: media.is_finalized === true || finalizedMediaMap[shot?.id]?.id === media.id,
      url: normalizeImageUrl(media.url),
      candidates: candidateMediaMap[shot?.id] || [],
    });
  }

  async function handleTimelineFinalizeChange(media, nextValue) {
    if (!timelinePreviewMedia?.shot || !media) return;
    await handleFinalizeToggle(timelinePreviewMedia.shot, media, nextValue);
    setTimelinePreviewMedia((prev) => prev ? {
      ...prev,
      finalized: nextValue,
      media: prev.media?.id === media.id ? { ...prev.media, is_finalized: nextValue } : prev.media,
      candidates: (prev.candidates || []).map((item) => ({
        ...item,
        is_finalized: item.id === media.id ? nextValue : false,
      })),
    } : prev);
  }

  async function handleRegenerate({ instruction = '' } = {}) {
    if (isGenerating || homeIsGenerating) return false;
    const episodeId = getEpisodeId(episode);
    if (!episodeId) {
      const message = '当前分集信息不完整，无法重新分镜';
      setRegenerateModalError(message);
      showToast(message, 'error');
      return false;
    }

    // 当前按集生成接口尚未声明 instruction 字段，先保留表单值，避免发送未约定参数。
    void instruction;
    setRegenerateModalError('');

    // 只有重新分镜需要主动清空旧结果；首次进入时由任务状态决定是否展示加载态。
    setShots([]);
    setSelectedShotIds(new Set());
    setDownloadMode(false);
    setIsGenerating(true);

    let pendingTaskId = null;
    const generationPromise = apiGenerateStoryboardsFromEpisode(projectId, {
      episode_id: episodeId,
      model: null,
      overwrite_existing: true,
      confirm_overwrite: true,
    })
      .then((rawResponse) => {
        const taskResponse = unwrapStoryboardTaskResponse(rawResponse);
        if (Array.isArray(taskResponse)) {
          return { status: 'completed', storyboards: taskResponse };
        }

        const taskId = getStoryboardTaskId(taskResponse);
        if (!taskId) {
          const status = String(getStoryboardTaskStatus(taskResponse) || '').toLowerCase();
          if (['completed', 'success', 'succeeded', 'done'].includes(status)) {
            return taskResponse;
          }
          throw new Error('重新分镜接口未返回分镜结果或任务 ID');
        }
        // 重新分镜任务也要写入持久化记录。这样用户刷新页面或离开后返回时，
        // 页面可以识别仍在执行的任务，不会只剩一个已经发出的 POST 请求。
        pendingTaskId = taskId;
        addPendingTask(projectId, {
          taskId,
          shotId: null,
          episodeId,
          type: 'storyboard',
        });
        return pollTask(taskId);
      })
      .then((taskResult) => {
        if (pendingTaskId) removePendingTask(projectId, pendingTaskId);
        const status = String(getStoryboardTaskStatus(taskResult) || '').toLowerCase();
        if (['failed', 'error', 'cancelled', 'canceled'].includes(status)) {
          throw new Error(getStoryboardTaskError(taskResult, '分镜生成失败'));
        }
        if (Array.isArray(taskResult?.storyboards) && hasBackendStoryboardIds(taskResult.storyboards)) return taskResult.storyboards;
        if (Array.isArray(taskResult?.results) && taskResult.results.some((item) => item?.episode_id || item?.shot_number) && hasBackendStoryboardIds(taskResult.results)) {
          return taskResult.results;
        }
        invalidate(K.storyboards(projectId, episodeId));
        invalidate(K.storyboards(projectId));
        return apiGetStoryboards(projectId, { episode_id: episodeId, limit: STORYBOARD_PAGE_SIZE, offset: 0, include_gen_params: true });
      })
      .then((latest) => {
        const normalizedLatest = normalizeStoryboardList(latest, storyboardSubjects, 0, projectId).slice(0, STORYBOARD_PAGE_SIZE);
        setHasMoreShots(Array.isArray(latest) && latest.length >= STORYBOARD_PAGE_SIZE);
        setShots(normalizedLatest);
        loadShotCandidates(normalizedLatest);
        generatedEpisodeIdsRef.current.add(episodeId);
      })
      .catch((err) => {
        console.error('[StoryboardPage] 重新分镜失败:', err);
        if (pendingTaskId) removePendingTask(projectId, pendingTaskId);
        const message = err?.message || '重新分镜失败，请稍后重试';
        setRegenerateModalError(message);
        showToast(message, 'error');
        return false;
      })
      .finally(() => setIsGenerating(false));

    const result = await generationPromise;
    return result !== false;
  }

  async function handleStartEpisodeGeneration() {
    if (isGenerating || homeIsGenerating || isLoadingEpisode) return;
    const episodeId = getEpisodeId(episode);
    if (!episodeId) {
      showToast('当前分集信息不完整，无法开始智能分镜', 'error');
      return;
    }

    setEpisodeGenerationError(false);
    setIsGenerating(true);
    generatingEpisodeRef.current = episodeId;

    try {
      const rawTaskResponse = await apiGenerateStoryboardsFromEpisode(projectId, {
        episode_id: episodeId,
        model: null,
      });
      const taskResponse = unwrapStoryboardTaskResponse(rawTaskResponse);
      let taskResult = taskResponse;
      if (!Array.isArray(taskResponse)) {
        const taskId = getStoryboardTaskId(taskResponse);
        if (!taskId) {
          const status = String(getStoryboardTaskStatus(taskResponse) || '').toLowerCase();
          if (!['completed', 'success', 'succeeded', 'done'].includes(status)) {
            throw new Error('按集生成分镜未返回分镜结果或任务 ID');
          }
        } else {
          taskResult = await pollTask(taskId);
        }
      }
      if (['failed', 'error', 'cancelled', 'canceled'].includes(String(getStoryboardTaskStatus(taskResult) || '').toLowerCase())) {
        throw new Error(getStoryboardTaskError(taskResult, '分镜生成失败'));
      }

      const taskItems = Array.isArray(taskResult)
        ? taskResult
        : (Array.isArray(taskResult?.storyboards)
          ? taskResult.storyboards
          : (Array.isArray(taskResult?.results) && taskResult.results.some((item) => item?.episode_id || item?.shot_number)
            ? taskResult.results
            : null));
      const latest = hasBackendStoryboardIds(taskItems)
        ? taskItems
        : await apiGetStoryboards(projectId, { episode_id: episodeId, limit: STORYBOARD_PAGE_SIZE, offset: 0, include_gen_params: true });
      const normalizedLatest = normalizeStoryboardList(latest, storyboardSubjects, 0, projectId).slice(0, STORYBOARD_PAGE_SIZE);
      setHasMoreShots(Array.isArray(latest) && latest.length >= STORYBOARD_PAGE_SIZE);
      setShots(normalizedLatest);
      loadShotCandidates(normalizedLatest);
      generatedEpisodeIdsRef.current.add(episodeId);
    } catch (error) {
      console.error('[StoryboardPage] 按集生成分镜失败:', error);
      setEpisodeGenerationError(true);
      showToast(error?.message || '分镜生成失败，请稍后重试', 'error');
    } finally {
      generatingEpisodeRef.current = null;
      setIsGenerating(false);
    }
  }

  useEffect(() => {
    if (shots.length > 0) onUnlockStep?.('storyboard');
  }, [shots.length, onUnlockStep]);

  function updateShot(id, next) {
    // 主体参考列与创作面板的参考主体必须共享同一份当前镜头集合。
    // 优先读取表单 ref，避免弹窗尚未重新渲染时把旧 creationForm 快照写回。
    const latestVideoForm = videoFormStateRef.current[id] || next?.creationForm?.video;
    const currentShot = shotsRef.current.find((shot) => shot.id === id);
    const durationChanged = next?.params?.duration != null
      && next.params.duration !== currentShot?.params?.duration;
    const synchronizedDurationNext = durationChanged
      ? {
          ...next,
          creationForm: {
            ...(next.creationForm || {}),
            video: {
              ...(next.creationForm?.video || currentShot?.creationForm?.video || {}),
              duration: next.params.duration,
            },
          },
        }
      : next;
    const hasMainRefs = Array.isArray(next?.mainRefs);
    const mainRefsChanged = hasMainRefs
      && !areCreationFormStatesEqual(currentShot?.mainRefs || [], next.mainRefs);
    const hasVideoForm = Boolean(latestVideoForm || synchronizedDurationNext?.creationForm?.video);
    const nextVideoForm = hasVideoForm
      ? {
          ...(latestVideoForm || synchronizedDurationNext.creationForm?.video || {}),
          ...(hasMainRefs ? { refSubjects: next.mainRefs } : {}),
          ...(durationChanged ? { duration: next.params.duration } : {}),
        }
      : null;
    const synchronizedNext = (hasMainRefs || durationChanged) && hasVideoForm
      ? {
          ...synchronizedDurationNext,
          creationForm: {
            ...(synchronizedDurationNext.creationForm || {}),
            video: nextVideoForm,
          },
        }
      : synchronizedDurationNext;

    if ((mainRefsChanged || durationChanged) && hasVideoForm) {
      videoFormStateRef.current = { ...videoFormStateRef.current, [id]: nextVideoForm };
      setVideoFormStateMap(videoFormStateRef.current);
    }
    setShots((prev) => prev.map((s) => (s.id === id ? synchronizedNext : s)));
    setVideoPanel((prev) => prev?.shot?.id === id ? { ...prev, shot: synchronizedNext } : prev);
    setCreationPanel((prev) => prev?.shot?.id === id ? { ...prev, shot: synchronizedNext } : prev);
    if (mainRefsChanged) {
      setStoryboardSubjectSnapshot(projectId, id, next.mainRefs);
      // 主体引用变更必须进入创作表单的串行最新快照队列，和普通参考图一样避免旧请求覆盖。
      if (hasVideoForm) {
        enqueueCreationFormSave(
          id,
          synchronizedNext.creationForm?.image,
          nextVideoForm,
          next.mainRefs,
        );
      } else {
        apiUpdateStoryboard(projectId, id, toBackendStoryboard(synchronizedNext)).catch((err) => {
          console.error('[StoryboardPage] 更新分镜主体参考失败:', err);
        });
      }
    } else {
      apiUpdateStoryboard(projectId, id, toBackendStoryboard(synchronizedNext)).catch((err) => {
        console.error('[StoryboardPage] 更新分镜失败:', err);
      });
    }
  }

  async function handleFinalizeToggle(shot, media, requestedFinalized) {
    const current = finalizedMediaMap[shot.id];
    const shouldFinalize = typeof requestedFinalized === 'boolean'
      ? requestedFinalized
      : current?.id !== media.id;
    const nextFinalized = shouldFinalize ? media : null;
    setFinalizedMediaMap((prev) => ({ ...prev, [shot.id]: nextFinalized }));
    setCandidateMediaMap((prev) => ({
      ...prev,
      [shot.id]: (prev[shot.id] || []).map((item) => ({ ...item, is_finalized: nextFinalized?.id === item.id })),
    }));
    try {
      if (media.id && !String(media.id).startsWith('blob:')) {
        await apiUpdateStoryboardMediaCandidate(projectId, shot.id, media.id, { is_finalized: !!nextFinalized });
      }
      if (nextFinalized) {
        const isVideo = nextFinalized.media_type === 'video';
        updateShot(shot.id, {
          ...shot,
          storyboardImage: isVideo ? null : { ...nextFinalized, type: 'image/jpeg' },
          storyboardVideo: isVideo ? { ...nextFinalized, type: 'video/mp4' } : null,
        });
      } else {
        updateShot(shot.id, {
          ...shot,
          storyboardImage: current?.media_type === 'image' ? null : shot.storyboardImage,
          storyboardVideo: current?.media_type === 'video' ? null : shot.storyboardVideo,
        });
      }
      // 以后端返回的状态为准，确保互斥定稿和兼容字段回写完成后页面一致。
      await refreshCandidateForShot(shot);
    } catch (error) {
      showToast(error.message || '保存定稿失败', 'error');
      setFinalizedMediaMap((prev) => ({ ...prev, [shot.id]: current || null }));
    }
  }

  function openCreationPanel(shot) {
    setActiveShotId(shot.id);
    const tab = creationPanel?.tab || 'video';
    setCreationPanel({ shot, tab });
    if (tab === 'image') {
      setVideoPanel(null);
      setImagePanel({ shot });
    } else {
      setImagePanel(null);
      setVideoPanel({ shot, nextShot: shots[shots.findIndex((item) => item.id === shot.id) + 1] ?? null });
    }
  }

  function handleCreationTabChange(tab) {
    if (!creationPanel) return;
    const shot = getLatestShot(creationPanel.shot?.id) || creationPanel.shot;
    flushCreationFormSave(shot.id);
    setCreationPanel((prev) => ({ ...prev, tab }));
    if (tab === 'image') {
      setVideoPanel(null);
      setImagePanel({ shot });
    } else {
      setImagePanel(null);
      setVideoPanel({ shot, nextShot: shots[shots.findIndex((item) => item.id === shot.id) + 1] ?? null });
    }
  }

  const handleCreationPanelClose = useCallback(() => {
    flushCreationFormSave(activeShotId || creationPanel?.shot?.id);
    setImagePanel(null);
    setVideoPanel(null);
    setCreationPanel(null);
  }, [activeShotId, creationPanel?.shot?.id, flushCreationFormSave]);

  const handleImageFormStateChange = useCallback((nextState) => {
    const shotId = imagePanel?.shot?.id;
    if (!shotId) return;
    dirtyCreationFormShotIdsRef.current.add(String(shotId));
    imageFormStateRef.current = { ...imageFormStateRef.current, [shotId]: nextState };
    setImageFormStateMap(imageFormStateRef.current);
    setShots((prev) => prev.map((shot) => shot.id === shotId
      ? { ...shot, creationForm: { ...(shot.creationForm || {}), image: nextState } }
      : shot));
    scheduleCreationFormSave(shotId, nextState, videoFormStateRef.current[shotId]);
  }, [imagePanel?.shot?.id, scheduleCreationFormSave]);

  const handleVideoFormStateChange = useCallback((nextState) => {
    const shotId = videoPanel?.shot?.id;
    if (!shotId) return;
    dirtyCreationFormShotIdsRef.current.add(String(shotId));
    const previousState = videoFormStateRef.current[shotId];
    if (previousState?.prompt !== nextState?.prompt) {
      userEditedVideoPromptRef.current.add(String(shotId));
    }
    if (previousState && areCreationFormStatesEqual(previousState, nextState)) return;
    const currentFormState = videoFormStateRef.current[shotId];
    if (currentFormState && areCreationFormStatesEqual(currentFormState, nextState)) return;
    // 面板内部已经持有编辑态。这里仅更新 ref 和持久化队列，避免每次字段变化
    // 都通过页面 state 反向刷新面板，形成父子 effect 循环。
    videoFormStateRef.current = { ...videoFormStateRef.current, [shotId]: nextState };
    const currentShot = shotsRef.current.find((shot) => shot.id === shotId);
    const nextDuration = nextState.duration == null || nextState.duration === ''
      ? undefined
      : String(nextState.duration).endsWith('s')
        ? String(nextState.duration)
        : `${nextState.duration}s`;
    const durationChanged = Boolean(currentShot)
      && nextDuration
      && currentShot.params?.duration !== nextDuration;
    const nextShot = currentShot
      ? {
          ...currentShot,
          ...(durationChanged
            ? { params: { ...(currentShot.params || {}), duration: nextDuration } }
            : {}),
          // 创作面板和主体参考列必须使用同一份当前镜头主体参考数据。
          ...(Array.isArray(nextState.refSubjects) ? { mainRefs: nextState.refSubjects } : {}),
          creationForm: { ...(currentShot.creationForm || {}), video: nextState },
        }
      : null;
    const subjectRefsChanged = Boolean(nextShot && Array.isArray(nextState.refSubjects)
      && !areCreationFormStatesEqual(currentShot?.mainRefs || [], nextState.refSubjects));
    // 用户在创作面板修改时长或主体后，需要把最新值回传给面板 props 和列表；
    // 其它表单字段继续只保存在 ref，避免普通表单快照触发父子循环。
    if (durationChanged || subjectRefsChanged) {
      const nextVideoFormStateMap = { ...videoFormStateRef.current, [shotId]: nextState };
      videoFormStateRef.current = nextVideoFormStateMap;
      setVideoFormStateMap((previous) => (
        previous[shotId] && areCreationFormStatesEqual(previous[shotId], nextState)
          ? previous
          : nextVideoFormStateMap
      ));
    }
    if (durationChanged || subjectRefsChanged) {
      setShots((prev) => prev.map((shot) => shot.id === shotId ? (nextShot || shot) : shot));
    }
    if (subjectRefsChanged) {
      setStoryboardSubjectSnapshot(projectId, shotId, nextState.refSubjects);
    }
    if (durationChanged) {
      apiUpdateStoryboard(projectId, shotId, {
        duration: Number.parseFloat(nextDuration),
      }).catch((error) => {
        console.error('[StoryboardPage] 同步创作面板时长失败:', error);
      });
    }
    if (subjectRefsChanged) {
      // 主体引用是覆盖语义，立即把最新集合放入同一串行队列，避免旧请求在删除后回写。
      enqueueCreationFormSave(shotId, imageFormStateRef.current[shotId], nextState, nextState.refSubjects);
    } else {
      scheduleCreationFormSave(shotId, imageFormStateRef.current[shotId], nextState);
    }
  }, [enqueueCreationFormSave, projectId, scheduleCreationFormSave, videoPanel?.shot?.id]);

  function selectActiveShot(shotId) {
    if (shotId === activeShotId) {
      setImagePanel(null);
      setVideoPanel(null);
      setCreationPanel(null);
      setActiveShotId(null);
      return;
    }
    setImagePanel(null);
    setVideoPanel(null);
    setCreationPanel(null);
    setActiveShotId(shotId);
  }

  // 媒体上传属于页面级 API 副作用，显式传给行组件，避免分镜行组件依赖页面闭包。
  function handleShotImageUpload(shot, media) {
    const source = media.file ? 'local-upload' : 'asset-library';
    updateShot(shot.id, { ...shot, storyboardImage: { ...media, source } });
    if (!media.file) return;

    apiUploadStoryboardImage(projectId, shot.id, media.file)
      .then((result) => {
        const url = normalizeImageUrl(result.url || result.image_url || result.imageUrl);
        if (url) {
          const next = { id: url, url, name: media.name, type: media.type, source };
          updateShot(shot.id, { ...shot, storyboardImage: next });
          return saveCandidateMedia(shot.id, { ...next, media_type: 'image', source });
        }
      })
      .catch((err) => console.error('[StoryboardPage] 图片上传失败:', err));
  }

  function handleShotVideoUpload(shot, media) {
    updateShot(shot.id, { ...shot, storyboardVideo: media });
    if (!media.file) return;

    apiUploadStoryboardVideo(projectId, shot.id, media.file)
      .then((result) => {
        const url = normalizeImageUrl(result.video_url || result.videoUrl || result.url);
        if (url) {
          const next = { id: url, url, name: media.name, type: media.type, source: 'local-upload' };
          updateShot(shot.id, { ...shot, storyboardVideo: next });
          return saveCandidateMedia(shot.id, { ...next, media_type: 'video', source: 'local-upload' });
        }
      })
      .catch((err) => console.error('[StoryboardPage] 视频上传失败:', err));
  }

  function addShotAfter(id) {
    const idx = shots.findIndex((s) => s.id === id);
    const newShot = makeStoryboardShot(idx + 2);

    apiCreateStoryboard(projectId, { ...toBackendStoryboard(newShot), episode_id: getEpisodeId(episode) })
      .then((created) => {
        const shotWithRealId = enrichMainRefs(normalizeStoryboard(created), storyboardSubjects);
        setShots((prev) => {
          const reordered = insertStoryboardShot(prev, idx + 1, shotWithRealId);
          const orderedIds = reordered.map(s => s.id);
          apiReorderStoryboards(projectId, orderedIds).catch(console.error);
          return reordered;
        });
      })
      .catch((err) => {
        console.error('[StoryboardPage] 创建分镜失败:', err);
      });
  }

  function copyShot(id) {
    const idx = shots.findIndex((s) => s.id === id);
    const original = shots[idx];
    const copy = { ...original, id: undefined };

    apiCreateStoryboard(projectId, { ...toBackendStoryboard(copy), episode_id: getEpisodeId(episode) })
      .then((created) => {
        // 合并原始富数据 + 后端生成的 ID
        const shotWithRealId = { ...copy, ...enrichMainRefs(normalizeStoryboard(created), storyboardSubjects) };
        setShots((prev) => {
          const reordered = insertStoryboardShot(prev, idx + 1, shotWithRealId);
          const orderedIds = reordered.map(s => s.id);
          apiReorderStoryboards(projectId, orderedIds).catch(console.error);
          return reordered;
        });
      })
      .catch((err) => {
        console.error('[StoryboardPage] 复制分镜失败:', err);
      });
  }

  function deleteShot(id) {
    apiDeleteStoryboard(projectId, id)
      .then(() => {
        setShots((prev) => {
          const reordered = removeStoryboardShot(prev, id);

          // 使用原子操作更新所有分镜的顺序
          const orderedIds = reordered.map(s => s.id);
          apiReorderStoryboards(projectId, orderedIds).catch(console.error);

          return reordered;
        });
      })
      .catch((err) => {
        console.error('[StoryboardPage] 删除分镜失败:', err);
      });
  }

  function addNewShot() {
    const newNumber = shots.length + 1;
    const newShot = makeStoryboardShot(newNumber);

    apiCreateStoryboard(projectId, { ...toBackendStoryboard(newShot), episode_id: getEpisodeId(episode) })
      .then((created) => {
        const shotWithRealId = enrichMainRefs(normalizeStoryboard(created), storyboardSubjects);
        setHasManuallyInteracted(true);
        setShots((prev) => renumberStoryboardShots([...prev, shotWithRealId]));
      })
      .catch((err) => {
        console.error('[StoryboardPage] 创建分镜失败:', err);
      });
  }

  function handleDrop(targetId) {
    if (!dragId || dragId === targetId) { setDragId(null); setOverId(null); return; }
    setShots((prev) => {
      const reordered = moveStoryboardShot(prev, dragId, targetId);
      if (reordered === prev) return prev;
      apiReorderStoryboards(projectId, reordered.map(s => s.id)).catch(console.error);
      return reordered;
    });
    setDragId(null);
    setOverId(null);
  }

  // 判断是否显示 loading / 错误态
  // homeIsGenerating 期间如果已有分镜数据，直接展示数据，不再显示全屏 loading
  const showGeneratingLoading = (isGenerating || homeIsGenerating) && shots.length === 0;
  const episodeDataReady = hasLoadedEpisodeData && loadedEpisodeDataKey === getEpisodeId(episode);
  const showGeneratingError = episodeDataReady && (!!generateError || episodeGenerationError) && shots.length === 0 && !hasManuallyInteracted;
  const showStoryboardLoadError = episodeDataReady && storyboardLoadError && !showGeneratingLoading && shots.length === 0 && !hasManuallyInteracted;
  const showEpisodeStart = episodeDataReady && !storyboardLoadError && !isLoadingEpisode && !showGeneratingLoading && shots.length === 0 && !hasManuallyInteracted;
  const displayLoadingText = statusMessage || loadingTexts[loadingTextIndex];
  const totalDuration = shots.reduce((sum, shot) => {
    const value = Number.parseFloat(shot.params?.duration ?? shot.duration ?? 0);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);
  const isMediaLoading = (shot) => {
    if (!isBackendStoryboardId(shot?.backendId || shot?.id)) return false;
    return mediaLoadingMap[shot.id] === true
      || !Object.prototype.hasOwnProperty.call(candidateMediaMap, shot.id);
  };
  const resolvedMediaLoadingMap = Object.fromEntries(
    shots.map((shot) => [shot.id, isMediaLoading(shot)]),
  );
  const getCreationCandidates = (shotId) => mergeStoryboardMediaItems(
    pendingCandidateMap[shotId] || [],
    candidateMediaMap[shotId] || [],
  );

  const storyboardHeader = (
    <StoryboardHeader
      projectName={projectName}
      activeEpisodes={activeEpisodes}
      episode={episode}
      onEpisodeChange={setEpisode}
      homeIsGenerating={homeIsGenerating && shots.length > 0}
      shotsCount={shots.length}
      totalDuration={totalDuration}
      completedEpisodesCount={completedEpisodesCount}
      downloadMode={downloadMode}
      selectedCount={selectedShotIds.size}
      generationDisabled={generatingImages || generatingVideos}
      onOpenImageModal={() => setShowImageModal(true)}
      onOpenVideoModal={() => setShowVideoModal(true)}
      onEnterDownloadMode={enterDownloadMode}
      onSelectAll={toggleSelectAll}
      onDownload={handleDownload}
      onExitDownloadMode={exitDownloadMode}
      onStartEdit={handleStartEdit}
      onRegenerate={openRegenerateModal}
      showStoryboardSummary={shots.length > 0}
      showBatchToolbar={shots.length > 0}
    />
  );

  const handleEmptyEpisodeStart = showGeneratingError ? () => {
    setEpisodeGenerationError(false);
    setIsGenerating(true);
    const start = onRetryGenerateStoryboards || onGenerateStoryboards;
    Promise.resolve(start?.()).finally(() => setIsGenerating(false));
  } : handleStartEpisodeGeneration;

  if (showGeneratingLoading) {
    return <StoryboardLoadingState loadingText={displayLoadingText} storyboardPageRef={storyboardPageRef} />;
  }

  if (showStoryboardLoadError || showGeneratingError || showEpisodeStart) {
    return (
      <StoryboardEmptyState
        showError={showStoryboardLoadError}
        header={storyboardHeader}
        projectRatio={projectRatio}
        timeline={<StoryboardFinalizedTimeline projectRatio={projectRatio} shots={[]} finalizedMap={{}} />}
        onContentBlankClick={() => setActiveShotId(null)}
        onResetActiveShot={() => setActiveShotId(null)}
        onStart={handleEmptyEpisodeStart}
        storyboardPageRef={storyboardPageRef}
      />
    );
  }

  return (
    <>
    <div style={{
      position: 'absolute',
      inset: 0,
      marginBottom: '24px',
      marginRight: '32px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      backgroundColor: 'var(--color-dark-bg)',
      backgroundImage: 'none',
      borderRadius: 0,
      border: 0,
      padding: 0,
      overflow: 'hidden',
      boxSizing: 'border-box',
    }} ref={storyboardPageRef} onClick={(event) => {
      if (event.target.closest('[data-storyboard-shot-row="true"], [data-storyboard-finalized-card="true"], [data-storyboard-header="true"], button, input, textarea, select, [role="button"]')) return;
      setActiveShotId(null);
    }}>
      <StoryboardContentArea
        header={storyboardHeader}
        onContentBlankClick={() => setActiveShotId(null)}
        projectRatio={projectRatio}
        timeline={<StoryboardFinalizedTimeline
          projectRatio={projectRatio}
          shots={shots}
          finalizedMap={finalizedMediaMap}
          mediaLoadingMap={resolvedMediaLoadingMap}
          selectedShotId={activeShotId}
          onSelectShot={selectActiveShot}
          onCreate={openCreationPanel}
          onPreview={(media, shot) => openTimelinePreview(media, shot)}
          onDownload={async (media, shot) => {
            try {
              if (media?.id && !String(media.id).startsWith('blob:')) {
                const blob = await apiDownloadStoryboardMediaCandidate(projectId, shot.id, media.id);
                downloadBlob(blob, media.name || `storyboard-${media.id}`);
                return;
              }
            } catch (error) {
              console.warn('[StoryboardPage] 候选媒体受控下载失败，回退直链:', error);
            }
            const link = document.createElement('a');
            link.href = normalizeImageUrl(media?.downloadUrl || media?.download_url || media?.url);
            link.download = media?.name || `storyboard-${media?.id || 'media'}`;
            link.click();
          }}
        />}
      >
      {isLoadingEpisode || (!episodeDataReady && shots.length === 0) ? (
        <div
          aria-label="正在加载分镜"
          role="status"
          style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#060606' }}
        >
          <DotsLoading size={6} color="#2DC3E1" gap={4} />
        </div>
      ) : (
        <StoryboardShotList
          shotListRef={shotListRef}
          shots={shots}
          dragId={dragId}
          overId={overId}
          isLoadingMoreShots={isLoadingMoreShots}
          onLoadMore={loadMoreShots}
          onDragEnd={() => { setDragId(null); setOverId(null); }}
          onDragOverBeforeFirst={(event) => { event.preventDefault(); setOverId('__before_first'); }}
          onDropBeforeFirst={(event) => { event.preventDefault(); handleDrop('__before_first'); }}
          onDragOverShot={(shotId) => { if (dragId && dragId !== shotId) setOverId(shotId); }}
          onDropShot={handleDrop}
          onDragOverAfterLast={(event) => { event.preventDefault(); setOverId('__after_last'); }}
          onDropAfterLast={(event) => { event.preventDefault(); handleDrop('__after_last'); }}
          onAddNewShot={addNewShot}
          renderShot={(shot, idx, listState) => (
            <StoryboardShotRowContent
              key={shot.id || `shot-${shot.number || idx + 1}-${idx}`}
              shot={removeDeletedSubjectRefs(shot)}
              projectId={projectId}
              durationOptions={getShotDurationOptions(shot)}
              onChange={(next) => updateShot(shot.id, next)}
              onAdd={() => addShotAfter(shot.id)}
              onCopy={() => copyShot(shot.id)}
              onDelete={() => deleteShot(shot.id)}
              chars={chars}
              isDragging={listState.isDragging}
              insertBefore={listState.insertBefore}
              insertAfter={listState.insertAfter}
              onDragStart={() => setDragId(shot.id)}
              onDragOver={listState.onDragOver}
              onDrop={listState.onDrop}
              onGenerateImage={() => {
                setGenImageHistoryMap((prev) => {
                  const shotId = shot.id;
                  if (!prev[shotId] || prev[shotId].length === 0) {
                    const initialized = { ...prev };
                    if (shot.storyboardImage?.url) initialized[shotId] = [{ url: shot.storyboardImage.url, settled: true, id: shot.storyboardImage.id }];
                    else if (generatingImageShotIds.has(shotId)) initialized[shotId] = [{ url: null, settled: false, id: `pending-resume-${shotId}` }];
                    else initialized[shotId] = [];
                    return initialized;
                  }
                  return prev;
                });
                setImagePanel({ shot });
              }}
              onGenerateVideo={() => {
                setGenVideoHistoryMap((prev) => {
                  const shotId = shot.id;
                  if (!prev[shotId] || prev[shotId].length === 0) {
                    const initialized = { ...prev };
                    if (shot.storyboardVideo?.url) initialized[shotId] = [{ url: shot.storyboardVideo.url, settled: true, id: shot.storyboardVideo.id }];
                    else if (generatingVideoShotIds.has(shotId)) initialized[shotId] = [{ url: null, settled: false, id: `pending-resume-${shotId}` }];
                    else initialized[shotId] = [];
                    return initialized;
                  }
                  return prev;
                });
                setVideoPanel({ shot, nextShot: shots[idx + 1] ?? null });
              }}
              onUploadImage={handleShotImageUpload}
              onUploadVideo={handleShotVideoUpload}
              globalVoiceParams={globalVoiceParams}
              onSaveGlobalVoice={(role, params) => setGlobalVoiceParams((prev) => ({ ...prev, [role]: params }))}
              generatingImage={generatingImageShotIds.has(shot.id)}
              generatingVideo={generatingVideoShotIds.has(shot.id)}
              genImageHistoryMap={genImageHistoryMap}
              genVideoHistoryMap={genVideoHistoryMap}
              candidates={getCreationCandidates(shot.id)}
              mediaLoading={isMediaLoading(shot)}
              onOpenCreation={() => openCreationPanel(shot)}
              onFinalizeToggle={(media) => handleFinalizeToggle(shot, media)}
              onSelectShot={() => selectActiveShot(shot.id)}
              isSelectMode={downloadMode}
              isSelected={selectedShotIds.has(shot.id)}
              isActive={activeShotId === shot.id}
              onSelect={() => selectActiveShot(shot.id)}
              onToggleSelect={() => toggleShotSelection(shot.id)}
              onUploadMainRef={async ({ file, tempRef, nextRefs }) => {
                const result = await apiUploadCreationImage({ file, category: 'reference', project_id: projectId });
                const uploadedUrl = normalizeImageUrl(getUploadedImageUrl(result));
                if (!uploadedUrl) throw new Error('上传成功但未返回可用的图片地址');
                const updatedRefs = nextRefs.map((ref) => (
                  ref.id === tempRef.id
                    ? { id: getUploadedImageId(result, uploadedUrl), url: uploadedUrl, name: file.name, type: file.type, uploaded: true }
                    : ref
                ));
                updateShot(shot.id, { ...shot, mainRefs: updatedRefs });
              }}
              onConfirmMainRefAssets={(assets) => {
                const newRefs = assets.map(buildStoryboardRefFromAsset);
                updateShot(shot.id, { ...shot, mainRefs: [...shot.mainRefs, ...newRefs] });
              }}
            />
          )}
        />
      )}
      </StoryboardContentArea>
    </div>
    {showImageModal && (
      <BatchImageModal
        shots={shots}
        shotCount={shots.length}
        finalizedMediaMap={finalizedMediaMap}
        onClose={() => setShowImageModal(false)}
        onConfirm={(params) => startBatchGenImages(params)}
        projectRatio={projectRatio}
      />
    )}
    {showVideoModal && (
      <BatchVideoModal
        shots={shots}
        finalizedMediaMap={finalizedMediaMap}
        onClose={() => setShowVideoModal(false)}
        onConfirm={(params) => startBatchGenVideos(params)}
        projectRatio={projectRatio}
      />
    )}
    <AIRegenerateStoryboardModal
      key={regenerateModalKey}
      open={regenerateModalOpen}
      error={regenerateModalError}
      onSubmit={handleRegenerate}
      onClose={() => {
        setRegenerateModalOpen(false);
        setRegenerateModalError('');
      }}
    />
    {timelinePreviewMedia ? (
      <StoryboardMediaDetailModal
        key={`${timelinePreviewMedia.shot?.id || 'shot'}-${timelinePreviewMedia.media?.id || timelinePreviewMedia.media?.url || 'media'}`}
        shot={timelinePreviewMedia.shot}
        media={timelinePreviewMedia.media}
        candidates={timelinePreviewMedia.candidates}
        onClose={() => setTimelinePreviewMedia(null)}
        onFinalizeChange={handleTimelineFinalizeChange}
        onDownload={async (media) => {
          try {
            if (media?.id && !String(media.id).startsWith('blob:')) {
              const blob = await apiDownloadStoryboardMediaCandidate(projectId, timelinePreviewMedia.shot.id, media.id);
              downloadBlob(blob, media.name || `storyboard-${media.id}`);
              return;
            }
          } catch (error) {
            console.warn('[StoryboardPage] 详情媒体受控下载失败，回退直链:', error);
          }
          const link = document.createElement('a');
          link.href = normalizeImageUrl(media?.downloadUrl || media?.download_url || media?.url);
          link.download = media?.name || `storyboard-${media?.id || 'media'}`;
          link.click();
        }}
      />
    ) : null}
    {creationPanel && (
      <StoryboardCreationPanel
        projectId={projectId}
        storyboardId={creationPanel.shot?.id}
        initialTab={creationPanel.tab}
        onTabChange={handleCreationTabChange}
        candidates={getCreationCandidates(creationPanel.shot?.id)}
        onCandidateMedia={(media) => saveCandidateMedia(creationPanel.shot?.id, media)}
        onFinalizeToggle={(media) => handleFinalizeToggle(creationPanel.shot, media)}
        onPreview={(media) => openTimelinePreview(media, creationPanel.shot)}
        onDownload={async (media) => {
          try {
            if (media?.id && !String(media.id).startsWith('blob:')) {
              const blob = await apiDownloadStoryboardMediaCandidate(projectId, creationPanel.shot.id, media.id);
              downloadBlob(blob, media.name || `storyboard-${media.id}`);
              return;
            }
          } catch (error) {
            console.warn('[StoryboardPage] 候选媒体受控下载失败，回退直链:', error);
          }
          const link = document.createElement('a');
          link.href = normalizeImageUrl(media?.downloadUrl || media?.download_url || media?.url);
          link.download = media?.name || `storyboard-${media?.id || 'media'}`;
          link.click();
        }}
        onClose={handleCreationPanelClose}
      >
    {imagePanel && creationPanel.tab === 'image' && (
      <GenerateImagePanel
        shot={imagePanel.shot}
        chars={chars}
        projectId={projectId}
        scenes={scenes}
        props={props}
        projectRatio={projectRatio}
        buildStoryboardPrompt={buildStoryboardPrompt}
        ModalCloseBtn={ModalCloseBtn}
        PanelPromptInput={PanelPromptInput}
        embedded
        formState={imageFormStateMap[imagePanel.shot?.id] ?? imagePanel.shot?.creationForm?.image}
        onFormStateChange={handleImageFormStateChange}
        onCandidateMedia={(media) => saveCandidateMedia(imagePanel.shot?.id, media)}
        generatedImages={genImageHistoryMap[imagePanel.shot?.id] ?? []}
        onSetGeneratedImages={(updater) => {
          const shotId = imagePanel.shot?.id;
          setGenImageHistoryMap((prev) => ({
            ...prev,
            [shotId]: typeof updater === 'function' ? updater(prev[shotId] ?? []) : updater,
          }));
        }}
        onClose={handleCreationPanelClose}
        onShowToast={showToast}
       onSettleImage={(imageUrl) => {
         const n = normalizeImageUrl(imageUrl);
         const shotId = imagePanel.shot?.id;
         const target = shots.find((s) => s.id === shotId);
         const form = imageFormStateMap[shotId] || {};
         const referenceImages = toSafeStoryboardReferenceUrls(form.refImages);
         setShots((prev) => prev.map((s) =>
           s.id === shotId
             ? { ...s, storyboardImage: { id: n, url: n, name: '分镜图', type: 'image/jpeg' } }
             : s
         ));
         saveCandidateMedia(shotId, {
           id: n,
           url: n,
           name: '分镜图',
           type: 'image/jpeg',
           media_type: 'image',
           source: 'ai-generated',
           prompt: form.prompt,
           model: form.model,
           resolution: form.resolution,
           ratio: projectRatio,
           referenceImages,
           genParams: {
             model: form.model,
             resolution: form.resolution,
             ratio: projectRatio,
             reference_images: referenceImages,
           },
         });
         if (target) {
           apiUpdateStoryboard(
             projectId,
             shotId,
             toBackendStoryboard({
               ...target,
               storyboardImage: { id: n, url: n, name: '分镜图', type: 'image/jpeg' },
             }),
           ).catch(console.error);
         }
       }}
      onGenerate={async (params) => {
        const shot = imagePanel.shot;
        let taskId = null;
        const pendingClientId = addPendingCandidate(shot.id, 'image');
        try {
          setGeneratingImageShotIds(prev => new Set([...prev, shot.id]));
          const taskResp = await apiGenerateStoryboardImage(projectId, shot.id, { model: params.model, resolution: params.resolution, prompt: params.prompt, aspect_ratio: projectRatio, reference_images: toSafeStoryboardReferenceUrls(params.refImages) });
          taskId = getStoryboardTaskId(taskResp);
          if (!taskId) throw new Error('分镜图生成接口未返回任务 ID');
          bindPendingCandidate(shot.id, pendingClientId, taskId);
          addPendingTask(projectId, { taskId, shotId: shot.id, episodeId: getEpisodeId(episode), type: 'image' });
          const task = await pollTask(taskId, hasStoryboardImageTaskResult);
          if ((getStoryboardTaskStatus(task) === 'completed' || getStoryboardTaskStatus(task) === 'partial') || hasStoryboardImageTaskResult(task)) {
             const imageUrl = extractStoryboardImageUrl(task);
             if (imageUrl) {
               const normalizedUrl = normalizeImageUrl(imageUrl);
               setShots((prev) => prev.map((s) => s.id === shot.id && !s.storyboardImage
                 ? { ...s, storyboardImage: { id: normalizedUrl, url: normalizedUrl, name: 'generated.jpg', type: 'image/jpeg' } }
                 : s
               ));
               await saveCandidateMedia(shot.id, { id: normalizedUrl, url: normalizedUrl, name: 'generated.jpg', type: 'image/jpeg', media_type: 'image', source: 'ai-generated', prompt: params.prompt, model: params.model, resolution: params.resolution, ratio: projectRatio, referenceImages: toSafeStoryboardReferenceUrls(params.refImages), genParams: { model: params.model, resolution: params.resolution, ratio: projectRatio, reference_images: toSafeStoryboardReferenceUrls(params.refImages) } });
               return { url: normalizedUrl };
             }
           }
           const errMsg = task.error_msg || task.errorMsg || '生成失败，请重试';
           throw new Error(errMsg);
         } catch (err) {
          console.error('[StoryboardPage] 生成分镜图失败:', err);
          throw err;
         } finally {
           if (taskId) removePendingTask(projectId, taskId);
           removePendingCandidate(taskId || pendingClientId, shot.id);
           setGeneratingImageShotIds(prev => {
            const next = new Set(prev); next.delete(shot.id); return next;
          });
        }
      }}
      />
    )}
    {videoPanel && creationPanel.tab === 'video' && (
      <GenerateVideoPanel
        // 主体参考列变更时重置面板内部主体快照，避免旧 refSubjects effect 在父级更新后回写。
        key={`${videoPanel.shot?.id || 'shot'}:${(videoPanel.shot?.mainRefs || []).map((ref) => (
          ref?.subjectId || ref?.subject_id || ref?.assetId || ref?.asset_id || ref?.id || ref?.url || ''
        )).join('|')}`}
        shot={videoPanel.shot}
        projectId={projectId}
        nextShot={videoPanel.nextShot}
        chars={chars}
        scenes={scenes}
        props={props}
        projectRatio={projectRatio}
        buildStoryboardPrompt={buildStoryboardPrompt}
        buildRefFromAsset={buildStoryboardRefFromAsset}
        ModalCloseBtn={ModalCloseBtn}
        PanelPromptInput={PanelPromptInput}
        embedded
        formState={videoFormStateMap[videoPanel.shot?.id]
          ?? videoPanel.shot?.creationForm?.video}
        onFormStateChange={handleVideoFormStateChange}
        onCandidateMedia={(media) => saveCandidateMedia(videoPanel.shot?.id, media)}
        generatedVideos={genVideoHistoryMap[videoPanel.shot?.id] ?? []}
        onSetGeneratedVideos={(updater) => {
          const shotId = videoPanel.shot?.id;
          setGenVideoHistoryMap((prev) => ({
            ...prev,
            [shotId]: mergeStoryboardMediaItems(
              typeof updater === 'function' ? updater(prev[shotId] ?? []) : updater,
              [],
            ),
          }));
        }}
        onClose={handleCreationPanelClose}
        onShowToast={showToast}
        onSettleVideo={(videoUrl) => {
          const n = normalizeImageUrl(videoUrl);
          const shotId = videoPanel.shot.id;
          const form = videoFormStateMap[shotId] || {};
          const referenceImages = form.refImages?.length
            ? toSafeStoryboardReferenceUrls(form.refImages)
            : undefined;
          const durationValue = form.duration == null || form.duration === ''
            ? undefined
            : Number.parseFloat(form.duration);
          setShots((prev) => {
            const updated = prev.map((s) => s.id === shotId
              ? { ...s, storyboardVideo: { id: n, url: n, name: 'generated.mp4', type: 'video/mp4' } }
              : s
            );
            return updated;
          });
          saveCandidateMedia(shotId, {
            id: n,
            url: n,
            name: 'generated.mp4',
            type: 'video/mp4',
            media_type: 'video',
            source: 'ai-generated',
            prompt: form.prompt,
            model: form.model,
            resolution: form.resolution,
            duration: Number.isNaN(durationValue) ? undefined : durationValue,
            ratio: projectRatio,
            referenceImages,
            genParams: {
              model: form.model,
              resolution: form.resolution,
              duration: Number.isNaN(durationValue) ? undefined : durationValue,
              sound_effect: form.sound,
              ratio: projectRatio,
              reference_images: referenceImages,
              first_frame_url: form.refFirstFrame?.url,
              last_frame_url: form.refLastFrame?.url,
              reference_video_url: form.refVideos?.[0]?.url,
              reference_audio_url: form.refAudios?.[0]?.url,
            },
          });
          // API 调用放在 setShots 外面，避免在 state updater 内产生副作用
          apiUpdateStoryboard(projectId, shotId, { video_url: n })
            .then((res) => console.log('[onSettleVideo] video_url 保存成功，后端返回:', JSON.stringify(res)))
            .catch((err) => console.error('[onSettleVideo] video_url 保存失败', err));
        }}
       onGenerate={async (params) => {
         const shot = videoPanel.shot;
         let taskId = null;
         const pendingClientId = addPendingCandidate(shot.id, 'video');
         try {
           setGeneratingVideoShotIds(prev => new Set([...prev, shot.id]));
           // 解析时长：将"Ns"格式转为数字
           const durationValue = (() => {
              if (!params.duration) return undefined;
              const parsed = parseFloat(params.duration);
              return isNaN(parsed) ? undefined : parsed;
            })();
            const taskResp = await apiGenerateStoryboardVideo(projectId, shot.id, {
                model: params.model,
                resolution: params.resolution,
                duration: durationValue,
                sound_effect: params.sound,
                prompt: params.prompt,
                ratio: projectRatio,
                reference_images: (params.reference_images || toSafeStoryboardReferenceUrls(params.refImages)),
                first_frame_url: toAbsoluteUrl(params.first_frame_url),
                last_frame_url: toAbsoluteUrl(params.last_frame_url),
                reference_video_url: toAbsoluteUrl(params.reference_video_url),
                reference_audio_url: toAbsoluteUrl(params.reference_audio_url),
              });
            taskId = getStoryboardTaskId(taskResp);
            if (!taskId) throw new Error('分镜视频生成接口未返回任务 ID');
            bindPendingCandidate(shot.id, pendingClientId, taskId);
            addPendingTask(projectId, { taskId, shotId: shot.id, episodeId: getEpisodeId(episode), type: 'video' });
            const task = await pollTask(taskId, hasStoryboardVideoTaskResult);
            const videoUrl = extractStoryboardVideoUrl(task);
            if (videoUrl) {
              const normalizedUrl = normalizeImageUrl(videoUrl);
              // 任务已有可播放结果时立即移除任务占位，候选保存接口较慢也不能并排渲染占位和正式结果。
              removePendingCandidate(taskId || pendingClientId, shot.id);
              // 将参考素材信息一并存入 shot，供查看弹窗展示
              const refInfo = {
                referenceImages: params.reference_images?.length > 0 ? params.reference_images : undefined,
                firstFrameUrl: params.first_frame_url || undefined,
                lastFrameUrl: params.last_frame_url || undefined,
                referenceVideoUrl: params.reference_video_url || undefined,
                referenceAudioUrl: params.reference_audio_url || undefined,
              };
              setShots((prev) => {
                const updated = prev.map((s) => s.id === shot.id && !s.storyboardVideo
                  ? { ...s, storyboardVideo: { id: `vid-${shot.id}`, url: normalizedUrl, name: 'generated.mp4', type: 'video/mp4' }, ...refInfo }
                  : s
                );
                // 若该分镜尚无视频（首次生成），自动持久化到后端
                const wasEmpty = !prev.find(s => s.id === shot.id)?.storyboardVideo;
                if (wasEmpty) {
                  apiUpdateStoryboard(projectId, shot.id, { video_url: normalizedUrl }).catch(console.error);
                }
                return updated;
              });
              await saveCandidateMedia(shot.id, { id: `vid-${shot.id}`, url: normalizedUrl, name: 'generated.mp4', type: 'video/mp4', media_type: 'video', source: 'ai-generated', prompt: params.prompt, model: params.model, resolution: params.resolution, duration: durationValue, ratio: projectRatio, referenceImages: params.reference_images || toSafeStoryboardReferenceUrls(params.refImages), genParams: { model: params.model, resolution: params.resolution, duration: durationValue, sound_effect: params.sound, ratio: projectRatio, reference_images: params.reference_images || toSafeStoryboardReferenceUrls(params.refImages), first_frame_url: params.first_frame_url, last_frame_url: params.last_frame_url, reference_video_url: params.reference_video_url, reference_audio_url: params.reference_audio_url } });
              return { url: normalizedUrl };
            }
            // 终态但没有视频 — 发送 toast 提示失败
            const failStatuses = ['failed', 'cancelled', 'canceled', 'expired', 'error'];
            if (failStatuses.includes(getStoryboardTaskStatus(task)) || (!task.result && !task.results?.length)) {
              const errMsg = task.error_msg || task.errorMsg
              || (Array.isArray(task.results) && task.results[0]?.error)
              || (getStoryboardTaskStatus(task) ? `任务状态: ${getStoryboardTaskStatus(task)}` : '');
              throw Object.assign(new Error(errMsg || '视频生成失败'), { status: getStoryboardTaskStatus(task) });
            }
            const errMsg = task.error_msg || task.errorMsg || '生成失败，请重试';
           throw new Error(errMsg);
          } catch (err) {
           console.error('[StoryboardPage] 生成分镜视频失败:', err);
           throw err;
          } finally {
           if (taskId) removePendingTask(projectId, taskId);
           removePendingCandidate(taskId || pendingClientId, shot.id);
           setGeneratingVideoShotIds(prev => {
             const next = new Set(prev); next.delete(shot.id); return next;
           });
         }
       }}
      />
    )}
      </StoryboardCreationPanel>
    )}
    <StoryboardToast toast={toast} />
  </>
  );
}
