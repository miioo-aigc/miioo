/**
 * @file useCreationGeneration.js
 * @structure-index
 *
 * ─── 生成动作 ───────────────────────────────────────────────
 *   useCreationGeneration  创建创作请求、占位卡和结果卡，并处理失败清理
 *
 * ─── 依赖边界 ───────────────────────────────────────────────
 *   页面通过显式参数传入 Session、Store、Toast 和并发计数动作；
 *   Hook 不读取 CreationPage 闭包，不管理页面级状态或历史加载。
 */

import { useCallback } from 'react';
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

function getCreationTab(genType) {
  return genType === 'video' ? 'video' : genType === 'dubbing' ? 'dubbing' : 'image';
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

function createGenerationPlaceholder({ genId, shotId, params, countNum, isVideoGen, isDubbingGen }) {
  const files = params.files || [];
  const placeholderCardId = `placeholder-${Date.now()}`;
  const cardCount = isVideoGen || isDubbingGen ? 1 : countNum;

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
      type: isVideoGen ? 'video' : isDubbingGen ? 'audio' : 'image',
      status: 'loading',
      imageUrl: null,
      videoUrl: null,
      audioUrl: null,
      placeholderId: `${placeholderCardId}-${index}`,
    })),
  };
}

function createCompletedGeneration({ genId, shotId, params, result, mediaUrls, imageDownloadUrls, isVideoGen, isDubbingGen }) {
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
      id: null,
      type: isVideoGen ? 'video' : isDubbingGen ? 'audio' : 'image',
      status: 'done',
      imageUrl: isDubbingGen ? null : (isVideoGen ? null : url),
      originalUrl: !isVideoGen && !isDubbingGen ? (imageDownloadUrls?.[index] || url) : undefined,
      videoUrl: isVideoGen ? url : null,
      audioUrl: isDubbingGen ? url : null,
    })),
  };
}

export function useCreationGeneration({
  activeTab,
  setGenerating,
  isLoggedIn,
  sessionIdRef,
  addGeneration,
  storeDeleteGeneration,
  storeUpdateCardIds,
  incrementActive,
  decrementActive,
  showToast,
}) {
  return useCallback(async (params) => {
    setGenerating(true);
    const genType = params.genType || 'image';
    incrementActive(getCreationTab(genType));
    const countNum = parseInt(params.count, 10) || 1;
    const isVideoGen = genType === 'video';
    const isDubbingGen = genType === 'dubbing';
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
          title: `${isVideoGen ? '视频' : '图片'} - ${timestamp}`,
          prompt: params.prompt || undefined,
          duration: isVideoGen ? (parseInt(params.videoDuration, 10) || 5) : undefined,
        });
        shotId = shot.id;
        params.session_id = sessionIdRef.current;
        params.shot_id = shotId;
      } catch {
        // shot creation fails silently; generation still proceeds
      }
    }

    const genId = `gen-${Date.now()}`;
    const currentTab = activeTab;
    addGeneration(currentTab, createGenerationPlaceholder({
      genId,
      shotId,
      params,
      countNum,
      isVideoGen,
      isDubbingGen,
    }));

    try {
      const result = await apiGenerateCreation(params, {
        onTaskCreated: ({ taskId }) => persistPendingTask(createPendingTaskSnapshot({
          taskId,
          genId,
          shotId,
          tab: currentTab,
          params,
        })),
      });
      const rawMediaUrls = isVideoGen ? (result.videos ?? []) : isDubbingGen ? (result.audios ?? []) : (result.images ?? []);
      let mediaUrls;
      let imageDownloadUrls = [];
      if (!isVideoGen && !isDubbingGen) {
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
        isVideoGen,
        isDubbingGen,
      }));

      if (!isDubbingGen && result.cardIds?.length) {
        storeUpdateCardIds(currentTab, genId, result.cardIds);
      }

      if (shotId) {
        try {
          const updateData = {};
          if (isVideoGen && mediaUrls.length > 0) updateData.video_url = mediaUrls[0];
          else if (!isDubbingGen && mediaUrls.length > 0) updateData.image_url = mediaUrls[0];
          if (Object.keys(updateData).length > 0) await apiUpdateShot(shotId, updateData);
        } catch {
          // shot update fails silently
        }
      }
      removePendingTask(genId);
      return { success: true };
    } catch (error) {
      removePendingTask(genId);
      showToast('error', error?.message || '生成失败，请稍后重试');
      storeDeleteGeneration(currentTab, genId);
      params.onFail?.(params.prompt);
      return { success: false };
    } finally {
      setGenerating(false);
      decrementActive(getCreationTab(genType));
    }
  }, [
    activeTab,
    addGeneration,
    decrementActive,
    incrementActive,
    isLoggedIn,
    sessionIdRef,
    setGenerating,
    showToast,
    storeDeleteGeneration,
    storeUpdateCardIds,
  ]);
}
