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
 *   2026-08-17  Seedance 真人保留 live_material 参数，虚拟人像保留 asset_ref_url 服务商引用；
 *               主体参考从主体列表补全认证身份且同步过程不丢失；全能参考显式传 generate_mode='full'
 *   2026-08-12  拆分全能参考与首尾帧提示词：fullPrompt 保留 @主体 标签绑定，
 *               framePrompt 为纯文本独立存储，首尾帧编辑不再覆盖全能参考提示词
 *   2026-08-11  首尾帧生成改传 generate_mode，避免将 start_end 误传为参考模式导致后端 400
 *   2026-08-11  手动新增空白分镜保持空提示词，不代入后端返回的默认内容，并跳过异步表单恢复覆盖
 *   2026-08-11  首尾帧提交补传 asset_id，避免后端只拿到相对 URL 时生成失败
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
import {
  getUploadedImageId,
  getUploadedImageUrl,
  mergeStoryboardReferenceWithSubject,
} from '../../utils/storyboardReferenceAdapter';
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

function stripPromptMentions(text) {
  return typeof text === 'string' ? text.replace(/@/g, '') : text;
}

function normalizeDurationValue(value) {
  return value == null || value === '' ? value : normalizeStoryboardDurationOptions([value])[0];
}

function areReferenceGroupsEqual(previous, next) {
  return JSON.stringify(previous) === JSON.stringify(next);
}

function enrichReferenceSubject(ref, chars, scenes, props) {
  const sid = ref?.subjectId || (
    ref?.type === 'char' || ref?.type === 'scene' || ref?.type === 'prop'
      ? ref?.id
      : null
  );
  if (!sid) return ref;
  const inChars = chars?.find((subject) => subject.id === sid);
  const inScenes = scenes?.find((subject) => subject.id === sid);
  const inProps = props?.find((subject) => subject.id === sid);
  const subject = inChars || inScenes || inProps;
  const type = inChars ? 'char' : inScenes ? 'scene' : inProps ? 'prop' : ref.type;
  if (!subject?.imageUrl) return { ...ref, type };
  return {
    ...mergeStoryboardReferenceWithSubject(ref, subject),
    type,
    url: normalizeImageUrl(subject.imageUrl),
    name: subject.name,
  };
}

export default function GenerateVideoPanel({
  shot,
  isManualBlank = false,
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
  // 全能参考与首尾帧各自持有独立提示词：fullPrompt 保留 @主体 标签绑定，
  // framePrompt 为纯文本，互不覆盖，避免首尾帧编辑剥除标签后污染全能参考绑定。
  // 关闭面板时组件卸载、本地态丢弃，下次打开按 shot 当前字段重新生成初始内容。
  // 手动新增的空白分镜保持空提示词，不代入后端返回的默认内容。
  // 点击「生成分镜视频」时才把当前模式提示词随 onGenerate 传回后端。
  const initialPrompt = isManualBlank ? '' : (formState?.prompt ?? buildStoryboardPrompt(shot));
  const [fullPrompt, setFullPrompt] = useState(initialPrompt);
  const [framePrompt, setFramePrompt] = useState(() => (
    isManualBlank ? '' : (formState?.frame_prompt ?? stripPromptMentions(initialPrompt))
  ));
  const promptRef = useRef(null);
  const fullPromptEditedRef = useRef(false);
  const framePromptEditedRef = useRef(false);
  const lastEmittedFormStateRef = useRef(null);
  const formStateHydratedRef = useRef(Array.isArray(formState?.refImages));

  const handlePromptChange = (nextPrompt) => {
    if (tab === 'frame') {
      framePromptEditedRef.current = true;
      setFramePrompt(nextPrompt);
    } else {
      fullPromptEditedRef.current = true;
      setFullPrompt(nextPrompt);
    }
  };

  // 页面加载阶段可能会在弹窗挂载后补全主体标签。弹窗不能只读取一次初始值，
  // 否则父级 formState 已经更新，编辑器仍会继续显示打开时的旧提示词。
  useEffect(() => {
    if (isManualBlank) return;
    if (fullPromptEditedRef.current) return;
    if (typeof formState?.prompt !== 'string' || formState.prompt === fullPrompt) return;
    const syncTimer = setTimeout(() => setFullPrompt(formState.prompt), 0);
    return () => clearTimeout(syncTimer);
  }, [formState?.prompt, isManualBlank, fullPrompt]);

  // 首尾帧提示词来自后端 frame_prompt；旧数据无该字段时沿用初始化回退值。
  useEffect(() => {
    if (isManualBlank) return;
    if (framePromptEditedRef.current) return;
    if (typeof formState?.frame_prompt !== 'string' || formState.frame_prompt === framePrompt) return;
    const syncTimer = setTimeout(() => setFramePrompt(formState.frame_prompt), 0);
    return () => clearTimeout(syncTimer);
  }, [formState?.frame_prompt, isManualBlank, framePrompt]);

  const [refSubjects, setRefSubjects] = useState(() => {
    // 从 shot.mainRefs 初始化主体列表，补全 url/name
    const shotSubjects = (shot?.mainRefs || [])
      .map((ref) => enrichReferenceSubject(ref, chars, scenes, props))
      .filter((ref) => ref?.url);
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
    const nextSubjects = normalizeStoryboardReferenceGroups({
      subjects: (shot?.mainRefs || []).map((ref) => enrichReferenceSubject(ref, chars, scenes, props)),
    }).subjects;
    const syncTimer = setTimeout(() => {
      setRefSubjects((previous) => (
        areReferenceGroupsEqual(previous, nextSubjects) ? previous : nextSubjects
      ));
    }, 0);
    return () => clearTimeout(syncTimer);
  }, [shot?.mainRefs, chars, scenes, props]);

  const videoPromptMentions = useMemo(
    () => tab === 'frame' ? [] : buildVideoPromptMentions(fullPrompt, refSubjects),
    [fullPrompt, refSubjects, tab],
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
      if (!isManualBlank && !fullPromptEditedRef.current && typeof formState.prompt === 'string') {
        setFullPrompt(formState.prompt);
      }
      if (!isManualBlank && !framePromptEditedRef.current && typeof formState.frame_prompt === 'string') {
        setFramePrompt(formState.frame_prompt);
      }
      // 表单快照只恢复参数和普通参考素材；主体集合始终从当前镜头 mainRefs 获取，
      // 防止主体参考列删除后，旧 refSubjects 把已删除图片重新带回面板。
      setRefSubjects(normalizeStoryboardReferenceGroups({
        subjects: (shot?.mainRefs || []).map((ref) => enrichReferenceSubject(ref, chars, scenes, props)),
      }).subjects);
      setRefImages(normalizeStoryboardReferenceGroups({ images: formState.refImages }).images);
      setRefVideos(normalizeStoryboardReferenceGroups({ videos: formState.refVideos }).videos);
      setRefAudios(normalizeStoryboardReferenceGroups({ audios: formState.refAudios }).audios);
      setRefFirstFrame(formState.refFirstFrame || null);
      setRefLastFrame(formState.refLastFrame || null);
      formStateHydratedRef.current = true;
    }, 0);
    return () => clearTimeout(restoreTimer);
  }, [formState, isManualBlank, shot?.mainRefs, chars, scenes, props]);

  useEffect(() => {
    if (!formStateHydratedRef.current) return;
    if (!fullPromptEditedRef.current && typeof formState?.prompt === 'string' && formState.prompt !== fullPrompt) return;
    const nextState = {
      tab,
      model,
      resolution,
      duration,
      sound,
      prompt: fullPrompt,
      frame_prompt: framePrompt,
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
  }, [tab, model, resolution, duration, sound, fullPrompt, framePrompt, formState?.prompt, videoPromptMentions, refSubjects, refImages, refVideos, refAudios, refFirstFrame, refLastFrame, onFormStateChange]);

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
      // 认证虚拟人像走服务商 asset:// 引用；普通参考图保持用户当前选择，
      // 由上层根据每个素材的身份组装服务商所需字段。
      const maxRefImages = currentVideoModel?.capabilities?.max_reference_images ?? null;
      const referenceMedia = tab !== 'frame' && (maxRefImages === null || maxRefImages > 0)
        ? [...refSubjects, ...refImages].slice(0, maxRefImages ?? 99)
        : [];
      const referenceImages = referenceMedia.map((item) => item.url).filter(Boolean);
      const result = await onGenerate?.({
        model,
        resolution,
        duration,
        sound,
        prompt: tab === 'frame' ? framePrompt : fullPrompt,
        tab,
        reference_images: referenceImages.length > 0 ? referenceImages : undefined,
        reference_media: referenceMedia.length > 0 ? referenceMedia : undefined,
        first_frame_url: refFirstFrame?.url,
        last_frame_url: refLastFrame?.url,
        first_frame_asset_id: refFirstFrame?.assetId || refFirstFrame?.asset_id || undefined,
        last_frame_asset_id: refLastFrame?.assetId || refLastFrame?.asset_id || undefined,
        generate_mode: tab === 'frame'
          ? (refFirstFrame && refLastFrame ? 'start_end' : 'first_frame')
          : 'full',
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
              value={tab === 'frame' ? framePrompt : fullPrompt}
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
              model={model}
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
              prompt: tab === 'frame' ? framePrompt : fullPrompt,
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
