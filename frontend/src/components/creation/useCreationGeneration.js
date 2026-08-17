/**
 * @file useCreationGeneration.js
 * @structure-index
 *
 * ─── 生成动作 ───────────────────────────────────────────────
 *   useCreationGeneration  创建创作请求、占位卡和结果卡，并处理失败/取消清理
 *   cancelGeneration       取消当前配音请求并清理前端占位状态
 *
 * ─── 依赖边界 ───────────────────────────────────────────────
 *   页面通过显式参数传入 Session、Store、Toast 和并发计数动作；
 *   Hook 不读取 CreationPage 闭包，不管理页面级状态或历史加载；
 *   取消只中断前端请求和轮询，后端任务是否停止取决于后端取消能力。
 *   完成卡写入图片、视频和配音记录 ID，供页面调用正式下载接口。
 */

import { useCallback, useRef } from 'react';
import {
  apiCreateShot,
  apiGenerateCreation,
  apiUpdateShot,
} from '../../api/creation';
import { normalizeImageUrl } from '../../utils/imageUrl';
import {
  AUDIO_EXTS_SET,
  isVideoFile,
} from './CreationFileUtils';

const PENDING_CREATION_TASKS_KEY = 'miioo_pending_tasks';

function createAbortError() {
  const error = new Error('请求已停止');
  error.name = 'AbortError';
  return error;
}

function getCreationTab(genType) {
  return genType === 'video' ? 'video'
    : (genType === 'dubbing' || genType === 'music') ? genType
      : 'image';
}

function getAudioReferenceFiles(files = []) {
  return files.filter((file) => {
    if (!file || typeof file !== 'object') return false;
    if (file.type && file.type.startsWith('audio/')) return true;
    if (file.isAsset && file.url) {
      if (/\.(mp3|wav|aac|ogg|flac|m4a|wma)$/i.test(file.url)) return true;
    }
    const ext = '.' + (file.name || '').split('.').pop().toLowerCase();
    return AUDIO_EXTS_SET.has(ext);
  });
}

function toReferenceAudio(file) {
  return {
    url: file.url || null,
    name: file.name || 'ref.mp3',
    size: file.size || 0,
  };
}

function toReferenceVideo(file) {
  return {
    url: file.url || null,
    previewUrl: file.previewUrl || (file instanceof File ? URL.createObjectURL(file) : (file.url || null)),
    isAsset: true,
    name: file.name || 'ref.mp4',
    size: file.size || 0,
  };
}

function toPendingReferenceVideo(file) {
  return {
    url: file.url || null,
    name: file.name || 'ref.mp4',
    size: file.size || 0,
  };
}

function toLiveMaterialReference(file) {
  return {
    url: file.previewUrl || file.url || '',
    previewUrl: file.previewUrl || file.url || '',
    isAsset: true,
    isLiveMaterial: true,
    assetId: file.assetId,
    groupId: file.groupId,
    groupType: file.groupType,
    assetRefUrl: file.assetRefUrl,
    name: file.name || '真人素材',
    size: 0,
    type: 'image/jpeg',
  };
}

function readPendingTasks() {
  try {
    return JSON.parse(localStorage.getItem(PENDING_CREATION_TASKS_KEY) || '[]');
  } catch {
    return [];
  }
}

function removePendingTask(genId) {
  try {
    const pending = readPendingTasks().filter((task) => task.genId !== genId);
    localStorage.setItem(PENDING_CREATION_TASKS_KEY, JSON.stringify(pending));
  } catch {
    // pending task cleanup is best-effort
  }
}

function createPendingTaskSnapshot({ taskId, genId, shotId, tab, params }) {
  return {
    taskId,
    genId,
    shotId: shotId || null,
    tab,
    genType: params.genType || 'image',
    count: parseInt(params.count, 10) || 1,
    prompt: params.prompt || '',
    promptHTML: params.promptHTML || '',
    model: params.model || '',
    ratio: params.ratio || params.videoRatio || '16:9',
    resolution: params.resolution || params.videoResolution || '',
    duration: params.videoDuration || '5s',
    createdAt: new Date().toISOString(),
    refVideos: (params.files || []).filter(isVideoFile).map(toPendingReferenceVideo),
    refAudios: getAudioReferenceFiles(params.files).map(toReferenceAudio),
  };
}

function persistPendingTask(snapshot) {
  try {
    const pending = readPendingTasks();
    pending.push(snapshot);
    localStorage.setItem(PENDING_CREATION_TASKS_KEY, JSON.stringify(pending));
  } catch {
    // pending task persistence is best-effort
  }
}

function createGenerationPlaceholder({ genId, shotId, params, countNum, isVideoGen, isAudioGen }) {
  const files = params.files || [];
  const placeholderCardId = `placeholder-${Date.now()}`;
  const cardCount = isVideoGen || isAudioGen ? 1 : countNum;

  return {
    id: genId,
    shot_id: shotId || undefined,
    ratio: params.ratio || (isVideoGen ? params.videoRatio : '') || '16:9',
    resolution: params.resolution || (isVideoGen ? params.videoResolution : '') || '',
    duration: isVideoGen ? params.videoDuration : undefined,
    model: params.model || '',
    prompt: params.prompt || '',
    promptHTML: params.promptHTML || '',
    refImages: (params.liveMaterialFiles || []).map(toLiveMaterialReference),
    refVideos: files.filter(isVideoFile).map(toReferenceVideo),
    refAudios: getAudioReferenceFiles(files).map(toReferenceAudio),
    createdAt: new Date().toISOString(),
    cards: Array.from({ length: cardCount }, (_, index) => ({
      id: null,
      type: isVideoGen ? 'video' : isAudioGen ? 'audio' : 'image',
      status: 'loading',
      imageUrl: null,
      videoUrl: null,
      audioUrl: null,
      placeholderId: `${placeholderCardId}-${index}`,
    })),
  };
}

function createCompletedGeneration({ genId, shotId, params, result, mediaUrls, imageDownloadUrls, audioIds, isVideoGen, isAudioGen }) {
  const genMeta = {
    prompt: params.prompt || '',
    model: params.model || '',
    ratio: params.ratio || (isVideoGen ? params.videoRatio : '') || '16:9',
    resolution: params.resolution || (isVideoGen ? params.videoResolution : '') || '',
    duration: isVideoGen ? params.videoDuration : undefined,
    createdAt: new Date().toISOString(),
    genType: params.genType || 'image',
  };

  return {
    id: genId,
    shot_id: shotId || undefined,
    ratio: genMeta.ratio,
    resolution: genMeta.resolution,
    duration: genMeta.duration,
    model: genMeta.model,
    prompt: genMeta.prompt,
    promptHTML: params.promptHTML || '',
    refImages: [
      ...(result.referenceImages || []).map((url) => ({
        url: normalizeImageUrl(url) || url,
        previewUrl: normalizeImageUrl(url) || url,
        isAsset: true,
        name: (url || '').split('/').pop() || 'ref.png',
        size: 0,
      })),
      ...(params.liveMaterialFiles || []).map(toLiveMaterialReference),
    ],
    refVideos: (result.referenceVideos || []).map((url) => ({
      url,
      previewUrl: url,
      isAsset: true,
      name: (url || '').split('/').pop() || 'ref.mp4',
      size: 0,
    })),
    refAudios: (result.referenceAudios || []).map((url) => ({
      url,
      name: (url || '').split('/').pop() || 'ref.mp3',
      size: 0,
    })),
    refMode: result.refMode || undefined,
    firstFrameUrl: result.firstFrameUrl || undefined,
    lastFrameUrl: result.lastFrameUrl || undefined,
    createdAt: genMeta.createdAt,
    cards: mediaUrls.map((url, index) => ({
      id: isAudioGen ? (audioIds?.[index] || null) : (result.cardIds?.[index] || null),
      type: isVideoGen ? 'video' : isAudioGen ? 'audio' : 'image',
      status: 'done',
      imageUrl: isAudioGen ? null : (isVideoGen ? null : url),
      originalUrl: !isVideoGen && !isAudioGen ? (imageDownloadUrls?.[index] || url) : undefined,
      videoUrl: isVideoGen ? url : null,
      audioUrl: isAudioGen ? url : null,
      audioId: isAudioGen ? (audioIds?.[index] || null) : undefined,
    })),
  };
}

export function useCreationGeneration({
  activeTab,
  isLoggedIn,
  sessionIdRef,
  addGeneration,
  storeDeleteGeneration,
  storeUpdateCardIds,
  incrementActive,
  decrementActive,
  showToast,
}) {
  const activeGenerationRef = useRef(null);

  const generateCreation = useCallback(async (params) => {
    const controller = new AbortController();
    const currentTab = activeTab;
    const genType = params.genType || 'image';
    const request = {
      controller,
      currentTab,
      genType,
      genId: null,
      params,
      cancelled: false,
    };
    activeGenerationRef.current = request;

    incrementActive(getCreationTab(genType));
    const countNum = parseInt(params.count, 10) || 1;
    const isVideoGen = genType === 'video';
    const isAudioGen = genType === 'dubbing' || genType === 'music';
    const shotTypeLabel = isVideoGen ? '视频' : isAudioGen ? (genType === 'music' ? '音乐' : '配音') : '图片';
    let shotId = null;

    if (isLoggedIn && sessionIdRef.current) {
      try {
        const now = new Date();
        const timestamp = now.toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        const shot = await apiCreateShot(sessionIdRef.current, {
          title: `${shotTypeLabel} - ${timestamp}`,
          prompt: params.prompt || undefined,
          duration: isVideoGen ? (parseInt(params.videoDuration, 10) || 5) : undefined,
        }, { signal: controller.signal });
        shotId = shot.id;
        params.session_id = sessionIdRef.current;
        params.shot_id = shotId;
      } catch (error) {
        if (error?.name === 'AbortError' || controller.signal.aborted) {
          request.cancelled = true;
        }
        // shot creation fails silently; generation still proceeds
      }
    }

    if (request.cancelled || controller.signal.aborted) {
      params.onCancel?.();
      decrementActive(getCreationTab(genType));
      if (activeGenerationRef.current === request) {
        activeGenerationRef.current = null;
      }
      return { success: false };
    }

    const genId = `gen-${Date.now()}`;
    request.genId = genId;
    addGeneration(currentTab, createGenerationPlaceholder({
      genId,
      shotId,
      params,
      countNum,
      isVideoGen,
      isAudioGen,
    }));

    try {
      const result = await apiGenerateCreation(params, {
        signal: controller.signal,
        onTaskCreated: ({ taskId }) => {
          if (request.cancelled || controller.signal.aborted) return;
          persistPendingTask(createPendingTaskSnapshot({
            taskId,
            genId,
            shotId,
            tab: currentTab,
            params,
          }));
        },
      });
      if (request.cancelled || controller.signal.aborted) throw createAbortError();
      const rawMediaUrls = isVideoGen ? (result.videos ?? []) : isAudioGen ? (result.audios ?? []) : (result.images ?? []);
      const audioIds = isAudioGen ? (result.audioIds || []) : [];
      let mediaUrls;
      let imageDownloadUrls = [];
      if (!isVideoGen && !isAudioGen) {
        const imageEntries = rawMediaUrls
          .map((url, index) => {
            const previewUrl = normalizeImageUrl(url) || url;
            const rawDownloadUrl = result.imageDownloadUrls?.[index] || previewUrl;
            return {
              previewUrl,
              downloadUrl: normalizeImageUrl(rawDownloadUrl) || rawDownloadUrl,
            };
          })
          .filter(({ previewUrl }) => Boolean(previewUrl))
          .filter((entry, index, entries) => entries.findIndex((item) => item.previewUrl === entry.previewUrl) === index);
        mediaUrls = imageEntries.map(({ previewUrl }) => previewUrl);
        imageDownloadUrls = imageEntries.map(({ downloadUrl }) => downloadUrl);
      } else {
        mediaUrls = [...new Set(rawMediaUrls.map((url) => normalizeImageUrl(url) || url).filter(Boolean))];
      }

      if (!mediaUrls.length) {
        showToast('error', '生成失败，请稍后重试');
        storeDeleteGeneration(currentTab, genId);
        params.onFail?.(params.prompt);
        return { success: false };
      }

      storeDeleteGeneration(currentTab, genId);
      addGeneration(currentTab, createCompletedGeneration({
        genId,
        shotId,
        params,
        result,
        mediaUrls,
        imageDownloadUrls,
        audioIds,
        isVideoGen,
        isAudioGen,
      }));

      if (!isAudioGen && result.cardIds?.length) {
        storeUpdateCardIds(currentTab, genId, result.cardIds);
      }

      if (shotId) {
        try {
          const updateData = {};
          if (isVideoGen && mediaUrls.length > 0) updateData.video_url = mediaUrls[0];
          else if (!isAudioGen && mediaUrls.length > 0) updateData.image_url = mediaUrls[0];
          if (Object.keys(updateData).length > 0) await apiUpdateShot(shotId, updateData);
        } catch {
          // shot update fails silently
        }
      }
      removePendingTask(genId);
      return { success: true };
    } catch (error) {
      const cancelled = request.cancelled || error?.name === 'AbortError';
      removePendingTask(genId);
      storeDeleteGeneration(currentTab, genId);
      if (cancelled) {
        params.onCancel?.();
      } else {
        showToast('error', error?.message || '生成失败，请稍后重试');
        params.onFail?.(params.prompt);
      }
      return { success: false };
    } finally {
      decrementActive(getCreationTab(genType));
      if (activeGenerationRef.current === request) {
        activeGenerationRef.current = null;
      }
    }
  }, [
    activeTab,
    addGeneration,
    decrementActive,
    incrementActive,
    isLoggedIn,
    sessionIdRef,
    showToast,
    storeDeleteGeneration,
    storeUpdateCardIds,
  ]);

  const cancelGeneration = useCallback(() => {
    const request = activeGenerationRef.current;
    if (!request || (request.genType !== 'dubbing' && request.genType !== 'music')) return false;

    request.cancelled = true;
    request.controller.abort();
    removePendingTask(request.genId);
    if (request.genId) storeDeleteGeneration(request.currentTab, request.genId);
    return true;
  }, [storeDeleteGeneration]);

  return { generateCreation, cancelGeneration };
}
