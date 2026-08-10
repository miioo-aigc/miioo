/**
 * @file GenerateVideoPanel.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────
 *   视频生成面板       管理模型、生成模式、提示词和参考素材表单
 *   GenerationModelField / GenerationOptionFields  参数选择纯展示组合
 *   VideoGenerationTabs / VideoSoundToggle  视频模式和音效纯展示组合
 *   GenerationSubmitButton  底部生成动作纯展示按钮
 *   参考素材编辑       管理主体、图片、视频、音频及首尾帧输入
 *   生成结果编排       连接 VideoResultsPanel 与页面回调，维护查看弹窗状态
 *   媒体查看弹窗       负责视频详情查看和定稿状态同步
 *
 * ─── 依赖边界 ───────────────────────────────────────────────
 *   页面通过 props 注入提示词输入、资产映射和业务回调；PanelSelect 与上传槽位
 *   由本组件/ReferenceMediaEditor 直接引入，不由页面转发；
 *   页面继续持有视频生成任务、轮询、持久化和分镜写回；
 *   本组件不读取 StoryboardPage.jsx 的局部变量。
 *
 * ─── 子组件 ─────────────────────────────────────────────────
 *   VideoResultsPanel                         结果列表、上传卡片和视频结果卡片
 *   ReferenceMediaEditor                      参考主体、参考图、参考视频、参考音频和首尾帧
 *
 * ─── 更新记录 ───────────────────────────────────────────────
 *   2026-08-06  参考主体以当前分镜主体参考列为权威集合，并避免关闭/卸载时旧表单快照恢复已删除主体
 *   2026-08-10  首帧支持使用上一个分镜视频尾帧：前端抽帧后上传为图片并写入首帧槽位
 *   2026-08-10  首帧支持从当前分镜图片列表中选择，弹窗由参考媒体编辑器管理
 *   2026-08-10  首尾帧模式提示词改为纯文本，并隔离普通参考图与主体绑定提交
 *   2026-08-06  保留后端时长作为初始默认值；用户修改时长后以用户值为准并同步列表，避免旧值覆盖和父子状态循环
 *   2026-08-05  修复异步表单恢复时首次空状态回写，确保参考图和提示词快照恢复后才触发持久化
 *   2026-08-05  用户编辑提示词后停止外部提示词覆盖，避免删除标签触发状态同步循环
 *   2026-08-05  页面加载补全主体标签后，同步更新已打开弹窗的提示词展示状态
 *   2026-08-05  支持从角色/场景/道具一致性字段对主体名称做唯一模糊匹配，避免普通画面描述误建立绑定
 *   2026-07-30  修复主体参考列新增资产未带入创作视频面板：当前分镜主体引用覆盖旧表单快照并按主体 ID 去重，保留其他已编辑参考素材
 *   2026-08-05  视频提示词保存时从当前 @标签重算 mentions，按 subject_id 去重，避免删除后重绑累加历史记录
 *   2026-08-03  参考主体、参考图、参考视频和参考音频分别归一化、去重，保留各自提交字段边界
 *   2026-07-15  将参考素材编辑区迁移至 ReferenceMediaEditor；本组件继续持有上传 API、模型能力限制、生成参数和页面级回调，所有依赖通过显式 props 传递
 *   2026-07-16  ReferenceMediaEditor 直接引入 StoryboardUploadSlots；本组件不再接收或转发 FrameUploadSlot / PanelUploadSlot，继续负责视频面板业务上传回调和生成参数
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ShotViewerModal from '../ShotViewerModal';
import { apiListModels } from '../../api/config';
import { apiGetVideoLastFrame, apiUploadCreationAudio, apiUploadCreationImage, apiUploadCreationVideo } from '../../api/creation';
import { normalizeImageUrl } from '../../utils/imageUrl';
import { normalizeStoryboardReferenceGroups } from '../../utils/referenceMediaAdapter';
import { getUploadedImageId, getUploadedImageUrl } from '../../utils/storyboardReferenceAdapter';
import {
  normalizeStoryboardDurationOptions,
  normalizeStoryboardModelList,
} from '../../utils/storyboardModelAdapter';
import ReferenceMediaEditor from './ReferenceMediaEditor';
import VideoResultsPanel from './VideoResultsPanel';
import { mergeStoryboardMediaItems } from '../../utils/storyboardMediaDedup';
import { GenerationModelField, GenerationOptionFields } from './GenerationParamsFields';
import { VideoGenerationTabs, VideoSoundToggle } from './VideoGenerationControls';
import GenerationSubmitButton from './GenerationSubmitButton';
import { buildVideoPromptMentions } from '../../utils/storyboardPromptBindingRepair';

const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function normalizeDurationValue(value) {
  return value == null || value === '' ? value : normalizeStoryboardDurationOptions([value])[0];
}

function areReferenceGroupsEqual(previous, next) {
  return JSON.stringify(previous) === JSON.stringify(next);
}

export default function GenerateVideoPanel({
  shot,
  projectId,
  nextShot = null,
  previousFrameShortcut = null,
  currentShotImages = [],
  chars = [],
  scenes = [],
  props = [],
  onClose,
  onGenerate,
  onShowToast,
  onSettleVideo,
  generatedVideos = [],
  onSetGeneratedVideos,
  projectRatio,
  buildStoryboardPrompt,
  buildRefFromAsset,
  ModalCloseBtn,
  PanelPromptInput,
  embedded = false,
  onCandidateMedia,
  formState,
  onFormStateChange,
}) {
  // 生成方式 Tab：'all' 全能参考 | 'frame' 首尾帧
  const [tab, setTab] = useState(() => formState?.tab || 'all');
  const [modelsLoading, setModelsLoading] = useState(true);
  const [model, setModel] = useState(() => formState?.model || '');
  const [frameModels, setFrameModels] = useState([]);
  const [allModels, setAllModels] = useState([]);
  const [resolution, setResolution] = useState(() => formState?.resolution || '');
  const [duration, setDuration] = useState(() => formState?.duration ?? null);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiListModels({ category: 'video' });
        const merged = normalizeStoryboardModelList(data, 'video');

        // 按 reference_modes 分类模型
        const frameModes = ['first_frame', 'last_frame', 'start_end', 'multiframe'];
        const isFrameModel = (m) => {
          const refs = m.capabilities?.reference_modes || [];
          return refs.some(r => frameModes.includes(r));
        };
        const frameModels = merged.filter(isFrameModel);
        const isAllRefModel = (m) => {
          const refs = m.capabilities?.reference_modes || [];
          if (refs.length === 0) return true;
          return refs.some(r => !frameModes.includes(r));
        };
        const allModels = merged.filter(isAllRefModel);

        // 缓存分类列表供 Tab 切换使用
        setFrameModels(frameModels);
        setAllModels(allModels);

        // 默认选中全能参考
        if (allModels.length > 0) {
          const first = allModels.find(m => m.is_default) || allModels[0];
          const restoredModel = formState?.model && allModels.some((item) => item.value === formState.model)
            ? formState.model
            : first.value;
          setModel(restoredModel);
          const selectedModel = allModels.find((item) => item.value === restoredModel) || first;
          const caps = selectedModel.capabilities;
          {
            const resList = (caps?.supported_resolutions?.length ? caps.supported_resolutions : caps?.supported_sizes) || [];
            if (resList.length > 0 && !formState?.resolution) setResolution(resList[0]);
          }
          {
            const durList = caps?.supported_durations;
            if (durList?.length > 0) {
              const shotDur = shot?.params?.duration;
              if (!formState?.duration) {
                setDuration(normalizeDurationValue(shotDur || durList[0]));
              }
            }
          }
        }
      } catch {
        setFrameModels([]);
        setAllModels([]);
      } finally {
        setModelsLoading(false);
      }
    })();
  // 模型列表只在面板挂载时读取；shot 时长仅用于首次默认值。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [sound, setSound] = useState(() => formState?.sound ?? true);
  // 提示词：仅暂存在当前弹窗的本地 state，编辑不回写分镜列表字段。
  // 关闭面板时组件卸载、本地态丢弃，下次打开按 shot 当前字段重新生成初始内容。
  // 点击「生成分镜视频」时才把 prompt 随 onGenerate 传回后端。
  const [prompt, setPrompt] = useState(() => formState?.prompt ?? buildStoryboardPrompt(shot));
  const promptRef = useRef(null);
  const promptEditedRef = useRef(false);
  const lastEmittedFormStateRef = useRef(null);
  const formStateHydratedRef = useRef(Array.isArray(formState?.refImages));

  const handlePromptChange = (nextPrompt) => {
    promptEditedRef.current = true;
    setPrompt(nextPrompt);
  };

  // 页面加载阶段可能会在弹窗挂载后补全主体标签。弹窗不能只读取一次初始值，
  // 否则父级 formState 已经更新，编辑器仍会继续显示打开时的旧提示词。
  useEffect(() => {
    if (promptEditedRef.current) return;
    if (typeof formState?.prompt !== 'string' || formState.prompt === prompt) return;
    const syncTimer = setTimeout(() => setPrompt(formState.prompt), 0);
    return () => clearTimeout(syncTimer);
  }, [formState?.prompt, prompt]);

  const [refSubjects, setRefSubjects] = useState(() => {
    // 从 shot.mainRefs 初始化主体列表，补全 url/name
    const shotSubjects = (shot?.mainRefs || []).map(ref => {
      // character_ids 反序列化的条目 type 被统一置为 'char'，这里按 subjectId/id 跨角色/场景/道具反查真实类型
      const sid = ref?.subjectId || ((ref?.type === 'char' || ref?.type === 'scene' || ref?.type === 'prop') ? ref?.id : null);
      if (sid) {
        const inChars = chars?.find(s => s.id === sid);
        const inScenes = scenes?.find(s => s.id === sid);
        const inProps = props?.find(s => s.id === sid);
        const found = inChars || inScenes || inProps;
        const realType = inChars ? 'char' : inScenes ? 'scene' : inProps ? 'prop' : ref.type;
        if (found?.imageUrl) return { ...ref, type: realType, url: normalizeImageUrl(found.imageUrl), name: found.name };
        if (ref?.url) return { ...ref, type: realType };
      }
      if (ref?.url) return ref;
      return ref;
    }).filter(ref => ref?.url);
    // 主体参考列是当前镜头主体集合的权威来源，不能再把旧表单快照中的已删除主体合并回来。
    return normalizeStoryboardReferenceGroups({ subjects: shotSubjects }).subjects;
  });
  const [refImages, setRefImages] = useState(() => normalizeStoryboardReferenceGroups({ images: formState?.refImages }).images);
  const [refVideos, setRefVideos] = useState(() => normalizeStoryboardReferenceGroups({ videos: formState?.refVideos }).videos);
  const [refAudios, setRefAudios] = useState(() => normalizeStoryboardReferenceGroups({ audios: formState?.refAudios }).audios);
  const [refFirstFrame, setRefFirstFrame] = useState(() => formState?.refFirstFrame || null);
  const [refLastFrame, setRefLastFrame] = useState(() => formState?.refLastFrame || null);
  const [loading, setLoading] = useState(false);
  const [viewerShot, setViewerShot] = useState(null);

  // 主体参考列可能在面板保持打开时被删除；下一帧校正本地列表，避免同步 effect 直接级联渲染。
  useEffect(() => {
    const nextSubjects = normalizeStoryboardReferenceGroups({ subjects: shot?.mainRefs || [] }).subjects;
    const syncTimer = setTimeout(() => {
      setRefSubjects((previous) => (
        areReferenceGroupsEqual(previous, nextSubjects) ? previous : nextSubjects
      ));
    }, 0);
    return () => clearTimeout(syncTimer);
  }, [shot?.mainRefs]);

  const videoPromptMentions = useMemo(
    () => tab === 'frame' ? [] : buildVideoPromptMentions(prompt, refSubjects),
    [prompt, refSubjects, tab],
  );

  const updateReferenceGroup = (setter, group) => (value) => {
    setter((previous) => {
      const next = typeof value === 'function' ? value(previous) : value;
      return normalizeStoryboardReferenceGroups({ [group]: next })[group];
    });
  };
  const handleRefSubjectsChange = updateReferenceGroup(setRefSubjects, 'subjects');
  const handleRefImagesChange = updateReferenceGroup(setRefImages, 'images');
  const handleRefVideosChange = updateReferenceGroup(setRefVideos, 'videos');
  const handleRefAudiosChange = updateReferenceGroup(setRefAudios, 'audios');

  // 父级可能先挂载面板、后收到异步恢复的创作表单。恢复完成前不能把本地
  // 初始空值回传保存；首次收到快照时一次性恢复全部字段。
  useEffect(() => {
    if (formState == null || formStateHydratedRef.current) return;
    if (!Array.isArray(formState.refImages)) return;
    const restoreTimer = setTimeout(() => {
      setTab(formState.tab || 'all');
      setModel(formState.model || '');
      setResolution(formState.resolution || '');
      setDuration(normalizeDurationValue(formState.duration ?? null));
      setSound(formState.sound ?? true);
      if (!promptEditedRef.current && typeof formState.prompt === 'string') setPrompt(formState.prompt);
      // 表单快照只恢复参数和普通参考素材；主体集合始终从当前镜头 mainRefs 获取，
      // 防止主体参考列删除后，旧 refSubjects 把已删除图片重新带回面板。
      setRefSubjects(normalizeStoryboardReferenceGroups({ subjects: shot?.mainRefs || [] }).subjects);
      setRefImages(normalizeStoryboardReferenceGroups({ images: formState.refImages }).images);
      setRefVideos(normalizeStoryboardReferenceGroups({ videos: formState.refVideos }).videos);
      setRefAudios(normalizeStoryboardReferenceGroups({ audios: formState.refAudios }).audios);
      setRefFirstFrame(formState.refFirstFrame || null);
      setRefLastFrame(formState.refLastFrame || null);
      formStateHydratedRef.current = true;
    }, 0);
    return () => clearTimeout(restoreTimer);
  }, [formState, shot?.mainRefs]);

  useEffect(() => {
    if (!formStateHydratedRef.current) return;
    if (!promptEditedRef.current && typeof formState?.prompt === 'string' && formState.prompt !== prompt) return;
    const nextState = {
      tab,
      model,
      resolution,
      duration,
      sound,
      prompt,
      video_prompt_mentions: videoPromptMentions,
      refSubjects,
      refImages,
      refVideos,
      refAudios,
      refFirstFrame,
      refLastFrame,
    };
    const signature = JSON.stringify(nextState);
    if (lastEmittedFormStateRef.current === signature) return;
    lastEmittedFormStateRef.current = signature;
    onFormStateChange?.(nextState);
  }, [tab, model, resolution, duration, sound, prompt, formState?.prompt, videoPromptMentions, refSubjects, refImages, refVideos, refAudios, refFirstFrame, refLastFrame, onFormStateChange]);

  useEffect(() => {
    const nextDuration = normalizeDurationValue(formState?.duration);
    if (!formStateHydratedRef.current || !nextDuration || nextDuration === duration) return;
    setDuration(nextDuration);
  }, [formState?.duration, duration]);

  // 获取当前模型支持的参数（优先从后端 capabilities 派生）
  // 当前 Tab 对应的模型列表
  const tabModels = useMemo(() => {
    return tab === 'frame' ? frameModels : allModels;
  }, [tab, frameModels, allModels]);

  const currentVideoModel = useMemo(() => tabModels.find(m => m.value === model), [model, tabModels]);
  function handleTabChange(newTab) {
    setTab(newTab);
    const newList = newTab === 'frame' ? frameModels : allModels;
    if (newList.length > 0) {
      // 如果当前模型不在新列表中，切到新列表第一个
      const inList = newList.some(m => m.value === model);
      let targetModel = model;
      if (!inList) {
        targetModel = newList[0].value;
        setModel(targetModel);
      }
      // 重置分辨率和时长
      const target = newList.find(m => m.value === targetModel);
      {
        const caps = target?.capabilities;
        const resList = (caps?.supported_resolutions?.length ? caps.supported_resolutions : caps?.supported_sizes) || [];
        if (resList.length > 0) setResolution(resList[0]);
        const durList = caps?.supported_durations;
        if (durList?.length > 0) {
          const shotDur = shot?.params?.duration;
          setDuration(normalizeDurationValue(shotDur || durList[0]));
        }
      }
    }
  }

  const availableResolutions = useMemo(() => {
    const caps = currentVideoModel?.capabilities || {};
    const allRes = (caps.supported_resolutions?.length ? caps.supported_resolutions : caps.supported_sizes) || [];
    if (projectRatio && currentVideoModel?.resolutionSizeMap) {
      return allRes.filter(r => {
        const ratios = currentVideoModel.resolutionSizeMap[r] || {};
        return Object.keys(ratios).length === 0 || Object.keys(ratios).includes(projectRatio);
      });
    }
    return allRes;
  }, [currentVideoModel, projectRatio]);

  // 时长：优先读 supported_durations（字符串数组），兼容旧的 supported_duration_range
  const availableDurations = useMemo(() => {
    const caps = currentVideoModel?.capabilities;
    // 新格式：supported_durations = ["4","5",...,"15"]
    if (caps?.supported_durations?.length > 0) {
      return caps.supported_durations.map(d => String(d).endsWith('s') ? String(d) : String(d) + 's');
    }
    // 旧格式兜底：supported_duration_range = [4, 15]
    const range = caps?.supported_duration_range;
    if (range && range.length === 2) {
      const [min, max] = range;
      return Array.from({ length: max - min + 1 }, (_, i) => `${min + i}s`);
    }
    return [];
  }, [currentVideoModel]);

  // ── 模型能力：参考素材数量上限 ──────────────────────────────────────────────
  const videoCaps = useMemo(() => currentVideoModel?.capabilities || {}, [currentVideoModel]);
  const maxRefImages = videoCaps.max_reference_images ?? null;
  const maxRefVideos = videoCaps.max_reference_videos ?? null;
  const maxRefAudios = videoCaps.max_reference_audios ?? null;
  const showRefVideo = maxRefVideos === null || maxRefVideos > 0;
  const showRefAudio = maxRefAudios === null || maxRefAudios > 0;
  const showRefImages = maxRefImages === null || maxRefImages > 0;
  const showRefSubjects = showRefImages && (
    videoCaps.supports_reference_subjects === true ||
    (videoCaps.supported_generation_modes || []).includes('full') ||
    (videoCaps.supported_generation_modes || []).includes('reference_subjects')
  );
  const imageCount = (showRefSubjects ? refSubjects.length : 0) + refImages.length;
  const canAddImage = maxRefImages === null || imageCount < maxRefImages;
  const imageCountLabel = maxRefImages != null ? `${imageCount}/${maxRefImages}` : null;
  const videoCountLabel = maxRefVideos != null ? `${refVideos.length}/${maxRefVideos}` : null;
  const audioCountLabel = maxRefAudios != null ? `${refAudios.length}/${maxRefAudios}` : null;

  // 模型切换时保留当前分辨率/时长（若新模型支持）
  useEffect(() => {
    if (availableResolutions.length > 0) {
      if (!availableResolutions.includes(resolution)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setResolution(availableResolutions[0]);
      }
    }
    // 时长：保留用户当前选择；仅在当前值为空或不被新模型支持时回退。
    if (availableDurations.length > 0) {
      if (!duration) {
        setDuration(normalizeDurationValue(shot?.params?.duration || availableDurations[0]));
      }
    }
  // 模型切换时才需要重新校正；其余依赖由模型能力计算结果覆盖。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, availableResolutions]);

  const videoReferenceItems = useMemo(() => {
    if (tab === 'frame') return [];
    const items = [];
    // 参考主体（_type: char/scene/prop 为真实主体；本地上传/非主体资产为普通参考图 image，与图片弹窗保持一致：紫色标签「参考图」）
    refSubjects.forEach(s => {
      const rawType = s._type || s.type;
      const isSubject = rawType === 'char' || rawType === 'scene' || rawType === 'prop';
      const type = isSubject ? rawType : 'image';
      const name = isSubject
        ? (s.name || '参考主体')
        : (s.name || (s.url ? s.url.split('/').pop()?.split('?')[0]?.replace(/\.[^.]+$/, '') || '参考图' : '参考图'));
      items.push({ id: s.id, name, _type: type });
    });
    // 参考图
    refImages.forEach(img => {
      items.push({ id: img.id, name: img.name || (img.url ? img.url.split('/').pop()?.split('?')[0]?.replace(/\.[^.]+$/, '') || '参考图' : '参考图'), _type: 'image' });
    });
    // 参考视频
    refVideos.forEach((video) => items.push({ id: video.id, name: video.name || '参考视频', _type: 'video' }));
    // 参考音频
    refAudios.forEach((audio) => items.push({ id: audio.id, name: audio.name || '参考音频', _type: 'audio' }));
    return items;
  }, [refSubjects, refImages, refVideos, refAudios, tab]);

  async function handleRefMediaUpload(file, type = 'image') {
    try {
      const uploadFn = type === 'audio' ? apiUploadCreationAudio
                     : type === 'video' ? apiUploadCreationVideo
                     : apiUploadCreationImage;
      const result = await uploadFn({
        file,
        category: 'reference',
        project_id: projectId,
      });
      const uploadedUrl = normalizeImageUrl(getUploadedImageUrl(result));
      if (!uploadedUrl) throw new Error('上传接口未返回参考图地址');

      // 不再自动插入提示词标签，标签由用户手动 @ 引入
      return normalizeStoryboardReferenceGroups({
        [type === 'audio' ? 'audios' : type === 'video' ? 'videos' : 'images']:
          [{ id: getUploadedImageId(result, uploadedUrl), assetId: getUploadedImageId(result), url: uploadedUrl, name: file.name, type: file.type }],
      })[type === 'audio' ? 'audios' : type === 'video' ? 'videos' : 'images'][0];
    } catch (error) {
      console.error('参考媒体上传失败:', error);
      onShowToast?.('参考图上传失败', 'error');
      throw error;
    }
  }

  async function handleUsePreviousFrameShortcut() {
    const { media, type } = previousFrameShortcut || {};
    if (!media?.url) return;
    if (type === 'image') {
      setRefFirstFrame(media);
      onShowToast?.('已使用上个分镜图', 'success');
      return;
    }
    try {
      const { lastFrameUrl, blob } = await apiGetVideoLastFrame(media.url);
      if (!lastFrameUrl || !blob) throw new Error('无法获取视频尾帧');
      const file = new File([blob], 'previous-shot-last-frame.jpg', { type: blob.type || 'image/jpeg' });
      const result = await apiUploadCreationImage({ file, category: 'reference', project_id: projectId });
      const uploadedUrl = normalizeImageUrl(getUploadedImageUrl(result));
      if (!uploadedUrl) throw new Error('尾帧上传未返回图片地址');
      setRefFirstFrame({
        id: getUploadedImageId(result, uploadedUrl),
        assetId: getUploadedImageId(result),
        url: uploadedUrl,
        name: '上一个分镜视频尾帧.jpg',
        type: 'image/jpeg',
      });
      onShowToast?.('已使用上一个分镜视频尾帧', 'success');
    } catch (error) {
      console.error('[GenerateVideoPanel] 使用上一个分镜视频尾帧失败:', error);
      onShowToast?.('获取上一个分镜视频尾帧失败，请重试', 'error');
    }
  }

  async function handleGenerate() {
    if (loading) return;
    setLoading(true);
    const placeholder = `pending-${Date.now()}`;
    const refImagesSnapshot = tab === 'frame'
      ? []
      : refImages.map(r => ({ url: r.url, fileUrl: r.url }));
    onSetGeneratedVideos?.((prev) => [{ url: null, settled: false, id: placeholder, refImages: refImagesSnapshot }, ...prev]);
    try {
      // 收集参考媒体（仅用户手动上传的参考图，不自动附带主体参考图避免误触模型限制）
      const maxRefImages = currentVideoModel?.capabilities?.max_reference_images ?? null;
      const referenceImages = tab !== 'frame' && (maxRefImages === null || maxRefImages > 0)
        ? [...refSubjects, ...refImages].map(r => r.url).filter(Boolean).slice(0, maxRefImages ?? 99)
        : [];
      const result = await onGenerate?.({
        model,
        resolution,
        duration,
        sound,
        prompt,
        tab,
        reference_images: referenceImages.length > 0 ? referenceImages : undefined,
        first_frame_url: refFirstFrame?.url,
        last_frame_url: refLastFrame?.url,
        // 当前分镜生成接口仍接收单个 URL；UI 可按模型能力收集多个素材，提交时保持既有接口契约。
        reference_video_url: refVideos[0]?.url,
        reference_audio_url: refAudios[0]?.url,
      });
      onSetGeneratedVideos?.((prev) => mergeStoryboardMediaItems(
        prev.map((item) => item.id === placeholder
          ? { ...item, url: result?.url ?? null, created_at: item.created_at || new Date().toISOString().replace('T', ' ').slice(0, 19) }
          : item),
        [],
      ));
      onShowToast?.('视频生成成功', 'success');
    } catch (err) {
      onSetGeneratedVideos?.((prev) => prev.filter((item) => item.id !== placeholder));
      const status = err?.status;
      const msg = err?.message || '';
      if (status === 502 || status === 504 || msg.includes('fetch') || msg.includes('Network')) {
        onShowToast?.('生成服务暂时不可用，请稍后重试', 'error');
      } else if (status === 429) {
        onShowToast?.('生成请求过于频繁，请稍后再试', 'error');
      } else if (status === 401 || status === 403) {
        onShowToast?.('登录已过期，请重新登录', 'error');
      } else if (status === 422) {
        onShowToast?.('生成参数有误，请检查后重试', 'error');
      } else if (status) {
        onShowToast?.(`生成失败（${status}），请稍后重试`, 'error');
      } else {
        onShowToast?.('生成失败，请检查网络连接后重试', 'error');
      }
    } finally {
      setLoading(false);
    }
  }


  const content = (
    <>
      {!embedded && <div
        style={{ position: 'fixed', inset: 0, zIndex: 900, pointerEvents: 'auto' }}
        onMouseDown={onClose}
      />}
      <div
        style={{
          position: embedded ? 'relative' : 'fixed', right: embedded ? undefined : '24px', top: embedded ? undefined : '60px', bottom: embedded ? undefined : '24px',
          width: embedded ? '100%' : '600px', height: embedded ? '100%' : undefined, zIndex: embedded ? undefined : 901,
          display: 'flex', flexDirection: 'column',
          backgroundColor: '#161616',
          borderRadius: embedded ? 0 : '12px',
          border: embedded ? 0 : '1px solid rgba(255,255,255,0.08)',
          boxShadow: embedded ? 'none' : '-10px 24px 64px rgba(0,0,0,0.60)',
          animation: embedded ? 'none' : 'slideInRight 220ms cubic-bezier(0.22,1,0.36,1) forwards',
          overflow: 'hidden',
          pointerEvents: 'auto',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {!embedded && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', flexShrink: 0 }}>
          <span style={{ fontSize: '16px', lineHeight: '20px', color: '#FFFFFF', fontFamily: FONT_MEDIUM, fontWeight: 500 }}>生成分镜视频</span>
          <ModalCloseBtn onClick={onClose} />
        </div>}

        {/* 内容区 */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* 左侧表单 */}
          <div style={{ display: 'flex', flexDirection: 'column', width: embedded ? '457px' : '419px', flexShrink: 0, padding: embedded ? '12px 16px 80px 24px' : '8px 12px 80px 24px', gap: '20px', overflowY: 'auto', boxSizing: 'border-box' }}>
            <VideoGenerationTabs value={tab} onChange={handleTabChange} />

            <PanelPromptInput
              ref={promptRef}
              value={prompt}
              onChange={handlePromptChange}
              referenceItems={videoReferenceItems}
              plainTextMode={tab === 'frame'}
            />

            <GenerationModelField
              value={modelsLoading ? '加载中...' : (tabModels.find(m => m.value === model)?.label || '请选择')}
              options={tabModels.map(m => m.label)}
              onChange={(label) => {
                const selected = tabModels.find(m => m.label === label);
                if (selected) setModel(selected.value);
              }}
              disabled={modelsLoading}
            />

            <ReferenceMediaEditor
              tab={tab}
              projectId={projectId}
              shot={shot}
              nextShot={nextShot}
              previousFrameShortcut={previousFrameShortcut}
              currentShotImages={currentShotImages}
              showRefSubjects={showRefSubjects}
              showRefImages={showRefImages}
              showRefVideo={showRefVideo}
              showRefAudio={showRefAudio}
              maxRefImages={maxRefImages}
              maxRefVideos={maxRefVideos}
              maxRefAudios={maxRefAudios}
              imageCountLabel={imageCountLabel}
              videoCountLabel={videoCountLabel}
              audioCountLabel={audioCountLabel}
              canAddImage={canAddImage}
              refSubjects={refSubjects}
              refImages={refImages}
              refVideos={refVideos}
              refAudios={refAudios}
              refFirstFrame={refFirstFrame}
              refLastFrame={refLastFrame}
              onRefSubjectsChange={handleRefSubjectsChange}
              onRefImagesChange={handleRefImagesChange}
              onRefVideosChange={handleRefVideosChange}
              onRefAudiosChange={handleRefAudiosChange}
              onRefFirstFrameChange={setRefFirstFrame}
              onRefLastFrameChange={setRefLastFrame}
              onUsePreviousFrameShortcut={handleUsePreviousFrameShortcut}
              onReferenceMediaUpload={handleRefMediaUpload}
              buildRefFromAsset={buildRefFromAsset}
              onInsertReference={(media, type) => promptRef.current?.insertMention(media.name || (type === 'video' ? '参考视频' : '参考音频'), type)}
            />

            <GenerationOptionFields
              duration={duration}
              durationOptions={availableDurations.length > 0 ? availableDurations : ['5s']}
              resolution={resolution}
              resolutionOptions={availableResolutions}
              onDurationChange={setDuration}
              onResolutionChange={setResolution}
              showDuration
            />

            <VideoSoundToggle value={sound} onChange={setSound} />

          </div>

          {/* 右侧视频列表 */}
          {!embedded && <VideoResultsPanel
            shot={shot}
            projectId={projectId}
            generatedVideos={generatedVideos}
            onSetGeneratedVideos={onSetGeneratedVideos}
            onSettleVideo={onSettleVideo}
            onShowToast={onShowToast}
            onCandidateMedia={onCandidateMedia}
            onViewVideo={(video, index) => setViewerShot({
              videoIndex: index,
              videoUrl: video.url,
              filename: video.name,
              label: `镜头 ${String(shot?.number ?? 1).padStart(2, '0')}`,
              prompt,
              model,
              resolution,
              duration: undefined,
              aspectRatio: '16:9',
              finalized: video.settled,
            })}
          />}
        </div>

        {/* footer: 生成按钮 — 绝对定位于底部 */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            bottom: 0,
            width: embedded ? '457px' : '419px',
            padding: '16px 24px',
            background: '#161616',
            borderBottomLeftRadius: '16px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <GenerationSubmitButton
            loading={false}
            disabled={loading}
            label="生成分镜视频"
            type="video"
            onClick={handleGenerate}
          />
        </div>
      </div>
      {viewerShot && (
        <ShotViewerModal
          shot={viewerShot}
          onClose={() => setViewerShot(null)}
          onFinalizeChange={(_shotId, newSettled) => {
            const idx = viewerShot.videoIndex;
            if (typeof idx !== 'number') return;
            onSetGeneratedVideos?.((prev) =>
              prev.map((item, i) => i === idx ? { ...item, settled: newSettled } : { ...item, settled: newSettled ? false : item.settled })
            );
            if (newSettled && viewerShot.videoUrl) onSettleVideo?.(viewerShot.videoUrl);
            // 同步弹窗内的 finalized，保证再次打开状态正确
            setViewerShot((prev) => prev ? { ...prev, finalized: newSettled } : prev);
          }}
        />
      )}
    </>
  );
  return embedded ? content : createPortal(content, document.body);
}
