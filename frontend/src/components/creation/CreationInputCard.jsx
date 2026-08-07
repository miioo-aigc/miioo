/**
 * @file CreationInputCard.jsx
 * @description 创作输入区状态、素材接线、参数组装和生成回调适配。
 *
 * 该组件不调用页面 API、Store 或缓存；生成参数通过 onGenerate 显式交回页面，
 * 页面继续负责生成请求、任务轮询、缓存和全局状态写回。
 *
 * ─── 结构索引 ───────────────────────────────────────────
 *   InputCard 状态与 Hook 接线                         L30–L181
 *   输入预填充、素材选择和失败/取消恢复                 L183–L437
 *   CreationInputSurface 组合                           L439–L538
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import CreationFileCard from './CreationFileCard';
import CreationInputSurface from './CreationInputSurface';
import { DEFAULT_EMOTIONS } from './CreationSelectorConstants';
import { useCreationInputFiles } from './useCreationInputFiles';
import { useCreationPromptInteraction } from './useCreationPromptInteraction';
import { useCreationParamsState } from './useCreationParamsState';
import { isSeedanceModel } from '../../utils/seedanceModel';
import {
  MAX_CREATION_FILES,
  getCreationUploadExtensions,
  getCreationAcceptAttr,
  isImageFile,
} from './CreationFileUtils';

// ─── InputCard ────────────────────────────────────────────────────────────────
function InputCard({ onGenerate, onCancelGeneration, width = '800px', disabled = false, genType, onGenTypeChange,
  model, onModelChange, modelOptions = [], creationParams, prefillVersion = 0, prefillData = null, onBeforeModelOpen, showToast, activeCount = 0, capabilitiesMap = {} }) {
  const [liveMaterialModalOpen, setLiveMaterialModalOpen] = useState(false);
  const [selectedVoiceName, setSelectedVoiceName] = useState('');
  const [selectedVoiceId, setSelectedVoiceId] = useState('');
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
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
    dubbingEmotion,
    setDubbingEmotion,
    resetDubbingParams,
  } = useCreationParamsState({ creationParams, genType, prefillVersion, prefillData });
  const {
    files,
    setFiles,
    firstFrameFile,
    setFirstFrameFile,
    lastFrameFile,
    setLastFrameFile,
    safeSetFiles,
    handleFileSelect,
    removeFile,
    replaceFiles,
    clearFiles,
    swapFrameFiles,
  } = useCreationInputFiles({
    model,
    genType,
    refMode,
    capabilitiesMap,
    onToast: showToast,
    onFileTooLarge: () => alert('抱歉，平台暂不支持上传20M以上的图片资源！'),
  });
  const [frameAssetTarget, setFrameAssetTarget] = useState(null);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const savedContentRef = useRef({
    html: "",
    text: "",
    voiceId: "",
    voiceName: "",
    dubbingSpeed: undefined,
    dubbingEmotion: undefined,
  }); // 用于失败时回退

  const {
    editorRef,
    mentionMenuRef,
    focused,
    hasContent,
    mentionOpen,
    mentionQuery,
    mentionPos,
    mentionIndex,
    handleInput,
    handleKeyDown: handlePromptKeyDown,
    handlePaste,
    handleEditorFocus,
    handleEditorBlur,
    handleRemoveFile,
    insertFromCard,
    insertMention,
    getPromptSnapshot,
    restoreContent,
    setMentionIndex,
  } = useCreationPromptInteraction({
    files,
    disabled,
    genType,
    refMode,
    showToast,
    handleFileSelect,
    removeFile,
    prefillVersion,
    prefillData,
  });

  // 保留图片/视频/配音各自的输入草稿，避免切换模式时互相覆盖。
  const draftsRef = useRef({});
  const previousGenTypeRef = useRef(genType);
  const captureDraft = useCallback(() => {
    const snapshot = getPromptSnapshot();
    draftsRef.current[previousGenTypeRef.current] = {
      ...snapshot,
      files,
      firstFrameFile,
      lastFrameFile,
      refMode,
      selectedVoiceId,
      selectedVoiceName,
      dubbingSpeed,
      dubbingEmotion,
    };
  }, [dubbingEmotion, dubbingSpeed, files, firstFrameFile, getPromptSnapshot, lastFrameFile, refMode, selectedVoiceId, selectedVoiceName]);

  const handleLocalGenTypeChange = useCallback((nextType) => {
    captureDraft();
    onGenTypeChange?.(nextType);
  }, [captureDraft, onGenTypeChange]);

  useEffect(() => {
    if (previousGenTypeRef.current === genType) return;
    previousGenTypeRef.current = genType;
    const draft = draftsRef.current[genType];
    if (draft) {
      const draftFiles = draft.files || [];
      restoreContent({ html: draft.html, text: draft.text, restoreFiles: draftFiles });
      replaceFiles(draftFiles);
      setFirstFrameFile(draft.firstFrameFile || null);
      setLastFrameFile(draft.lastFrameFile || null);
      if (draft.refMode && genType === 'video') setRefMode(draft.refMode);
      setSelectedVoiceId(draft.selectedVoiceId || '');
      setSelectedVoiceName(draft.selectedVoiceName || '');
      if (draft.dubbingSpeed !== undefined) setDubbingSpeed(draft.dubbingSpeed);
      if (draft.dubbingEmotion !== undefined) setDubbingEmotion(draft.dubbingEmotion);
    } else {
      restoreContent({ html: '', text: '' });
      replaceFiles([]);
      setFirstFrameFile(null);
      setLastFrameFile(null);
      setSelectedVoiceId('');
      setSelectedVoiceName('');
    }
  }, [genType, replaceFiles, restoreContent, setDubbingEmotion, setDubbingSpeed, setFirstFrameFile, setLastFrameFile, setRefMode]);


  // Video: filter modelOptions by refMode
  const dubbingEmotions = useMemo(() => { return creationParams?.emotions ?? DEFAULT_EMOTIONS; }, [creationParams]);

  // 是否显示真人素材入口：仅视频模式、当前模型支持，且不属于 Seedance 系列。
  const showLiveMaterial = useMemo(() => {
    if (genType !== 'video') return false;
    const currentModel = modelOptions.find(m => m.value === model);
    return !!(currentModel?.supportsLiveMaterial) && !isSeedanceModel(currentModel);
  }, [genType, model, modelOptions]);

  const filteredModelOptions = useMemo(() => {
    if (genType !== 'video') return modelOptions;
    if (!refMode) return modelOptions;
    if (refMode === 'frame') {
      return modelOptions.filter(m => m.hasFrame);
    }
    // 'all' (全能参考): 只显示支持全能参考的模型
    return modelOptions.filter(m => m.hasFull);
  }, [genType, refMode, modelOptions]);

  // Video: sync model when refMode changes
  const handleRefModeChange = useCallback((newRefMode) => {
    // 切换到首尾帧：将 files 中的图片迁移到帧槽位，其余丢弃
    if (newRefMode === 'frame') {
      const imageFiles = files.filter((file) => isImageFile(file));
      setFirstFrameFile(imageFiles[0] || null);
      setLastFrameFile(imageFiles[1] || null);
      clearFiles({ preserveFiles: imageFiles });
    }
    // 离开首尾帧：将帧槽位的图片合并回 files 作为普通参考图
    if (refMode === 'frame' && newRefMode !== 'frame') {
      const carried = [firstFrameFile, lastFrameFile].filter(Boolean);
      if (carried.length > 0) replaceFiles(carried.map(f => (f instanceof File) ? f : { ...f, isAsset: true }));
    }
    setRefMode(newRefMode);
    const filtered = newRefMode === 'frame'
      ? modelOptions.filter(m => m.hasFrame)
      : modelOptions.filter(m => m.hasFull);
    const inList = filtered.some(m => m.value === model);
    if (!inList && filtered.length > 0) {
      onModelChange(filtered[0].value);
    }
  }, [clearFiles, files, refMode, firstFrameFile, lastFrameFile, modelOptions, model, onModelChange, replaceFiles, setFirstFrameFile, setLastFrameFile, setRefMode]);
  // Apply prefill when version bumps (re-edit or use-as-ref or use-as-first-frame)
  useEffect(() => {
    if (!prefillVersion || !prefillData) return;
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

  const uploadAllowedExts = getCreationUploadExtensions(genType, creationParams?.supportsAudio);
  const uploadAcceptAttr = getCreationAcceptAttr(genType, creationParams?.supportsAudio);

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
    const liveMaterialAssets = selectedAssets.filter((asset) => asset.isLiveMaterial);
    const liveMats = liveMaterialAssets.map((asset) => ({
        isAsset: true,
        isLiveMaterial: true,
        assetId: asset.id,
        groupId: asset.groupId,
        groupType: asset.groupType,
        assetRefUrl: asset.assetRefUrl,
        url: asset.previewUrl || asset.url,
        previewUrl: asset.previewUrl || asset.url,
        name: asset.name || '真人素材',
        type: 'image/jpeg',
        size: 0,
      }));
    const assetFiles = selectedAssets.filter((asset) => !asset.isLiveMaterial).map((asset) => {
      const isVideo = asset.type === 'video';
      const isAudio = asset.type === 'audio';
      let fileUrl;
      if (isVideo) fileUrl = asset.videoUrl || asset.fileUrl || asset.url;
      else if (isAudio) fileUrl = asset.audioUrl || asset.fileUrl || asset.url;
      else fileUrl = asset.fileUrl || asset.url;
      const previewUrl = asset.url || asset.thumbnailUrl || asset.thumbnail_url || fileUrl;
      // 只传真实后端 UUID：backendId（创作资产回写的 card.id）或 asset_id（项目资产）
      // 排除 composite id（如 "gen-xxx-0" / "history-xxx-0"），这些不是有效后端 ID
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      // 兜底到 asset.id：项目/全局资产经 normalizePickerAsset 后真实后端 id 就在 id 上，
      // 创作历史 composite id 会因 UUID 校验被过滤，安全
      // AIGC 素材属于 live-materials 资源，不一定存在统一资产表记录；仅通过 URL 作为参考图传递。
      const rawId = asset.isAigcMaterial ? undefined : (asset.backendId || asset.asset_id || asset.id);
      const assetId = rawId && UUID_RE.test(rawId) ? rawId : undefined;
      return {
        name: asset.name || asset.id,
        size: 0,
        url: fileUrl,
        previewUrl,
        assetId,
        isAsset: true,
        type: isVideo ? 'video/mp4' : isAudio ? 'audio/mpeg' : 'image/jpeg',
      };
    });
    if (liveMats.length > 0 || assetFiles.length > 0) {
      safeSetFiles((prev) => [
        ...prev.filter((file) => !file.isLiveMaterial),
        ...liveMats,
        ...assetFiles,
      ]);
    }
  };

  const concurrentLimit = genType === 'dubbing' ? 5 : 10;
  const atConcurrentLimit = activeCount >= concurrentLimit;
  const canSend = !disabled && !atConcurrentLimit && (hasContent || files.length > 0 || firstFrameFile || lastFrameFile || (genType === 'dubbing' && selectedVoiceId));
  const isDubbingGenerating = genType === 'dubbing' && disabled;

  const restoreSavedInput = () => {
    const backup = savedContentRef.current;
    restoreContent({
      html: backup.html,
      text: backup.text,
      restoreFiles: savedContentRef.current.files || files,
    });
    const savedFiles = savedContentRef.current.files || [];
    replaceFiles(savedFiles);
    setFirstFrameFile(savedContentRef.current.firstFrameFile || null);
    setLastFrameFile(savedContentRef.current.lastFrameFile || null);
    if (backup.dubbingSpeed !== undefined) setDubbingSpeed(backup.dubbingSpeed);
    if (backup.dubbingEmotion !== undefined) setDubbingEmotion(backup.dubbingEmotion);
    setSelectedVoiceId(backup.voiceId || '');
    setSelectedVoiceName(backup.voiceName || '');
  };

  const handleSend = async () => {
    if (!canSend) return;
    // 提取纯文字 prompt，剔除 @ 标签节点（data-file-ref），避免把 @文件名 混入发给后端的 prompt
    const { text: currentText, html: savedHTML } = getPromptSnapshot();
    const savedFiles = files;
    savedContentRef.current = {
      html: savedHTML,
      text: currentText,
      files: savedFiles,
      firstFrameFile,
      lastFrameFile,
      voiceId: selectedVoiceId || "",
      voiceName: selectedVoiceName || "",
      dubbingSpeed,
      dubbingEmotion,
    };
    const savedFirstFrameFile = firstFrameFile;
    const savedLastFrameFile = lastFrameFile;
    resetDubbingParams();
    setSelectedVoiceId('');
    setSelectedVoiceName('');
    // 视频模式：把「全能参考」/「首尾帧」映射为当前模型支持的实际 reference_mode
    let actualRefMode = refMode;
    if (genType === 'video') {
      const currentModel = modelOptions.find(m => m.value === model);
      if (refMode === 'all') {
        actualRefMode = currentModel?.actualAllRefMode || 'full';
      } else if (refMode === 'frame') {
        actualRefMode = currentModel?.actualFrameRefMode || 'first_frame';
      }
    }
    await onGenerate?.({
      prompt: currentText,
      promptHTML: savedHTML,
      genType,
      model,
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
          refMode: actualRefMode, videoRatio, videoResolution, videoDuration, soundEnabled, firstFrameFile, lastFrameFile,
          liveMaterialParam: liveMaterialParam.length > 0 ? liveMaterialParam : null,
          liveMaterialFiles: liveMats,  // 保留预览信息用于详情展示和重新编辑
        };
      })() : {}),
      ...(genType === 'dubbing' ? { speed: dubbingSpeed, emotion: dubbingEmotion, voiceId: selectedVoiceId, voiceName: selectedVoiceName } : {}),
      files: savedFiles.filter(f => !f.isLiveMaterial),
      onFail: (fallbackPrompt) => {
        // 失败时回退输入框内容（含标签 HTML）和附件
        restoreContent({ html: savedHTML, text: currentText, fallback: fallbackPrompt, restoreFiles: savedFiles });
        replaceFiles(savedFiles);
        setFirstFrameFile(savedFirstFrameFile);
        setLastFrameFile(savedLastFrameFile);
        setDubbingSpeed(dubbingSpeed);
        setDubbingEmotion(dubbingEmotion);
        setSelectedVoiceId(selectedVoiceId || '');
        setSelectedVoiceName(selectedVoiceName || '');
      },
      onCancel: genType === 'dubbing' ? restoreSavedInput : undefined,
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

  const assetPickerAccept = genType === 'image' ? 'image' : genType === 'video' ? (creationParams?.supportsAudio ? 'all' : 'image') : genType === 'dubbing' ? 'audio' : 'all';
  return (
    <CreationInputSurface
      width={width}
      disabled={disabled}
      focused={focused}
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
        onVoiceRemove: () => { setSelectedVoiceId(''); setSelectedVoiceName(''); },
        onOpenVoiceModal: () => setVoiceModalOpen(true),
      }}
      prompt={{
        editorRef,
        files,
        hasContent,
        genType,
        refMode,
        onInput: handleInput,
        onKeyDown: handleKeyDown,
        onPaste: handlePaste,
        onFocus: handleEditorFocus,
        onBlur: handleEditorBlur,
        renderFileCard: (file, index) => (
          <CreationFileCard key={index} file={file} onRemove={() => handleRemoveFile(index)} disabled={disabled} onInsert={() => insertFromCard(file)} />
        ),
        mentionOpen,
        mentionQuery,
        mentionPos,
        mentionMenuRef,
        mentionIndex,
        onMentionSelect: insertMention,
        onMentionIndexChange: setMentionIndex,
      }}
      controls={{
        genType,
        model,
        modelOptions,
        filteredModelOptions,
        creationParams,
        onGenTypeChange: handleLocalGenTypeChange,
        onModelChange,
        onBeforeModelOpen,
        dubbingSpeed,
        dubbingEmotion,
        dubbingEmotions,
        onDubbingSpeedChange: setDubbingSpeed,
        onDubbingEmotionChange: setDubbingEmotion,
        ratio,
        resolution,
        count,
        onRatioChange: setRatio,
        onResolutionChange: setResolution,
        onCountChange: setCount,
        refMode,
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
        model,
        voiceModalOpen,
        onVoiceModalClose: () => setVoiceModalOpen(false),
        onVoiceConfirm: (voiceId, voiceName) => {
          setSelectedVoiceId(voiceId);
          setSelectedVoiceName(voiceName);
          setVoiceModalOpen(false);
        },
        liveMaterialModalOpen,
        onLiveMaterialModalClose: () => setLiveMaterialModalOpen(false),
        onLiveMaterialConfirm: (items) => {
          const liveMats = items.map((item) => ({
            isAsset: true,
            isLiveMaterial: true,
            assetId: item.assetId,
            groupId: item.groupId,
            groupType: item.groupType,
            assetRefUrl: item.assetRefUrl,
            url: item.previewUrl,
            previewUrl: item.previewUrl,
            name: item.name || '真人素材',
            type: 'image/jpeg',
            size: 0,
          }));
          setFiles((prev) => [...prev.filter((file) => !file.isLiveMaterial), ...liveMats]);
        },
        liveMaterialInitialSelected: files.filter((file) => file.isLiveMaterial).map((file) => ({
          assetId: file.assetId,
          assetRefUrl: file.assetRefUrl,
          previewUrl: file.previewUrl,
          name: file.name,
        })),
      }}
    />
  );
}


export default InputCard;
