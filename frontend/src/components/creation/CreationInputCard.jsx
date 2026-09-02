/**
 * @file CreationInputCard.jsx
 * @description 创作输入区状态、素材接线、参数组装和生成回调适配。
 *
 * 该组件不调用页面 API、Store 或缓存；生成参数通过 onGenerate 显式交回页面，
 * 页面继续负责生成请求、任务轮询、缓存和全局状态写回。
 *
 * ─── 结构索引 ───────────────────────────────────────────
 *   草稿文件恢复工具                                   L106–L128
 *   InputCard 状态、Hook 与草稿接线                    L132–L487
 *   模式回退、素材选择与参数预填充                     L489–L728
 *   发送、失败/取消恢复与参数组装                      L730–L937
 *   CreationInputSurface 组合                           L939–L1143
 *
 *   2026-08-18  配音面板改为语速/声调/音量，草稿与失败恢复同步新字段
 *   2026-08-11  图片/视频生成轮询期间保持输入区可用；IndexedDB 临时缓存各类型完整创作草稿
 *   2026-08-18  空提示词/参考图草稿恢复为占位符初始态，模型和生成参数继续保留
 *   2026-08-17  草稿同步保存提示词 HTML，恢复后重建 @素材标签，避免视频发送后标签降级为纯文本
 *   2026-08-12  音乐生成与配音同规则：生成中可停止、上传音频附件；音乐不带配音参数
 *   2026-08-18  配音高级模式接入输入框展开状态，保持页面编排与生成参数边界不变
 *   2026-08-18  高级模式支持从 PDF/DOCX/TXT/HTML 提取最多 3000 字正文并写入提示词草稿
 *   2026-08-19  退出登录时清空提示词与参考素材草稿，保留当前模型和生成参数
 *   2026-08-31  配音语速、声调和音量不再写入草稿，切换一级 Tab 后恢复默认值
 *   2026-08-19  配音生成前要求已选择音色，未选择时提示并打开音色弹窗
 *   2026-08-20  视频模型改由 supported_generation_modes 驱动参考模式、素材门禁与 generation_mode 路由
 *   2026-08-20  视频请求从后端 generation_reference_mode_map 解析 reference_mode，缺少映射时阻止提交
 *   2026-08-20  配音资产确认后使用独立音频文件卡片展示，并提供播放/暂停控制
 *   2026-08-20  资产库视频参考保留封面字段，输入区文件卡片不再把视频地址误作背景图
 *   2026-08-20  Seedance 真人素材按带特殊标识的普通参考图追加，不替换已有真人素材
 *   2026-08-28  当前视频创作仅保留全能参考与首尾帧；已下线多帧模式不再进入上传、资产选择或请求参数
 *   2026-08-21  首尾帧与普通参考双向切换时迁移图片素材，避免模式切换丢图
 *   2026-08-21  高频切换时同步清空首尾帧 ref，避免旧状态更新覆盖新回填结果
 *   2026-08-21  普通与高级配音模式统一透传 voice_setting，保持现有编辑和多选交互不变
 *   2026-08-25  视频生成模式与参考模式映射移除模型名称硬编码兜底，改为完全读取后端能力数据
 *   2026-08-21  高级配音生成中保持输入框不透明，避免与创作结果卡片叠加时视觉变淡
 *   2026-08-27  HappyHorse 普通参考素材按 r2v/video-edit 子模型能力限制上传，首尾帧不参与；素材弹窗和真人素材追加同样走上传校验
 *   2026-08-27  修复资产库视频添加到输入框后封面未渲染导致的黑卡
 *   2026-08-27  资产库已添加素材回传选择器并禁用，避免图片或视频重复添加
 *   2026-08-28  全能参考仅支持文生但支持首尾帧的模型，在添加图片时确认切换，避免发送后才提示不支持
 *   2026-08-28  切换至纯文生全能参考模型时，确认后静默保留前两张图片为首尾帧；取消不提交模型切换
 *   2026-09-02  创作页首尾帧已有图片切换至不支持图片参考的全能参考时拦截切换
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import CreationFileCard from './CreationFileCard';
import CreationAudioFileCard from './CreationAudioFileCard';
import ConfirmDialog from '../ConfirmDialog';
import CreationInputSurface from './CreationInputSurface';
import { useCreationInputFiles } from './useCreationInputFiles';
import { useCreationPromptInteraction } from './useCreationPromptInteraction';
import { useCreationParamsState } from './useCreationParamsState';
import {
  CREATION_DRAFTS_CLEARED_EVENT,
  readCreationDraft,
  readCreationDraftFromMemory,
  saveCreationDraft,
} from './CreationDraftStorage';
import { isSeedanceModel } from '../../utils/seedanceModel';
import { readCreationDocumentText } from './CreationDocumentTextReader';
import {
  MAX_CREATION_FILES,
  getCreationUploadExtensions,
  getCreationAcceptAttr,
  isAudioFile,
  isImageFile,
  isVideoFile,
} from './CreationFileUtils';
import { DEFAULT_DUBBING_EFFECTS } from './CreationDubbingEffectsDefaults';
import {
  getVideoReferenceModeLabel,
  resolveVideoReferenceMode,
  resolveVideoGenerationMode,
  resolveVideoReferenceModeFallback,
  shouldConfirmFrameModeForAllReferenceMedia,
  shouldConfirmFrameModeForImageReference,
  VIDEO_REFERENCE_MODES,
} from '../../utils/videoModelCapabilities';
import { resolveVideoModelRoute } from '../../utils/videoModelAdapter';

function createDefaultDubbingEffects() {
  return {
    toneValues: { ...DEFAULT_DUBBING_EFFECTS.toneValues },
    selectedEffects: [],
  };
}

const DUBBING_SOUND_EFFECT_API_VALUES = {
  echo: 'spacious_echo',
  hall: 'auditorium_echo',
  telephone: 'lofi_telephone',
  electronic: 'robotic',
};

function buildDubbingVoiceModify(effects) {
  const pitch = Number(effects?.toneValues?.brightness) || 0;
  const intensity = Number(effects?.toneValues?.softness) || 0;
  const timbre = Number(effects?.toneValues?.clarity) || 0;
  const selectedEffect = effects?.selectedEffects?.at(-1);
  const soundEffects = DUBBING_SOUND_EFFECT_API_VALUES[selectedEffect];
  const voiceModify = {
    ...(pitch !== 0 ? { pitch } : {}),
    ...(intensity !== 0 ? { intensity } : {}),
    ...(timbre !== 0 ? { timbre } : {}),
    ...(soundEffects ? { sound_effects: soundEffects } : {}),
  };

  return Object.keys(voiceModify).length > 0 ? voiceModify : undefined;
}

function restoreDraftFile(file, restoredFiles) {
  if (!file) return null;
  if (restoredFiles.has(file)) return restoredFiles.get(file);
  if (typeof File === 'undefined' || !(file instanceof File)) return file;

  // 旧输入卡卸载会释放本地文件的 blob 预览地址；创建新的 File 让素材 Hook 重新生成预览。
  const restoredFile = new File([file], file.name, {
    type: file.type,
    lastModified: file.lastModified,
  });
  // 标签 HTML 保存的是这个稳定引用；如果恢复时重新生成 _uid，标签会匹配失败，
  // 最终把旧 UID 当成名称显示在蓝色标签里。
  if (file._uid) {
    Object.defineProperty(restoredFile, '_uid', {
      value: file._uid,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  }
  restoredFiles.set(file, restoredFile);
  return restoredFile;
}

// ─── InputCard ────────────────────────────────────────────────────────────────
function InputCard({ onGenerate, onCancelGeneration, width = '800px', disabled = false, genType, onGenTypeChange,
  model, onModelChange, modelOptions = [], creationParams, prefillVersion = 0, prefillData = null, onBeforeModelOpen, showToast, activeCount = 0, capabilitiesMap = {}, onRegisterSaveDraft,
  dubbingAdvancedEnabled = false, onDubbingAdvancedChange }) {
  const [liveMaterialModalOpen, setLiveMaterialModalOpen] = useState(false);
  const [pendingFrameModeImages, setPendingFrameModeImages] = useState(null);
  const [pendingModelChange, setPendingModelChange] = useState(null);
  const [pendingReferenceModeChange, setPendingReferenceModeChange] = useState(null);
  const [selectedVoiceName, setSelectedVoiceName] = useState('');
  const [selectedVoiceSource, setSelectedVoiceSource] = useState('');
  const [selectedVoiceId, setSelectedVoiceId] = useState('');
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [advancedExitConfirmOpen, setAdvancedExitConfirmOpen] = useState(false);
  const [dubbingEffects, setDubbingEffects] = useState(createDefaultDubbingEffects);
  const [promptCharacterCount, setPromptCharacterCount] = useState(0);
  const handlePromptTextChange = useCallback((text) => {
    setPromptCharacterCount(String(text ?? '').length);
  }, []);
  const {
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
  } = useCreationParamsState({ creationParams, genType, prefillVersion, prefillData });
  const currentModel = useMemo(
    () => modelOptions.find((option) => option.value === model),
    [model, modelOptions],
  );
  const activeVideoCapabilities = useMemo(() => (
    currentModel?.specialRouteModels?.[refMode]?.capabilities
      || capabilitiesMap?.[model]
      || {}
  ), [capabilitiesMap, currentModel, model, refMode]);
  const isCurrentSeedance = Boolean(currentModel?.isSeedance);
  const allowsVideoAudio = genType === 'video'
    && (isCurrentSeedance || activeVideoCapabilities.supports_reference_audio === true);
  const {
    files,
    firstFrameFile,
    setFirstFrameFile,
    lastFrameFile,
    setLastFrameFile,
    safeSetFiles,
    handleFileSelect: handleRawFileSelect,
    removeFile,
    replaceFiles,
    clearFiles,
    clearFrameFiles,
    moveFrameFilesToFiles,
    moveFilesToFrameFiles,
    swapFrameFiles,
    getCurrentFiles,
  } = useCreationInputFiles({
    model,
    genType,
    refMode,
    capabilitiesMap,
    onToast: showToast,
    onFileTooLarge: () => alert('抱歉，平台暂不支持上传20M以上的图片资源！'),
  });
  const handleFileSelect = useCallback((newFiles = []) => {
    const selectedFiles = Array.from(newFiles);
    if (genType === 'video' && !allowsVideoAudio && selectedFiles.some(isAudioFile)) {
      showToast?.('warning', '当前仅 Seedance 全能参考支持音频素材');
      return;
    }
    if (genType === 'video' && selectedFiles.some(isImageFile)
      && shouldConfirmFrameModeForImageReference({
        capabilities: activeVideoCapabilities,
        referenceMode: refMode,
      })) {
      setPendingFrameModeImages(selectedFiles.filter(isImageFile));
      return;
    }
    handleRawFileSelect(selectedFiles);
  }, [activeVideoCapabilities, allowsVideoAudio, genType, handleRawFileSelect, refMode, showToast]);
  const [frameAssetTarget, setFrameAssetTarget] = useState(null);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const savedContentRef = useRef({
    html: "",
    text: "",
    voiceId: "",
    voiceName: "",
    voiceSource: "",
    dubbingSpeed: undefined,
    dubbingPitch: undefined,
    dubbingVolume: undefined,
  }); // 用于失败时回退

  // 图片和视频生成均为异步轮询任务，生成期间允许继续创作；配音保留生成中停止请求的交互。
  const promptDisabled = disabled && (genType === 'dubbing' || genType === 'music');

  const {
    editorRef,
    mentionMenuRef,
    focused,
    hasContent,
    hasTextSelection,
    mentionOpen,
    mentionQuery,
    mentionPos,
    mentionIndex,
    emotionMenuPosition,
    emotionMenuSelectedEmotion,
    pauseMenuPosition,
    interjectionMenuPosition,
    handleInput,
    handleBeforeInput,
    handleKeyDown: handlePromptKeyDown,
    handlePaste,
    handleEditorFocus,
    handleEditorBlur,
    handleRemoveFile,
    insertFromCard,
    insertMention,
    openEmotionMenu,
    openInlineMenu,
    insertInlineTag,
    applyEmotion,
    getPromptSnapshot,
    clearContent,
    clearAdvancedContent,
    restoreContent,
    setMentionIndex,
  } = useCreationPromptInteraction({
    files,
    disabled: promptDisabled,
    genType,
    refMode,
    showToast,
    handleFileSelect,
    removeFile,
    prefillVersion,
    prefillData,
    dubbingAdvancedEnabled,
    onTextChange: handlePromptTextChange,
  });

  const handleAdvancedChange = useCallback((nextEnabled) => {
    if (nextEnabled) {
      onDubbingAdvancedChange?.(true);
      return;
    }
    if (!dubbingAdvancedEnabled) return;

    const hasAdvancedPromptContent = Boolean(
      editorRef.current?.querySelector('[data-emotion], [data-dubbing-inline-tag]'),
    );
    const hasAdvancedEffects = Object.values(dubbingEffects.toneValues).some((value) => Number(value) !== 0)
      || dubbingEffects.selectedEffects.length > 0;
    if (!hasAdvancedPromptContent && !hasAdvancedEffects) {
      setDubbingEffects(createDefaultDubbingEffects());
      onDubbingAdvancedChange?.(false);
      return;
    }
    setAdvancedExitConfirmOpen(true);
  }, [dubbingAdvancedEnabled, dubbingEffects, editorRef, onDubbingAdvancedChange]);

  const confirmAdvancedExit = useCallback(() => {
    clearAdvancedContent();
    setDubbingEffects(createDefaultDubbingEffects());
    setAdvancedExitConfirmOpen(false);
    onDubbingAdvancedChange?.(false);
  }, [clearAdvancedContent, onDubbingAdvancedChange]);

  // 卸载阶段 contentEditable ref 可能已被 React 清空；提示词在输入时同步镜像，
  // 切换 Tab 保存草稿时不能再依赖即将销毁的 DOM。
  const promptTextRef = useRef('');
  const hydratedGenTypeRef = useRef(null);
  const createDraftSnapshot = useCallback(() => {
    const currentFiles = getCurrentFiles();
    const promptSnapshot = getPromptSnapshot();
    return {
      prompt: promptSnapshot.text || promptTextRef.current,
      promptHTML: promptSnapshot.html,
      files: currentFiles.files,
      firstFrameFile: currentFiles.firstFrameFile,
      lastFrameFile: currentFiles.lastFrameFile,
      ratio,
      resolution,
      count,
      refMode,
      videoRatio,
      videoResolution,
      videoDuration,
      soundEnabled,
      selectedVoiceId,
      selectedVoiceName,
      selectedVoiceSource,
    };
  }, [count, getCurrentFiles, getPromptSnapshot, ratio, refMode, resolution, selectedVoiceId, selectedVoiceName, selectedVoiceSource, soundEnabled, videoDuration, videoRatio, videoResolution]);

  const persistDraft = useCallback((force = false) => {
    if (!force && hydratedGenTypeRef.current !== genType) return;
    void saveCreationDraft(genType, createDraftSnapshot());
  }, [createDraftSnapshot, genType]);

  useEffect(() => {
    const handleDraftsCleared = () => {
      // 先关闭当前类型的自动保存，避免清空素材触发的状态更新重新写入草稿。
      hydratedGenTypeRef.current = null;
      promptTextRef.current = '';
      setPromptCharacterCount(0);
      clearContent();
      clearFiles();
      clearFrameFiles();
      setSelectedVoiceId('');
      setSelectedVoiceName('');
      setSelectedVoiceSource('');
    };

    window.addEventListener(CREATION_DRAFTS_CLEARED_EVENT, handleDraftsCleared);
    return () => window.removeEventListener(CREATION_DRAFTS_CLEARED_EVENT, handleDraftsCleared);
  }, [clearContent, clearFiles, clearFrameFiles]);

  useEffect(() => {
    onRegisterSaveDraft?.(() => persistDraft(true));
    return () => onRegisterSaveDraft?.(null);
  }, [onRegisterSaveDraft, persistDraft]);

  const handleLocalGenTypeChange = useCallback((nextType) => {
    persistDraft();
    onGenTypeChange?.(nextType);
  }, [onGenTypeChange, persistDraft]);

  useEffect(() => {
    let cancelled = false;
    hydratedGenTypeRef.current = null;

    const restoreDraft = (draft) => {
      if (cancelled) return;
      hydratedGenTypeRef.current = genType;
      if (prefillVersion && prefillData?.prompt !== undefined) return;
      const prompt = draft?.prompt ?? '';
      promptTextRef.current = prompt;
      setPromptCharacterCount(prompt.length);
      const restoredFiles = new Map();
      const restoredReferenceFiles = (draft?.files ?? []).map((file) => restoreDraftFile(file, restoredFiles));
      replaceFiles(restoredReferenceFiles);
      const restoredFirstFrameFile = restoreDraftFile(draft?.firstFrameFile, restoredFiles);
      const restoredLastFrameFile = restoreDraftFile(draft?.lastFrameFile, restoredFiles);
      setFirstFrameFile(restoredFirstFrameFile);
      setLastFrameFile(restoredLastFrameFile);
      restoreContent({
        html: draft?.promptHTML ?? '',
        text: prompt,
        restoreFiles: restoredReferenceFiles,
      });
      if (draft?.ratio !== undefined) setRatio(draft.ratio);
      if (draft?.resolution !== undefined) setResolution(draft.resolution);
      if (draft?.count !== undefined) setCount(draft.count);
      if (draft?.refMode !== undefined && genType === 'video') setRefMode(draft.refMode);
      if (draft?.videoRatio !== undefined) setVideoRatio(draft.videoRatio);
      if (draft?.videoResolution !== undefined) setVideoResolution(draft.videoResolution);
      if (draft?.videoDuration !== undefined) setVideoDuration(draft.videoDuration);
      if (draft?.soundEnabled !== undefined) setSoundEnabled(draft.soundEnabled);
      setSelectedVoiceId(draft?.selectedVoiceId ?? '');
      setSelectedVoiceName(draft?.selectedVoiceName ?? '');
      setSelectedVoiceSource(draft?.selectedVoiceSource ?? '');
    };

    const memoryDraft = readCreationDraftFromMemory(genType);
    if (memoryDraft) {
      restoreDraft(memoryDraft);
    } else {
      void readCreationDraft(genType).then(restoreDraft);
    }

    return () => {
      cancelled = true;
    };
  // 草稿加载仅由创作类型切换触发，避免每个输入状态变更都重新覆盖编辑器。
  // 卸载清理不能在这里保存：该闭包可能持有上传前的空文件数组，反而覆盖新草稿。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genType]);

  // 草稿与发送动作完全解耦：上传/删除参考图、首尾帧或参数变化后立即持久化。
  // 首次挂载等待当前类型草稿恢复完成，避免初始空状态覆盖已有缓存。
  useEffect(() => {
    if (hydratedGenTypeRef.current !== genType) return;
    persistDraft();
  }, [
    count,
    files,
    firstFrameFile,
    genType,
    lastFrameFile,
    persistDraft,
    ratio,
    refMode,
    resolution,
    selectedVoiceId,
    selectedVoiceName,
    selectedVoiceSource,
    soundEnabled,
    videoDuration,
    videoRatio,
    videoResolution,
  ]);

  const handlePromptInput = useCallback(() => {
    handleInput();
    const snapshot = getPromptSnapshot();
    promptTextRef.current = snapshot.text;
    setPromptCharacterCount(snapshot.text.length);
    persistDraft(true);
  }, [getPromptSnapshot, handleInput, persistDraft]);

  const handleDubbingDocumentSelect = useCallback(async (file) => {
    try {
      const documentText = await readCreationDocumentText(file);
      const truncatedText = documentText.slice(0, 3000);
      restoreContent({ text: truncatedText });
      promptTextRef.current = truncatedText;
      setPromptCharacterCount(truncatedText.length);
      persistDraft(true);
      if (documentText.length > 3000) {
        showToast?.('warning', '文件正文超过 3000 字，已保留前 3000 字');
      } else {
        showToast?.('success', '文件正文已导入');
      }
    } catch (error) {
      showToast?.('error', error?.message || '文件正文读取失败，请重试');
    }
  }, [persistDraft, restoreContent, showToast]);

  // 是否显示真人素材入口：仅视频模式、当前模型支持，且不属于 Seedance 系列。
  const showLiveMaterial = useMemo(() => {
    if (genType !== 'video') return false;
    return !!(currentModel?.supportsLiveMaterial) && !isSeedanceModel(currentModel);
  }, [currentModel, genType]);

  const handleRefModeChange = useCallback((newRefMode) => {
    const currentFiles = getCurrentFiles();
    const hasFrameImage = Boolean(currentFiles.firstFrameFile || currentFiles.lastFrameFile);
    const shouldBlockFrameImageSwitch = genType === 'video'
      && refMode === VIDEO_REFERENCE_MODES.FRAME
      && newRefMode === VIDEO_REFERENCE_MODES.ALL
      && hasFrameImage
      && shouldConfirmFrameModeForAllReferenceMedia({
        capabilities: currentModel?.capabilities || capabilitiesMap?.[model] || {},
        referenceMode: VIDEO_REFERENCE_MODES.ALL,
      });

    if (shouldBlockFrameImageSwitch) {
      setPendingReferenceModeChange({ nextRefMode: newRefMode });
      return false;
    }

    if (genType === 'video' && newRefMode !== VIDEO_REFERENCE_MODES.FRAME
      && !moveFrameFilesToFiles()) {
      return false;
    }
    if (genType === 'video' && newRefMode === VIDEO_REFERENCE_MODES.FRAME
      && !moveFilesToFrameFiles()) {
      return false;
    }
    setRefMode(newRefMode);
    return true;
  }, [capabilitiesMap, currentModel, genType, getCurrentFiles, model, moveFilesToFrameFiles, moveFrameFilesToFiles, refMode, setRefMode]);

  const handleModelChange = useCallback((nextModel) => {
    if (nextModel === model) return;

    const targetModel = modelOptions.find((option) => option.value === nextModel);
    const targetCapabilities = targetModel?.capabilities || capabilitiesMap?.[nextModel] || {};
    const currentFiles = getCurrentFiles();
    const hasReferenceMedia = currentFiles.files.some((file) => (
      isImageFile(file) || isVideoFile(file) || isAudioFile(file)
    ));
    const requiresFrameModeConfirmation = genType === 'video'
      && refMode === VIDEO_REFERENCE_MODES.ALL
      && hasReferenceMedia
      && shouldConfirmFrameModeForAllReferenceMedia({
        capabilities: targetCapabilities,
        referenceMode: refMode,
      });

    if (requiresFrameModeConfirmation) {
      setPendingModelChange({ nextModel, previousModel: model });
      return;
    }

    onModelChange(nextModel);
  }, [capabilitiesMap, genType, getCurrentFiles, model, modelOptions, onModelChange, refMode]);

  const confirmModelChangeToFrameMode = useCallback(() => {
    if (!pendingModelChange) return;

    const { files: currentFiles } = getCurrentFiles();
    const frameImages = currentFiles.filter(isImageFile).slice(0, 2);

    // 先保留将迁入首尾帧的图片，避免清理普通素材时释放其本地预览地址。
    clearFiles({ preserveFiles: frameImages });
    clearFrameFiles({ preserveFiles: frameImages });
    setRefMode(VIDEO_REFERENCE_MODES.FRAME);
    setFirstFrameFile(frameImages[0] || null);
    setLastFrameFile(frameImages[1] || null);
    onModelChange(pendingModelChange.nextModel);
    setPendingModelChange(null);
  }, [clearFiles, clearFrameFiles, getCurrentFiles, onModelChange, pendingModelChange, setFirstFrameFile, setLastFrameFile, setRefMode]);

  const confirmFrameModeImageAdd = useCallback(() => {
    const imageFiles = pendingFrameModeImages || [];
    if (!handleRefModeChange(VIDEO_REFERENCE_MODES.FRAME)) return;

    const currentFiles = getCurrentFiles();
    let firstFrame = currentFiles.firstFrameFile;
    let lastFrame = currentFiles.lastFrameFile;
    let ignoredCount = 0;
    imageFiles.forEach((file) => {
      if (!firstFrame) {
        firstFrame = file;
        setFirstFrameFile(file);
      } else if (!lastFrame) {
        lastFrame = file;
        setLastFrameFile(file);
      } else {
        ignoredCount += 1;
      }
    });
    if (ignoredCount > 0) {
      showToast?.('warning', '首尾帧模式最多添加两张图片，其他图片未添加');
    }
    setPendingFrameModeImages(null);
  }, [getCurrentFiles, handleRefModeChange, pendingFrameModeImages, setFirstFrameFile, setLastFrameFile, showToast]);

  const previousModelRef = useRef(model);
  useEffect(() => {
    if (genType !== 'video' || !currentModel) return;
    const availableModes = currentModel.availableReferenceModes || creationParams?.refModes || [];
    const fallbackMode = resolveVideoReferenceModeFallback(refMode, availableModes);
    const modelChanged = previousModelRef.current && previousModelRef.current !== model;
    previousModelRef.current = model;
    if (!fallbackMode || fallbackMode === refMode) return;
    // 模型能力变化后需要在 effect 中同步回退到可用模式；门禁仍在切换前执行。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    const switched = handleRefModeChange(fallbackMode);
    if (!switched) return;
    if (modelChanged && refMode) {
      showToast?.('info', `新模型不支持${getVideoReferenceModeLabel(refMode)}，已切换为${getVideoReferenceModeLabel(fallbackMode)}`);
    }
  }, [creationParams?.refModes, currentModel, genType, handleRefModeChange, model, refMode, showToast]);
  // Apply prefill when version bumps (re-edit or use-as-ref or use-as-first-frame)
  useEffect(() => {
    if (!prefillVersion || !prefillData) return;
    if (prefillData.prompt !== undefined) promptTextRef.current = String(prefillData.prompt ?? '');
    if (prefillData.files !== undefined) {
      // 替换模式（onReEdit 等场景）
      replaceFiles(prefillData.files);
    } else if (prefillData.appendFiles !== undefined) {
      // 追加模式（onUseAsRef 场景）：每次点击都生成独立引用，最多20个，同时检查模型上限
      safeSetFiles((prev) => {
        if (prev.length >= MAX_CREATION_FILES) {
          showToast('error', '您添加的文件太多了，最多支持20个参考文件');
          return prev;
        }
        const toAdd = prefillData.appendFiles;

        const merged = [...(prev ?? []), ...toAdd];
        if (merged.length > MAX_CREATION_FILES) {
          showToast('error', '您添加的文件太多了，最多支持20个参考文件');
          return merged.slice(0, MAX_CREATION_FILES);
        }
        return merged;
      });
    }
    // 先切换到首尾帧模式，避免文件 Hook 按旧的“全能参考”模式清空刚回填的首帧。
    if (genType === 'video' && prefillData.refMode !== undefined) {
      setRefMode(prefillData.refMode);
    }
    if (prefillData.firstFrameFile !== undefined) {
      const nextFirstFrame = prefillData.firstFrameFile;
      // 兼容带 File 包装对象的历史预填充数据，同时保留当前 File 对象的预览字段。
      setFirstFrameFile(nextFirstFrame?.file || nextFirstFrame);
    }
    if (prefillData.lastFrameFile !== undefined) setLastFrameFile(prefillData.lastFrameFile);
  }, [prefillVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const uploadAllowedExts = getCreationUploadExtensions(genType, allowsVideoAudio);
  const uploadAcceptAttr = getCreationAcceptAttr(genType, allowsVideoAudio);

  // 文件列表、上限裁剪和 Blob URL 生命周期由 useCreationInputFiles 统一管理。

  const handleAssetConfirm = (selectedAssets) => {
    setAssetPickerOpen(false);
    if (frameAssetTarget && selectedAssets.length > 0) {
      const asset = selectedAssets[0];
      // fileUrl 是真实文件地址（项目资产 normalize 后），url 可能是缩略图
      const realUrl = asset.fileUrl || asset.url;
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      // 兜底到 asset.id：normalizePickerAsset 已把项目/全局资产的真实后端 id 落到 id 字段，
      // 否则从资产库选的参考图拿不到 asset_id，导致 reference_image_asset_ids 为空、参考图失效
      const rawFrameId = asset.backendId || asset.asset_id || asset.id;
      const assetFile = {
        name: asset.name || asset.id,
        size: 0,
        url: realUrl,
        previewUrl: asset.url || realUrl,
        assetId: rawFrameId && UUID_RE.test(rawFrameId) ? rawFrameId : undefined,
        isAsset: true,
      };
      if (frameAssetTarget === 'first') setFirstFrameFile(assetFile);
      else setLastFrameFile(assetFile);
      setFrameAssetTarget(null);
      return;
    }
    if (genType === 'video' && !allowsVideoAudio
      && selectedAssets.some((asset) => String(asset.asset_type || asset.assetType || asset.type || '').toLowerCase().startsWith('audio'))) {
      showToast?.('warning', '当前仅 Seedance 全能参考支持音频素材');
      return;
    }
    const liveMaterialAssets = selectedAssets.filter((asset) => asset.isLiveMaterial);
    const liveMats = liveMaterialAssets.map((asset) => {
        // Seedance 的 assetRefUrl 只用于生成请求，输入框图片槽必须使用可访问的媒体 URL。
        const assetType = String(asset.asset_type || asset.assetType || asset.type || '').toLowerCase();
        const isVideo = assetType === 'video' || assetType.startsWith('video/');
        const mediaUrl = asset.fileUrl || asset.file_url || asset.sourceUrl || asset.source_url || asset.url || null;
        const posterUrl = asset.posterUrl || asset.poster_url || asset.thumbnailUrl || asset.thumbnail_url
          || asset.coverUrl || asset.cover_url || asset.firstFrameUrl || asset.first_frame_url || null;
        const previewUrl = isVideo ? posterUrl : (asset.url || asset.previewUrl || asset.preview_url || null);
        return {
          isAsset: true,
          isLiveMaterial: true,
          assetId: asset.id,
          groupId: asset.groupId,
          groupType: asset.groupType,
          assetRefUrl: asset.assetRefUrl,
          url: isVideo ? mediaUrl : previewUrl,
          videoUrl: isVideo ? mediaUrl : null,
          previewUrl,
          posterUrl,
          sourceUrl: asset.sourceUrl || asset.source_url || null,
          fileUrl: asset.fileUrl || asset.file_url || null,
          name: asset.name || '认证素材',
          type: isVideo ? 'video/mp4' : 'image/jpeg',
          size: 0,
        };
      });
    const assetFiles = selectedAssets.filter((asset) => !asset.isLiveMaterial).map((asset) => {
      const assetType = String(asset.asset_type || asset.assetType || asset.type || '').toLowerCase();
      const isVideo = assetType === 'video' || assetType.startsWith('video/');
      const isAudio = assetType === 'audio' || assetType.startsWith('audio/');
      const isAigcMaterial = Boolean(asset.isAigcMaterial)
        || String(asset.groupType || asset.group_type || '').toUpperCase() === 'AIGC';
      let fileUrl;
      if (isVideo) fileUrl = asset.videoUrl || asset.video_url || asset.fileUrl || asset.file_url || asset.url;
      else if (isAudio) fileUrl = asset.audioUrl || asset.fileUrl || asset.url;
      else fileUrl = isAigcMaterial
        // 虚拟人像的 assetRefUrl 是 Seedance 服务商引用，不能作为输入框图片地址。
        // 展示地址优先使用已归一化的 preview/url，引用地址单独保留在 assetRefUrl。
        ? (asset.sourceUrl || asset.source_url || asset.fileUrl || asset.file_url || asset.url || asset.previewUrl || asset.preview_url || null)
        : (asset.fileUrl || asset.url);
      const posterUrl = isVideo
        ? (asset.posterUrl
          || asset.poster_url
          || asset.thumbnailUrl
          || asset.thumbnail_url
          || asset.coverUrl
          || asset.cover_url
          || asset.firstFrameUrl
          || asset.first_frame_url
          || null)
        : null;
      const previewUrl = isVideo
        ? posterUrl
        : (isAigcMaterial
          ? (asset.sourceUrl || asset.source_url || asset.fileUrl || asset.file_url || asset.url || asset.previewUrl || asset.preview_url || fileUrl)
          : (asset.url || asset.previewUrl || asset.preview_url || asset.thumbnailUrl || asset.thumbnail_url || fileUrl));
      // 只传真实后端 UUID：backendId（创作资产回写的 card.id）或 asset_id（项目资产）
      // 排除 composite id（如 "gen-xxx-0" / "history-xxx-0"），这些不是有效后端 ID
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      // 兜底到 asset.id：项目/全局资产经 normalizePickerAsset 后真实后端 id 就在 id 上，
      // 创作历史 composite id 会因 UUID 校验被过滤，安全
      // AIGC 素材的 asset_ref_url 是服务商引用地址；不把 live-materials 资产 ID
      // 当作普通资产 ID 传入，避免后端改走普通图片解析。
      const rawId = asset.isAigcMaterial ? undefined : (asset.backendId || asset.asset_id || asset.id);
      const assetId = rawId && UUID_RE.test(rawId) ? rawId : undefined;
      return {
        name: asset.name || asset.id,
        size: 0,
        url: fileUrl,
        videoUrl: isVideo ? fileUrl : null,
        previewUrl,
        sourceUrl: asset.sourceUrl || asset.source_url || null,
        fileUrl: asset.fileUrl || asset.file_url || null,
        posterUrl,
        assetId,
        isAigcMaterial: Boolean(asset.isAigcMaterial),
        assetRefUrl: asset.assetRefUrl || asset.asset_ref_url || undefined,
        isAsset: true,
        type: isVideo ? 'video/mp4' : isAudio ? 'audio/mpeg' : 'image/jpeg',
      };
    });
    if (genType === 'video' && assetFiles.some(isImageFile)
      && shouldConfirmFrameModeForImageReference({
        capabilities: activeVideoCapabilities,
        referenceMode: refMode,
      })) {
      setPendingFrameModeImages(assetFiles.filter(isImageFile));
      return;
    }
    if (liveMats.length > 0 || assetFiles.length > 0) {
      safeSetFiles((prev) => [
        ...prev,
        ...liveMats,
        ...assetFiles,
      ]);
    }
  };

  const concurrentLimit = genType === 'dubbing' ? 5 : 10;
  const atConcurrentLimit = activeCount >= concurrentLimit;
  const canSend = !disabled && !atConcurrentLimit && (hasContent || files.length > 0 || firstFrameFile || lastFrameFile || (genType === 'dubbing' && selectedVoiceId));
  const isDubbingGenerating = (genType === 'dubbing' || genType === 'music') && disabled;
  const requiresDubbingVoice = genType === 'dubbing';

  const restoreSavedInput = () => {
    const backup = savedContentRef.current;
    restoreContent({
      html: backup.html,
      text: backup.text,
      restoreFiles: savedContentRef.current.files || files,
    });
    setPromptCharacterCount((backup.text || '').length);
    const savedFiles = savedContentRef.current.files || [];
    replaceFiles(savedFiles);
    setFirstFrameFile(savedContentRef.current.firstFrameFile || null);
    setLastFrameFile(savedContentRef.current.lastFrameFile || null);
    if (backup.dubbingSpeed !== undefined) setDubbingSpeed(backup.dubbingSpeed);
    if (backup.dubbingPitch !== undefined) setDubbingPitch(backup.dubbingPitch);
    if (backup.dubbingVolume !== undefined) setDubbingVolume(backup.dubbingVolume);
    setSelectedVoiceId(backup.voiceId || '');
    setSelectedVoiceName(backup.voiceName || '');
    setSelectedVoiceSource(backup.voiceSource || '');
  };

  const handleSend = async () => {
    if (!canSend) return;
    if (requiresDubbingVoice && !selectedVoiceId) {
      showToast?.('warning', '请先选择音色');
      setVoiceModalOpen(true);
      return;
    }
    // 提取纯文字 prompt，剔除 @ 标签节点（data-file-ref），避免把 @文件名 混入发给后端的 prompt
    const { text: currentText, requestText, html: savedHTML } = getPromptSnapshot();
    const generationText = genType === 'dubbing' && dubbingAdvancedEnabled ? requestText : currentText;
    const savedFiles = files;
    let videoGenerationMode;
    let videoReferenceMode;
    let requestModel = model;
    let requestCapabilities = capabilitiesMap?.[model] || {};
    if (genType === 'video') {
      const routeResult = resolveVideoGenerationMode({
        modelId: model,
        modelName: currentModel?.label,
        capabilities: activeVideoCapabilities,
        referenceMode: refMode,
        hasPrompt: Boolean(currentText.trim()),
        imageCount: savedFiles.filter((file) => !file.isLiveMaterial && isImageFile(file)).length,
        videoCount: savedFiles.filter(isVideoFile).length,
        audioCount: savedFiles.filter(isAudioFile).length,
        liveMaterialCount: savedFiles.filter((file) => file.isLiveMaterial).length,
        hasFirstFrame: Boolean(firstFrameFile),
        hasLastFrame: Boolean(lastFrameFile),
      });
      if (!routeResult.ok) {
        showToast?.('warning', routeResult.message);
        return;
      }
      videoGenerationMode = routeResult.generationMode;
      const hasReferenceVideo = savedFiles.some(isVideoFile);
      const requestRoute = resolveVideoModelRoute({
        modelOption: currentModel,
        generationMode: videoGenerationMode,
        referenceMode: refMode,
        hasReferenceVideo,
      });
      if (hasReferenceVideo
        && currentModel?.uploadReferenceCapabilities
        && !requestRoute) {
        showToast?.('warning', '当前 HappyHorse 模型暂不支持参考视频，请移除视频素材或更换模型');
        return;
      }
      requestModel = requestRoute?.modelId || model;
      requestCapabilities = requestRoute?.capabilities || activeVideoCapabilities;
      const referenceRouteResult = resolveVideoReferenceMode({
        generationMode: videoGenerationMode,
        capabilities: requestCapabilities,
      });
      if (!referenceRouteResult.ok) {
        showToast?.('warning', referenceRouteResult.message);
        return;
      }
      videoReferenceMode = referenceRouteResult.referenceMode;
      if (refMode?.startsWith('kling_') && !requestRoute) {
        showToast?.('warning', '当前 Kling V3 专项能力暂不可用，请刷新模型数据后重试');
        return;
      }
    }
    savedContentRef.current = {
      html: savedHTML,
      text: currentText,
      files: savedFiles,
      firstFrameFile,
      lastFrameFile,
      voiceId: selectedVoiceId || "",
      voiceName: selectedVoiceName || "",
      voiceSource: selectedVoiceSource || "",
      dubbingSpeed,
      dubbingPitch,
      dubbingVolume,
    };
    // @素材标签是通过 DOM 插入的，部分浏览器不会为这类操作触发 input 事件；
    // 发送前显式写入当前快照，避免新输入卡从旧的纯文本草稿恢复。
    persistDraft(true);
    const savedFirstFrameFile = firstFrameFile;
    const savedLastFrameFile = lastFrameFile;
    resetDubbingParams();
    setSelectedVoiceId('');
    setSelectedVoiceName('');
    setSelectedVoiceSource('');
      await onGenerate?.({
      prompt: generationText,
      promptHTML: savedHTML,
      genType,
          model: requestModel,
          modelName: currentModel?.label,
      ...(genType === 'image' ? { ratio, resolution, count } : {}),
      ...(genType === 'video' ? (() => {
        const liveMats = savedFiles.filter(f => f.isLiveMaterial);
        // 按 groupId 分组，构建 provider_params.live_material 数组
        const groupMap = {};
        liveMats.forEach(f => {
          if (!f.groupId) return;
          if (!groupMap[f.groupId]) groupMap[f.groupId] = { group_id: f.groupId, group_type: f.groupType || 'LivenessFace', asset_ids: [] };
          groupMap[f.groupId].asset_ids.push(f.assetId);
        });
        const liveMaterialParam = Object.values(groupMap);
        return {
          refMode,
          generation_mode: videoGenerationMode,
          reference_mode: videoReferenceMode,
          videoCapabilities: requestCapabilities,
          supportedGenerationModes: requestCapabilities?.supported_generation_modes || [],
          isSeedance: isCurrentSeedance,
          videoRatio, videoResolution, videoDuration, soundEnabled, firstFrameFile, lastFrameFile,
          liveMaterialParam: liveMaterialParam.length > 0 ? liveMaterialParam : null,
          liveMaterialFiles: liveMats,  // 保留预览信息用于详情展示和重新编辑
        };
      })() : {}),
      ...(genType === 'dubbing' ? { speed: dubbingSpeed, voiceId: selectedVoiceId, voiceName: selectedVoiceName } : {}),
      ...(genType === 'dubbing' ? {
        voiceSource: selectedVoiceSource,
        pitch: dubbingPitch,
        volume: dubbingVolume,
        advancedEnabled: dubbingAdvancedEnabled,
        voice_setting: {
          voice_id: selectedVoiceId,
          speed: dubbingSpeed,
          pitch: dubbingPitch,
          vol: dubbingVolume,
        },
        ...(dubbingAdvancedEnabled ? {
          voice_modify: buildDubbingVoiceModify(dubbingEffects),
        } : {}),
      } : {}),
      files: savedFiles.filter(f => !f.isLiveMaterial),
      onFail: (fallbackPrompt) => {
        // 失败时回退输入框内容（含标签 HTML）和附件
        restoreContent({ html: savedHTML, text: currentText, fallback: fallbackPrompt, restoreFiles: savedFiles });
        setPromptCharacterCount(currentText.length);
        replaceFiles(savedFiles);
        setFirstFrameFile(savedFirstFrameFile);
        setLastFrameFile(savedLastFrameFile);
        setDubbingSpeed(dubbingSpeed);
        setDubbingPitch(dubbingPitch);
        setDubbingVolume(dubbingVolume);
        setSelectedVoiceId(selectedVoiceId || '');
        setSelectedVoiceName(selectedVoiceName || '');
        setSelectedVoiceSource(selectedVoiceSource || '');
      },
      onCancel: (genType === 'dubbing' || genType === 'music') ? restoreSavedInput : undefined,
    });
  };

  const handleSendOrCancel = () => {
    if (isDubbingGenerating) {
      onCancelGeneration?.();
      return;
    }
    handleSend();
  };

  const handleKeyDown = (event) => {
    handlePromptKeyDown(event, handleSend);
  };

  const assetPickerAccept = genType === 'image'
    ? 'image'
    : genType === 'video'
      ? allowsVideoAudio ? 'all' : 'media'
      : (genType === 'dubbing' || genType === 'music') ? 'audio' : 'all';
  const assetPickerPreSelectedFiles = [...files, firstFrameFile, lastFrameFile]
    .filter((file) => file?.isAsset);
  const assetPickerPreSelectedIds = assetPickerPreSelectedFiles
    .flatMap((file) => [file.assetId, file.asset_id].filter((id) => id != null))
    .map((id) => String(id));
  const assetPickerPreSelectedUrls = assetPickerPreSelectedFiles
    .flatMap((file) => [
      file.url,
      file.fileUrl,
      file.file_url,
      file.sourceUrl,
      file.source_url,
      file.previewUrl,
      file.preview_url,
      file.posterUrl,
      file.poster_url,
    ].filter(Boolean));
  return (
    <>
      <CreationInputSurface
      width={width}
      disabled={disabled}
      promptDisabled={promptDisabled}
      focused={focused}
      expanded={genType === 'dubbing' && dubbingAdvancedEnabled}
      upload={{
        genType,
        refMode,
        firstFrameFile,
        lastFrameFile,
        onFirstChange: setFirstFrameFile,
        onLastChange: setLastFrameFile,
        onSwap: swapFrameFiles,
        onFirstAssetPick: () => { setFrameAssetTarget('first'); setAssetPickerOpen(true); },
        onLastAssetPick: () => { setFrameAssetTarget('last'); setAssetPickerOpen(true); },
        onFileSelect: handleFileSelect,
        onAssetPick: () => setAssetPickerOpen(true),
        allowedExts: uploadAllowedExts,
        acceptAttr: uploadAcceptAttr,
        voiceId: selectedVoiceId,
        voiceName: selectedVoiceName,
        onVoiceRemove: () => { setSelectedVoiceId(''); setSelectedVoiceName(''); setSelectedVoiceSource(''); },
        onOpenVoiceModal: () => setVoiceModalOpen(true),
      }}
      prompt={{
        editorRef,
        files,
        hasContent,
        genType,
        refMode,
        dubbingAdvancedEnabled,
        onDocumentSelect: handleDubbingDocumentSelect,
        onInput: handlePromptInput,
        onBeforeInput: handleBeforeInput,
        onKeyDown: handleKeyDown,
        onPaste: handlePaste,
        onFocus: handleEditorFocus,
        onBlur: handleEditorBlur,
        renderFileCard: (file, index) => isAudioFile(file) ? (
          <CreationAudioFileCard key={index} file={file} onRemove={() => handleRemoveFile(index)} disabled={disabled} onInsert={() => insertFromCard(file)} />
        ) : (
          <CreationFileCard key={index} file={file} onRemove={() => handleRemoveFile(index)} disabled={disabled} onInsert={() => insertFromCard(file)} />
        ),
        mentionOpen,
        mentionQuery,
        mentionPos,
        mentionMenuRef,
        mentionIndex,
        onMentionSelect: insertMention,
        onMentionIndexChange: setMentionIndex,
        emotionMenuPosition,
        emotionMenuSelectedEmotion,
        onEmotionSelect: applyEmotion,
        pauseMenuPosition,
        interjectionMenuPosition,
        onPauseSelect: (value) => insertInlineTag(`#${value.replace('s', '')}#`, 'pause'),
        onPauseCustomInput: (value) => insertInlineTag(`#${value}#`, 'pause'),
        onInterjectionSelect: (value) => insertInlineTag(value, 'interjection'),
      }}
      controls={{
        genType,
        model,
        modelOptions,
        creationParams,
        onGenTypeChange: handleLocalGenTypeChange,
        onModelChange: handleModelChange,
        onBeforeModelOpen,
        dubbingSpeed,
        dubbingPitch,
        dubbingVolume,
        onDubbingSpeedChange: setDubbingSpeed,
        onDubbingPitchChange: setDubbingPitch,
        onDubbingVolumeChange: setDubbingVolume,
        dubbingAdvancedEnabled,
        onDubbingAdvancedChange: handleAdvancedChange,
        dubbingEffects,
        onDubbingEffectToneChange: (key, value) => setDubbingEffects((current) => ({ ...current, toneValues: { ...current.toneValues, [key]: value } })),
        onDubbingEffectToggle: (selectedEffects) => setDubbingEffects((current) => ({ ...current, selectedEffects })),
        dubbingPromptCharacterCount: promptCharacterCount,
        dubbingHasTextSelection: hasTextSelection,
        onDubbingEmotionClick: openEmotionMenu,
        onDubbingPauseClick: () => openInlineMenu('pause'),
        onDubbingInterjectionClick: () => openInlineMenu('interjection'),
        ratio,
        resolution,
        count,
        onRatioChange: setRatio,
        onResolutionChange: setResolution,
        onCountChange: setCount,
        refMode,
        referenceModeOptions: currentModel?.availableReferenceModes || creationParams?.refModes || [],
        onRefModeChange: handleRefModeChange,
        videoRatio,
        videoResolution,
        videoDuration,
        onVideoRatioChange: setVideoRatio,
        onVideoResolutionChange: setVideoResolution,
        onVideoDurationChange: setVideoDuration,
        soundEnabled,
        onSoundChange: setSoundEnabled,
        showLiveMaterial,
        onOpenLiveMaterial: () => setLiveMaterialModalOpen(true),
      }}
      send={{
        onClick: handleSendOrCancel,
        disabled: isDubbingGenerating ? false : !canSend,
        loading: disabled,
        cancelable: isDubbingGenerating,
        disabledTooltip: atConcurrentLimit ? `当前有${concurrentLimit}个任务进行中，为了保证成功率，请稍等一会儿再发送创作请求` : '',
      }}
      overlays={{
        assetPickerOpen,
        onAssetPickerClose: () => setAssetPickerOpen(false),
        onFrameAssetTargetClear: () => setFrameAssetTarget(null),
        onAssetConfirm: handleAssetConfirm,
        assetPickerAccept,
        assetPickerPreSelectedIds,
        assetPickerPreSelectedUrls,
        model,
        voiceModalOpen,
        onVoiceModalClose: () => setVoiceModalOpen(false),
        onVoiceConfirm: (voiceId, voiceName, _tab, voiceSource) => {
          setSelectedVoiceId(voiceId);
          setSelectedVoiceName(voiceName);
          setSelectedVoiceSource(voiceSource || '');
          setVoiceModalOpen(false);
        },
        showToast,
        liveMaterialModalOpen,
        onLiveMaterialModalClose: () => setLiveMaterialModalOpen(false),
        onLiveMaterialConfirm: (items) => {
          const liveMats = items.map((item) => ({
            ...item,
            isAsset: true,
            isLiveMaterial: true,
            assetId: item.assetId,
            groupId: item.groupId,
            groupType: item.groupType,
            assetRefUrl: item.assetRefUrl,
            url: item.previewUrl,
            previewUrl: item.previewUrl,
            sourceUrl: item.sourceUrl || item.source_url || null,
            fileUrl: item.fileUrl || item.file_url || null,
            name: item.name || '真人素材',
            type: String(item.assetType || item.asset_type || item.type || '').toLowerCase().startsWith('video') ? 'video/mp4' : 'image/jpeg',
            size: 0,
          }));
          safeSetFiles((prev) => [...prev, ...liveMats]);
        },
        liveMaterialInitialSelected: files.filter((file) => file.isLiveMaterial).map((file) => ({
          assetId: file.assetId,
          assetRefUrl: file.assetRefUrl,
          previewUrl: file.previewUrl,
          name: file.name,
        })),
      }}
      />
      {advancedExitConfirmOpen && (
        <ConfirmDialog
          title="退出高级模式"
          description={<>是否要继续退出高级模式？<br />现在编辑的高级内容会丢失，请谨慎操作！</>}
          cancelText="我再想想"
          confirmText="直接退出"
          confirmVariant="danger"
          onCancel={() => setAdvancedExitConfirmOpen(false)}
          onConfirm={confirmAdvancedExit}
        />
      )}
      {pendingFrameModeImages && (
        <ConfirmDialog
          title="切换至首尾帧模式"
          description={<>当前模型的全能参考暂仅支持文生视频，图生视频能力正在加紧接入中，敬请期待。是否切换至首尾帧模式并添加图片？</>}
          cancelText="暂不切换"
          confirmText="切换并添加"
          confirmVariant="orange"
          onCancel={() => setPendingFrameModeImages(null)}
          onConfirm={confirmFrameModeImageAdd}
        />
      )}
      {pendingModelChange && !pendingFrameModeImages && (
        <ConfirmDialog
          title="提醒"
          description={<>当前模型的全能参考模式暂时不支持参考图片/视频/音频素材，你可以「切换至首尾帧」继续使用当前模型，也可以「取消」并保留上次模型选项。<br />图生视频能力正在加紧接入中，敬请期待。</>}
          cancelText="取消"
          confirmText="切换至首尾帧"
          confirmVariant="orange"
          onCancel={() => setPendingModelChange(null)}
          onConfirm={confirmModelChangeToFrameMode}
        />
      )}
      {pendingReferenceModeChange && !pendingModelChange && !pendingFrameModeImages && (
        <ConfirmDialog
          title="提醒"
          description={<>当前模型的全能参考模式暂时不支持参考图片/视频/音频素材，请切换至首尾帧继续使用当前图片。<br />图生视频能力正在加紧接入中，敬请期待。</>}
          cancelText="取消"
          confirmText="切换至首尾帧"
          confirmVariant="orange"
          onCancel={() => setPendingReferenceModeChange(null)}
          onConfirm={() => {
            setRefMode(VIDEO_REFERENCE_MODES.FRAME);
            setPendingReferenceModeChange(null);
          }}
        />
      )}
    </>
  );
}


export default InputCard;
