/**
 * @file SubjectPage.jsx
 * @structure-index
 *
 * ─── 全局常量 & 工具函数 ──────────────────────────────────────────
 *   SubjectEmptyIcons / SubjectExtractionState / SubjectEditorSlot components/subject/
 *   SUBJECT_LOADING_TEXTS                                           L159
 *   downloadBlob                                                  utils/downloadBlob.js
 *   INITIAL_CHARS                                                  L179
 *   sleep                                                           L197
 *   batchGeneratedImagesCache                                      L203
 *   主体面板会话缓存 / pending 任务存储                               utils/subjectPanelStorage.js / subjectPendingGenerationStore.js
 *   normalizeSubjectList                                           utils/subjectAdapter.js
 *   getSubjectDownloadName                                          主体下载文件名适配
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
 *   normalizeSubjectImageModels         components/subject/SubjectModelAdapter.js
 *
 * ─── 业务组件 ────────────────────────────────────────────────────
 *   ConfirmStoryboardModal                                          components/subject/ConfirmStoryboardModal.jsx
 *   <EditSubjectPanel>                                             L249
 *     ├─ [状态/Ref] 模型、字段、图片、弹窗与保存队列状态            面板内部
 *     ├─ [函数] 生成、定稿、保存及图片动作句柄                      面板内部
 *     ├─ [纯数据] 详情图片映射、参考图快照和生成参数由域工具完成
 *     └─ [副作用] 模型/详情加载、批量占位、模型能力和选项联动
 *   SubjectGenerationOptions  主体生图选项组合                       src/components/subject/SubjectGenerationOptions.jsx
 *   SubjectGenerationMode     主体生图方式选择                       src/components/subject/SubjectGenerationMode.jsx
 *   SubjectGenerationAction   主体编辑面板底部生成动作区             src/components/subject/SubjectGenerationAction.jsx
 *   SubjectTextFields         主体字段组合，内部复用 ui/TextField       src/components/subject/SubjectTextFields.jsx
 *   SubjectEditForm           编辑面板左侧表单组合                         src/components/subject/SubjectEditForm.jsx
 *   SubjectPanelHeader        主体编辑面板标题和关闭动作             src/components/subject/SubjectPanelHeader.jsx
 *   DubbingVoiceModal         复用创作页官方音色选择、筛选和试听弹窗   src/components/creation/CreationDubbingVoiceModal.jsx
 *   SubjectToolbar / SubjectTabs 主体页工具栏和标签导航             src/components/subject/
 *   SubjectGridViewport / SubjectWorkspace 主体列表和工作区组合    src/components/subject/
 *
 * ─── 主页面入口 ─────────────────────────────────────────────────
 *   export default function SubjectPage()                          L1110
 *     ├─ [状态] activeTab / 认证模式 / 提取 / 批量；选中主体        L1856
 *     ├─ [副作用] 页面生命周期、单任务恢复与详情恢复               L1112 / L1399 / L1509
 *     ├─ [函数] 批量生成、添加、下载、删除                         L1628 起
 *     ├─ [副作用] 缓存订阅、资产删除和滚动加载                     主页面内
 *     └─ [渲染] SubjectWorkspace 和弹窗组合                       L2335
 *
 * ─── 更新记录 ──────────────────────────────────────────────────────
 *   2026-10-20  主体独立缓存校验及读写确认，损坏保留、提交前阻断；清理失败保留任务，完成结果保存失败留会话并提示。任务/认证/缓存/分页副作用集中编排暂保留；验证提交/恢复/收尾，未作视觉修改。
 *   2026-10-20  共用存储异常阻止提交；读取失败提示并暂停恢复，清理传入账号；编号写失败保留保护，离页迟到编号仍登记原归属。页面超规模因任务/缓存/分页集中编排暂保留；验证生成/恢复/收尾，主体独立缓存待下一项。
 *   2026-10-19  详情回填保护本面板上传并在更新执行时复核会话/定稿版本；保存与音色保护保留。任务/认证副作用暂保留。
 *   2026-10-19  已编辑字段拒绝迟到详情覆盖，加载就绪补存草稿，关闭保存失败保留面板；受控列表由 Home 管理。
 *   2026-09-18  删除已无运行时引用的旧主体页 Toast 展示；反馈统一由 GlobalToast 承接
 *   2026-07-16  迁移 SubjectExtractionState 至 components/subject/SubjectExtractionState.jsx；页面仅传入加载文案和重试回调
 *   2026-07-16  新增 SubjectEditorSlot 统一三类主体编辑面板接线；页面继续持有列表写回与封面 API 副作用
 *   2026-07-16  迁移 SubjectEmptyIcons 至 components/subject/SubjectEmptyIcons.jsx；页面通过显式 emptyIcons 传递，保留列表状态和业务副作用
 *   2026-07-16  迁移旧 Toast 展示；当时主体页和编辑面板继续持有 Toast 状态、定时器与业务触发
 *   2026-07-16  迁移 ConfirmStoryboardModal 至 components/subject；页面保留确认状态和重新生成副作用
 *   2026-07-17  迁移 SubjectEditForm，页面保留编辑状态、生成 API、任务轮询和图片副作用
 *   2026-07-24  主体编辑自动保存按变更字段增量提交，收口 PATCH 异常，避免提示词保存连带提交整套生图配置
 *   2026-07-15  抽离主体卡片、更多菜单和新增卡片到主体业务域组件
 *   2026-07-15  抽离主体编辑区右侧图片列表、上传卡片和图片卡片
 *   2026-07-15  抽离主体编辑区参考图字段、上传卡片和悬浮预览
 *   2026-07-15  抽离主体生图方式选择区
 *   2026-07-15  将主体生图模型、比例、分辨率选择器提升为可复用 Select 基础组件
 *   2026-07-15  抽离主体编辑面板底部生成动作区，页面保留生成请求与任务轮询
 *   2026-07-15  抽离主体编辑面板标题和关闭动作，页面保留面板生命周期
 *   2026-07-15  抽离主体名称、描述、提示词字段组合，页面保留字段状态与保存回调
 *   2026-07-15  抽离主体音色选择弹窗，性别和年龄复用通用 Select
 *   2026-07-31  主体卡片支持直接清除已添加音色，兼容音色库删除后的旧引用
 *   2026-07-31  服务端主体列表返回 voice_id=null 时同步清除本地音色映射，修复刷新后旧音色复现
 *   2026-07-31  取消音色优先依据 PATCH 返回结果，兼容主体列表最终一致性延迟
 *   2026-08-07  主体编辑面板未保存画面比例时默认选择 16:9，不再继承项目画幅
 *   2026-08-21  角色 Tab 新增 Seedance 真人素材认证入口和工具栏认证模式切换
 *   2026-07-31  主体列表首屏请求期间显示 DotsLoading，请求完成且为空后才显示抽取失败态
 *   2026-07-31  编辑主体候选图首次请求期间保留加载占位，避免已有候选图尚未返回时误显示为空列表
 *   2026-08-03  主体删除事件携带已清理的项目资产 ID，联动分镜、资产库和资产选择弹窗移除残留引用
 *   2026-08-03  主体初始化候选图排除参考图资产，修复参考图重新出现在右侧候选列表
 *   2026-08-03  参考图异步回读后再次过滤候选状态，修复上传参考图与候选资产请求时序导致的回归
 *   2026-08-03  删除主体前先解绑参考图，并从候选资产清理集合排除，避免误删被引用原图
 *   2026-08-03  统一兼容空数组遮蔽嵌套参考图，以及嵌套 asset/image 身份，删除前无法读取详情时中止
 *   2026-08-03  参考图候选过滤统一使用资产 ID/地址身份键，修复参考图再次混入右侧列表
 *   2026-08-03  初始化请求不再用旧空参考图覆盖上传中的参考图，避免候选列表回归
 *   2026-08-05  主体详情接入本地缓存，编辑弹窗优先恢复缓存并后台校验，减少重复打开等待
 *   2026-09-01  主体候选图缓存改为候选列表加载后的增量合并，避免首屏数据源不一致
 *   2026-09-01  编辑弹窗每次打开主动刷新主体详情，缓存仅用于补齐历史候选图
 *   2026-08-05  参考图快照同步写入本地存储，编辑弹窗初始化时立即恢复图片地址
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
 *   2026-07-22  批量生成进行中允许关闭批量生成弹窗，后台任务继续执行
 *   2026-07-22  主体编辑草稿改为防抖实时保存，关闭前刷新并恢复生成配置与参考图
 *   2026-07-22  主体参考图与右侧候选图分流；候选上传不再调用主体参考图接口，分镜页同类状态链路已复核
 *   2026-07-28  候选区本地上传/资产库选择写入项目资产并绑定 subject_id；初始化合并绑定资产，刷新后恢复候选图
 *   2026-07-28  候选图所有来源统一支持定稿；普通项目资产走 assets is_primary，主体生成图走候选图 set-primary
 *   2026-07-28  主体候选图按生成/上传时间倒序，最新进入候选列表的图片置顶
 *   2026-07-23  主体删除改走主体专用删除接口；下载文件名统一为项目名_主体类型_主体名称
 *   2026-07-23  接收 Home 的主体抽取活动状态，刷新恢复期间持续显示加载动画
 *   2026-07-27  主体抽取加载文案优先展示 Home 传入的任务 status_message，接口缺失时沿用轮换兜底文案
 *   2026-07-23  批量生成候选图缓存按图片地址去重，修复首次打开编辑弹窗重复展示
 *   2026-07-16  迁移主体任务恢复标签 setter 和默认提示词纯函数；页面保留状态与副作用
 *   2026-07-16  抽离主体面板会话缓存和 pending 任务持久化桥接；页面保留轮询与写回
 *   2026-07-16  依据当前代码重新核对主体页结构索引、状态边界和渲染终点
 *   2026-07-17  迁移 SubjectGridViewport 至 components/subject；页面继续持有主体列表状态、分页和业务回调
 *   2026-07-17  迁移 SubjectWorkspace 至 components/subject；页面继续通过 children 保留编辑面板、弹窗和业务副作用
 *   2026-07-15  主体确认弹窗取消/确认、提取失败重试统一复用 components/ui/Button；保留关闭图标按钮等专用交互
 *   2026-07-09  取消定稿改走语义化接口 apiUnsetPrimarySubjectImage，移除本地兜底状态
 *   2026-07-06  单主体与批量生图统一任务轮询并修复刷新后的重复占位
 *   2026-07-03  修复媒体详情弹窗参考图数据源

 * 2026-10-23：模型目录仅采用服务器可用项，失败/空目录暂停提交并保留草稿。
 * 当前定义定位：sanitizeDownloadPart L165；getSubjectDownloadName L173；sleep L201；appendBatchGeneratedImage L209；dedupeBatchGeneratedImages L217；getGeneratedSubjectImageId L227；getGeneratedSubjectReferenceImages L241；EditSubjectPanel L253；SubjectPage L1110。
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import SubjectImageList from '../components/subject/SubjectImageList';
import { mergeSubjectDetailUploads } from '../components/subject/SubjectImageMappers';
import ConfirmStoryboardModal from '../components/subject/ConfirmStoryboardModal';
import BatchGenerateModal from '../components/BatchGenerateModal';
import { SubjectGenerationAction, SubjectPanelHeader, SubjectEmptyIcons, SubjectExtractionLoading, SubjectDataLoading, SubjectExtractionError, SubjectEditorSlot, SubjectWorkspace, SubjectEditForm, buildSubjectGenerationParams, createSubjectImageActionHandlers, createSubjectImageItem, extractSubjectImageResult, getSubjectGenerationErrorMessage, isSubjectTaskTerminal, getSubjectTaskResults, getSubjectTaskResult, mapReferenceImageIdsForModal, mergeSubjectImages, filterSubjectImagesByReferences, getSubjectCandidateImagesFromResponse, buildSubjectCertificationMap, getCurrentSubjectCertification } from '../components/subject';
import { DubbingVoiceModal } from '../components/creation';
import { showGlobalToast } from '../stores/toastStore';
import { apiCreateSubject, apiUpdateSubject, apiDeleteSubject, apiGenerateSubjectImage, apiGetSubjects, apiBatchGenerateStream, apiGetSubjectDetail, apiGetSubjectImages, apiDownloadSubjectImage, apiBindSubjectReferenceImages } from '../api/subject';
import { apiGetTask } from '../api/storyboard';
import { apiGetSubjectAssets, apiDeleteSubjectAssets } from '../api/assets';
// 模型能力直接从后端 capabilities 获取
import { useAvailableModels } from '../hooks/useAvailableModels';
import ModelReadStatus from '../components/feedback/ModelReadStatus';
import { apiGetVoices } from '../api/voices';
import { normalizeImageUrl } from '../utils/imageUrl';
import { getSubjectReferenceImageIdentities, getSubjectReferenceImagesFromResponse, getSubjectReferenceSnapshot } from '../utils/referenceMediaAdapter';
import { normalizeSubjects as normalizeSubjectList } from '../utils/subjectAdapter';
import { addPendingTask, removePendingTask, getPendingTasks, assertPendingTaskStorageReady } from '../utils/taskPersistence';
import { peekCacheEntry, subscribe } from '../utils/cache';
import { getAuthSessionGeneration, getToken } from '../api/request';
import { K, MEDIUM } from '../utils/cacheKeys';
import { defaultPromptForTab, findPendingSubjectImage, getPendingGenTabSetter } from '../utils/subjectPendingGenerationAdapter';
import { clearSubjectPanelState, readSubjectPanelState, saveSubjectPanelState } from '../utils/subjectPanelStorage';
import { getSubjectGenerationScope, belongsToSubjectOwner } from '../utils/subjectPendingGenerationStore';
import { beginManualPrimary, getPrimaryVersion, canApplyAutomaticPrimary, saveAutomaticPrimary } from '../components/subject/SubjectPrimaryCoordinator';
import { downloadBlob } from '../utils/downloadBlob';
import { startDownloadFeedback } from '../utils/downloadFeedback';
import { normalizeSubjectImageModels } from '../components/subject/SubjectModelAdapter';
import { apiBindSubjectFinalAsset, apiListLiveMaterialAssets, apiListLiveMaterialGroups, apiListLiveMaterialSubjectBindings } from '../api/liveMaterials';

const SUBJECT_LOADING_TEXTS = ['正在抽取剧本灵魂', '正在抽取剧本主角', '正在抽取剧本配角', '正在抽取场景', '正在抽取道具'];

function sanitizeDownloadPart(value, fallback) {
  const normalized = Array.from(String(value ?? '').trim())
    .filter((character) => character.charCodeAt(0) >= 32)
    .join('')
    .replace(/[\\/:*?"<>|]/g, '_');
  return normalized || fallback;
}

function getSubjectDownloadName(projectName, subject, subjectType) {
  const typeLabel = { character: '角色', scene: '场景', prop: '道具' }[subjectType] || '主体';
  return `${sanitizeDownloadPart(projectName, '项目')}_${typeLabel}_${sanitizeDownloadPart(subject?.name, '未命名主体')}.jpg`;
}

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

function appendBatchGeneratedImage(subjectId, rawUrl, imageId = null, refImages = []) {
  if (!subjectId || !rawUrl) return;
  const normalizedUrl = normalizeImageUrl(rawUrl) || rawUrl;
  const existing = batchGeneratedImagesCache.get(subjectId) || [];
  if (existing.some((image) => (normalizeImageUrl(image.rawUrl) || image.rawUrl) === normalizedUrl)) return;
  batchGeneratedImagesCache.set(subjectId, [...existing, { rawUrl: normalizedUrl, imageId, refImages }]);
}

function dedupeBatchGeneratedImages(images) {
  const seen = new Set();
  return images.filter((image) => {
    const url = normalizeImageUrl(image?.rawUrl) || image?.rawUrl;
    if (!url || seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

function getGeneratedSubjectImageId(result) {
  const nestedImage = result?.image || result?.subject_image || result?.subjectImage || result?.candidate_image || result?.candidateImage;
  return result?.image_id
    || result?.imageId
    || result?.candidate_image_id
    || result?.candidateImageId
    || result?.subject_image_id
    || result?.subjectImageId
    || nestedImage?.id
    || nestedImage?.image_id
    || nestedImage?.imageId
    || null;
}

function getGeneratedSubjectReferenceImages(result) {
  const nestedImage = result?.image || result?.subject_image || result?.subjectImage || result?.candidate_image || result?.candidateImage;
  const metadata = result?.metadata || nestedImage?.metadata || {};
  const refs = result?.reference_image_urls || result?.referenceImageUrls
    || result?.reference_images || result?.referenceImages
    || nestedImage?.reference_image_urls || nestedImage?.referenceImageUrls
    || nestedImage?.reference_images || nestedImage?.referenceImages
    || metadata.reference_image_urls || metadata.referenceImageUrls
    || metadata.reference_images || metadata.referenceImages;
  return Array.isArray(refs) ? refs : [];
}

function EditSubjectPanel({ projectId, ownerId, isGenerationPageCurrent, char, tabLabel = '角色', onClose, onCommit, onCoverChange, refreshToken, setBatchLoadingSubjects, isBatchLoading = false }) {
  const pendingGenerations = useMemo(() => getSubjectGenerationScope(projectId, ownerId, error => showGlobalToast(error.message, 'error')), [projectId, ownerId]);
  // ── 从后端拉取模型列表，直接使用后端 capabilities ──────────────
  const { models: availableModels, loading: modelsLoading, error: modelsError, retry: retryModels } = useAvailableModels('image');
  const imageModels = useMemo(() => normalizeSubjectImageModels(availableModels), [availableModels]);

  // 本地表单状态必须先于模型加载 effect 声明，避免 effect 闭包引用尚未声明的 setter。
  const [promptText, setPromptText] = useState(char?.prompt || char?.prompt_text || '');
  const [selectedModel, setSelectedModel] = useState(char?.model || char?.default_image_model || imageModels[0]?.value || '');
  const [selectedRatio, setSelectedRatio] = useState(char?.ratio || '16:9');
  const [selectedResolution, setSelectedResolution] = useState(char?.resolution || '2K');
  const [genMode, setGenMode] = useState('three_view');
  const [generatedImages, setGeneratedImages] = useState([]);
  const [refImageIds, setRefImageIds] = useState(() => {
    const snapshot = getSubjectReferenceSnapshot(projectId, char?.id);
    return snapshot !== null
      ? snapshot
      : (Array.isArray(char?.reference_image_ids) ? char.reference_image_ids : []);
  });
  const referencePersistenceRef = useRef(null);
  const latestRefImageIdsRef = useRef(refImageIds);
  const uploadingAssetIdsRef = useRef(new Set());
  const primaryOperationRef = useRef({ pending: false, version: 0 });
  const [mediaDetailOpen, setMediaDetailOpen] = useState(false);
  const [mediaDetailActiveIdx, setMediaDetailActiveIdx] = useState(0);
  const isMountedRef = useRef(true); // 跟踪组件是否已挂载，关闭弹窗后仍让请求跑完
  const deletedAssetIdsRef = useRef(new Set());
  const [detailLoaded, setDetailLoaded] = useState(false);
  const saveTimerRef = useRef(null);
  const draftRef = useRef(null);
  const draftDirtyRef = useRef(false);
  const draftFieldsRef = useRef(new Set());
  // 保存队列会清空待保存字段；编辑归属必须持续到本次面板关闭。
  const editedFieldsRef = useRef(new Set());
  const saveChainRef = useRef(Promise.resolve());
  const draftVersionsRef = useRef({});
  const [saveSession] = useState(() => getAuthSessionGeneration());
  const isSaveCurrent = useCallback(() => isMountedRef.current
    && !!getToken() && saveSession === getAuthSessionGeneration(), [saveSession]);

  useEffect(() => {
    latestRefImageIdsRef.current = refImageIds;
  }, [refImageIds]);

  const [, setPrimaryImageUrl] = useState(null);
  const [, setPrimaryImageId] = useState(null);

  useEffect(() => {
    if (modelsLoading || editedFieldsRef.current.has('genConfig') || char?.model || char?.default_image_model) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
    const first = imageModels.find(model => model.is_default) || imageModels[0];
    if (first) setSelectedModel(first.value);
    });
    return () => { active = false; };
  }, [modelsLoading, imageModels, char?.model, char?.default_image_model]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    function handleAssetsDeleted(event) {
      if (event.detail?.projectId && event.detail.projectId !== projectId) return;
      (event.detail?.assetIds || []).forEach((id) => deletedAssetIdsRef.current.add(String(id)));
      setGeneratedImages((prev) => prev.filter((image) => {
        const imageId = image.assetId || image.id;
        return !deletedAssetIdsRef.current.has(String(imageId));
      }));
    }
    window.addEventListener('project-assets:deleted', handleAssetsDeleted);
    return () => window.removeEventListener('project-assets:deleted', handleAssetsDeleted);
  }, [projectId]);

  // ── 从后端拉取主体详情和已生成图片 ─────────────────────────────
  useEffect(() => {
    if (!projectId || !char?.id) return;
    let cancelled = false;

    // ── 读取批量生成缓存，待候选图列表加载完成后统一合并 ─────────
    const uniqueBatchCached = dedupeBatchGeneratedImages(batchGeneratedImagesCache.get(char.id) || []);
    const cachedImages = uniqueBatchCached.map((img, i) => (
      createSubjectImageItem({
        id: img.imageId || `batch-${char.id}-${Date.now()}-${i}`,
        rawUrl: img.rawUrl,
        refImages: img.refImages || [],
        createdAt: img.createdAt || img.created_at || Date.now() - i,
      })
    ));
    // 缓存只作为候选列表加载完成后的增量补充，不在这里直接写入右侧列表。
    // 否则弹窗首屏会先展示“上次生成结果”，随后又被候选图接口结果替换。

    // ── 检查跨弹窗单主体生成缓存，立即展示但仍继续读取后端历史数据 ──
    const pendingPreflight = pendingGenerations.get(char.id);
    if (pendingPreflight?.status === 'done') {
      // 完成缓存只提供本次新结果，等候选图列表加载完成后统一合并。
      // 恢复生成参数，避免跳过 API 后字段为空
      if (pendingPreflight.genParams) {
        const { genParams } = pendingPreflight;
        queueMicrotask(() => {
          if (cancelled) return;
          if (!editedFieldsRef.current.has('prompt')) setPromptText(genParams.prompt || '');
          if (editedFieldsRef.current.has('genConfig')) return;
          if (genParams.model) setSelectedModel(genParams.model);
          if (genParams.ratio) setSelectedRatio(genParams.ratio);
          if (genParams.resolution) setSelectedResolution(genParams.resolution);
        });
      }
      // 更新卡片封面（兜底：else 分支可能因时序问题未执行 onCoverChange）
      if (!char.imageUrl && pendingPreflight.rawUrl && canApplyAutomaticPrimary(projectId, char.id, pendingPreflight.primaryVersion)) {
        onCoverChange?.(pendingPreflight.rawUrl, { persist: true, primaryVersion: pendingPreflight.primaryVersion });
      }
      if (pendingPreflight.rawUrl) {
        const { rawUrl } = pendingPreflight;
        queueMicrotask(() => {
          if (!cancelled) setPrimaryImageUrl(rawUrl);
        });
      }
      console.log('[SubjectPage] preflight DONE hit: restored genParams, rawUrl:', pendingPreflight.rawUrl?.substring(0, 60));
    } else if (pendingPreflight?.status === 'pending') {
      // 生成进行中：先恢复占位槽提供即时反馈，但仍继续读取详情。
      // 不能在这里直接 return，否则会跳过已有候选图/资产的加载，弹窗只剩一个占位框。
      const { placeholderId } = pendingPreflight;
      queueMicrotask(() => {
        if (!cancelled) {
          setGeneratedImages([{ url: null, settled: false, id: placeholderId, isReference: false }]);
        }
      });
    }

    (async () => {
      // 只拉一次详情，SubjectDetailResponse 包含：
      //   subject (SubjectResponse)
      //   primary_image (SubjectImageResponse | null)
      //   candidate_images (SubjectImageResponse[])
      //   reference_images (SubjectReferenceImage[])
      //   latest_generate_config (SubjectGenerateConfig | null)
      const detailCacheEntry = peekCacheEntry(K.subjectDetail(projectId, char.id), MEDIUM.CONTENT);
      const cachedCandidateImages = getSubjectCandidateImagesFromResponse(detailCacheEntry?.d);
      console.log(
        detailCacheEntry
          ? '[SubjectPage] 主体详情命中本地缓存，先使用缓存打开：'
          : '[SubjectPage] 主体详情未命中本地缓存，开始请求：',
        char.id,
      );
      // 先恢复主体详情和参考图；右侧候选资产较慢时不能阻塞编辑面板的首屏显示。
      // 每次编辑弹窗打开都主动读取当前主体详情；本地快照只负责接口暂时未返回的历史候选图补齐，
      // 不能把快照当成完整列表，否则生成后的新图可能遮蔽历史候选图。
      const primaryVersion = primaryOperationRef.current.version;
      const sharedPrimaryVersion = getPrimaryVersion(projectId, char.id);
      const detailRes = await apiGetSubjectDetail(projectId, char.id, { fresh: true }).catch(() => null);
      if (cancelled || !isSaveCurrent()) return;

      if (!detailRes) {
        if (!editedFieldsRef.current.has('prompt') && !promptText) setPromptText(defaultPromptForTab(tabLabel));
        setDetailLoaded(true);
        return;
      }

      // ── 从 subject 字段读取基础信息 ──────────────────────────────
      const subject = detailRes.subject || detailRes;   // 兼容后端扁平返回
      const genCfg = detailRes.latest_generate_config || subject.gen_config || {};

      if (!editedFieldsRef.current.has('prompt') && subject.prompt != null) setPromptText(subject.prompt);
      if (!editedFieldsRef.current.has('genConfig')) {
      if (genCfg.model || subject.model) setSelectedModel(genCfg.model || subject.model);
      if (genCfg.ratio || subject.ratio) setSelectedRatio(genCfg.ratio || subject.ratio);
      if (genCfg.resolution || genCfg.size || subject.resolution) {
        setSelectedResolution(genCfg.resolution || genCfg.size || subject.resolution);
      }
      if (genCfg.generation_mode) setGenMode(genCfg.generation_mode);
      }
      const responseReferenceImages = getSubjectReferenceImagesFromResponse(detailRes);
      const cachedReferenceImages = getSubjectReferenceSnapshot(projectId, char.id);
      // 参考图接口成功写入后，详情接口可能短暂返回旧快照；关闭弹窗再打开时优先
      // 使用本次已确认的快照。缓存中的空数组也有意义，代表用户刚完成了清空绑定。
      const referenceImages = cachedReferenceImages !== null
        ? cachedReferenceImages
        : responseReferenceImages;
      const currentReferenceImages = latestRefImageIdsRef.current;
      // 初始化详情可能早于参考图上传完成返回旧快照；此时不能用空数组覆盖
      // 当前弹窗已经拿到的参考图，否则并行候选资产请求会再次把它显示出来。
      const effectiveReferenceImages = referenceImages.length > 0 || currentReferenceImages.length === 0
        ? referenceImages
        : currentReferenceImages;
      if (Array.isArray(effectiveReferenceImages)) {
        const nextRefImageIds = effectiveReferenceImages.map((image) => {
          const identities = getSubjectReferenceImageIdentities([image]);
          const id = identities.ids[0] || (typeof image === 'string' ? image : null);
          const url = identities.urls[0] || (typeof image === 'string' && /^(https?:|blob:|\/)/i.test(image) ? image : null);
          return { id, assetId: id, url };
        }).filter((image) => image.id || image.url);
        setRefImageIds(nextRefImageIds);
        // 参考图与候选图请求并行时，候选列表可能已先写入状态；
        // 详情回读拿到参考图后立即清理同一资产，避免参考图回归右侧列表。
        setGeneratedImages((prev) => filterSubjectImagesByReferences(prev, nextRefImageIds));
      }

      // 参考图状态已经可以立即渲染，候选资产在后台补充。
      const subjectAssets = await apiGetSubjectAssets(projectId, char.id, {
        category: tabLabel === '场景' ? 'scene' : tabLabel === '道具' ? 'prop' : 'character',
      }).catch(() => []);
      if (cancelled || !isSaveCurrent()) return;

      // 检查是否有进行中/已完成的跨弹窗生成
      const pending = pendingGenerations.get(char.id);
      // 参考图只用于生成输入；详情弹窗的参考图必须来自候选图片自身原数据。
      const finalImages = mergeSubjectImages({
        // 最新详情可能在生成完成后短暂只返回新图；先使用最新接口对象，
        // 再用生成前详情缓存补齐历史候选图，最终统一去重合并。
        candidateImages: [...getSubjectCandidateImagesFromResponse(detailRes), ...cachedCandidateImages],
        subjectAssets,
        referenceImages: effectiveReferenceImages,
        pending,
      }).filter((image) => {
        const imageId = image.assetId || image.id;
        return !deletedAssetIdsRef.current.has(String(imageId));
      });
      const resolvedPendingImage = pendingPreflight?.status === 'done'
        ? createSubjectImageItem({
          rawUrl: pendingPreflight.rawUrl,
          id: pendingPreflight.realId || pendingPreflight.placeholderId,
          refImages: pendingPreflight.refImages || [],
          createdAt: pendingPreflight.createdAt || Date.now(),
        })
        : null;
      if (pending?.status === 'done') {
        pendingGenerations.delete(char.id);
      }
      if (pendingPreflight?.status === 'done') {
        pendingGenerations.delete(char.id);
      }

      const candidateImages = [
        ...finalImages,
        // 候选图接口已经返回最新结果时，以接口对象为准；缓存只负责补缺。
        resolvedPendingImage,
        ...cachedImages,
      ].filter(Boolean);
      const canSyncPrimary = primaryVersion === primaryOperationRef.current.version
        && canApplyAutomaticPrimary(projectId, char.id, sharedPrimaryVersion)
        && !primaryOperationRef.current.pending;
      if (canSyncPrimary) {
        setGeneratedImages(prev => {
          if (cancelled || !isSaveCurrent()
            || !canApplyAutomaticPrimary(projectId, char.id, sharedPrimaryVersion)
            || primaryVersion !== primaryOperationRef.current.version || primaryOperationRef.current.pending) return prev;
          return mergeSubjectDetailUploads(prev, candidateImages, latestRefImageIdsRef.current, deletedAssetIdsRef.current);
        });
      }
      if (uniqueBatchCached.length > 0) {
        batchGeneratedImagesCache.delete(char.id);
      }

      setDetailLoaded(true);
      if (!canSyncPrimary) return;

      // 只有候选图列表中的定稿图才能同步到卡片封面；参考图不会进入 finalImages。
      const _settledImg = finalImages.find((img) => img.settled && img.rawUrl);
      if (_settledImg) {
        setPrimaryImageUrl(_settledImg.rawUrl);
        setPrimaryImageId(_settledImg.id);
        onCoverChange?.(_settledImg.rawUrl, { persist: false });
      } else {
        // 详情已完成且没有候选定稿图时，清除可能由旧 subject.image_url 带来的错误封面。
        // 候选普通图也不能充当封面，封面来源必须是候选图中的唯一 settled 图。
        setPrimaryImageUrl(null);
        setPrimaryImageId(null);
        // 读取详情只同步显示，不发起取消定稿请求。
        if (char?.imageUrl) onCoverChange?.(null, { persist: false });
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
      const cached = dedupeBatchGeneratedImages(batchGeneratedImagesCache.get(char.id) || []);
      if (cached.length > 0) {
        const newImgs = cached.map((img, i) => createSubjectImageItem({ id: img.imageId || `batch-${char.id}-${Date.now()}-${i}`, rawUrl: img.rawUrl, refImages: img.refImages || [], createdAt: img.createdAt || img.created_at || Date.now() - i }));
        batchGeneratedImagesCache.delete(char.id);
        // 批量流结束后，用外部缓存结果替换占位槽。
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setGeneratedImages(prev => {
          const without = prev.filter(img => img.id !== BATCH_PLACEHOLDER);
          // 去重：跳过已存在的 URL
          const existingUrls = new Set(without.map(img => normalizeImageUrl(img.rawUrl) || img.rawUrl).filter(Boolean));
          const toAdd = newImgs.filter(img => {
            const imageUrl = normalizeImageUrl(img.rawUrl) || img.rawUrl;
            return imageUrl && !existingUrls.has(imageUrl);
          });
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
    if (availableRatios.length === 0) return;
    if (!availableRatios.includes(selectedRatio)) {
      // 模型能力联动后修正失效比例，避免选择器展示不可提交的值。
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedRatio(availableRatios.includes('16:9') ? '16:9' : availableRatios[0]);
    }
  }, [availableRatios, selectedRatio]);

  const showToast = useCallback((msg, type = 'success') => {
    showGlobalToast(msg, type);
  }, []);
  const [charName, setCharName] = useState(char?.name ?? '');
  const [charDesc, setCharDesc] = useState(char?.desc ?? '');
  useEffect(() => {
    draftRef.current = {
      name: charName,
      description: charDesc,
      prompt: promptText,
      genConfig: {
        model: selectedModel,
        ratio: selectedRatio,
        resolution: selectedResolution,
        generation_mode: genMode,
      },
    };
  }, [charName, charDesc, promptText, selectedModel, selectedRatio, selectedResolution, genMode]);
  const enqueueDraftSave = useCallback(() => {
    if (!isSaveCurrent() || !draftDirtyRef.current || !draftRef.current) return saveChainRef.current;
    const draft = draftRef.current;
    const fields = new Set(draftFieldsRef.current);
    const versions = { ...draftVersionsRef.current };
    saveChainRef.current = saveChainRef.current.catch(() => {}).then(async () => {
      if (!isSaveCurrent()) return;
      try {
        await onCommit?.(draft, fields, isSaveCurrent);
        if (!isSaveCurrent()) return;
        // 仅确认本次快照：请求期间的新输入仍需保存。
        fields.forEach((field) => {
          if (draftVersionsRef.current[field] === versions[field]) draftFieldsRef.current.delete(field);
        });
        draftDirtyRef.current = draftFieldsRef.current.size > 0;
      } catch (error) {
        if (!isSaveCurrent()) return;
        console.error('[SubjectPage] 保存主体编辑内容失败:', error);
        showToast('主体修改尚未保存，请重试关闭面板或继续编辑', 'error');
      }
    });
    return saveChainRef.current;
  }, [isSaveCurrent, onCommit, showToast]);
  const scheduleDraftSave = useCallback(() => {
    if (!draftDirtyRef.current || !detailLoaded) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      enqueueDraftSave();
    }, 400);
  }, [detailLoaded, enqueueDraftSave]);
  useEffect(() => {
    // 用户可在详情等待期间输入；详情就绪后补发尚未排入队列的草稿。
    if (detailLoaded && draftDirtyRef.current) scheduleDraftSave();
  }, [detailLoaded, scheduleDraftSave]);
  const flushDraftSave = useCallback(() => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    return enqueueDraftSave();
  }, [enqueueDraftSave]);
  useEffect(() => () => clearTimeout(saveTimerRef.current), []);
  const markDraftDirty = useCallback(() => {
    draftDirtyRef.current = true;
    scheduleDraftSave();
  }, [scheduleDraftSave]);
  const updateDraftField = useCallback((field, value) => {
    editedFieldsRef.current.add(field);
    draftVersionsRef.current[field] = (draftVersionsRef.current[field] || 0) + 1;
    draftRef.current = {
      ...(draftRef.current || {}),
      [field]: value,
    };
    draftFieldsRef.current.add(field);
    markDraftDirty();
  }, [markDraftDirty]);
  const handlePanelClose = useCallback(async () => {
    await flushDraftSave();
    if (!isSaveCurrent()) return;
    if (draftDirtyRef.current) {
      showToast('主体修改尚未保存，请稍后再次关闭重试', 'error');
      return;
    }
    onClose?.();
  }, [flushDraftSave, isSaveCurrent, onClose, showToast]);
  const getImageActionHandlers = useCallback(
    () => createSubjectImageActionHandlers({
      projectId,
      subjectId: char?.id,
      subjectType: tabLabel === '场景' ? 'scene' : tabLabel === '道具' ? 'prop' : 'character',
      generatedImages,
      uploadingAssetIdsRef,
      primaryOperationRef,
      beforeManualPrimary: () => beginManualPrimary(projectId, char?.id),
      isCurrent: isSaveCurrent,
      setGeneratedImages,
      onCoverChange,
      setPrimaryImageUrl,
      setPrimaryImageId,
      showToast,
      triggerBlobDownload: downloadBlob,
    }),
    [projectId, char?.id, tabLabel, generatedImages, onCoverChange, showToast, isSaveCurrent]
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
      onClick={handlePanelClose}
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
      <SubjectPanelHeader tabLabel={tabLabel} onClose={handlePanelClose} />

      <ModelReadStatus loading={modelsLoading} error={modelsError} empty={!imageModels.length} onRetry={retryModels} />
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
          referencePersistenceRef={referencePersistenceRef}
          maxRefImages={maxRefImages}
          genMode={genMode}
          onNameChange={(event) => { const value = event.target.value; setCharName(value); updateDraftField('name', value); }}
          onDescriptionChange={(event) => { const value = event.target.value; setCharDesc(value); updateDraftField('description', value); }}
          onPromptChange={(event) => { const value = event.target.value; setPromptText(value); updateDraftField('prompt', value); }}
          onNameBlur={scheduleDraftSave}
          onDescriptionBlur={scheduleDraftSave}
          onPromptBlur={scheduleDraftSave}
          onModelChange={(value) => { setSelectedModel(value); updateDraftField('genConfig', { ...draftRef.current?.genConfig, model: value }); }}
          onRatioChange={(value) => { setSelectedRatio(value); updateDraftField('genConfig', { ...draftRef.current?.genConfig, ratio: value }); }}
          onResolutionChange={(value) => { setSelectedResolution(value); updateDraftField('genConfig', { ...draftRef.current?.genConfig, resolution: value }); }}
          onRefImagesChange={(value) => {
            setRefImageIds(value);
            setGeneratedImages((prev) => filterSubjectImagesByReferences(prev, value));
            markDraftDirty();
          }}
          onGenModeChange={(value) => { setGenMode(value); updateDraftField('genConfig', { ...draftRef.current?.genConfig, generation_mode: value }); }}
        />

        <SubjectImageList
          projectId={projectId}
          subject={char}
          generatedImages={generatedImages}
          candidateImagesLoading={!detailLoaded}
          promptText={promptText}
          selectedModel={selectedModel}
          selectedRatio={selectedRatio}
          selectedResolution={selectedResolution}
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
          disabled={modelsLoading || !imageModels.some(item => item.value === selectedModel)}
          onGenerate={async () => {
            if (modelsLoading || !imageModels.some(item => item.value === selectedModel)) {
              showToast('模型不可用，请重试读取或前往首页 API 配置启用模型', 'error');
              return;
            }
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

            // 参考图上传/绑定是覆盖式写入。必须等待服务端完成后再创建生成任务，
            // 否则临时上传 ID 或旧绑定可能被带入本次生成。
            let persistedReferenceImages = refImageIds;
            try {
              const persisted = await referencePersistenceRef.current?.();
              if (Array.isArray(persisted)) {
                persistedReferenceImages = persisted;
                const nextIds = persisted.map((image) => ({
                  id: image?.assetId || image?.asset_id || image?.id || null,
                  assetId: image?.assetId || image?.asset_id || image?.id || null,
                  url: image?.url || null,
                })).filter((image) => image.id || image.url);
                setRefImageIds(nextIds);
                latestRefImageIdsRef.current = nextIds;
              }
            } catch {
              showToast('参考图绑定未完成，请稍后重试', 'error');
              return;
            }

            if (!isSaveCurrent()) return;
            if (!ownerId) { showToast('登录信息尚未就绪，请稍后重试', 'error'); return; }
            try {
              assertPendingTaskStorageReady(projectId, ownerId);
              pendingGenerations.assertReady();
            }
            catch (error) { showToast(error.message, 'error'); return; }
            if (pendingGenerations.get(char.id)?.status === 'pending') return;
            const primaryVersion = getPrimaryVersion(projectId, char.id);
            const canAutoPrimary = () => !!getToken() && saveSession === getAuthSessionGeneration()
              && canApplyAutomaticPrimary(projectId, char.id, primaryVersion);
            const placeholder = `generated-${crypto.randomUUID()}`;
            const tab = tabLabel === '角色' ? 'char' : tabLabel === '场景' ? 'scene' : 'prop';
            const genParamsForCache = { model: selectedModel, ratio: selectedRatio, resolution: selectedResolution, prompt: promptText };
            const existingImages = generatedImages.filter((img) => img?.rawUrl || img?.url);
            try { pendingGenerations.set(char.id, {
              placeholderId: placeholder,
              primaryVersion,
              projectId,
              status: 'pending',
              genParams: genParamsForCache,
              createdAt: Date.now(),
              tab,
              knownImageIds: existingImages.map((img) => img.id).filter(Boolean),
              knownImageUrls: existingImages.flatMap((img) => [img.rawUrl, img.url]).filter(Boolean),
              refImages: mapReferenceImageIdsForModal(persistedReferenceImages),
            }); } catch (error) { showToast(error.message, 'error'); return; }
            setBatchLoadingSubjects((prev) => ({ ...prev, [char.id]: true }));
            setGeneratedImages((prev) => [{ url: null, settled: false, id: placeholder, created_at: Date.now() }, ...prev]);

            const genParams = buildSubjectGenerationParams({
              model: selectedModel,
              ratio: selectedRatio,
              resolution: selectedResolution,
              prompt: promptText,
              generationMode: genMode,
              refImageIds: persistedReferenceImages,
            });

            // 快照当前参考图，生成成功后附加到图片对象
            const refImagesSnapshot = mapReferenceImageIdsForModal(persistedReferenceImages);

            // 处理生成结果的回调（无论同步返回还是异步轮询，最终都走这里）
            let completed = false;
            const handleGenResult = (payload) => {
              if (completed || !isGenerationPageCurrent() || !getToken() || saveSession !== getAuthSessionGeneration()) return;
              const { rawUrl, imageId: realImageId } = extractSubjectImageResult(payload);
              if (!rawUrl) return;
              completed = true;
              const autoPrimary = !char.imageUrl && !generatedImages.some(img => img.settled) && canAutoPrimary();
              if (isMountedRef.current) {
                const imageUrl = normalizeImageUrl(rawUrl);
                setGeneratedImages((prev) => {
                  if (!isSaveCurrent()) return prev;
                  const resultImage = { id: realImageId || placeholder, rawUrl, url: imageUrl, settled: autoPrimary && canAutoPrimary() && !prev.some(img => img.settled), refImages: refImagesSnapshot, created_at: Date.now() };
                  if (!prev.some(img => img.id === placeholder)) {
                    if (prev.some(img => img.id === realImageId || normalizeImageUrl(img.rawUrl || img.url) === imageUrl)) return prev;
                    return [resultImage, ...prev];
                  }
                  const updated = prev.map((img) =>
                    img.id === placeholder
                      ? { ...img, ...resultImage, created_at: img.created_at || resultImage.created_at }
                      : img
                  );
                  return updated;
                });
                if (autoPrimary) {
                  setPrimaryImageUrl(rawUrl);
                  setPrimaryImageId(realImageId);
                  onCoverChange?.(rawUrl, { persist: true, primaryVersion });
                }
                showToast('图片生成成功', 'success');
                pendingGenerations.delete(char.id);
              } else {
                const currentPending = pendingGenerations.get(char.id);
                pendingGenerations.set(char.id, {
                  ...currentPending,
                  primaryVersion,
                  projectId,
                  placeholderId: placeholder,
                  status: 'done',
                  rawUrl,
                  imageUrl: rawUrl,
                  realId: realImageId,
                  createdAt: currentPending?.createdAt || Date.now(),
                  genParams: currentPending?.genParams,
                  refImages: refImagesSnapshot,
                });
                if (autoPrimary) {
                  onCoverChange?.(rawUrl, { persist: true, primaryVersion });
                }
              }
              setBatchLoadingSubjects((prev) => {
                const next = { ...prev };
                delete next[char.id];
                return next;
              });
            };

            const handleGenError = (err) => {
              if (completed || !isGenerationPageCurrent() || !getToken() || saveSession !== getAuthSessionGeneration()) return;
              completed = true;
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

            let acceptedTaskId = null;
            try {
              const result = await apiGenerateSubjectImage(projectId, char.id, genParams);
              const { taskId, rawUrl } = extractSubjectImageResult(result);
              // 迟到编号仍登记原账号和项目；页面/登录边界只决定是否回填与轮询。
              if (taskId && !rawUrl) {
                acceptedTaskId = taskId;
                addPendingTask(projectId, { taskId, shotId: '', episodeId: '', type: 'subject-single', subjectId: char.id, tab, placeholderId: placeholder, primaryVersion, ownerId });
              }
              if (!isGenerationPageCurrent() || !getToken() || saveSession !== getAuthSessionGeneration()) return;

              if (rawUrl) {
                handleGenResult(result);
              } else if (taskId) {
                // 后端改为任务模式：写入持久化，轮询 apiGetTask
                // 后台轮询（不阻塞 onClick）
                const pollTask = async () => {
                  let failures = 0;
                  const startedAt = Date.now();
                  const pause = () => {
                    setBatchLoadingSubjects(prev => {
                      if (!isGenerationPageCurrent() || !getToken() || saveSession !== getAuthSessionGeneration()) return prev;
                      const next = { ...prev }; delete next[char.id]; return next;
                    });
                    showToast('生成结果暂时无法确认，任务记录已保留，请稍后重新进入主体页恢复', 'error');
                  };
                  while (true) {
                      await new Promise(r => setTimeout(r, 3000));
                      if (!isGenerationPageCurrent() || !getToken() || saveSession !== getAuthSessionGeneration()) return;
                      if (Date.now() - startedAt > PENDING_GEN_STALE_MS) { pause(); return; }
                      try {
                      const t = await apiGetTask(taskId);
                      if (!isGenerationPageCurrent() || !getToken() || saveSession !== getAuthSessionGeneration()) return;
                      // 找到当前主体对应的结果
                      const item = getSubjectTaskResult(t, char.id);
                      if (item) {
                        const { rawUrl: imgUrl } = extractSubjectImageResult(item);
                        const errMsg = getSubjectGenerationErrorMessage(item, '');
                        if (imgUrl) {
                          handleGenResult(item);
                          if (!pendingGenerations.hasStorageError()) removePendingTask(projectId, taskId, ownerId);
                          return;
                        } else if (errMsg) {
                          handleGenError(errMsg);
                          if (!pendingGenerations.hasStorageError()) removePendingTask(projectId, taskId, ownerId);
                          return;
                        }
                      }
                      if (isSubjectTaskTerminal(t)) {
                        // 任务已结束但未找到对应结果，回退检查主体详情
                        const detail = await apiGetSubjectDetail(projectId, char.id);
                        if (!isGenerationPageCurrent() || !getToken() || saveSession !== getAuthSessionGeneration()) return;
                        const recovered = detail ? findPendingSubjectImage(detail, pendingGenerations.get(char.id)) : null;
                        if (recovered) {
                          handleGenResult(recovered);
                        } else {
                          throw new Error('任务已结束，结果暂未同步');
                        }
                        if (!pendingGenerations.hasStorageError()) removePendingTask(projectId, taskId, ownerId);
                        return;
                      }
                      failures = 0;
                      } catch {
                        if (!isGenerationPageCurrent() || !getToken() || saveSession !== getAuthSessionGeneration()) return;
                        failures += 1;
                        if (failures >= 3) { pause(); return; }
                      }
                  }
                };
                pollTask();
              } else {
                // 既无 taskId 也无 image_url：异常
                handleGenError(new Error('生成接口未返回有效结果'));
              }
            } catch (err) {
              if (acceptedTaskId) {
                if (isGenerationPageCurrent() && getToken() && saveSession === getAuthSessionGeneration()) showToast(err.message, 'error');
                return;
              }
              handleGenError(err);
            }
          }}
        />
    </div>
    </>
  );
}

// ── Main export ────────────────────────────────────────────────────────────

export default function SubjectPage({ projectId, ownerId, projectName = '两只老虎的奇遇', onBack, onUnlockStep, onStartStoryboard, onRegenerateStoryboard, onExtractSubjects, onRetryExtractSubjects, extractError = null, isExtractingSubjects = false, subjectExtractionStatusMessage = '', isStoryboardGenerated = false, initialTab = 'char', chars: externalChars, onCharsChange, scenes: externalScenes, onScenesChange, props: externalProps, onPropsChange, subjectsLoading = false, onLoadMoreChars, onLoadMoreScenes, onLoadMoreProps, hasMoreChars = false, hasMoreScenes = false, hasMoreProps = false, charsLoadError = false, scenesLoadError = false, propsLoadError = false, onRetryChars, onRetryScenes, onRetryProps, onRefreshSubjects, onGoToSeedanceLiveMaterials }) {
  const pendingGenerations = useMemo(() => getSubjectGenerationScope(projectId, ownerId, error => showGlobalToast(error.message, 'error')), [projectId, ownerId]);
  useEffect(() => {
    try { pendingGenerations.assertReadable(); }
    catch (error) { showGlobalToast(error.message, 'error'); }
  }, [pendingGenerations]);

  const generationPageRef = useRef(false);
  const isGenerationPageCurrent = useCallback(() => generationPageRef.current, []);
  useEffect(() => {
    generationPageRef.current = true;
    return () => { generationPageRef.current = false; };
  }, []);

  const [activeTab, setActiveTab] = useState(initialTab);
  const [isSeedanceCertificationMode, setIsSeedanceCertificationMode] = useState(false);
  const [showCertificationBanner, setShowCertificationBanner] = useState(() => {
    try {
      return localStorage.getItem('miioo:subject:seedance-certification-banner-dismissed') !== 'true';
    } catch {
      return true;
    }
  });
  const [certificationBySubject, setCertificationBySubject] = useState({});
  const [certificationGroups, setCertificationGroups] = useState([]);
  const certificationRefreshRef = useRef(null);
  const certificationCharactersRef = useRef([]);
  const [batchGenOpen, setBatchGenOpen] = useState(false);
  const [isRetryingExtraction, setIsRetryingExtraction] = useState(false);
  const isExtracting = isExtractingSubjects || isRetryingExtraction;
  const extractingRef = useRef(false);
  const subjectListRef = useRef(null);
  const subjectSentinelRef = useRef(null);

  // 仅从剧本页「开始提取主体」触发（Home.jsx 传入 onExtractSubjects 回调），
  // 浏览器刷新 / tab 切换等场景不触发提取
  useEffect(() => {
    if (!onExtractSubjects) return;
    if (extractingRef.current) return;
    extractingRef.current = true;
    setIsRetryingExtraction(true);
    onExtractSubjects().finally(() => {
      setIsRetryingExtraction(false);
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
  // 批量生成加载状态：{ [subjectId]: true }
  const [batchLoadingSubjects, setBatchLoadingSubjects] = useState({});
  // 批量生成前的封面 URL 快照
  const prevCoverUrlsRef = useRef({});
  // 批量生成 AbortController，组件卸载时取消
  const batchAbortRef = useRef(null);
  const batchRecoveryRef = useRef(new Set());
  const batchScopeRef = useRef(null);
  useEffect(() => {
    const scope = {};
    batchScopeRef.current = scope;
    // 切换项目或账号时，不沿用上一归属的加载标记；后续恢复副作用会补回当前任务。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBatchLoadingSubjects({});
    setBatchGeneratingByTab({});
    return () => {
      batchScopeRef.current = null;
      batchAbortRef.current?.abort();
      batchAbortRef.current = null;
    };
  }, [projectId, ownerId]);
  const singleGenRecoveryRunRef = useRef(0);

  const refreshCertificationBindings = useCallback(async (refreshPending = false) => {
    if (!projectId) return { available: false, hasPending: false };
    try {
      let payload = await apiListLiveMaterialSubjectBindings(projectId);
      let certificationMap = buildSubjectCertificationMap(payload);
      let pendingCertifications = certificationCharactersRef.current
        .map((subject) => getCurrentSubjectCertification(subject, certificationMap[subject.id]))
        .filter((certification) => certification?.status === 'pending');
      if (refreshPending) {
        const pendingGroupIds = [...new Set(pendingCertifications
          .map((item) => item.binding?.group_id ?? item.binding?.groupId ?? item.binding?.group?.id)
          .filter(Boolean))];
        if (pendingGroupIds.length > 0) {
          await Promise.all(pendingGroupIds.map((groupId) => apiListLiveMaterialAssets(groupId, { refresh: true }).catch(() => null)));
          payload = await apiListLiveMaterialSubjectBindings(projectId);
          certificationMap = buildSubjectCertificationMap(payload);
          pendingCertifications = certificationCharactersRef.current
            .map((subject) => getCurrentSubjectCertification(subject, certificationMap[subject.id]))
            .filter((certification) => certification?.status === 'pending');
        }
      }
      setCertificationBySubject(certificationMap);
      return { available: true, hasPending: pendingCertifications.length > 0 };
    } catch (error) {
      console.warn('[SubjectPage] 获取真人认证状态失败', error);
      return { available: false, hasPending: false };
    }
  }, [projectId]);

  const startCertificationPolling = useCallback(() => {
    if (certificationRefreshRef.current) return;
    certificationRefreshRef.current = setInterval(async () => {
      const { available, hasPending } = await refreshCertificationBindings(true);
      if (!available || !hasPending) {
        clearInterval(certificationRefreshRef.current);
        certificationRefreshRef.current = null;
      }
    }, 5000);
  }, [refreshCertificationBindings]);

  const loadCertificationGroups = useCallback(async () => {
    try {
      const payload = await apiListLiveMaterialGroups();
      const groups = Array.isArray(payload) ? payload : (payload?.list ?? payload?.items ?? payload?.data ?? []);
      setCertificationGroups(groups.filter((group) => String(group?.group_type ?? group?.groupType ?? '').toUpperCase() !== 'AIGC'));
    } catch (error) {
      console.warn('[SubjectPage] 获取真人素材组失败', error);
      setCertificationGroups([]);
    }
  }, []);

  useEffect(() => {
    if (!isSeedanceCertificationMode) {
      clearInterval(certificationRefreshRef.current);
      certificationRefreshRef.current = null;
      return undefined;
    }
    let cancelled = false;
    const initialTimer = setTimeout(async () => {
      loadCertificationGroups();
      const { available, hasPending } = await refreshCertificationBindings();
      if (!cancelled && available && hasPending) {
        startCertificationPolling();
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(initialTimer);
      clearInterval(certificationRefreshRef.current);
      certificationRefreshRef.current = null;
    };
  }, [isSeedanceCertificationMode, loadCertificationGroups, refreshCertificationBindings, startCertificationPolling]);

  const handleCertificationGroupSelect = useCallback(async (subject, group) => {
    if (!projectId || !subject?.id || !group?.id) return;
    const primaryAssetId = subject.primary_asset_id ?? subject.primaryAssetId;
    const pendingCertification = {
      status: 'pending',
      binding: {
        subject_id: subject.id,
        primary_asset_id: primaryAssetId,
        group_id: group.id,
      },
      };
      setCertificationBySubject((previous) => ({
      ...previous,
      [subject.id]: {
        ...pendingCertification,
        records: [pendingCertification, ...(previous[subject.id]?.records ?? [])],
      },
      }));
    try {
      await apiBindSubjectFinalAsset(group.id, { project_id: projectId, subject_id: subject.id });
      const { hasPending } = await refreshCertificationBindings();
      if (hasPending) startCertificationPolling();
    } catch (error) {
      setCertificationBySubject((previous) => ({
        ...previous,
        [subject.id]: {
          ...pendingCertification,
          status: 'failed',
          records: [{ ...pendingCertification, status: 'failed' }, ...(previous[subject.id]?.records ?? []).slice(1)],
        },
      }));
      showGlobalToast(error?.message || '真人认证提交失败，请重试', 'error');
    }
  }, [projectId, refreshCertificationBindings, startCertificationPolling]);

  // ── 恢复跨刷新挂起的批量生成任务 ────────────────────────────────────────────
  useEffect(() => {
    if (!projectId || !ownerId) return;
    let pending;
    try { pending = getPendingTasks(projectId, ''); }
    catch (error) { showGlobalToast(error.message, 'error'); return; }
    const batchTasks = pending.filter(t => t.type === 'batch-subject' && t.taskId
      && ['char', 'scene', 'prop'].includes(t.tab) && belongsToSubjectOwner(t, projectId, ownerId));
    if (batchTasks.length === 0) return;
    let cancelled = false;
    const session = getAuthSessionGeneration();
    const isCurrent = () => !cancelled && !!getToken() && session === getAuthSessionGeneration();
    const active = new Map(batchTasks.map(task => [task.taskId, task]));
    batchRecoveryRef.current = new Set(active.keys());
    const singleIds = new Set(pending.filter(t => t.type === 'subject-single'
      && belongsToSubjectOwner(t, projectId, ownerId)).map(t => t.subjectId));
    const loadingMap = {};
    batchTasks.forEach(task => (task.subjectIds || []).forEach(id => { loadingMap[id] = true; }));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBatchGeneratingByTab(prev => ({ ...prev, ...Object.fromEntries(batchTasks.map(task => [task.tab, true])) }));
    setBatchLoadingSubjects(prev => ({ ...prev, ...loadingMap }));

    batchTasks.forEach(task => { void (async () => {
      const processedIds = new Set();
      const allowedIds = new Set(task.subjectIds || []);
      const expectedIds = task.expectedSubjectIds || task.subjectIds || [];
      const startedAt = Date.now();
      let failures = 0;
      let incompleteReads = 0;
      const targetSetter = getPendingGenTabSetter(task.tab, { setChars, setScenes, setProps });
      try {
        while (isCurrent()) {
          if (Date.now() - startedAt >= PENDING_GEN_STALE_MS) throw new Error('等待生成结果超时');
          let t;
          try {
            t = await apiGetTask(task.taskId);
            failures = 0;
          } catch (error) {
            if (!isCurrent()) return;
            if (++failures >= 3) throw error;
            await sleep(3000);
            continue;
          }
          if (!isCurrent()) return;
          const results = getSubjectTaskResults(t);
          if (Array.isArray(results)) {
            for (const item of results) {
              const sid = item.subject_id || item.id;
              if (!sid || !allowedIds.has(sid) || processedIds.has(sid)) continue;
              const { rawUrl: imgUrl } = extractSubjectImageResult(item);
              const errMsg = getSubjectGenerationErrorMessage(item, '');
              if (imgUrl) {
                processedIds.add(sid);
                const fullUrl = normalizeImageUrl(imgUrl);
                targetSetter(prev => !isCurrent() ? prev : prev.map(s => s.id === sid
                  && !s.imageUrl && task.primaryVersions?.[sid] != null
                  && canApplyAutomaticPrimary(projectId, sid, task.primaryVersions[sid]) ? { ...s, imageUrl: fullUrl } : s));
                appendBatchGeneratedImage(sid, fullUrl, getGeneratedSubjectImageId(item), getGeneratedSubjectReferenceImages(item));
                setSubjectDetailRefreshToken(prev => isCurrent() ? prev + 1 : prev);
              } else if (errMsg) {
                processedIds.add(sid);
              }
            }
          }
          if (isSubjectTaskTerminal(t)) {
            if (expectedIds.every(id => processedIds.has(id))) {
              removePendingTask(projectId, task.taskId, ownerId);
              break;
            }
            if (++incompleteReads >= 5) throw new Error('原任务已结束，但部分主体结果尚未返回');
          }
          await sleep(3000);
        }
      } catch (err) {
        if (!isCurrent()) return;
        console.error('[SubjectPage] 恢复批量任务失败:', task.taskId, err);
        showGlobalToast('批量生成结果暂时无法确认，任务记录已保留，请稍后重新进入主体页恢复，请勿重复提交', 'error');
      } finally {
        if (isCurrent()) {
          active.delete(task.taskId);
          batchRecoveryRef.current.delete(task.taskId);
          const remainingIds = new Set([...active.values()].flatMap(t => t.subjectIds || []));
          setBatchLoadingSubjects(prev => {
            if (!isCurrent()) return prev;
            const next = { ...prev };
            (task.subjectIds || []).forEach(id => { if (!remainingIds.has(id) && !singleIds.has(id)) delete next[id]; });
            return next;
          });
          if (![...active.values()].some(t => t.tab === task.tab)) {
            setBatchGeneratingByTab(prev => { if (!isCurrent()) return prev; const next = { ...prev }; delete next[task.tab]; return next; });
          }
        }
      }
    })(); });
    return () => { cancelled = true; batchRecoveryRef.current = new Set(); };
  // setChars/setScenes/setProps 是受控与非受控数据的适配包装器，任务恢复只应在项目切换时启动，不能因包装器重建重复轮询。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, ownerId]);

  // ── 恢复跨刷新挂起的单主体生成任务（subject-single 类型）────────────────────
  useEffect(() => {
    if (!projectId) return;
    let pending;
    try { pending = getPendingTasks(projectId, ''); }
    catch (error) { showGlobalToast(error.message, 'error'); return; }
    const singleTasks = pending.filter(t => t.type === 'subject-single' && t.subjectId && t.taskId && belongsToSubjectOwner(t, projectId, ownerId));
    if (singleTasks.length === 0) return;
    let cancelled = false;
    const session = getAuthSessionGeneration();
    const isCurrent = () => !cancelled && !!getToken() && session === getAuthSessionGeneration();

    const processedIds = new Set();
    const failures = new Map();
    const startedAt = Date.now();
    const loadingMap = {};
    singleTasks.forEach(t => { loadingMap[t.subjectId] = true; });
    // 跨刷新恢复单主体任务时，先恢复卡片 loading 状态，再启动轮询。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBatchLoadingSubjects(prev => ({ ...loadingMap, ...prev }));

    (async () => {
      let allDone = false;
      try {
        while (!allDone && isCurrent()) {
          allDone = true;
          await Promise.all(singleTasks.map(async (task) => {
            if (processedIds.has(task.taskId)) return;
            const pause = () => {
              processedIds.add(task.taskId);
              setBatchLoadingSubjects(prev => { if (!isCurrent()) return prev; const next = { ...prev }; delete next[task.subjectId]; return next; });
              showGlobalToast('生成结果暂时无法确认，任务记录已保留，请稍后重新进入主体页恢复', 'error');
            };
            if (Date.now() - startedAt > PENDING_GEN_STALE_MS) { pause(); return; }
            try {
              const t = await apiGetTask(task.taskId);
              if (!isCurrent()) return;
              // 查找当前主体对应的结果
              const item = getSubjectTaskResult(t, task.subjectId);
              if (item) {
                const { rawUrl: imgUrl } = extractSubjectImageResult(item);
                const errMsg = getSubjectGenerationErrorMessage(item, '');
                if (imgUrl) {
                  processedIds.add(task.taskId);
                  const fullUrl = normalizeImageUrl(imgUrl);
                  const targetSetter = getPendingGenTabSetter(task.tab, { setChars, setScenes, setProps });
                  targetSetter(prev => !isCurrent() ? prev : prev.map(s => s.id === task.subjectId && !s.imageUrl && canApplyAutomaticPrimary(projectId, task.subjectId, task.primaryVersion) ? { ...s, imageUrl: fullUrl } : s));
                  setBatchLoadingSubjects(prev => { if (!isCurrent()) return prev; const n = { ...prev }; delete n[task.subjectId]; return n; });
                  setSubjectDetailRefreshToken(prev => isCurrent() ? prev + 1 : prev);
                  // 同步写入缓存供 EditSubjectPanel 读取
                  appendBatchGeneratedImage(task.subjectId, fullUrl, getGeneratedSubjectImageId(item), getGeneratedSubjectReferenceImages(item));
                  // 清理旧 pendingGenerations 路径的 pending 状态，避免残留 loading
                  if (pendingGenerations.get(task.subjectId)?.placeholderId === task.placeholderId) pendingGenerations.delete(task.subjectId);
                  if (!pendingGenerations.hasStorageError()) removePendingTask(projectId, task.taskId, ownerId);
                } else if (errMsg) {
                  processedIds.add(task.taskId);
                  setBatchLoadingSubjects(prev => { if (!isCurrent()) return prev; const n = { ...prev }; delete n[task.subjectId]; return n; });
                  if (pendingGenerations.get(task.subjectId)?.placeholderId === task.placeholderId) pendingGenerations.delete(task.subjectId);
                  if (!pendingGenerations.hasStorageError()) removePendingTask(projectId, task.taskId, ownerId);
                }
              }
              if (processedIds.has(task.taskId)) return;
              if (isSubjectTaskTerminal(t)) {
                // 任务已结束但无对应结果，尝试从主体详情恢复
                const detail = await apiGetSubjectDetail(projectId, task.subjectId);
                if (!isCurrent()) return;
                const pendingInfo = pendingGenerations.get(task.subjectId);
                if (!pendingInfo || pendingInfo.placeholderId !== task.placeholderId) throw new Error('缺少对应任务的结果识别记录');
                const recovered = detail ? findPendingSubjectImage(detail, pendingInfo) : null;
                if (recovered) {
                  const { rawUrl: recoveredUrl } = extractSubjectImageResult(recovered);
                  if (!recoveredUrl) throw new Error('任务结果缺少图片地址');
                  processedIds.add(task.taskId);
                  if (recoveredUrl) {
                    const fullUrl = normalizeImageUrl(recoveredUrl);
                    appendBatchGeneratedImage(task.subjectId, fullUrl, getGeneratedSubjectImageId(recovered), getGeneratedSubjectReferenceImages(recovered));
                    setSubjectDetailRefreshToken(prev => isCurrent() ? prev + 1 : prev);
                    const targetSetter = getPendingGenTabSetter(task.tab, { setChars, setScenes, setProps });
                    targetSetter(prev => !isCurrent() ? prev : prev.map(s => s.id === task.subjectId && !s.imageUrl && canApplyAutomaticPrimary(projectId, task.subjectId, task.primaryVersion) ? { ...s, imageUrl: fullUrl } : s));
                  }
                } else {
                  throw new Error('任务已结束，结果暂未同步');
                }
                setBatchLoadingSubjects(prev => { if (!isCurrent()) return prev; const n = { ...prev }; delete n[task.subjectId]; return n; });
                if (pendingGenerations.get(task.subjectId)?.placeholderId === task.placeholderId) pendingGenerations.delete(task.subjectId);
                if (!pendingGenerations.hasStorageError()) removePendingTask(projectId, task.taskId, ownerId);
              } else {
                allDone = false;
              }
              failures.delete(task.taskId);
            } catch (err) {
              if (!isCurrent()) return;
              console.error('[SubjectPage] 恢复单主体任务失败:', task.subjectId, err);
              const count = (failures.get(task.taskId) || 0) + 1;
              failures.set(task.taskId, count);
              if (count >= 3) pause();
              else allDone = false;
            }
          }));
          if (!allDone) await new Promise(r => setTimeout(r, 3000));
        }
      } catch (err) {
        console.error('[SubjectPage] 恢复单主体任务循环异常:', err);
      }
    })();
    return () => { cancelled = true; };
  // setChars/setScenes/setProps 是受控与非受控数据的适配包装器，任务恢复只应在项目切换时启动，不能因包装器重建重复轮询。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, ownerId, pendingGenerations]);

  // ── 恢复单主体 pending generations 的 loading 状态 ──────────────────────────
  useEffect(() => {
    const loadingMap = {};
    // 已被 subject-single 任务覆盖的 subjectId（避免与 taskPersistence 路径重复轮询）
    const taskCoveredIds = new Set();
    try {
      const taskPending = getPendingTasks(projectId, "");
      taskPending.filter(t => t.type === "subject-single" && t.subjectId && belongsToSubjectOwner(t, projectId, ownerId)).forEach(t => taskCoveredIds.add(t.subjectId));
    } catch (error) {
      showGlobalToast(error.message, 'error');
      return;
    }
    
    for (const [subjectId, info] of pendingGenerations) {
      if (info?.status === 'pending') {
        if (taskCoveredIds.has(subjectId)) {
          // 该主体已有任务模式恢复在跑，本路径跳过避免双轨轮询
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
    const session = getAuthSessionGeneration();
    const isCurrent = () => !cancelled && singleGenRecoveryRunRef.current === runId
      && !!getToken() && session === getAuthSessionGeneration();
    const paused = new Set();
    const failures = new Map();
    const eligible = (subjectId, info) => info?.status === 'pending'
      && !taskCoveredIds.has(subjectId) && !paused.has(subjectId);
    const pause = (subjectId) => {
      paused.add(subjectId);
      setBatchLoadingSubjects(prev => { if (!isCurrent()) return prev; const next = { ...prev }; delete next[subjectId]; return next; });
      showGlobalToast('生成结果暂时无法确认，任务记录已保留，请稍后重新进入主体页恢复', 'error');
    };

    const pollPendingGenerations = async () => {
      while (isCurrent()) {
        const activeEntries = Array.from(pendingGenerations.entries()).filter(([id, info]) => eligible(id, info));
        if (activeEntries.length === 0) break;

        await Promise.all(activeEntries.map(async ([subjectId, info]) => {
          if (!info) return;

          if (Date.now() - runId > PENDING_GEN_STALE_MS) {
            pause(subjectId);
            return;
          }

          try {
            const detailRes = await apiGetSubjectDetail(projectId, subjectId);
            if (!isCurrent() || pendingGenerations.get(subjectId) !== info) return;
            failures.delete(subjectId);

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
            targetSetter((prev) => !isCurrent() ? prev : prev.map((item) => {
              if (item.id !== subjectId || item.imageUrl || !rawUrl || !canApplyAutomaticPrimary(projectId, subjectId, info.primaryVersion)) return item;
              return { ...item, imageUrl: normalizeImageUrl(rawUrl) };
            }));

            setBatchLoadingSubjects((prev) => {
              if (!isCurrent()) return prev;
              const next = { ...prev };
              delete next[subjectId];
              return next;
            });
            setSubjectDetailRefreshToken((prev) => isCurrent() ? prev + 1 : prev);
          } catch (err) {
            if (!isCurrent() || pendingGenerations.get(subjectId) !== info) return;
            console.error('[SubjectPage] 恢复单主体生成失败:', subjectId, err);
            const count = (failures.get(subjectId) || 0) + 1;
            failures.set(subjectId, count);
            if (count >= 3) pause(subjectId);
          }
        }));

        const stillPending = Array.from(pendingGenerations.entries()).some(([id, info]) => eligible(id, info));
        if (!stillPending) break;
        await sleep(PENDING_GEN_POLL_MS);
      }
    };

    pollPendingGenerations();

    return () => {
      cancelled = true;
    };
  // setter 随受控 props 重建；恢复仅随项目或账号归属改变重新启动。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, ownerId, pendingGenerations]);



  function showBatchToast(msg, type = 'success') {
    showGlobalToast(msg, type);
  }

  const handleBatchGenerate = async (params) => {
    if (!projectId || !ownerId || !getToken()) {
      showBatchToast('登录信息尚未就绪，请稍后重试', 'error');
      return;
    }

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
    let pendingTasks;
    try {
      assertPendingTaskStorageReady(projectId, ownerId);
      pendingTasks = getPendingTasks(projectId, '');
    }
    catch (error) { showBatchToast(error.message, 'error'); return; }
    if (batchAbortRef.current || batchRecoveryRef.current.size > 0 || Object.keys(batchLoadingSubjects).length > 0
      || pendingTasks.some(t => t.type === 'batch-subject' && belongsToSubjectOwner(t, projectId, ownerId))) {
      showBatchToast('已有生成任务尚未确认，请稍后重新进入主体页恢复，请勿重复提交', 'error');
      return;
    }

    // 关闭弹窗
    setBatchGenOpen(false);

    // 保存当前 tab 引用（stream 期间 tab 不会变）
    const captureTab = activeTab;
    const primaryVersions = Object.fromEntries(subjectIds.map(id => [id, getPrimaryVersion(projectId, id)]));
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
    const batchSession = getAuthSessionGeneration();
    const batchScope = batchScopeRef.current;
    batchAbortRef.current = controller;
    const isCurrent = () => !!batchScope && batchScopeRef.current === batchScope
      && !controller.signal.aborted
      && !!getToken() && batchSession === getAuthSessionGeneration();
    const processedIds = new Set();
    const allowedIds = new Set(subjectIds);
    const expectedSubjectIds = Object.keys(loadingMap);
    const hasAllResults = () => expectedSubjectIds.every(id => processedIds.has(id));
    let batchTaskId = null;
    let completed = false;

    // 统计成功/失败数
    let successCount = 0;
    let failCount = 0;

    try {
      const callbacks = {
        signal: controller.signal,
        onTaskCreated: (taskId) => {
          batchTaskId = taskId;
          addPendingTask(projectId, { taskId, shotId: '', episodeId: '', type: 'batch-subject', tab: captureTab, subjectIds, expectedSubjectIds, ownerId, primaryVersions });
        },
        onSubjectImage: (subjectId, imageUrl, result) => {
          if (!isCurrent() || !allowedIds.has(subjectId) || processedIds.has(subjectId)) return;
          processedIds.add(subjectId);
          successCount++;
          const fullUrl = normalizeImageUrl(imageUrl);
          // 更新对应 tab 的主体封面
          targetSetter(prev => !isCurrent() ? prev : prev.map(s =>
            s.id === subjectId && canApplyAutomaticPrimary(projectId, subjectId, primaryVersions[subjectId]) ? { ...s, imageUrl: fullUrl } : s
          ));
          // 该主体退出 loading
          setBatchLoadingSubjects(prev => {
            if (!isCurrent()) return prev;
            const next = { ...prev };
            delete next[subjectId];
            return next;
          });
          // 存入批量生成缓存，EditSubjectPanel 打开时优先从缓存读取
          // 结果里的 id 通常是主体 ID（用于 sid 解析），不能当作候选图 ID。
          const imageId = getGeneratedSubjectImageId(result);
          appendBatchGeneratedImage(subjectId, fullUrl, imageId, getGeneratedSubjectReferenceImages(result));
        },
        onSubjectError: (subjectId, errorMsg) => {
          if (!isCurrent() || !allowedIds.has(subjectId) || processedIds.has(subjectId)) return;
          processedIds.add(subjectId);
          // 命中静默错误（如「已有主图，跳过生成」）：仅退出 loading，不弹 toast、不计入失败
          if (isSilentBatchError(errorMsg)) {
            setBatchLoadingSubjects(prev => {
              if (!isCurrent()) return prev;
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
            if (!isCurrent()) return prev;
            const next = { ...prev };
            delete next[subjectId];
            return next;
          });
        },
        onComplete: () => {
          if (isCurrent()) completed = true;
        },
      };
      await apiBatchGenerateStream(projectId, { model: params.model, ratio: params.ratio, resolution: params.resolution, generation_mode: params.mode, only_undrafted: params.only_undrafted, subject_ids: subjectIds }, callbacks);
      if (!isCurrent()) return;
      // 完成通知不等于逐项结果完整；只按原任务补读，不重新提交生成。
      for (let attempt = 0; completed && !hasAllResults() && batchTaskId && attempt < 5; attempt++) {
        if (attempt > 0) await sleep(3000);
        if (!isCurrent()) return;
        const task = await apiGetTask(batchTaskId);
        if (!isCurrent()) return;
        for (const item of getSubjectTaskResults(task)) {
          const sid = item.subject_id || item.id;
          const { rawUrl } = extractSubjectImageResult(item);
          const error = getSubjectGenerationErrorMessage(item, '');
          if (rawUrl) callbacks.onSubjectImage(sid, rawUrl, item);
          else if (error) callbacks.onSubjectError(sid, error);
        }
      }
      if (!completed || !hasAllResults()) {
        showBatchToast(batchTaskId
          ? '批量结果尚未完整返回，原任务已保留；请稍后重新进入主体页补查，请勿重复提交'
          : '批量结果不完整且未返回任务编号，无法补查；请先确认服务端结果，勿直接重新生成', 'error');
        return;
      }
      if (batchTaskId) removePendingTask(projectId, batchTaskId, ownerId);
      if (successCount > 0) {
        showBatchToast(successCount === targetCount
          ? '批量生成全部完成'
          : `批量生成完成（成功 ${successCount}，失败 ${failCount}）`, 'success');
      } else if (failCount > 0) {
        showBatchToast('批量生成失败，可能是调用服务商模型失败了，请换个模型再试下', 'error');
      } else {
        showBatchToast('本批次无需生成，已跳过已有定稿图的主体', 'success');
      }
    } catch (err) {
      // 忽略用户主动取消的错误
      if (err?.name === 'AbortError' || !isCurrent()) return;

      console.error('[SubjectPage] 批量生成流失败:', err);
      // 网络断开或整体请求失败 — toast 后统一恢复
      const errMsg = err?.isNetworkError
        ? '网络连接失败，请检查网络后重试'
        : (err?.message || '批量生成失败，请重试');
      showBatchToast(errMsg, 'error');

      // 受控列表必须由父页面同时刷新列表与分页，不能用独立批次覆盖共享列表。
      try {
        if (hasExternalChars && hasExternalScenes && hasExternalProps) {
          await onRefreshSubjects?.(projectId, batchSession);
        } else {
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
        if (!isCurrent()) return;
        if (!hasExternalChars) setChars(normalizeSubjectList(newChars));
        if (!hasExternalScenes) setScenes(normalizeSubjectList(newScenes));
        if (!hasExternalProps) setProps(normalizeSubjectList(newProps));
        }
      } catch (refetchErr) {
        console.error('[SubjectPage] 失败后刷新主体数据也失败:', refetchErr);
      }

      // 整体失败时，所有卡片的 loading 都会由于 finally 清除而消失，
      // 封面自然恢复为之前的图片（因为我们没有修改过 imageUrl）
    } finally {
      if (isCurrent()) {
        setBatchLoadingSubjects(prev => {
          if (batchScopeRef.current !== batchScope) return prev;
          const next = { ...prev };
          Object.keys(loadingMap).forEach(id => { delete next[id]; });
          return next;
        });
        setBatchGeneratingByTab(prev => {
          if (batchScopeRef.current !== batchScope) return prev;
          const next = { ...prev }; delete next[captureTab]; return next;
        });
        batchAbortRef.current = null;
      }
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
  certificationCharactersRef.current = chars;
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
  const [charVoiceNames, setCharVoiceNames] = useState({});
  const voiceOperationsRef = useRef(new Map());
  const voiceOwnerRef = useRef(null);
  useEffect(() => {
    const owner = { projectId, session: getAuthSessionGeneration() };
    const operations = voiceOperationsRef.current; voiceOwnerRef.current = owner;
    return () => { voiceOwnerRef.current = null; operations.clear(); };
  }, [projectId]);
  const beginVoiceOperation = (subjectId) => {
    const owner = voiceOwnerRef.current;
    if (!owner || owner.projectId !== projectId || !getToken()
      || owner.session !== getAuthSessionGeneration()) return null;
    if (voiceOperationsRef.current.has(subjectId)) {
      showBatchToast('该主体音色正在保存，请稍候', 'error');
      return null;
    }
    const operation = {};
    voiceOperationsRef.current.set(subjectId, operation);
    return {
      isCurrent: () => voiceOwnerRef.current === owner && !!getToken()
        && owner.session === getAuthSessionGeneration(),
      finish: () => {
        if (voiceOperationsRef.current.get(subjectId) === operation) voiceOperationsRef.current.delete(subjectId);
      },
    };
  };

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

  // 从后端数据同步 voice_id 到本地 charVoices。
  // null 也是后端的有效状态，不能因为“没有值”而保留已经失效的旧音色。
  useEffect(() => {
    if (!externalChars || externalChars.length === 0) return;
    // 外部主体数据到达后以服务端绑定为准，避免刷新后从旧的本地映射恢复音色。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCharVoices((prev) => {
      const next = { ...prev };
      let changed = false;
      externalChars.forEach((c) => {
        if (!Object.prototype.hasOwnProperty.call(c, 'voice_id')) return;
        const serverVoiceId = c.voice_id ?? null;
        if (prev[c.id] !== serverVoiceId) {
          next[c.id] = serverVoiceId;
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
      if (!hasExternalChars && Array.isArray(data)) {
        setChars(normalizeSubjectList(data));
      }
    }));

    // 订阅场景缓存
    unsubscribers.push(subscribe(K.subjects(projectId, 'scene'), (data) => {
      if (!hasExternalScenes && Array.isArray(data)) {
        setScenes(normalizeSubjectList(data));
      }
    }));

    // 订阅道具缓存
    unsubscribers.push(subscribe(K.subjects(projectId, 'prop'), (data) => {
      if (!hasExternalProps && Array.isArray(data)) {
        setProps(normalizeSubjectList(data));
      }
    }));

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  // 缓存订阅回调使用受控/非受控适配 setter；订阅生命周期只随项目切换变化。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, hasExternalChars, hasExternalScenes, hasExternalProps]);

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
    const feedback = startDownloadFeedback();
    try {
      const subjectSources = [
        { list: chars, type: 'character' },
        { list: scenes, type: 'scene' },
        { list: props, type: 'prop' },
      ];
      const subjectEntry = subjectSources
        .map(({ list, type }) => ({ subject: list.find((item) => String(item.id) === String(subjectId)), type }))
        .find(({ subject }) => subject);

      // 获取主体图片列表，找到主图
      const imgRes = await apiGetSubjectImages(projectId, subjectId);
      const imgs = Array.isArray(imgRes) ? imgRes : (imgRes?.images || imgRes?.items || []);
      const primaryImg = imgs.find((img) => img.is_primary);
      const targetImg = primaryImg || imgs[0];
      if (!targetImg?.id) {
        console.warn('[SubjectPage] 没有可下载的图片');
        await feedback.fail('暂无可下载的主体图片', 'warning');
        return;
      }
      // 调用下载 API
      const blob = await apiDownloadSubjectImage(projectId, subjectId, targetImg.id, { onProgress: feedback.setProgress });
      downloadBlob(blob, getSubjectDownloadName(projectName, subjectEntry?.subject, subjectEntry?.type));
      await feedback.complete('下载成功');
    } catch (err) {
      console.error('[SubjectPage] 下载图片失败:', err);
      await feedback.fail('下载失败，请重试');
    }
  };

  // ── 删除主体 ──────────────────────────────────────────────────
  const handleDeleteSubject = async (subjectId) => {
    try {
      const subjectType = chars.some((subject) => String(subject.id) === String(subjectId))
        ? 'character'
        : scenes.some((subject) => String(subject.id) === String(subjectId))
          ? 'scene'
          : props.some((subject) => String(subject.id) === String(subjectId))
            ? 'prop'
            : undefined;
      // 参考图只是 B 对图片的引用，不属于 B 的候选图资产。
      // 先读取参考图快照并传给资产清理函数排除，避免删除 B 时误删被 A 使用的原图。
      const subjectDetail = await apiGetSubjectDetail(projectId, subjectId).catch(() => null);
      if (!subjectDetail) {
        throw new Error('无法读取主体详情，已中止删除，避免误删参考图资产');
      }
      const referenceImages = getSubjectReferenceImagesFromResponse(subjectDetail);
      const { ids: referenceAssetIds, urls: referenceAssetUrls } = getSubjectReferenceImageIdentities(referenceImages);
      if (referenceAssetIds.length > 0 || referenceAssetUrls.length > 0) {
        // 参考图是可复用资产，删除主体前只解除 B 的引用关系，不删除资产本体。
        // 解绑失败时直接中止后续删除，避免主体删除接口级联误删参考图。
        await apiBindSubjectReferenceImages(projectId, subjectId, {
          asset_ids: [],
          primary_asset_id: null,
        });
      }
      const deletedAssetResult = await apiDeleteSubjectAssets(projectId, subjectId, {
        excludedAssetIds: referenceAssetIds,
        excludedAssetUrls: referenceAssetUrls,
        subjectType,
      });
      // 主体与项目资产属于同一条数据链：清理候选资产后再删除主体记录。
      await apiDeleteSubject(projectId, subjectId);
      const assetIds = [
        ...(deletedAssetResult?.ownedIds || []),
        ...(deletedAssetResult?.creationIds || []),
      ];
      const deletionDetail = { projectId, subjectId, subjectType, assetIds };
      window.dispatchEvent(new CustomEvent('subject:deleted', { detail: deletionDetail }));
      // Home 负责跨页面共享主体列表，沿用现有事件让它重新拉取对应分类。
      window.dispatchEvent(new CustomEvent('project-assets:deleted', { detail: deletionDetail }));
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

  const handleRemoveSubjectVoice = async (subject) => {
    if (!subject?.id) return;
    const subjectId = subject.id;
    const previousVoiceId = charVoices[subjectId] ?? subject.voice_id ?? null;
    if (!previousVoiceId) return;

    const operation = beginVoiceOperation(subjectId);
    if (!operation) return;

    try {
      const updateResult = await apiUpdateSubject(projectId, subjectId, { voice_id: null });
      if (!operation.isCurrent()) return;
      const updatedSubject = updateResult?.subject
        || updateResult?.data?.subject
        || updateResult?.result?.subject
        || updateResult?.data
        || updateResult?.result
        || updateResult;

      // PATCH 返回 2xx 后，接口响应或后续查询任一处确认 voice_id=null 即视为成功。
      // 部分后端部署会先返回旧主体，不能仅凭 PATCH 响应里的旧 voice_id 立即回滚。
      const hasVoiceField = (value) => Object.prototype.hasOwnProperty.call(value || {}, 'voice_id');
      let persisted = hasVoiceField(updatedSubject) && updatedSubject.voice_id == null;
      let latestSubject = updatedSubject;

      if (!persisted) {
        // 给写入传播留出时间，主体详情比列表更适合作为单主体解绑状态的确认来源。
        const retryDelays = [300, 700, 1200, 2000];
        for (const delay of retryDelays) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          if (!operation.isCurrent()) return;
          const detail = await apiGetSubjectDetail(projectId, subjectId).catch(() => null);
          if (!operation.isCurrent()) return;
          const detailSubject = detail?.subject || detail?.data?.subject || detail?.data || detail;
          if (hasVoiceField(detailSubject)) {
            latestSubject = detailSubject;
            if (detailSubject.voice_id == null) {
              persisted = true;
              break;
            }
          }

          const latestChars = await apiGetSubjects(projectId, { type: 'character', limit: 200 });
          if (!operation.isCurrent()) return;
          const listSubject = latestChars.find((character) => character.id === subjectId) || null;
          if (listSubject) latestSubject = listSubject;
          if (hasVoiceField(listSubject) && listSubject.voice_id == null) {
            persisted = true;
            break;
          }
        }
      }

      if (!persisted) {
        throw new Error(latestSubject?.voice_id ? '音色取消未保存成功，请稍后重试' : '暂未确认音色取消结果，请稍后重试');
      }
      setCharVoices((prev) => operation.isCurrent() ? { ...prev, [subjectId]: null } : prev);
      setCharVoiceNames((prev) => operation.isCurrent() ? { ...prev, [subjectId]: null } : prev);
      setChars((prev) => operation.isCurrent() ? prev.map((character) => character.id === subjectId
        ? { ...character, voice_id: null, voice_name: null, voice_preview_url: null }
        : character) : prev);
      showBatchToast('音色已取消', 'success');
    } catch (err) {
      if (!operation.isCurrent()) return;
      console.error('[SubjectPage] 取消主体音色失败:', err);
      showBatchToast(err?.message || '取消音色失败，请重试', 'error');
    } finally {
      operation.finish();
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
  const showDataLoading = subjectsLoading && allEmpty && !showLoading;
  const showError = !!extractError && !subjectsLoading && allEmpty;

  if (showLoading) {
    return <SubjectExtractionLoading message={subjectExtractionStatusMessage || SUBJECT_LOADING_TEXTS[loadingTextIndex]} />;
  }

  if (showDataLoading) {
    return <SubjectDataLoading />;
  }

  if (showError) {
    return <SubjectExtractionError
      loading={isExtracting}
      onRetry={() => {
        setIsRetryingExtraction(true);
        const retry = onRetryExtractSubjects || onExtractSubjects;
        Promise.resolve(retry?.()).finally(() => setIsRetryingExtraction(false));
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
      isSeedanceCertificationMode={isSeedanceCertificationMode}
      onEnterSeedanceCertification={() => setIsSeedanceCertificationMode(true)}
      onExitSeedanceCertification={() => setIsSeedanceCertificationMode(false)}
      onTabChange={(tab) => {
        setIsSeedanceCertificationMode(false);
        setActiveTab(tab);
        setSelectedChar(null);
        setSelectedScene(null);
        setSelectedProp(null);
      }}
      gridProps={{
        activeTab, chars, scenes, props, charVoices, charVoiceNames, voiceList, selectedChar, selectedScene, selectedProp,
        batchLoadingSubjects, charsLoadError, scenesLoadError, propsLoadError,
        onRetryChars, onRetryScenes, onRetryProps, onVoiceClick: setVoiceModalChar,
        onVoiceRemove: handleRemoveSubjectVoice,
        onSelect: (tab, item) => {
          if (tab === 'char') setSelectedChar(item);
          else if (tab === 'scene') setSelectedScene(item);
          else setSelectedProp(item);
        },
        onDownloadImage: handleDownloadSubjectImage, onDeleteSubject: handleDeleteSubject, onAdd: handleAdd,
        emptyIcons: SubjectEmptyIcons, sentinelRef: subjectSentinelRef,
        hasMore: (activeTab === 'char' && hasMoreChars) || (activeTab === 'scene' && hasMoreScenes) || (activeTab === 'prop' && hasMoreProps),
        certificationMode: isSeedanceCertificationMode,
        certificationBySubject,
        certificationGroups,
        onCertificationClick: handleCertificationGroupSelect,
        onCertificationCreateGroup: onGoToSeedanceLiveMaterials,
        showCertificationBanner,
        onCloseCertificationBanner: () => {
          setShowCertificationBanner(false);
          try {
            localStorage.setItem('miioo:subject:seedance-certification-banner-dismissed', 'true');
          } catch {
            // 本地缓存不可用时仍允许本次关闭。
          }
        },
      }}
    >
      {/* edit panel */}
      <SubjectEditorSlot
        EditorComponent={EditSubjectPanel}
        projectId={projectId}
        subject={selectedChar}
        ownerId={ownerId}
        isGenerationPageCurrent={isGenerationPageCurrent}
        tabLabel="角色"
        refreshToken={subjectDetailRefreshToken}
        setBatchLoadingSubjects={setBatchLoadingSubjects}
        isBatchLoading={!!batchLoadingSubjects[selectedChar?.id]}
        onClose={() => setSelectedChar(null)}
        onCommit={async (draft, fields, isCurrent) => {
          if (!selectedChar) return;
          const payload = {};
          if (fields.has('name')) payload.name = draft.name;
          if (fields.has('description')) payload.description = draft.description;
          if (fields.has('prompt')) payload.prompt = draft.prompt;
          if (fields.has('genConfig')) payload.gen_config = draft.genConfig;
          if (Object.keys(payload).length === 0) return;
          if (!isCurrent()) return;
          await apiUpdateSubject(projectId, selectedChar.id, payload);
          if (!isCurrent()) return;
          const patch = { ...payload };
          if (fields.has('description')) { patch.desc = payload.description; delete patch.description; }
          setChars((prev) => isCurrent() ? prev.map((c) => c.id === selectedChar.id ? { ...c, ...patch } : c) : prev);
          setSelectedChar((prev) => isCurrent() && prev?.id === selectedChar.id ? { ...prev, ...patch } : prev);
        }}
        onCoverChange={(imageUrl, { persist = false, primaryVersion = 0 } = {}) => {
          if (!selectedChar) return;
          if (persist && !canApplyAutomaticPrimary(projectId, selectedChar.id, primaryVersion)) return;
          const fullUrl = normalizeImageUrl(imageUrl);
          setChars((prev) => prev.map((c) => c.id === selectedChar.id ? { ...c, imageUrl: fullUrl } : c));
          if (persist && imageUrl) return saveAutomaticPrimary(projectId, selectedChar.id, primaryVersion, () => apiUpdateSubject(projectId, selectedChar.id, { image_url: imageUrl }))
            .catch(() => showBatchToast('自动封面保存失败，请重新设置定稿图', 'error'));
        }}
      />
      <SubjectEditorSlot
        EditorComponent={EditSubjectPanel}
        projectId={projectId}
        subject={selectedScene}
        ownerId={ownerId}
        isGenerationPageCurrent={isGenerationPageCurrent}
        tabLabel="场景"
        refreshToken={subjectDetailRefreshToken}
        setBatchLoadingSubjects={setBatchLoadingSubjects}
        isBatchLoading={!!batchLoadingSubjects[selectedScene?.id]}
        onClose={() => setSelectedScene(null)}
        onCommit={async (draft, fields, isCurrent) => {
          if (!selectedScene) return;
          const payload = {};
          if (fields.has('name')) payload.name = draft.name;
          if (fields.has('description')) payload.description = draft.description;
          if (fields.has('prompt')) payload.prompt = draft.prompt;
          if (fields.has('genConfig')) payload.gen_config = draft.genConfig;
          if (Object.keys(payload).length === 0) return;
          if (!isCurrent()) return;
          await apiUpdateSubject(projectId, selectedScene.id, payload);
          if (!isCurrent()) return;
          const patch = { ...payload };
          if (fields.has('description')) { patch.desc = payload.description; delete patch.description; }
          setScenes((prev) => isCurrent() ? prev.map((s) => s.id === selectedScene.id ? { ...s, ...patch } : s) : prev);
          setSelectedScene((prev) => isCurrent() && prev?.id === selectedScene.id ? { ...prev, ...patch } : prev);
        }}
        onCoverChange={(imageUrl, { persist = false, primaryVersion = 0 } = {}) => {
          if (!selectedScene) return;
          if (persist && !canApplyAutomaticPrimary(projectId, selectedScene.id, primaryVersion)) return;
          const fullUrl = normalizeImageUrl(imageUrl);
          setScenes((prev) => prev.map((s) => s.id === selectedScene.id ? { ...s, imageUrl: fullUrl } : s));
          if (persist && imageUrl) return saveAutomaticPrimary(projectId, selectedScene.id, primaryVersion, () => apiUpdateSubject(projectId, selectedScene.id, { image_url: imageUrl }))
            .catch(() => showBatchToast('自动封面保存失败，请重新设置定稿图', 'error'));
        }}
      />
      <SubjectEditorSlot
        EditorComponent={EditSubjectPanel}
        projectId={projectId}
        subject={selectedProp}
        ownerId={ownerId}
        isGenerationPageCurrent={isGenerationPageCurrent}
        tabLabel="道具"
        refreshToken={subjectDetailRefreshToken}
        setBatchLoadingSubjects={setBatchLoadingSubjects}
        isBatchLoading={!!batchLoadingSubjects[selectedProp?.id]}
        onClose={() => setSelectedProp(null)}
        onCommit={async (draft, fields, isCurrent) => {
          if (!selectedProp) return;
          const payload = {};
          if (fields.has('name')) payload.name = draft.name;
          if (fields.has('description')) payload.description = draft.description;
          if (fields.has('prompt')) payload.prompt = draft.prompt;
          if (fields.has('genConfig')) payload.gen_config = draft.genConfig;
          if (Object.keys(payload).length === 0) return;
          if (!isCurrent()) return;
          await apiUpdateSubject(projectId, selectedProp.id, payload);
          if (!isCurrent()) return;
          const patch = { ...payload };
          if (fields.has('description')) { patch.desc = payload.description; delete patch.description; }
          setProps((prev) => isCurrent() ? prev.map((p) => p.id === selectedProp.id ? { ...p, ...patch } : p) : prev);
          setSelectedProp((prev) => isCurrent() && prev?.id === selectedProp.id ? { ...prev, ...patch } : prev);
        }}
        onCoverChange={(imageUrl, { persist = false, primaryVersion = 0 } = {}) => {
          if (!selectedProp) return;
          if (persist && !canApplyAutomaticPrimary(projectId, selectedProp.id, primaryVersion)) return;
          const fullUrl = normalizeImageUrl(imageUrl);
          setProps((prev) => prev.map((p) => p.id === selectedProp.id ? { ...p, imageUrl: fullUrl } : p));
          if (persist && imageUrl) return saveAutomaticPrimary(projectId, selectedProp.id, primaryVersion, () => apiUpdateSubject(projectId, selectedProp.id, { image_url: imageUrl }))
            .catch(() => showBatchToast('自动封面保存失败，请重新设置定稿图', 'error'));
        }}
      />

      {/* voice select modal */}
      {voiceModalChar && (
        <DubbingVoiceModal
          open
          currentVoice={charVoices[voiceModalChar.id]}
          onClose={() => setVoiceModalChar(null)}
          showToast={(type, message) => showBatchToast(message, type)}
          onConfirm={async (voiceId, voiceName, _activeTab, _source, selectedVoice) => {
            const normalizedVoiceId = voiceId || null;
            const subjectId = voiceModalChar.id;
            const operation = beginVoiceOperation(subjectId);
            if (!operation) return false;
            try {
              await apiUpdateSubject(projectId, subjectId, { voice_id: normalizedVoiceId });
              if (!operation.isCurrent()) return false;
              setCharVoices((prev) => operation.isCurrent() ? { ...prev, [subjectId]: normalizedVoiceId } : prev);
              setCharVoiceNames((prev) => operation.isCurrent() ? { ...prev, [subjectId]: voiceName || normalizedVoiceId } : prev);
              // 同步更新本地角色卡片，避免保存后等待主体列表刷新。
              setChars((prev) => operation.isCurrent() ? prev.map((c) => c.id === subjectId
                ? { ...c, voice_id: normalizedVoiceId, voice_name: voiceName ?? null, voice_preview_url: selectedVoice?.audioUrl ?? null }
                : c) : prev);
              setVoiceModalChar((prev) => operation.isCurrent() && prev === voiceModalChar ? null : prev);
              showBatchToast('音色保存成功', 'success');
              return true;
            } catch (err) {
              if (!operation.isCurrent()) return false;
              console.error('[SubjectPage] 更新主体音色失败:', err);
              showBatchToast(err?.message || '音色保存失败，请重试', 'error');
              return false;
            } finally {
              operation.finish();
            }
          }}
        />
      )}

      <BatchGenerateModal
        open={batchGenOpen}
        onClose={() => setBatchGenOpen(false)}
        onConfirm={handleBatchGenerate}
        generating={!!batchGeneratingByTab[activeTab]}
        activeTab={activeTab}
      />

      {confirmStoryboardOpen && (
        <ConfirmStoryboardModal
          onConfirm={async () => {
            setConfirmStoryboardOpen(false);
            await onRegenerateStoryboard?.();
          }}
          onCancel={() => setConfirmStoryboardOpen(false)}
        />
      )}


    </SubjectWorkspace>
  );
}
