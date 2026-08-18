/**
 * @file useCreationParamsState.js
 * @structure-index
 *
 * ─── 参数状态 ─────────────────────────────────────────────────────
 *   ratio / resolution / count                                  图片参数
 *   videoRatio / videoResolution / videoDuration                视频参数
 *   refMode / soundEnabled                                      参考模式与音效
 *   dubbingSpeed / dubbingPitch / dubbingVolume                 配音参数
 *
 * ─── 状态转换 ───────────────────────────────────────────────────
 *   creationParams 或 genType 变化                               默认值与联动重置
 *   prefillVersion 变化                                          重新编辑/复用时回填参数
 *   resetDubbingParams                                            发送后恢复配音参数
 *
 * ─── 边界说明 ───────────────────────────────────────────────────
 *   只管理创作输入区的参数值、默认值和参数联动；文件、首尾帧迁移、
 *   生成参数组装、API、任务轮询、缓存、Toast 和 Store 仍由 InputCard /
 *   CreationPage 持有。
 *
 * ─── 更新记录 ───────────────────────────────────────────────────
 *   2026-08-18  配音参数由语速/情绪调整为语速/声调/音量，并补齐默认值与重置
 *   2026-07-16  从 CreationPage 的 InputCard 抽离参数状态与默认值联动
 *   2026-07-16  补齐视频重新编辑的 videoRatio / videoResolution / videoDuration 回填；完成定向 ESLint、构建、架构和差异检查
 */

import { useCallback, useEffect, useRef, useState } from 'react';

function resolveImageDefaults(creationParams) {
  let ratio = creationParams.defaults?.ratio || creationParams.ratios?.[0]?.value || '';
  let resolution = creationParams.defaults?.resolution || creationParams.resolutions?.[0] || '';
  const resolutionRatios = creationParams.resolutionRatios || {};

  if (ratio && resolution && resolutionRatios[resolution]
    && !resolutionRatios[resolution].includes(ratio)) {
    for (const candidateResolution of creationParams.resolutions || []) {
      if (resolutionRatios[candidateResolution]?.includes(ratio)) {
        resolution = candidateResolution;
        break;
      }
    }
    if (resolutionRatios[resolution] && !resolutionRatios[resolution].includes(ratio)) {
      const firstResolution = creationParams.resolutions?.[0] || '';
      const firstRatios = resolutionRatios[firstResolution] || [];
      ratio = firstRatios[0] || creationParams.ratios?.[0]?.value || '';
      resolution = firstResolution;
    }
  }

  return {
    ratio,
    resolution,
    count: creationParams.defaults?.count || creationParams.counts?.[0] || '',
  };
}

function resolveVideoDefaults(creationParams, currentRefMode) {
  let ratio = creationParams.defaults?.ratio || creationParams.ratios?.[0]?.value || '';
  let resolution = creationParams.defaults?.resolution || creationParams.resolutions?.[0] || '';
  const resolutionRatios = creationParams.resolutionRatios || {};

  if (ratio && resolution && resolutionRatios[resolution]
    && !resolutionRatios[resolution].includes(ratio)) {
    for (const candidateResolution of creationParams.resolutions || []) {
      if (resolutionRatios[candidateResolution]?.includes(ratio)) {
        resolution = candidateResolution;
        break;
      }
    }
    if (resolutionRatios[resolution] && !resolutionRatios[resolution].includes(ratio)) {
      const firstResolution = creationParams.resolutions?.[0] || '';
      const firstRatios = resolutionRatios[firstResolution] || [];
      ratio = firstRatios[0] || creationParams.ratios?.[0]?.value || '';
      resolution = firstResolution;
    }
  }

  const refModes = creationParams.refModes?.map((item) => item.value) || [];
  const refMode = refModes.includes(currentRefMode)
    ? currentRefMode
    : (creationParams.defaults?.refMode || creationParams.refModes?.[0]?.value || '');

  return {
    videoRatio: ratio,
    videoResolution: resolution,
    videoDuration: creationParams.defaults?.duration || creationParams.durations?.[0] || '',
    refMode,
  };
}

/**
 * 创作输入区的参数状态边界。
 * 默认值由模型能力配置决定；模型能力或生成类型变化时重置对应参数，
 * 但不触碰文件、API 和页面级副作用。
 */
export function useCreationParamsState({
  creationParams,
  genType,
  prefillVersion = 0,
  prefillData = null,
}) {
  const [ratio, setRatio] = useState('');
  const [resolution, setResolution] = useState('');
  const [count, setCount] = useState('');
  const [refMode, setRefMode] = useState('');
  const [videoRatio, setVideoRatio] = useState('');
  const [videoResolution, setVideoResolution] = useState('');
  const [videoDuration, setVideoDuration] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [dubbingSpeed, setDubbingSpeed] = useState(1.0);
  const [dubbingPitch, setDubbingPitch] = useState(0);
  const [dubbingVolume, setDubbingVolume] = useState(1.0);
  const currentRefModeRef = useRef('');

  useEffect(() => {
    currentRefModeRef.current = refMode;
  }, [refMode]);

  const resetDubbingParams = useCallback(() => {
    setDubbingSpeed(1.0);
    setDubbingPitch(0);
    setDubbingVolume(1.0);
  }, []);

  useEffect(() => {
    if (!creationParams) return;

    const timer = setTimeout(() => {
      if (genType === 'image') {
        const defaults = resolveImageDefaults(creationParams);
        setRatio(defaults.ratio);
        setResolution(defaults.resolution);
        setCount(defaults.count);
        return;
      }

      const defaults = resolveVideoDefaults(creationParams, currentRefModeRef.current);
      setVideoRatio(defaults.videoRatio);
      setVideoResolution(defaults.videoResolution);
      setVideoDuration(defaults.videoDuration);
      setRefMode(defaults.refMode);
    }, 0);

    return () => clearTimeout(timer);
  }, [creationParams, genType]);

  // prefillVersion 是外部约定的唯一触发信号，避免对象重建时覆盖用户正在编辑的参数。
  useEffect(() => {
    if (!prefillVersion || !prefillData) return undefined;

    const timer = setTimeout(() => {
      // 图片和视频选择器拥有两套独立状态。历史结果虽然共用 ratio/resolution
      // 字段，但视频重新编辑必须回填 videoRatio/videoResolution，否则生成请求
      // 会继续使用模型切换时的默认值。
      if (genType === 'video') {
        const nextVideoRatio = prefillData.videoRatio ?? prefillData.ratio;
        const nextVideoResolution = prefillData.videoResolution ?? prefillData.resolution;
        const nextVideoDuration = prefillData.videoDuration ?? prefillData.duration;
        if (nextVideoRatio !== undefined) setVideoRatio(nextVideoRatio);
        if (nextVideoResolution !== undefined) setVideoResolution(nextVideoResolution);
        if (nextVideoDuration !== undefined) setVideoDuration(nextVideoDuration);
        if (prefillData.refMode !== undefined) setRefMode(prefillData.refMode);
      } else if (genType === 'image') {
        if (prefillData.ratio !== undefined) setRatio(prefillData.ratio);
        if (prefillData.resolution !== undefined) setResolution(prefillData.resolution);
        if (prefillData.count !== undefined) setCount(prefillData.count);
      }
    }, 0);

    return () => clearTimeout(timer);
  // prefillVersion 是外部约定的唯一触发信号，不能因 prefillData 或 genType
  // 对象重建而重复覆盖参数；调用方会在切换到目标生成类型后递增版本号。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillVersion]);

  return {
    ratio,
    setRatio,
    resolution,
    setResolution,
    count,
    setCount,
    refMode,
    setRefMode,
    videoRatio,
    setVideoRatio,
    videoResolution,
    setVideoResolution,
    videoDuration,
    setVideoDuration,
    soundEnabled,
    setSoundEnabled,
    dubbingSpeed,
    setDubbingSpeed,
    dubbingPitch,
    setDubbingPitch,
    dubbingVolume,
    setDubbingVolume,
    resetDubbingParams,
  };
}
