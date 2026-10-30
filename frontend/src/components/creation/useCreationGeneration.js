/**
 * @file useCreationGeneration.js
 *   2026-10-30 独立新任务不受旧任务阻塞；本页活跃任务避免被恢复流程重复查询。
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
 *   视频结果同时保留后端返回的封面地址，详情弹窗使用 poster 展示。
 *   2026-09-08 新生成图片独立透传原图地址，避免参考图使用下载入口。
 *   2026-09-08 多机位通过 onSubmitted/onSubmissionError 区分提交与生成终态。
 *   2026-10-20 按账号保存受理前快照和全部任务编号；取消/离页保留恢复记录。
 *   已完成卡脱离等待清理，避免分镜关联写入期间离页误删结果。
 */

import { useCallback, useRef, useEffect } from 'react';
import { creationPendingStore } from '../../utils/CreationPendingStore';
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
    voiceName: params.voiceName || '',
    voiceId: params.voiceId || params.voice_id || '',
    voiceSource: params.voiceSource || '',
    speed: params.speed,
    pitch: params.pitch,
    volume: params.volume,
    advancedEnabled: Boolean(params.advancedEnabled),
    ratio: params.ratio || params.videoRatio || '16:9',
    resolution: params.resolution || params.videoResolution || '',
    duration: params.videoDuration || '5s',
    createdAt: new Date().toISOString(),
    refVideos: (params.files || []).filter(isVideoFile).map(toPendingReferenceVideo),
    refAudios: getAudioReferenceFiles(params.files).map(toReferenceAudio),
  };
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
    voiceName: params.voiceName || '',
    voiceId: params.voiceId || params.voice_id || '',
    voiceSource: params.voiceSource || '',
    speed: params.speed,
    pitch: params.pitch,
    volume: params.volume,
    advancedEnabled: Boolean(params.advancedEnabled),
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

function createCompletedGeneration({ genId, shotId, params, result, mediaUrls, imageOriginalUrls, audioIds, isVideoGen, isAudioGen }) {
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
    voiceName: params.voiceName || '',
    voiceId: params.voiceId || params.voice_id || '',
    voiceSource: params.voiceSource || '',
    speed: params.speed,
    pitch: params.pitch,
    volume: params.volume,
    advancedEnabled: Boolean(params.advancedEnabled),
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
    refModeLabel: result.referenceModeLabel || result.reference_mode_label || undefined,
    firstFrameUrl: result.firstFrameUrl || undefined,
    lastFrameUrl: result.lastFrameUrl || undefined,
    posterUrl: isVideoGen ? (normalizeImageUrl(result.posterUrl) || result.posterUrl || undefined) : undefined,
    createdAt: genMeta.createdAt,
    cards: mediaUrls.map((url, index) => ({
      id: isAudioGen ? (audioIds?.[index] || null) : (result.cardIds?.[index] || null),
      type: isVideoGen ? 'video' : isAudioGen ? 'audio' : 'image',
      status: 'done',
      imageUrl: isAudioGen ? null : (isVideoGen ? null : url),
      originalUrl: !isVideoGen && !isAudioGen ? (imageOriginalUrls?.[index] || url) : undefined,
      videoUrl: isVideoGen ? url : null,
      posterUrl: isVideoGen
        ? (normalizeImageUrl(result.posterUrl) || result.posterUrl || undefined)
        : undefined,
      audioUrl: isAudioGen ? url : null,
      audioId: isAudioGen ? (audioIds?.[index] || null) : undefined,
    })),
  };
}

export function useCreationGeneration({
  activeTab,
  isLoggedIn,
  ownerId,
  sessionIdRef,
  addGeneration,
  storeDeleteGeneration,
  storeUpdateCardIds,
  incrementActive,
  decrementActive,
  showToast,
}) {
  const activeGenerationRef = useRef(null);
  const requestsRef = useRef(new Set());
  const scopeRef = useRef(null);
  useEffect(() => {
    const scope = { ownerId, isLoggedIn };
    const requests = requestsRef.current;
    scopeRef.current = scope;
    return () => {
      scopeRef.current = null;
      for (const request of requests) {
        request.controller.abort();
        if (request.genId) storeDeleteGeneration(request.currentTab, request.genId);
        decrementActive(request.currentTab);
      }
    };
  // 清理绑定创建请求时的页面作用域，不随渲染生成的新回调重启。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId, isLoggedIn]);

  const generateCreation = useCallback(async (params) => {
    const scope = scopeRef.current;
    try {
      if (!scope?.isLoggedIn || scope.ownerId !== ownerId) throw new Error('请先登录后再生成');
      creationPendingStore.assertReady(ownerId);
    } catch (error) {
      showToast('error', error.message);
      params.onSubmissionError?.(error);
      return { success: false };
    }
    const isCurrent = () => scopeRef.current === scope;
    params = { ...params };
    const sessionId = sessionIdRef.current;
    const controller = new AbortController();
    const currentTab = getCreationTab(params.genType || activeTab);
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
    requestsRef.current.add(request);

    incrementActive(getCreationTab(genType));
    const countNum = parseInt(params.count, 10) || 1;
    const isVideoGen = genType === 'video';
    const isAudioGen = genType === 'dubbing' || genType === 'music';
    const shotTypeLabel = isVideoGen ? '视频' : isAudioGen ? (genType === 'music' ? '音乐' : '配音') : '图片';
    let shotId = null;

    if (isLoggedIn && sessionId) {
      try {
        const now = new Date();
        const timestamp = now.toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        const shot = await apiCreateShot(sessionId, {
          title: `${shotTypeLabel} - ${timestamp}`,
          prompt: params.prompt || undefined,
          duration: isVideoGen ? (parseInt(params.videoDuration, 10) || 5) : undefined,
        }, { signal: controller.signal });
        shotId = shot.id;
        params.session_id = sessionId;
        params.shot_id = shotId;
      } catch (error) {
        if (error?.name === 'AbortError' || controller.signal.aborted) {
          request.cancelled = true;
        }
        // shot creation fails silently; generation still proceeds
      }
    }

    if (request.cancelled || controller.signal.aborted || !isCurrent()) {
      if (isCurrent()) { params.onCancel?.(); decrementActive(getCreationTab(genType)); }
      requestsRef.current.delete(request);
      if (activeGenerationRef.current === request) {
        activeGenerationRef.current = null;
      }
      return { success: false };
    }

    const genId = `gen-${crypto.randomUUID()}`;
    request.genId = genId;
    creationPendingStore.setActive(ownerId, genId, true);
    let snapshot = { ...createPendingTaskSnapshot({ genId, shotId, tab: currentTab, params }), ownerId, sessionId };
    try { creationPendingStore.save(snapshot); }
    catch (error) {
      showToast('error', error.message);
      params.onSubmissionError?.(error);
      decrementActive(getCreationTab(genType));
      requestsRef.current.delete(request);
      if (activeGenerationRef.current === request) activeGenerationRef.current = null;
      return { success: false };
    }
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
        onTaskCreated: ({ taskId, taskIds }) => {
          snapshot = { ...snapshot, taskId, taskIds: taskIds || [taskId] };
          // 迟到的编号仍属于原账号，取消等待不能丢弃它。
          try { creationPendingStore.save(snapshot); }
          catch (error) { if (isCurrent()) showToast('error', error.message); }
          if (isCurrent() && !request.cancelled) params.onSubmitted?.({ taskId });
        },
      });
      if (request.cancelled || controller.signal.aborted || !isCurrent()) throw createAbortError();
      const rawMediaUrls = isVideoGen ? (result.videos ?? []) : isAudioGen ? (result.audios ?? []) : (result.images ?? []);
      const audioIds = isAudioGen ? (result.audioIds || []) : [];
      let mediaUrls;
      let imageOriginalUrls = [];
      if (!isVideoGen && !isAudioGen) {
        const imageEntries = rawMediaUrls
          .map((url, index) => {
            const previewUrl = normalizeImageUrl(url) || url;
            const rawOriginalUrl = result.imageOriginalUrls?.[index] || '';
            return {
              previewUrl,
              originalUrl: normalizeImageUrl(rawOriginalUrl) || rawOriginalUrl,
            };
          })
          .filter(({ previewUrl }) => Boolean(previewUrl))
          .filter((entry, index, entries) => entries.findIndex((item) => item.previewUrl === entry.previewUrl) === index);
        mediaUrls = imageEntries.map(({ previewUrl }) => previewUrl);
        imageOriginalUrls = imageEntries.map(({ originalUrl }) => originalUrl);
      } else {
        mediaUrls = [...new Set(rawMediaUrls.map((url) => normalizeImageUrl(url) || url).filter(Boolean))];
      }

      if (!mediaUrls.length) {
        showToast('error', '结果暂未完整返回，已保留任务记录，请勿重复提交');
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
        imageOriginalUrls,
        audioIds,
        isVideoGen,
        isAudioGen,
      }));
      request.genId = null;

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
      try { creationPendingStore.remove(ownerId, genId); }
      catch (error) { if (isCurrent()) showToast('error', error.message); }
      return { success: true };
    } catch (error) {
      const cancelled = request.cancelled || error?.name === 'AbortError';
      if (error?.taskFailed && snapshot.taskIds?.length === 1) {
        try { creationPendingStore.remove(ownerId, genId); }
        catch (storageError) { if (isCurrent()) showToast('error', storageError.message); }
      }
      if (!isCurrent()) return { success: false };
      storeDeleteGeneration(currentTab, genId);
      if (cancelled) {
        params.onCancel?.();
        showToast('info', '已停止前端等待，后台任务记录保留，重新进入后查询原任务');
      } else {
        params.onSubmissionError?.(error);
        showToast('error', error?.taskFailed ? error.message : '任务状态暂未确认，记录已保留，可继续创建新任务');
        params.onFail?.(params.prompt);
      }
      return { success: false };
    } finally {
      creationPendingStore.setActive(ownerId, genId, false);
      if (isCurrent()) decrementActive(getCreationTab(genType));
      requestsRef.current.delete(request);
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
    ownerId,
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
    if (request.genId) storeDeleteGeneration(request.currentTab, request.genId);
    return true;
  }, [storeDeleteGeneration]);

  return { generateCreation, cancelGeneration };
}
