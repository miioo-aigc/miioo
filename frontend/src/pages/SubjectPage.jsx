/**
 * @file SubjectPage.jsx
 * @structure-index
 *
 * ─── 全局常量 & 工具函数 ──────────────────────────────────────────
 *   SubjectEmptyIcons / SubjectExtractionState / SubjectEditorSlot components/subject/
 *   SUBJECT_LOADING_TEXTS                                            L99
 *   downloadBlob                                                  utils/downloadBlob.js
 *   INITIAL_CHARS                                                  L120–L128
 *   sleep                                                           L141
 *   batchGeneratedImagesCache                                      L145
 *   主体面板会话缓存 / pending 任务存储                               utils/subjectPanelStorage.js / subjectPendingGenerationStore.js
 *   normalizeSubjectList                                           utils/subjectAdapter.js
 *
 * ─── 原子 UI 组件 ────────────────────────────────────────────────
 *   SubjectCard / SubjectMoreMenu / AddSubjectCard                  src/components/subject/SubjectCard.jsx
 *   RefImageField                                                    src/components/subject/RefImageField.jsx
 *   Select                                                            src/components/ui/Select.jsx
 *   SubjectImageMappers                                              src/components/subject/SubjectImageMappers.js
 *     └─ mapReferenceImageIdsForModal                                  参考图详情弹窗快照转换
 *   SubjectGenerationParams                                          src/components/subject/SubjectGenerationParams.js
 *   SubjectGenerationResult                                          src/components/subject/SubjectGenerationResult.js
 *     ├─ extractSubjectImageResult                                     生图响应字段标准化
 *     └─ getSubjectGenerationErrorMessage                              生图错误消息适配
 *   SubjectTaskPolling                                                src/components/subject/SubjectTaskPolling.js
 *     ├─ getSubjectTaskStatus / isSubjectTaskTerminal                   任务状态与终态读取
 *     └─ getSubjectTaskResults / getSubjectTaskResult                   任务结果列表与主体结果读取
 *   SubjectImageActions                                               src/components/subject/SubjectImageActions.js
 *     └─ createSubjectImageActionHandlers                                图片上传、下载和定稿动作适配
 *   normalizeSubjectImageModels / getFallbackSubjectImageModels         components/subject/SubjectModelAdapter.js
 *
 * ─── 业务组件 ────────────────────────────────────────────────────
 *   ConfirmStoryboardModal                                          components/subject/ConfirmStoryboardModal.jsx
 *   <EditSubjectPanel>                                              L147–L881
 *     ├─ [状态/Ref] 模型、字段、图片、弹窗、Toast 与任务恢复状态     L160–L210
 *     ├─ [函数] 生成、定稿、保存及图片动作句柄                      L520–L820
 *     ├─ [纯数据] 详情图片映射、参考图快照和生成参数由域工具完成    L278 / L672
 *     └─ [副作用] 模型/详情加载、批量占位、模型能力和选项联动      L211–L519
 *   SubjectGenerationOptions  主体生图选项组合                       src/components/subject/SubjectGenerationOptions.jsx
 *   SubjectGenerationMode     主体生图方式选择                       src/components/subject/SubjectGenerationMode.jsx
 *   SubjectGenerationAction   主体编辑面板底部生成动作区             src/components/subject/SubjectGenerationAction.jsx
 *   SubjectTextFields         主体字段组合，内部复用 ui/TextField       src/components/subject/SubjectTextFields.jsx
 *   SubjectEditForm           编辑面板左侧表单组合                         src/components/subject/SubjectEditForm.jsx
 *   SubjectPanelHeader        主体编辑面板标题和关闭动作             src/components/subject/SubjectPanelHeader.jsx
 *   SubjectVoiceSelectModal   主体音色选择、筛选和试听弹窗           src/components/subject/SubjectVoiceSelectModal.jsx
 *   SubjectToolbar / SubjectTabs 主体页工具栏和标签导航             src/components/subject/
 *   SubjectGridViewport / SubjectWorkspace 主体列表和工作区组合    src/components/subject/
 *
 * ─── 主页面入口 ─────────────────────────────────────────────────
 *   export default function SubjectPage()                           L759
 *     ├─ [状态] activeTab / 批量状态 / 选中主体与列表数据            L761–L1008
 *     ├─ [Ref] extractingRef / 列表哨兵 / 批量任务控制器              L764–L800
 *     ├─ [函数] 批量生成、添加、下载、删除、进入分镜                 L1010–L1500
 *     ├─ [副作用] 提取、任务恢复、缓存订阅、资产删除和滚动加载       L789–L1525
 *     └─ [渲染] loading/error、SubjectWorkspace 和弹窗组合          L1552–L1707
 *
 * ─── 更新记录 ──────────────────────────────────────────────────────
 *   2026-07-16  迁移 SubjectExtractionState 至 components/subject/SubjectExtractionState.jsx；页面仅传入加载文案和重试回调
 *   2026-07-16  新增 SubjectEditorSlot 统一三类主体编辑面板接线；页面继续持有列表写回与封面 API 副作用
 *   2026-07-16  迁移 SubjectEmptyIcons 至 components/subject/SubjectEmptyIcons.jsx；页面通过显式 emptyIcons 传递，保留列表状态和业务副作用
 *   2026-07-16  迁移 SubjectToast 至 components/subject/SubjectToast.jsx；主体页和编辑面板继续持有 Toast 状态、定时器与业务触发
 *   2026-07-16  迁移 ConfirmStoryboardModal 至 components/subject；页面保留确认状态和重新生成副作用
 *   2026-07-17  迁移 SubjectEditForm，页面保留编辑状态、生成 API、任务轮询和图片副作用
 *   2026-07-15  抽离主体卡片、更多菜单和新增卡片到主体业务域组件
 *   2026-07-15  抽离主体编辑区右侧图片列表、上传卡片和图片卡片
 *   2026-07-15  抽离主体编辑区参考图字段、上传卡片和悬浮预览
 *   2026-07-15  抽离主体生图方式选择区
 *   2026-07-15  将主体生图模型、比例、分辨率选择器提升为可复用 Select 基础组件
 *   2026-07-15  抽离主体编辑面板底部生成动作区，页面保留生成请求与任务轮询
 *   2026-07-15  抽离主体编辑面板标题和关闭动作，页面保留面板生命周期
 *   2026-07-15  抽离主体名称、描述、提示词字段组合，页面保留字段状态与保存回调
 *   2026-07-15  抽离主体音色选择弹窗，性别和年龄复用通用 Select
 *   2026-07-15  抽离主体页工具栏和标签导航，页面保留业务状态与回调
 *   2026-07-15  抽离主体详情候选图/参考图映射、去重和单一定稿纯函数
 *   2026-07-15  抽离参考图详情快照转换和主体生图参数组装纯函数
 *   2026-07-15  抽离主体生图结果标准化与错误消息适配纯函数
 *   2026-07-15  抽离主体任务状态、终态与按主体结果读取适配纯函数，页面保留轮询和副作用
 *   2026-07-15  抽离主体图片上传、下载和定稿动作适配，页面保留状态与反馈副作用
 *   2026-07-15  修正 SubjectGrid 接入、组件定义及所有实际结构索引行号
 *   2026-07-15  稳定主体图片动作句柄并移除已迁移的页面 API 导入
 *   2026-07-15  SubjectPage 收尾：核对动作链路、清理失效引用并同步结构索引
 *   2026-07-17  复用模型 fallback 与 createSubjectImageItem，页面继续持有恢复轮询和状态写回
 *   2026-07-16  迁移主体任务恢复标签 setter 和默认提示词纯函数；页面保留状态与副作用
 *   2026-07-16  抽离主体面板会话缓存和 pending 任务持久化桥接；页面保留轮询与写回
 *   2026-07-16  依据当前代码重新核对主体页结构索引、状态边界和渲染终点
 *   2026-07-17  迁移 SubjectGridViewport 至 components/subject；页面继续持有主体列表状态、分页和业务回调
 *   2026-07-17  迁移 SubjectWorkspace 至 components/subject；页面继续通过 children 保留编辑面板、弹窗和业务副作用
 *   2026-07-15  主体确认弹窗取消/确认、提取失败重试统一复用 components/ui/Button；保留关闭图标按钮等专用交互
 *   2026-07-09  取消定稿改走语义化接口 apiUnsetPrimarySubjectImage，移除本地兜底状态
 *   2026-07-06  单主体与批量生图统一任务轮询并修复刷新后的重复占位
 *   2026-07-03  修复媒体详情弹窗参考图数据源
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import SubjectImageList from '../components/subject/SubjectImageList';
import ConfirmStoryboardModal from '../components/subject/ConfirmStoryboardModal';
import BatchGenerateModal from '../components/BatchGenerateModal';
import { SubjectGenerationAction, SubjectPanelHeader, SubjectVoiceSelectModal, SubjectToast, SubjectEmptyIcons, SubjectExtractionLoading, SubjectExtractionError, SubjectEditorSlot, SubjectWorkspace, SubjectEditForm, buildSubjectGenerationParams, createSubjectImageActionHandlers, createSubjectImageItem, extractSubjectImageResult, getSubjectGenerationErrorMessage, isSubjectTaskTerminal, getSubjectTaskResults, getSubjectTaskResult, mapReferenceImageIdsForModal, mergeSubjectImages, getFallbackSubjectImageModels } from '../components/subject';
import { apiCreateSubject, apiUpdateSubject, apiDeleteSubject, apiGenerateSubjectImage, apiGetSubjects, apiBatchGenerateStream, apiGetSubjectDetail, apiGetSubjectImages, apiDownloadSubjectImage, apiUnsetPrimarySubjectImage } from '../api/subject';
import { apiGetTask } from '../api/storyboard';
// 模型能力直接从后端 capabilities 获取
import { apiListModels } from '../api/config';
import { apiGetVoices } from '../api/voices';
import { normalizeImageUrl } from '../utils/imageUrl';
import { normalizeSubjects as normalizeSubjectList } from '../utils/subjectAdapter';
import { addPendingTask, removePendingTask, getPendingTasks } from '../utils/taskPersistence';
import { subscribe } from '../utils/cache';
import { K } from '../utils/cacheKeys';
import { defaultPromptForTab, findPendingSubjectImage, getPendingGenTabSetter } from '../utils/subjectPendingGenerationAdapter';
import { clearSubjectPanelState, readSubjectPanelState, saveSubjectPanelState } from '../utils/subjectPanelStorage';
import { pendingGenerations } from '../utils/subjectPendingGenerationStore';
import { downloadBlob } from '../utils/downloadBlob';
import { normalizeSubjectImageModels } from '../components/subject/SubjectModelAdapter';

const SUBJECT_LOADING_TEXTS = ['正在抽取剧本灵魂', '正在抽取剧本主角', '正在抽取剧本配角', '正在抽取场景', '正在抽取道具'];

// ── 工具：触发浏览器下载 Blob ──────────────────────────────────────────
// ── Confirm storyboard modal (二次确认弹窗) ────────────────────────────────

// ── Mock data ──────────────────────────────────────────────────────────────

const INITIAL_CHARS = [
  { id: 1, name: '虎大', desc: '森林里最年长的老虎，性格沉稳，是两兄弟中的大哥，负责保护弟弟虎二。', imageUrl: null, voice: '霸气威武' },
  { id: 1, name: '虎大', desc: '森林里最年长的老虎，性格沉稳，是两兄弟中的大哥，负责保护弟弟虎二。', imageUrl: null, voice: null },
  { id: 2, name: '虎二', desc: '活泼好动的小老虎，总是惹麻烦，但心地善良，对哥哥虎大十分依赖。', imageUrl: null, voice: null },
  { id: 3, name: '狐狸阿九', desc: '狡猾却重情义的狐狸，表面上爱耍小聪明，关键时刻总会挺身而出。', imageUrl: null, voice: null },
  { id: 4, name: '老猫头鹰', desc: '森林里的智者，见过无数风雨，总在两只老虎迷路时给出关键指引。', imageUrl: null, voice: null },
  { id: 5, name: '小松鼠', desc: '话多又热心的小松鼠，是森林里的消息灵通人士，喜欢收集各种坚果和秘密。', imageUrl: null, voice: null },
  { id: 6, name: '大灰狼', desc: '看似凶猛的反派，实则只是想找人一起玩，孤独是他最大的秘密。', imageUrl: null, voice: null },
];

// Per-model upload limits


// 模块级缓存：跨弹窗打开/关闭保留生成中的图片状态
// key: subjectId, value: { placeholderId, status: 'pending'|'done', imageUrl?, rawUrl? }
const PENDING_GEN_POLL_MS = 3000;
const PENDING_GEN_STALE_MS = 15 * 60 * 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 批量生成图片缓存（跨弹窗打开/关闭保留，优先于后端数据展示）
// key: subjectId, value: { rawUrl }[]
const batchGeneratedImagesCache = new Map();

function EditSubjectPanel({ projectId, char, tabLabel = '角色', projectRatio, onClose, onCommit, onCoverChange, refreshToken, setBatchLoadingSubjects, isBatchLoading = false }) {
  // ── 从后端拉取模型列表，直接使用后端 capabilities ──────────────
  const [imageModels, setImageModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(true);

  // 本地表单状态必须先于模型加载 effect 声明，避免 effect 闭包引用尚未声明的 setter。
  const [promptText, setPromptText] = useState(char?.prompt || char?.prompt_text || '');
  const [selectedModel, setSelectedModel] = useState(char?.model || char?.default_image_model || imageModels[0]?.value || 'doubao-seedream-5.0-lite');
  const [selectedRatio, setSelectedRatio] = useState(char?.ratio || projectRatio || '16:9');
  const [selectedResolution, setSelectedResolution] = useState(char?.resolution || '2K');
  const [genMode, setGenMode] = useState('single');
  const [generatedImages, setGeneratedImages] = useState([]);
  const [refImageIds, setRefImageIds] = useState(Array.isArray(char?.reference_image_ids) ? char.reference_image_ids : []);
  const [mediaDetailOpen, setMediaDetailOpen] = useState(false);
  const [mediaDetailActiveIdx, setMediaDetailActiveIdx] = useState(0);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const isMountedRef = useRef(true); // 跟踪组件是否已挂载，关闭弹窗后仍让请求跑完
  const cacheConsumedRef = useRef(false); // 标记 pendingGenerations 缓存已被本挂载消费
  const [detailLoaded, setDetailLoaded] = useState(false);

  const [, setPrimaryImageUrl] = useState(null);
  const [, setPrimaryImageId] = useState(null);

  useEffect(() => {
    (async () => {
      let merged = [];
      try {
        const data = await apiListModels({ category: 'image' });
        merged = normalizeSubjectImageModels(data);
        setImageModels(merged.length > 0 ? merged : getFallbackSubjectImageModels());
      } catch {
        setImageModels(getFallbackSubjectImageModels());
      } finally {
        setModelsLoading(false);
      }

      // 如果角色没有预设模型，加载完后自动选中默认模型
      if (merged.length > 0 && !char?.model && !char?.default_image_model) {
        const def = merged.find(m => m.is_default) || merged[0];
        if (def) setSelectedModel(def.value);
      }
    })();
  }, [projectId, char?.model, char?.default_image_model]);

  // 从 refImageIds 解析出 refImages（供 MediaDetailModal 使用）
  const refImagesForModal = useMemo(() => mapReferenceImageIdsForModal(refImageIds), [refImageIds]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // ── 从后端拉取主体详情和已生成图片 ─────────────────────────────
  useEffect(() => {
    if (!projectId || !char?.id) return;
    let cancelled = false;

    // ── 优先从批量生成缓存读取图片，立即展示（不等待后端） ─────────
    const batchCached = batchGeneratedImagesCache.get(char.id);
    if (batchCached && batchCached.length > 0) {
      // 缓存是弹窗外部任务完成后的结果，挂载时必须恢复到本地展示状态。
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGeneratedImages(
        batchCached.map((img, i) => ({
          ...createSubjectImageItem({ id: `batch-${char.id}-${Date.now()}-${i}`, rawUrl: img.rawUrl, refImages: refImagesForModal }),
        }))
      );
      batchGeneratedImagesCache.delete(char.id);

      // ── 缓存命中：跳过 apiGetSubjectDetail，直接完成初始化 ───────
      setDetailLoaded(true);
      // 如果 char 带封面图，设置 primaryImageUrl
      if (char?.imageUrl) {
        setPrimaryImageUrl(char.imageUrl);
      }
      // 检查是否有跨弹窗完成的单主体生成
      const pending = pendingGenerations.get(char.id);
      if (pending?.status === 'done') {
        // 跨弹窗任务已完成，挂载时将结果追加到详情图片列表。
        setGeneratedImages(prev => [...prev, createSubjectImageItem({ rawUrl: pending.rawUrl, id: pending.realId || pending.placeholderId, refImages: pending.refImages || refImagesForModal })]);
        pendingGenerations.delete(char.id);
      }
      return; // 不发起后端请求
    }

    // ── 无批量缓存时，检查跨弹窗单主体生成缓存，立即展示不等待后端 ──
    // 如果本挂载已消费过缓存（StrictMode 二次调用），直接跳过
    if (cacheConsumedRef.current) {
      setDetailLoaded(true);
      return;
    }
    const pendingPreflight = pendingGenerations.get(char.id);
    if (pendingPreflight?.status === 'done') {
      setGeneratedImages([createSubjectImageItem({ rawUrl: pendingPreflight.rawUrl, id: pendingPreflight.realId || pendingPreflight.placeholderId, refImages: pendingPreflight.refImages || refImagesForModal })]);
      // 恢复生成参数，避免跳过 API 后字段为空
      if (pendingPreflight.genParams) {
        setPromptText(pendingPreflight.genParams.prompt || '');
        if (pendingPreflight.genParams.model) setSelectedModel(pendingPreflight.genParams.model);
        if (pendingPreflight.genParams.ratio) setSelectedRatio(pendingPreflight.genParams.ratio);
        if (pendingPreflight.genParams.resolution) setSelectedResolution(pendingPreflight.genParams.resolution);
      }
      // 更新卡片封面（兜底：else 分支可能因时序问题未执行 onCoverChange）
      if (!char.imageUrl && pendingPreflight.rawUrl) {
        onCoverChange?.(pendingPreflight.rawUrl);
      }
      if (char?.imageUrl) {
        setPrimaryImageUrl(char.imageUrl);
      } else if (pendingPreflight.rawUrl) {
        setPrimaryImageUrl(pendingPreflight.rawUrl);
      }
      cacheConsumedRef.current = true;
      pendingGenerations.delete(char.id);
      setDetailLoaded(true);
      console.log('[SubjectPage] preflight DONE hit: skipped API, restored genParams, rawUrl:', pendingPreflight.rawUrl?.substring(0, 60));
      return; // 跳过 API 请求
    } else if (pendingPreflight?.status === 'pending') {
      // 生成进行中：占位槽已在 onClick 中创建，这里仅恢复 loading 状态
      // 不进入 API 请求路径，避免重复占位槽（轮询由 subject-single 恢复 useEffect 接管）
      setGeneratedImages([{ url: null, settled: false, id: pendingPreflight.placeholderId, isReference: false }]);
      cacheConsumedRef.current = true;
      setDetailLoaded(true);
      return; // 跳过 API 请求，避免 L1910 再次 unshift 占位槽
    }

    (async () => {
      // 只拉一次详情，SubjectDetailResponse 包含：
      //   subject (SubjectResponse)
      //   primary_image (SubjectImageResponse | null)
      //   candidate_images (SubjectImageResponse[])
      //   reference_images (SubjectReferenceImage[])
      //   latest_generate_config (SubjectGenerateConfig | null)
      console.log('[SubjectPage] preflight MISS: calling apiGetSubjectDetail for', char.id);
      const detailRes = await apiGetSubjectDetail(projectId, char.id).catch(() => null);
      if (cancelled) return;

      if (!detailRes) {
        if (!promptText) setPromptText(defaultPromptForTab(tabLabel));
        setDetailLoaded(true);
        return;
      }

      // ── 从 subject 字段读取基础信息 ──────────────────────────────
      const subject = detailRes.subject || detailRes;   // 兼容后端扁平返回
      const genCfg = detailRes.latest_generate_config || subject.gen_config || {};

      if (subject.prompt) setPromptText(subject.prompt);
      if (genCfg.model || subject.model) setSelectedModel(genCfg.model || subject.model);
      if (genCfg.ratio || subject.ratio) setSelectedRatio(genCfg.ratio || subject.ratio);
      if (genCfg.resolution || genCfg.size || subject.resolution) {
        setSelectedResolution(genCfg.resolution || genCfg.size || subject.resolution);
      }

      // 检查是否有进行中/已完成的跨弹窗生成
      const pending = pendingGenerations.get(char.id);
      const finalImages = mergeSubjectImages({
        candidateImages: detailRes.candidate_images,
        referenceImages: detailRes.reference_images,
        refImages: refImagesForModal,
        pending,
      });
      if (pending?.status === 'done') {
        pendingGenerations.delete(char.id);
      }

      if (finalImages.length > 0) {
        setGeneratedImages(prev => {
          if (prev.length === 0) return finalImages;
          const seenUrls = new Set(prev.map(img => img.rawUrl));
          const toAdd = finalImages.filter(img => !seenUrls.has(img.rawUrl));
          return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
        });
      } else if (char?.imageUrl) {
        // 兜底用 char 的封面图（不覆盖已展示的缓存图片）
        setGeneratedImages(prev => prev.length > 0 ? prev : [createSubjectImageItem({ rawUrl: char.imageUrl, settled: true, id: char.imageUrl, refImages: refImagesForModal })]);
      } else {
        setGeneratedImages(prev => prev.length > 0 ? prev : []);
      }

      setDetailLoaded(true);

      // 将后端返回的定稿图同步到卡片封面
      const _settledImg = finalImages.find((img) => img.settled && img.rawUrl);
      if (_settledImg) {
        setPrimaryImageUrl(_settledImg.rawUrl);
        setPrimaryImageId(_settledImg.id);
        onCoverChange?.(_settledImg.rawUrl);
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, char?.id, refreshToken]);

  // ── 批量生成：占位槽插入 & 完成后消费缓存 ─────────────────────
  const BATCH_PLACEHOLDER = '__batch_loading__';
  const prevBatchLoadingRef = useRef(isBatchLoading);
  useEffect(() => {
    const wasLoading = prevBatchLoadingRef.current;
    prevBatchLoadingRef.current = isBatchLoading;

    if (isBatchLoading && !wasLoading) {
      // 批量生成开始（面板已打开的情况下）：插入占位槽
      // 单主体生成已在 onClick 中直接创建占位槽，此处仅服务于批量生成
      setGeneratedImages(prev => {
        if (prev.some(img => img.id === BATCH_PLACEHOLDER)) return prev;
        // 若已有 pending 占位槽（单主体生成路径），跳过避免双占位
        if (prev.some(img => String(img.id).startsWith('generated-') && !img.rawUrl)) return prev;
        return [{ url: null, settled: false, id: BATCH_PLACEHOLDER, isReference: false }, ...prev];
      });
    } else if (!isBatchLoading && wasLoading) {
      // 批量生成结束：消费缓存，用真实图片替换占位槽
      const cached = batchGeneratedImagesCache.get(char.id);
      if (cached && cached.length > 0) {
        const newImgs = cached.map((img, i) => createSubjectImageItem({ id: `batch-${char.id}-${Date.now()}-${i}`, rawUrl: img.rawUrl, refImages: refImagesForModal }));
        batchGeneratedImagesCache.delete(char.id);
        // 批量流结束后，用外部缓存结果替换占位槽。
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setGeneratedImages(prev => {
          const without = prev.filter(img => img.id !== BATCH_PLACEHOLDER);
          // 去重：跳过已存在的 URL
          const existingUrls = new Set(without.map(img => img.rawUrl));
          const toAdd = newImgs.filter(img => !existingUrls.has(img.rawUrl));
          return toAdd.length > 0 ? [toAdd[0], ...without, ...toAdd.slice(1)] : without;
        });
      } else {
        // 无缓存（可能已被消费）：只移除占位槽
        setGeneratedImages(prev => prev.filter(img => img.id !== BATCH_PLACEHOLDER));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBatchLoading]);

  // 面板刚打开时，若已在批量生成中且 detail 加载完成，同步插入占位槽
  useEffect(() => {
    if (isBatchLoading && detailLoaded) {
      // 面板打开时需要立即显示正在运行的批量任务占位槽。
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGeneratedImages(prev => {
        if (prev.some(img => img.id === BATCH_PLACEHOLDER)) return prev;
        // 若已有 pending 占位槽（单主体生成路径），跳过避免双占位
        if (prev.some(img => String(img.id).startsWith('generated-') && !img.rawUrl)) return prev;
        return [{ url: null, settled: false, id: BATCH_PLACEHOLDER, isReference: false }, ...prev];
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailLoaded]);

  // 获取当前模型的能力配置（直接从后端 capabilities 读取）
  const currentModel = useMemo(
    () => imageModels.find(m => m.value === selectedModel) || {},
    [imageModels, selectedModel]
  );
  // 比例根据当前选中的分辨率动态获取，不同分辨率可能支持不同比例
  const availableRatios = useMemo(() => {
    const resRatios = currentModel.resolutionSizeMap?.[selectedResolution];
    // 空映射（resolutionSizeMap[res] 为 {}）表示「该分辨率不限制比例」，回退到模型全局比例，
    // 否则会把比例错误过滤成空白（新接入模型常为空 resolution_size_map）
    if (resRatios && Object.keys(resRatios).length > 0) return Object.keys(resRatios);
    return currentModel.ratios || [];
  }, [currentModel, selectedResolution]);
  // Filter resolutions to only those supporting the current ratio (reverse direction)
  const availableResolutions = useMemo(() => {
    const resList = currentModel.resolutions || [];
    const map = currentModel.resolutionSizeMap || {};
    if (selectedRatio && Object.keys(map).length > 0) {
      return resList.filter(res => {
        const ratios = map[res] || {};
        return Object.keys(ratios).length === 0 || Object.keys(ratios).includes(selectedRatio);
      });
    }
    return resList;
  }, [currentModel, selectedRatio]);
  const maxRefImages = currentModel.maxRefImages || 3;

  // 当模型切换时（非首次加载），保留当前比例/分辨率（若新模型支持）
  const prevModelRef = useRef(selectedModel);
  useEffect(() => {
    // 跳过首次渲染（初始化）
    if (!detailLoaded) {
      prevModelRef.current = selectedModel;
      return;
    }
    // 只有用户主动切换模型时才处理
    if (prevModelRef.current === selectedModel) return;
    prevModelRef.current = selectedModel;

    const newModel = imageModels.find(m => m.value === selectedModel);
    const resList = newModel?.resolutions || [];
    if (resList.length > 0) {
      // 若新模型支持当前分辨率则保留，否则回退到第一个
      const currentResSupported = resList.includes(selectedResolution);
      const newRes = currentResSupported ? selectedResolution : resList[0];
      // 模型能力来自异步接口，切换模型后必须同步修正无效选项。
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedResolution(newRes);
      // 若新模型在该分辨率下支持当前比例则保留
      const resRatios = newModel?.resolutionSizeMap?.[newRes];
      if (resRatios) {
        const ratioKeys = Object.keys(resRatios);
        if (currentResSupported && ratioKeys.includes(selectedRatio)) {
          setSelectedRatio(selectedRatio);
        } else {
          setSelectedRatio(ratioKeys[0] || '16:9');
        }
      }
    } else {
      setSelectedResolution('');
      setSelectedRatio('16:9');
    }
  }, [selectedModel, detailLoaded, imageModels, selectedResolution, selectedRatio]);

  // 当选中的分辨率/比例不在当前模型支持列表中时，自动修正到第一个可用值
  useEffect(() => {
    if (!availableResolutions.includes(selectedResolution)) {
      // 模型能力联动后修正失效分辨率，避免选择器展示不可提交的值。
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedResolution(availableResolutions[0]);
    }
  }, [availableResolutions, selectedResolution]);
  useEffect(() => {
    if (!availableRatios.includes(selectedRatio)) {
      // 模型能力联动后修正失效比例，避免选择器展示不可提交的值。
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedRatio(availableRatios[0]);
    }
  }, [availableRatios, selectedRatio]);

  const showToast = useCallback((msg, type = 'success') => {
    clearTimeout(toastTimerRef.current);
    setToast({ msg, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 2500);
  }, []);
  const [charName, setCharName] = useState(char?.name ?? '');
  const [charDesc, setCharDesc] = useState(char?.desc ?? '');
  const getImageActionHandlers = useCallback(
    () => createSubjectImageActionHandlers({
      projectId,
      subjectId: char?.id,
      setGeneratedImages,
      onCoverChange,
      setPrimaryImageUrl,
      setPrimaryImageId,
      showToast,
      triggerBlobDownload: downloadBlob,
    }),
    [projectId, char?.id, onCoverChange, showToast]
  );
  const handleImageUpload = useCallback(
    (fileOrAsset) => getImageActionHandlers().handleUpload(fileOrAsset),
    [getImageActionHandlers]
  );
  const handleImageDownload = useCallback(
    (imageId) => getImageActionHandlers().handleDownload(imageId),
    [getImageActionHandlers]
  );
  const handleSettledChange = useCallback(
    (image, index, newSettled) => getImageActionHandlers().handleSettledChange(image, index, newSettled),
    [getImageActionHandlers]
  );

  if (!char) return null;

  return (
    <>
    {/* 点击遮罩层关闭弹窗 */}
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 49,
        background: 'transparent',
      }}
    />
    <div
      style={{
        position: 'fixed', top: '60px', right: '24px', bottom: '24px',
        width: '600px', zIndex: 50,
        display: 'flex', flexDirection: 'column',
        background: '#161616', border: '1px solid #FFFFFF14',
        borderRadius: '16px', boxShadow: '#00000099 0px 24px 64px',
        overflow: 'hidden',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <SubjectPanelHeader tabLabel={tabLabel} onClose={onClose} />

      {/* two-column body */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', overflow: 'hidden' }}>
        <SubjectEditForm
          projectId={projectId}
          subjectId={char?.id}
          tabLabel={tabLabel}
          name={charName}
          description={charDesc}
          prompt={promptText}
          imageModels={imageModels}
          modelsLoading={modelsLoading}
          selectedModel={selectedModel}
          selectedRatio={selectedRatio}
          selectedResolution={selectedResolution}
          availableRatios={availableRatios}
          availableResolutions={availableResolutions}
          refImageIds={refImageIds}
          maxRefImages={maxRefImages}
          genMode={genMode}
          onNameChange={(event) => setCharName(event.target.value)}
          onDescriptionChange={(event) => setCharDesc(event.target.value)}
          onPromptChange={(event) => setPromptText(event.target.value)}
          onNameBlur={() => onCommit?.(charName, charDesc)}
          onDescriptionBlur={() => onCommit?.(charName, charDesc)}
          onPromptBlur={() => onCommit?.(charName, charDesc, promptText)}
          onModelChange={setSelectedModel}
          onRatioChange={setSelectedRatio}
          onResolutionChange={setSelectedResolution}
          onRefImagesChange={setRefImageIds}
          onGenModeChange={setGenMode}
        />

        <SubjectImageList
          projectId={projectId}
          subject={char}
          generatedImages={generatedImages}
          promptText={promptText}
          selectedModel={selectedModel}
          selectedRatio={selectedRatio}
          selectedResolution={selectedResolution}
          refImagesForModal={refImagesForModal}
          mediaDetailOpen={mediaDetailOpen}
          mediaDetailActiveIdx={mediaDetailActiveIdx}
          onOpenDetail={(index) => { setMediaDetailActiveIdx(index); setMediaDetailOpen(true); }}
          onCloseDetail={() => setMediaDetailOpen(false)}
          onUpload={handleImageUpload}
          onDownload={handleImageDownload}
          onSettledChange={handleSettledChange}
        />
        </div>
      {/* footer: 生成图片动作区 — 由主体域组件负责布局，页面保留业务生成流程 */}
      <SubjectGenerationAction
        onGenerate={async () => {
            if (!promptText.trim()) {
              showToast('请输入提示词', 'error');
              return;
            }

            // 防止同一主体重复点击生成
            const existing = pendingGenerations.get(char.id);
            if (existing && existing.status === 'pending') {
              showToast('该主体已有生成任务进行中', 'error');
              return;
            }

            const placeholder = `generated-${Date.now()}`;
            const tab = tabLabel === '角色' ? 'char' : tabLabel === '场景' ? 'scene' : 'prop';
            const genParamsForCache = { model: selectedModel, ratio: selectedRatio, resolution: selectedResolution, prompt: promptText };
            const existingImages = generatedImages.filter((img) => img?.rawUrl || img?.url);
            pendingGenerations.set(char.id, {
              placeholderId: placeholder,
              status: 'pending',
              genParams: genParamsForCache,
              createdAt: Date.now(),
              tab,
              knownImageIds: existingImages.map((img) => img.id).filter(Boolean),
              knownImageUrls: existingImages.flatMap((img) => [img.rawUrl, img.url]).filter(Boolean),
            });
            setBatchLoadingSubjects((prev) => ({ ...prev, [char.id]: true }));
            setGeneratedImages((prev) => [{ url: null, settled: false, id: placeholder }, ...prev]);

            const genParams = buildSubjectGenerationParams({
              model: selectedModel,
              ratio: selectedRatio,
              resolution: selectedResolution,
              prompt: promptText,
              generationMode: genMode,
              refImageIds,
            });

            // 快照当前参考图，生成成功后附加到图片对象
            const refImagesSnapshot = refImagesForModal;

            // 处理生成结果的回调（无论同步返回还是异步轮询，最终都走这里）
            const handleGenResult = (payload) => {
              const { rawUrl, imageId: realImageId } = extractSubjectImageResult(payload);
              if (!rawUrl) return;
              if (isMountedRef.current) {
                const imageUrl = normalizeImageUrl(rawUrl);
                setGeneratedImages((prev) => {
                  const updated = prev.map((img) =>
                    img.id === placeholder
                      ? { ...img, id: realImageId || placeholder, rawUrl, url: imageUrl, settled: false, refImages: refImagesSnapshot }
                      : img
                  );
                  const hasSettled = updated.some((img) => img.settled && img.rawUrl);
                  if (!hasSettled && rawUrl) {
                    updated[0] = { ...updated[0], settled: true };
                    setPrimaryImageUrl(rawUrl);
                    setPrimaryImageId(realImageId);
                    onCoverChange?.(rawUrl);
                  }
                  return updated;
                });
                showToast('图片生成成功', 'success');
                pendingGenerations.delete(char.id);
              } else {
                const currentPending = pendingGenerations.get(char.id);
                pendingGenerations.set(char.id, {
                  placeholderId: placeholder,
                  status: 'done',
                  rawUrl,
                  imageUrl: rawUrl,
                  realId: realImageId,
                  genParams: currentPending?.genParams,
                  refImages: refImagesSnapshot,
                });
                if (!char.imageUrl && rawUrl) {
                  onCoverChange?.(rawUrl);
                }
              }
              setBatchLoadingSubjects((prev) => {
                const next = { ...prev };
                delete next[char.id];
                return next;
              });
            };

            const handleGenError = (err) => {
              console.error('[SubjectPage] 生成图片失败:', err);
              pendingGenerations.delete(char.id);
              setBatchLoadingSubjects((prev) => {
                const next = { ...prev };
                delete next[char.id];
                return next;
              });
              if (isMountedRef.current) {
                setGeneratedImages((prev) => prev.filter((img) => img.id !== placeholder));
              }
              const errMsg = getSubjectGenerationErrorMessage(err);
              showToast(errMsg, 'error');
            };

            try {
              const result = await apiGenerateSubjectImage(projectId, char.id, genParams);
              const { taskId, rawUrl } = extractSubjectImageResult(result);

              if (taskId) {
                // 后端改为任务模式：写入持久化，轮询 apiGetTask
                addPendingTask(projectId, { taskId, shotId: '', episodeId: '', type: 'subject-single', subjectId: char.id, tab, placeholderId: placeholder });
                // 后台轮询（不阻塞 onClick）
                const pollTask = async () => {
                  try {
                    while (true) {
                      await new Promise(r => setTimeout(r, 3000));
                      const t = await apiGetTask(taskId).catch(() => null);
                      if (!t) continue;
                      // 找到当前主体对应的结果
                      const item = getSubjectTaskResult(t, char.id);
                      if (item) {
                        const { rawUrl: imgUrl } = extractSubjectImageResult(item);
                        const errMsg = getSubjectGenerationErrorMessage(item, '');
                        if (imgUrl) {
                          handleGenResult(item);
                          removePendingTask(projectId, taskId);
                          return;
                        } else if (errMsg) {
                          handleGenError(errMsg);
                          removePendingTask(projectId, taskId);
                          return;
                        }
                      }
                      if (isSubjectTaskTerminal(t)) {
                        // 任务已结束但未找到对应结果，回退检查主体详情
                        const detail = await apiGetSubjectDetail(projectId, char.id).catch(() => null);
                        const recovered = detail ? findPendingSubjectImage(detail, pendingGenerations.get(char.id)) : null;
                        if (recovered) {
                          handleGenResult(recovered);
                        } else {
                          handleGenError(new Error('生成任务已完成但未获取到结果'));
                        }
                        removePendingTask(projectId, taskId);
                        return;
                      }
                    }
                  } catch (err) {
                    handleGenError(err);
                    removePendingTask(projectId, taskId);
                  }
                };
                pollTask();
                // 同步模式下也有可能返回 taskId + image_url 共存
                if (rawUrl) {
                  handleGenResult(result);
                  removePendingTask(projectId, taskId);
                }
              } else if (rawUrl) {
                // 纯同步模式（后端未改造）：直接处理结果
                handleGenResult(result);
              } else {
                // 既无 taskId 也无 image_url：异常
                handleGenError(new Error('生成接口未返回有效结果'));
              }
            } catch (err) {
              handleGenError(err);
            }
          }}
        />
    </div>
    <SubjectToast toast={toast} />
    </>
  );
}

// ── Main export ────────────────────────────────────────────────────────────

export default function SubjectPage({ projectId, projectName = '两只老虎的奇遇', onBack, onUnlockStep, onStartStoryboard, onExtractSubjects, extractError = null, isStoryboardGenerated = false, initialTab = 'char', projectRatio, chars: externalChars, onCharsChange, scenes: externalScenes, onScenesChange, props: externalProps, onPropsChange, onLoadMoreChars, onLoadMoreScenes, onLoadMoreProps, hasMoreChars = false, hasMoreScenes = false, hasMoreProps = false, charsLoadError = false, scenesLoadError = false, propsLoadError = false, onRetryChars, onRetryScenes, onRetryProps }) {

  const [activeTab, setActiveTab] = useState(initialTab);
  const [batchGenOpen, setBatchGenOpen] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const extractingRef = useRef(false);
  const subjectListRef = useRef(null);
  const subjectSentinelRef = useRef(null);

  // 仅从剧本页「开始提取主体」触发（Home.jsx 传入 onExtractSubjects 回调），
  // 浏览器刷新 / tab 切换等场景不触发提取
  useEffect(() => {
    if (!onExtractSubjects) return;
    if (extractingRef.current) return;
    extractingRef.current = true;
    setIsExtracting(true);
    onExtractSubjects().finally(() => {
      setIsExtracting(false);
      extractingRef.current = false;
    });
  }, [onExtractSubjects]);

  // 循环 loading 文案
  const [loadingTextIndex, setLoadingTextIndex] = useState(0);

  useEffect(() => {
    if (!isExtracting) return;
    const timer = setInterval(() => {
      setLoadingTextIndex(prev => (prev + 1) % SUBJECT_LOADING_TEXTS.length);
    }, 2500);
    return () => clearInterval(timer);
  }, [isExtracting]);

  const [batchGeneratingByTab, setBatchGeneratingByTab] = useState({});
  const [batchToast, setBatchToast] = useState(null);
  const batchToastTimerRef = useRef(null);
  // 批量生成加载状态：{ [subjectId]: true }
  const [batchLoadingSubjects, setBatchLoadingSubjects] = useState({});
  // 批量生成前的封面 URL 快照
  const prevCoverUrlsRef = useRef({});
  // 批量生成 AbortController，组件卸载时取消
  const batchAbortRef = useRef(null);
  const singleGenRecoveryRunRef = useRef(0);

  // ── 恢复跨刷新挂起的批量生成任务 ────────────────────────────────────────────
  useEffect(() => {
    if (!projectId) return;
    const pending = getPendingTasks(projectId, '');
    const batchTasks = pending.filter(t => t.type === 'batch-subject' && t.tab);
    if (batchTasks.length === 0) return;

    // 取最新的一个批量任务
    const task = batchTasks.sort((a, b) => b.createdAt - a.createdAt)[0];
    const captureTab = task.tab;

    // 跨刷新恢复任务时，先恢复页面级 loading 状态，再启动轮询。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBatchGeneratingByTab(prev => ({ ...prev, [captureTab]: true }));
    // 初始化所有待生成主体的 loading 状态
    if (task.subjectIds && task.subjectIds.length > 0) {
      const loadingMap = {};
      task.subjectIds.forEach(id => { loadingMap[id] = true; });
      setBatchLoadingSubjects(loadingMap);
    }

    const targetSetter =
      captureTab === 'char' ? setChars :
      captureTab === 'scene' ? setScenes :
      setProps;

    (async () => {
      const processedIds = new Set();
      try {
        while (true) {
          const t = await apiGetTask(task.taskId);
          const results = getSubjectTaskResults(t);
          if (Array.isArray(results)) {
            for (const item of results) {
              const sid = item.subject_id || item.id;
              if (!sid || processedIds.has(sid)) continue;
              const { rawUrl: imgUrl } = extractSubjectImageResult(item);
              const errMsg = getSubjectGenerationErrorMessage(item, '');
              if (imgUrl) {
                processedIds.add(sid);
                const fullUrl = normalizeImageUrl(imgUrl);
                targetSetter(prev => prev.map(s => s.id === sid ? { ...s, imageUrl: fullUrl } : s));
                setBatchLoadingSubjects(prev => { const n = { ...prev }; delete n[sid]; return n; });
                const existingCache = batchGeneratedImagesCache.get(sid) || [];
                batchGeneratedImagesCache.set(sid, [...existingCache, { rawUrl: fullUrl }]);
              } else if (errMsg) {
                processedIds.add(sid);
                setBatchLoadingSubjects(prev => { const n = { ...prev }; delete n[sid]; return n; });
              }
            }
          }
          if (isSubjectTaskTerminal(t)) break;
          await new Promise(r => setTimeout(r, 3000));
        }
      } catch (err) {
        console.error('[SubjectPage] 恢复批量任务失败:', task.taskId, err);
      } finally {
        removePendingTask(projectId, task.taskId);
        setBatchGeneratingByTab(prev => { const n = { ...prev }; delete n[captureTab]; return n; });
        setBatchLoadingSubjects({});
      }
    })();
  // setChars/setScenes/setProps 是受控与非受控数据的适配包装器，任务恢复只应在项目切换时启动，不能因包装器重建重复轮询。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // ── 恢复跨刷新挂起的单主体生成任务（subject-single 类型）────────────────────
  useEffect(() => {
    if (!projectId) return;
    const pending = getPendingTasks(projectId, '');
    const singleTasks = pending.filter(t => t.type === 'subject-single' && t.subjectId && t.taskId);
    if (singleTasks.length === 0) return;

    const processedIds = new Set();
    const loadingMap = {};
    singleTasks.forEach(t => { loadingMap[t.subjectId] = true; });
    // 跨刷新恢复单主体任务时，先恢复卡片 loading 状态，再启动轮询。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBatchLoadingSubjects(prev => ({ ...loadingMap, ...prev }));

    (async () => {
      let allDone = false;
      try {
        while (!allDone) {
          allDone = true;
          await Promise.all(singleTasks.map(async (task) => {
            if (processedIds.has(task.subjectId)) return;
            try {
              const t = await apiGetTask(task.taskId);
              // 查找当前主体对应的结果
              const item = getSubjectTaskResult(t, task.subjectId);
              if (item) {
                const { rawUrl: imgUrl } = extractSubjectImageResult(item);
                const errMsg = getSubjectGenerationErrorMessage(item, '');
                if (imgUrl) {
                  processedIds.add(task.subjectId);
                  const fullUrl = normalizeImageUrl(imgUrl);
                  const targetSetter = getPendingGenTabSetter(task.tab, { setChars, setScenes, setProps });
                  targetSetter(prev => prev.map(s => s.id === task.subjectId ? { ...s, imageUrl: fullUrl } : s));
                  setBatchLoadingSubjects(prev => { const n = { ...prev }; delete n[task.subjectId]; return n; });
                  setSubjectDetailRefreshToken(prev => prev + 1);
                  // 同步写入缓存供 EditSubjectPanel 读取
                  const existingCache = batchGeneratedImagesCache.get(task.subjectId) || [];
                  batchGeneratedImagesCache.set(task.subjectId, [...existingCache, { rawUrl: fullUrl }]);
                  // 清理旧 pendingGenerations 路径的 pending 状态，避免残留 loading
                  pendingGenerations.delete(task.subjectId);
                  removePendingTask(projectId, task.taskId);
                } else if (errMsg) {
                  processedIds.add(task.subjectId);
                  setBatchLoadingSubjects(prev => { const n = { ...prev }; delete n[task.subjectId]; return n; });
                  pendingGenerations.delete(task.subjectId);
                  removePendingTask(projectId, task.taskId);
                }
              } else if (isSubjectTaskTerminal(t)) {
                // 任务已结束但无对应结果，尝试从主体详情恢复
                const detail = await apiGetSubjectDetail(projectId, task.subjectId).catch(() => null);
                const pendingInfo = pendingGenerations.get(task.subjectId) || {};
                const recovered = detail ? findPendingSubjectImage(detail, pendingInfo) : null;
                if (recovered) {
                  processedIds.add(task.subjectId);
                  const { rawUrl: recoveredUrl } = extractSubjectImageResult(recovered);
                  if (recoveredUrl) {
                    const fullUrl = normalizeImageUrl(recoveredUrl);
                    const targetSetter = getPendingGenTabSetter(task.tab, { setChars, setScenes, setProps });
                    targetSetter(prev => prev.map(s => s.id === task.subjectId ? { ...s, imageUrl: fullUrl } : s));
                  }
                } else {
                  processedIds.add(task.subjectId);
                }
                setBatchLoadingSubjects(prev => { const n = { ...prev }; delete n[task.subjectId]; return n; });
                pendingGenerations.delete(task.subjectId);
                removePendingTask(projectId, task.taskId);
              } else {
                allDone = false;
              }
            } catch (err) {
              console.error('[SubjectPage] 恢复单主体任务失败:', task.subjectId, err);
              processedIds.add(task.subjectId);
              setBatchLoadingSubjects(prev => { const n = { ...prev }; delete n[task.subjectId]; return n; });
              pendingGenerations.delete(task.subjectId);
              removePendingTask(projectId, task.taskId);
            }
          }));
          if (!allDone) await new Promise(r => setTimeout(r, 3000));
        }
      } catch (err) {
        console.error('[SubjectPage] 恢复单主体任务循环异常:', err);
      }
    })();
  // setChars/setScenes/setProps 是受控与非受控数据的适配包装器，任务恢复只应在项目切换时启动，不能因包装器重建重复轮询。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // ── 恢复单主体 pending generations 的 loading 状态 ──────────────────────────
  useEffect(() => {
    const loadingMap = {};
    // 已被 subject-single 任务覆盖的 subjectId（避免与 taskPersistence 路径重复轮询）
    const taskCoveredIds = new Set();
    try {
      const taskPending = getPendingTasks(projectId, "");
      taskPending.filter(t => t.type === "subject-single" && t.subjectId).forEach(t => taskCoveredIds.add(t.subjectId));
    } catch {
      // getPendingTasks 失败不影响旧路径
    }
    
    for (const [subjectId, info] of pendingGenerations) {
      if (info?.status === 'pending') {
        if (taskCoveredIds.has(subjectId)) {
          // 该主体已有任务模式恢复在跑，本路径跳过避免双轨轮询
          continue;
        }
        
        if (info.createdAt && (Date.now() - info.createdAt > PENDING_GEN_STALE_MS)) {
          pendingGenerations.delete(subjectId);
          continue;
        }
        loadingMap[subjectId] = true;
      }
    }
    if (Object.keys(loadingMap).length > 0) {
      // 旧版 pending 缓存没有 taskPersistence 记录，需要在挂载时恢复 loading。
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBatchLoadingSubjects(prev => ({ ...loadingMap, ...prev }));
    }

    const runId = Date.now();
    singleGenRecoveryRunRef.current = runId;
    let cancelled = false;

    const pollPendingGenerations = async () => {
      while (!cancelled && singleGenRecoveryRunRef.current === runId) {
        const activeEntries = Array.from(pendingGenerations.entries()).filter(([, info]) => info?.status === 'pending');
        if (activeEntries.length === 0) break;

        await Promise.all(activeEntries.map(async ([subjectId, info]) => {
          if (!info) return;

          if (info.createdAt && (Date.now() - info.createdAt > PENDING_GEN_STALE_MS)) {
            pendingGenerations.delete(subjectId);
            setBatchLoadingSubjects((prev) => {
              const next = { ...prev };
              delete next[subjectId];
              return next;
            });
            return;
          }

          try {
            const detailRes = await apiGetSubjectDetail(projectId, subjectId);
            if (cancelled || singleGenRecoveryRunRef.current !== runId) return;

            const recoveredImage = findPendingSubjectImage(detailRes, info);
            if (!recoveredImage) return;

            const { rawUrl, imageId } = extractSubjectImageResult(recoveredImage);
            pendingGenerations.set(subjectId, {
              ...info,
              status: 'done',
              rawUrl,
              imageUrl: rawUrl,
              realId: imageId || info.realId || null,
              recoveredAt: Date.now(),
            });

            const targetSetter = getPendingGenTabSetter(info.tab, { setChars, setScenes, setProps });
            targetSetter((prev) => prev.map((item) => {
              if (item.id !== subjectId || item.imageUrl || !rawUrl) return item;
              return { ...item, imageUrl: normalizeImageUrl(rawUrl) };
            }));

            setBatchLoadingSubjects((prev) => {
              const next = { ...prev };
              delete next[subjectId];
              return next;
            });
            setSubjectDetailRefreshToken((prev) => prev + 1);
          } catch (err) {
            console.error('[SubjectPage] 恢复单主体生成失败:', subjectId, err);
          }
        }));

        const stillPending = Array.from(pendingGenerations.values()).some((info) => info?.status === 'pending');
        if (!stillPending) break;
        await sleep(PENDING_GEN_POLL_MS);
      }
    };

    pollPendingGenerations();

    return () => {
      cancelled = true;
    };
  // 自定义 setChars/setScenes/setProps 包装器随受控 props 重建；恢复 effect 只应随项目切换启动一次。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);



  function showBatchToast(msg, type = 'success') {
    if (batchToastTimerRef.current) clearTimeout(batchToastTimerRef.current);
    setBatchToast({ msg, type });
    batchToastTimerRef.current = setTimeout(() => setBatchToast(null), 3000);
  }

  const handleBatchGenerate = async (params) => {

  // 批量生成中可静默忽略的错误消息：命中后退出 loading，但不弹 toast、不计入失败数
  const BATCH_SILENT_ERRORS = ['已有主图，跳过生成'];
  const isSilentBatchError = (msg) => BATCH_SILENT_ERRORS.includes(msg);

    // 收集当前 tab 下的主体 ID 列表
    const currentSubjects = activeTab === 'char' ? chars : activeTab === 'scene' ? scenes : props;
    const subjectIds = (currentSubjects || []).map(s => s.id).filter(Boolean);
    if (subjectIds.length === 0) {
      showBatchToast('当前没有可生成的主体', 'error');
      return;
    }

    // 防止重复触发（已有加载中的主体）
    if (Object.keys(batchLoadingSubjects).length > 0) {
      showBatchToast('批量生成进行中，请等待当前任务完成', 'error');
      return;
    }

    // 关闭弹窗
    setBatchGenOpen(false);

    // 保存当前 tab 引用（stream 期间 tab 不会变）
    const captureTab = activeTab;
    // 根据 tab 确定 setter 函数
    const targetSetter =
      captureTab === 'char' ? setChars :
      captureTab === 'scene' ? setScenes :
      setProps;

    // 快照当前所有封面 URL
    prevCoverUrlsRef.current = {};
    (currentSubjects || []).forEach(s => {
      prevCoverUrlsRef.current[s.id] = s.imageUrl;
    });

    // 仅让本次会实际生成的卡片进入 loading 状态：
    // only_undrafted=true 时，只有没有定稿图（primary_image_url 为空）的主体才会被后端处理
    const loadingMap = {};
    (currentSubjects || []).forEach(s => {
      const isUndrafted = !s.primary_image_url;
      if (!params.only_undrafted || isUndrafted) {
        loadingMap[s.id] = true;
      }
    });
    const targetCount = Object.keys(loadingMap).length;
    setBatchLoadingSubjects(loadingMap);

    setBatchGeneratingByTab(prev => ({ ...prev, [captureTab]: true }));

    // 创建 AbortController，用于组件卸载时取消
    const controller = new AbortController();
    batchAbortRef.current = controller;
    let batchTaskId = null;

    // 统计成功/失败数
    let successCount = 0;
    let failCount = 0;

    try {
      await apiBatchGenerateStream(projectId, { model: params.model, ratio: params.ratio, resolution: params.resolution, generation_mode: params.mode, only_undrafted: params.only_undrafted, subject_ids: subjectIds }, {
        signal: controller.signal,
        onTaskCreated: (taskId) => {
          batchTaskId = taskId;
          addPendingTask(projectId, { taskId, shotId: '', episodeId: '', type: 'batch-subject', tab: captureTab, subjectIds });
        },
        onSubjectImage: (subjectId, imageUrl) => {
          successCount++;
          const fullUrl = normalizeImageUrl(imageUrl);
          // 更新对应 tab 的主体封面
          targetSetter(prev => prev.map(s =>
            s.id === subjectId ? { ...s, imageUrl: fullUrl } : s
          ));
          // 该主体退出 loading
          setBatchLoadingSubjects(prev => {
            const next = { ...prev };
            delete next[subjectId];
          return next;
          });
          // 存入批量生成缓存，EditSubjectPanel 打开时优先从缓存读取
          const existingCache = batchGeneratedImagesCache.get(subjectId) || [];
          batchGeneratedImagesCache.set(subjectId, [...existingCache, { rawUrl: fullUrl }]);
        },
        onSubjectError: (subjectId, errorMsg) => {
          // 命中静默错误（如「已有主图，跳过生成」）：仅退出 loading，不弹 toast、不计入失败
          if (isSilentBatchError(errorMsg)) {
            setBatchLoadingSubjects(prev => {
              const next = { ...prev };
              delete next[subjectId];
              return next;
            });
            return;
          }
          failCount++;
          console.error(`[SubjectPage] 主体 ${subjectId} 批量生成失败:`, errorMsg);
          // Toast 提示单个失败
          const sub = (currentSubjects || []).find(s => s.id === subjectId);
          const label = sub?.name || subjectId;
          showBatchToast(`「${label}」生成失败: ${errorMsg || '未知错误'}`, 'error');
          // 该主体退出 loading（封面恢复为之前的图片或占位图）
          setBatchLoadingSubjects(prev => {
            const next = { ...prev };
            delete next[subjectId];
            return next;
          });
        },
      onComplete: () => {
         if (batchTaskId) removePendingTask(projectId, batchTaskId);
         if (successCount > 0) {
           showBatchToast(successCount === targetCount
             ? '批量生成全部完成'
             : `批量生成完成（成功 ${successCount}，失败 ${failCount}）`, 'success');
        }
          else if (failCount > 0) {
            showBatchToast('批量生成失败，可能是调用服务商模型失败了，请换个模型再试下', 'error');
          }
          else {
            showBatchToast('批量生成失败，未能接收到任何结果', 'error');
          }
      },
    });
    } catch (err) {
      // 忽略用户主动取消的错误
      if (err?.name === 'AbortError') return;

      console.error('[SubjectPage] 批量生成流失败:', err);
      // 网络断开或整体请求失败 — toast 后统一恢复
      const errMsg = err?.isNetworkError
        ? '网络连接失败，请检查网络后重试'
        : (err?.message || '批量生成失败，请重试');
      showBatchToast(errMsg, 'error');

      // 生图失败后重新从后端获取主体数据，恢复真实封面
      try {
        const _spAvailW = window.innerWidth - 48;
        const _spAvailH = window.innerHeight - 60 - 48;
        const _spCols = Math.max(1, Math.floor((_spAvailW + 16) / (200 + 16)));
        const _spRows = Math.max(1, Math.ceil(_spAvailH / (246 + 16))) + 1;
        const _spLimit = _spCols * _spRows;
        const [newChars, newScenes, newProps] = await Promise.all([
          apiGetSubjects(projectId, { type: 'character', limit: _spLimit }),
          apiGetSubjects(projectId, { type: 'scene', limit: _spLimit }),
          apiGetSubjects(projectId, { type: 'prop', limit: _spLimit }),
        ]);
        setChars(normalizeSubjectList(newChars));
        setScenes(normalizeSubjectList(newScenes));
        setProps(normalizeSubjectList(newProps));
      } catch (refetchErr) {
        console.error('[SubjectPage] 失败后刷新主体数据也失败:', refetchErr);
      }

      // 整体失败时，所有卡片的 loading 都会由于 finally 清除而消失，
      // 封面自然恢复为之前的图片（因为我们没有修改过 imageUrl）
    } finally {
      // 清空所有 loading 状态
      setBatchLoadingSubjects({});
      setBatchGeneratingByTab(prev => { const next = { ...prev }; delete next[captureTab]; return next; });
      batchAbortRef.current = null;
    }
  };

  const [confirmStoryboardOpen, setConfirmStoryboardOpen] = useState(false);
  const [selectedChar, setSelectedChar] = useState(null);
  const [selectedScene, setSelectedScene] = useState(null);
  const [selectedProp, setSelectedProp] = useState(null);
  const [subjectDetailRefreshToken, setSubjectDetailRefreshToken] = useState(0);
  const [voiceModalChar, setVoiceModalChar] = useState(null);
  const [voiceList, setVoiceList] = useState([]);

  const [internalChars, setInternalChars] = useState(INITIAL_CHARS);
  const chars = (externalChars !== undefined && externalChars !== null) ? externalChars : internalChars;
  const hasExternalChars = externalChars !== undefined && externalChars !== null;
  function setChars(updater) {
    if (typeof updater === 'function') {
      if (hasExternalChars) {
        onCharsChange?.(updater);
      } else {
        setInternalChars(prev => {
          const next = updater(prev);
          onCharsChange?.(next);
          return next;
        });
      }
    } else {
      if (hasExternalChars) {
        onCharsChange?.(updater);
      } else {
        setInternalChars(updater);
        onCharsChange?.(updater);
      }
    }
  }
  const [internalScenes, setInternalScenes] = useState([]);
  const scenes = (externalScenes !== undefined && externalScenes !== null) ? externalScenes : internalScenes;
  const hasExternalScenes = externalScenes !== undefined && externalScenes !== null;
  function setScenes(updater) {
    if (typeof updater === 'function') {
      if (hasExternalScenes) {
        onScenesChange?.(updater);
      } else {
        setInternalScenes(prev => {
          const next = updater(prev);
          onScenesChange?.(next);
          return next;
        });
      }
    } else {
      if (hasExternalScenes) {
        onScenesChange?.(updater);
      } else {
        setInternalScenes(updater);
        onScenesChange?.(updater);
      }
    }
  }
  const [internalProps, setInternalProps] = useState([]);
  const props = (externalProps !== undefined && externalProps !== null) ? externalProps : internalProps;
  const hasExternalProps = externalProps !== undefined && externalProps !== null;
  function setProps(updater) {
    if (typeof updater === 'function') {
      if (hasExternalProps) {
        onPropsChange?.(updater);
      } else {
        setInternalProps(prev => {
          const next = updater(prev);
          onPropsChange?.(next);
          return next;
        });
      }
    } else {
      if (hasExternalProps) {
        onPropsChange?.(updater);
      } else {
        setInternalProps(updater);
        onPropsChange?.(updater);
      }
    }
  }
  const [charVoices, setCharVoices] = useState(() =>
    Object.fromEntries(INITIAL_CHARS.map((c) => [c.id, c.voice]))
  );

  useEffect(() => {
    const panelState =
      selectedChar ? { tab: 'char', subjectId: selectedChar.id } :
      selectedScene ? { tab: 'scene', subjectId: selectedScene.id } :
      selectedProp ? { tab: 'prop', subjectId: selectedProp.id } :
      null;

    if (panelState) {
      saveSubjectPanelState(projectId, panelState);
    } else {
      clearSubjectPanelState(projectId);
    }
  }, [projectId, selectedChar, selectedScene, selectedProp]);

  useEffect(() => {
    const panelState = readSubjectPanelState(projectId);
    if (!panelState?.subjectId || !panelState?.tab) return;

    const source =
      panelState.tab === 'char' ? chars :
      panelState.tab === 'scene' ? scenes :
      props;
    const matched = source.find((item) => item.id === panelState.subjectId);
    if (!matched) return;

    // 从 sessionStorage 恢复用户上次打开的主体面板，必须在列表数据到达后写回页面状态。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveTab(panelState.tab);
    if (panelState.tab === 'char') {
      setSelectedChar((prev) => prev?.id === matched.id ? prev : matched);
      setSelectedScene(null);
      setSelectedProp(null);
      return;
    }
    if (panelState.tab === 'scene') {
      setSelectedScene((prev) => prev?.id === matched.id ? prev : matched);
      setSelectedChar(null);
      setSelectedProp(null);
      return;
    }
    setSelectedProp((prev) => prev?.id === matched.id ? prev : matched);
    setSelectedChar(null);
    setSelectedScene(null);
  }, [projectId, chars, scenes, props]);

  // 从后端数据同步 voice_id 到本地 charVoices（仅当本地无记录时）
  useEffect(() => {
    if (!externalChars || externalChars.length === 0) return;
    // 外部主体数据到达后同步本地音色映射，保留已有用户选择。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCharVoices((prev) => {
      const next = { ...prev };
      let changed = false;
      externalChars.forEach((c) => {
        if (c.voice_id && prev[c.id] === undefined) {
          next[c.id] = c.voice_id;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [externalChars]);

  useEffect(() => {
    apiGetVoices({ tab: 'all' }).then((data) => {
      const list = Array.isArray(data) ? data : data?.items ?? data?.voices ?? [];
      setVoiceList(list);
    }).catch(() => {});
  }, []);

  // 组件卸载时取消进行中的批量生成流
  useEffect(() => {
    return () => {
      batchAbortRef.current?.abort();
    };
  }, []);

  // 初始化时把内部默认数据同步给父组件（仅当父组件尚未持有数据时）
  useEffect(() => {
    if (externalChars === null || externalChars === undefined) onCharsChange?.(INITIAL_CHARS);
    if (externalScenes === null || externalScenes === undefined) onScenesChange?.([]);
    if (externalProps === null || externalProps === undefined) onPropsChange?.([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 订阅主体数据后台更新（角色、场景、道具）
  useEffect(() => {
    if (!projectId) return;

    const unsubscribers = [];

    // 订阅角色缓存
    unsubscribers.push(subscribe(K.subjects(projectId, 'character'), (data) => {
      if (Array.isArray(data)) {
        setChars(normalizeSubjectList(data));
      }
    }));

    // 订阅场景缓存
    unsubscribers.push(subscribe(K.subjects(projectId, 'scene'), (data) => {
      if (Array.isArray(data)) {
        setScenes(normalizeSubjectList(data));
      }
    }));

    // 订阅道具缓存
    unsubscribers.push(subscribe(K.subjects(projectId, 'prop'), (data) => {
      if (Array.isArray(data)) {
        setProps(normalizeSubjectList(data));
      }
    }));

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  // 缓存订阅回调使用受控/非受控适配 setter；订阅生命周期只随项目切换变化。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // 监听资产库删除事件，刷新已打开的主体详情弹窗
  useEffect(() => {
    function handleAssetsDeleted(e) {
      if (e.detail?.projectId && e.detail.projectId !== projectId) return;
      setSubjectDetailRefreshToken(t => t + 1);
    }
    window.addEventListener('project-assets:deleted', handleAssetsDeleted);
    return () => window.removeEventListener('project-assets:deleted', handleAssetsDeleted);
  }, [projectId]);

  const counts = {
    char: chars.length,
    scene: scenes.length,
    prop: props.length,
  };

  const handleAdd = async () => {
    const type = activeTab; // 'char' | 'scene' | 'prop'
    const typeMap = { char: 'character', scene: 'scene', prop: 'prop' };
    const labelMap = { char: '角色', scene: '场景', prop: '道具' };
    const actualType = typeMap[type];
    const labelPrefix = labelMap[type];
    const num = counts[type] + 1;
    const defaultName = `${labelPrefix}${String(num).padStart(3, '0')}`;
    const defaultDesc = '自定义描述';

    const { id } = await apiCreateSubject(projectId, { type: actualType, name: defaultName, description: defaultDesc });
    if (activeTab === 'char') {
      setChars((prev) => [...prev, { id, name: defaultName, desc: defaultDesc, imageUrl: null, voice: null }]);
    } else if (activeTab === 'scene') {
      setScenes((prev) => [...prev, { id, name: defaultName, desc: defaultDesc, imageUrl: null }]);
    } else if (activeTab === 'prop') {
      setProps((prev) => [...prev, { id, name: defaultName, desc: defaultDesc, imageUrl: null }]);
    }
  };

  // ── 下载主体封面图 ────────────────────────────────────────────
  const handleDownloadSubjectImage = async (subjectId) => {
    try {
      // 获取主体图片列表，找到主图
      const imgRes = await apiGetSubjectImages(projectId, subjectId);
      const imgs = Array.isArray(imgRes) ? imgRes : (imgRes?.images || imgRes?.items || []);
      const primaryImg = imgs.find((img) => img.is_primary);
      const targetImg = primaryImg || imgs[0];
      if (!targetImg?.id) {
        console.warn('[SubjectPage] 没有可下载的图片');
        return;
      }
      // 调用下载 API
      const blob = await apiDownloadSubjectImage(projectId, subjectId, targetImg.id);
      downloadBlob(blob, `subject-${subjectId}.jpg`);
    } catch (err) {
      console.error('[SubjectPage] 下载图片失败:', err);
    }
  };

  // ── 删除主体 ──────────────────────────────────────────────────
  const handleDeleteSubject = async (subjectId) => {
    try {
      await apiDeleteSubject(projectId, subjectId);
      setChars((prev) => prev.filter((c) => c.id !== subjectId));
      setScenes((prev) => prev.filter((s) => s.id !== subjectId));
      setProps((prev) => prev.filter((p) => p.id !== subjectId));
      setSelectedChar(null);
      setSelectedScene(null);
      setSelectedProp(null);
    } catch (err) {
      console.error('[SubjectPage] 删除主体失败:', err);
    }
  };

  useEffect(() => {
    if (chars.length > 0) onUnlockStep?.('subject');
  }, [chars.length, onUnlockStep]);

  // 滚动触底加载更多主体
  useEffect(() => {
    if (!subjectSentinelRef.current || !subjectListRef.current) return;
    // 当前标签页已无更多数据，不加载
    if (activeTab === 'char' && !hasMoreChars) return;
    if (activeTab === 'scene' && !hasMoreScenes) return;
    if (activeTab === 'prop' && !hasMoreProps) return;
    const loadMore = () => {
      if (activeTab === 'char') onLoadMoreChars?.();
      else if (activeTab === 'scene') onLoadMoreScenes?.();
      else if (activeTab === 'prop') onLoadMoreProps?.();
    };
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { root: subjectListRef.current, rootMargin: '120px', threshold: 0 }
    );
    observer.observe(subjectSentinelRef.current);
    return () => observer.disconnect();
  }, [activeTab, onLoadMoreChars, onLoadMoreScenes, onLoadMoreProps, hasMoreChars, hasMoreScenes, hasMoreProps]);

  // 开始智能分镜：跳转到分镜页（由 Home 处理解锁和导航）
  const handleStartStoryboardRequest = () => {
    if (isStoryboardGenerated) {
      setConfirmStoryboardOpen(true);
      return;
    }
    onStartStoryboard?.();
  };

  // 判断是否显示 loading / 错误态
  const allEmpty = (!externalChars || externalChars.length === 0) && (!externalScenes || externalScenes.length === 0) && (!externalProps || externalProps.length === 0);
  const showLoading = isExtracting;
  const showError = !!extractError && allEmpty;

  if (showLoading) {
    return <SubjectExtractionLoading message={SUBJECT_LOADING_TEXTS[loadingTextIndex]} />;
  }

  if (showError) {
    return <SubjectExtractionError
      loading={isExtracting}
      onRetry={() => {
        setIsExtracting(true);
        onExtractSubjects?.().finally(() => setIsExtracting(false));
      }}
    />;
  }

  return (
    <SubjectWorkspace
      projectName={projectName}
      activeTab={activeTab}
      counts={counts}
      subjectListRef={subjectListRef}
      onBack={onBack}
      onAddSubject={handleAdd}
      onBatchGenerate={() => setBatchGenOpen(true)}
      onStartStoryboard={handleStartStoryboardRequest}
      onTabChange={(tab) => {
        setActiveTab(tab);
        setSelectedChar(null);
        setSelectedScene(null);
        setSelectedProp(null);
      }}
      gridProps={{
        activeTab, chars, scenes, props, charVoices, voiceList, selectedChar, selectedScene, selectedProp,
        batchLoadingSubjects, charsLoadError, scenesLoadError, propsLoadError,
        onRetryChars, onRetryScenes, onRetryProps, onVoiceClick: setVoiceModalChar,
        onSelect: (tab, item) => {
          if (tab === 'char') setSelectedChar(item);
          else if (tab === 'scene') setSelectedScene(item);
          else setSelectedProp(item);
        },
        onDownloadImage: handleDownloadSubjectImage, onDeleteSubject: handleDeleteSubject, onAdd: handleAdd,
        emptyIcons: SubjectEmptyIcons, sentinelRef: subjectSentinelRef,
        hasMore: (activeTab === 'char' && hasMoreChars) || (activeTab === 'scene' && hasMoreScenes) || (activeTab === 'prop' && hasMoreProps),
      }}
    >
      {/* edit panel */}
      <SubjectEditorSlot
        EditorComponent={EditSubjectPanel}
        projectId={projectId}
        projectRatio={projectRatio}
        subject={selectedChar}
        tabLabel="角色"
        refreshToken={subjectDetailRefreshToken}
        setBatchLoadingSubjects={setBatchLoadingSubjects}
        isBatchLoading={!!batchLoadingSubjects[selectedChar?.id]}
        onClose={() => setSelectedChar(null)}
        onCommit={(name, desc, prompt) => {
          if (!selectedChar) return;
          setChars((prev) => prev.map((c) => c.id === selectedChar.id ? { ...c, name, desc, prompt } : c));
          setSelectedChar((prev) => ({ ...prev, name, desc, prompt }));
          apiUpdateSubject(projectId, selectedChar.id, { name, description: desc, prompt });
        }}
        onCoverChange={(imageUrl) => {
          if (!selectedChar) return;
          const fullUrl = normalizeImageUrl(imageUrl);
          setChars((prev) => prev.map((c) => c.id === selectedChar.id ? { ...c, imageUrl: fullUrl } : c));
          if (imageUrl) apiUpdateSubject(projectId, selectedChar.id, { image_url: imageUrl });
          else apiUnsetPrimarySubjectImage(projectId, selectedChar.id).catch(() => {});
        }}
      />
      <SubjectEditorSlot
        EditorComponent={EditSubjectPanel}
        projectId={projectId}
        projectRatio={projectRatio}
        subject={selectedScene}
        tabLabel="场景"
        refreshToken={subjectDetailRefreshToken}
        setBatchLoadingSubjects={setBatchLoadingSubjects}
        isBatchLoading={!!batchLoadingSubjects[selectedScene?.id]}
        onClose={() => setSelectedScene(null)}
        onCommit={(name, desc, prompt) => {
          if (!selectedScene) return;
          setScenes((prev) => prev.map((s) => s.id === selectedScene.id ? { ...s, name, desc, prompt } : s));
          setSelectedScene((prev) => ({ ...prev, name, desc, prompt }));
          apiUpdateSubject(projectId, selectedScene.id, { name, description: desc, prompt });
        }}
        onCoverChange={(imageUrl) => {
          if (!selectedScene) return;
          const fullUrl = normalizeImageUrl(imageUrl);
          setScenes((prev) => prev.map((s) => s.id === selectedScene.id ? { ...s, imageUrl: fullUrl } : s));
          if (imageUrl) apiUpdateSubject(projectId, selectedScene.id, { image_url: imageUrl });
          else apiUnsetPrimarySubjectImage(projectId, selectedScene.id).catch(() => {});
        }}
      />
      <SubjectEditorSlot
        EditorComponent={EditSubjectPanel}
        projectId={projectId}
        projectRatio={projectRatio}
        subject={selectedProp}
        tabLabel="道具"
        refreshToken={subjectDetailRefreshToken}
        setBatchLoadingSubjects={setBatchLoadingSubjects}
        isBatchLoading={!!batchLoadingSubjects[selectedProp?.id]}
        onClose={() => setSelectedProp(null)}
        onCommit={(name, desc, prompt) => {
          if (!selectedProp) return;
          setProps((prev) => prev.map((p) => p.id === selectedProp.id ? { ...p, name, desc, prompt } : p));
          setSelectedProp((prev) => ({ ...prev, name, desc, prompt }));
          apiUpdateSubject(projectId, selectedProp.id, { name, description: desc, prompt });
        }}
        onCoverChange={(imageUrl) => {
          if (!selectedProp) return;
          const fullUrl = normalizeImageUrl(imageUrl);
          setProps((prev) => prev.map((p) => p.id === selectedProp.id ? { ...p, imageUrl: fullUrl } : p));
          if (imageUrl) apiUpdateSubject(projectId, selectedProp.id, { image_url: imageUrl });
          else apiUnsetPrimarySubjectImage(projectId, selectedProp.id).catch(() => {});
        }}
      />

      {/* voice select modal */}
      {voiceModalChar && (
        <SubjectVoiceSelectModal
          open
          currentVoice={charVoices[voiceModalChar.id]}
          onClose={() => setVoiceModalChar(null)}
          onVoicesLoaded={setVoiceList}
          onConfirm={async (voiceId) => {
            const normalizedVoiceId = voiceId || null;
            try {
              await apiUpdateSubject(projectId, voiceModalChar.id, { voice_id: normalizedVoiceId });
              setCharVoices((prev) => ({ ...prev, [voiceModalChar.id]: normalizedVoiceId }));
              // 同步更新本地 char 的 voice_name / voice_preview_url，避免展示后端旧值
              const selectedVoice = voiceList.find((v) => v.voice_id === normalizedVoiceId);
              setChars((prev) => prev.map((c) => c.id === voiceModalChar.id
                ? { ...c, voice_name: selectedVoice?.name ?? null, voice_preview_url: selectedVoice?.preview_url ?? null }
                : c));
              setVoiceModalChar(null);
              showBatchToast('音色保存成功', 'success');
            } catch (err) {
              console.error('[SubjectPage] 更新主体音色失败:', err);
              showBatchToast(err?.message || '音色保存失败，请重试', 'error');
            }
          }}
        />
      )}

      <BatchGenerateModal
        projectRatio={projectRatio}
        open={batchGenOpen}
        onClose={() => { if (!batchGeneratingByTab[activeTab]) setBatchGenOpen(false); }}
        onConfirm={handleBatchGenerate}
        generating={!!batchGeneratingByTab[activeTab]}
        activeTab={activeTab}
      />

      {confirmStoryboardOpen && (
        <ConfirmStoryboardModal
          onConfirm={() => {
            setConfirmStoryboardOpen(false);
            onStartStoryboard?.();
          }}
          onCancel={() => setConfirmStoryboardOpen(false)}
        />
      )}

      {/* 批量生成 toast */}
      <SubjectToast toast={batchToast} />

    </SubjectWorkspace>
  );
}
