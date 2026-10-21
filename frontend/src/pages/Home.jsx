/**
 * @file Home.jsx
 * @structure-update：2026-10-21 正式项目入口由 UseCanvasProjects 编排（L301）；账号变化同步重置创作 Store（L399），认证与恢复编排仍保留首页。
 * @structure-index：2026-10-21 readProjects L317；详情读取 L573；主体抽取 L1225；智能分镜 L1491；重新分镜 L1720；恢复 L1739。
 *   2026-10-19：缓存无分页元信息，仅作为刷新信号；解锁探测绕过缓存，页面保留认证、缓存与请求编排，不因规模移动副作用。
 *   2026-10-12：登录用户确认后恢复已受理的视频编辑任务；保留认证与恢复的页面编排边界。
 *   2026-10-13：公告提醒 L2178 主动查看全部进入消息中心系统页签；按用户隔离已读状态。
 *   2026-10-14：画布内部切换路由；仅增加导航接线，认证、缓存和任务恢复仍保留页面编排。
 *   2026-10-14：项目保存队列 L266；按项目隔离保存回写，页面继续保留请求编排。
 * ─── 全局常量 & 配置 ───────────────────────────────────────────────
 *   页面业务模块懒加载                                          L145–L151
 *   NAV_ITEMS / BOTTOM_NAV_ITEMS                                  components/home/HomeNavigationConfig.jsx
 *   STEP_TABS / WorkflowStepTabs                                components/home/WorkflowStepTabs.jsx
 *   BG_VIDEOS                                                   components/home/HomeNavigationConfig.jsx
 *
 * ─── 原子 UI 组件 ────────────────────────────────────────────────
 *   HomeSloganText / StartCreationButton / HomeLogo / HomeBackground / HomeHeader components/home
 *   QRCodePopup / MoreOptionsMenu                                components/home/HomeBottomMenus.jsx
 *   CreationManualButton / LoginButton                          components/home/HomeHeaderActions.jsx
 *   WorkflowHeadbar / ApiConfigBubble / HomeNavigationRail      components/home/
 *
 * ─── 工具函数 ───────────────────────────────────────────────────
 *   normalizeSubjects(items) 主体列表标准化                      utils/subjectAdapter.js
 *   normalizeProjectList(data) 项目字段兼容与排序                 utils/projectAdapter.js
 *   buildEpisodeStatusMap(overview, episodes) 剧集完成状态适配     utils/episodeStatusAdapter.js
 *
 * ─── 主页面入口 ─────────────────────────────────────────────────
 *   2026-10-09 画布项目菜单返回自由画布列表，保留品牌图标返回首页；仅新增导航接线
 *   export default function Home()                               L257
 *     ├─ [懒加载] 页面业务模块按需加载                             L145–L151
 *     ├─ [状态] 页面导航、模态开关、登录/API 状态、项目及工作流数据   L258–L439
 *     ├─ [函数] showToast / handleVideoEnded / handleLogout          L440 / L497 / L508
 *     │           loadProjectDetails / handleUnlockStep / loadMoreSubjects L573 / L1135 / L1159
 *     │           handleExtractSubjects / handleGenerateStoryboards        L1225 / L1491
 *     │           handleScriptFinalized / handleNavChange / handleBottomNavChange / handleProjectCreated
 *                                                               L1787 / L1794 / L1832 / L1848
 *     ├─ [副作用] 项目 ID / 步骤 / 导航 / 解锁状态持久化                 L534 / L548 / L555 / L565
 *     │           微信回调与鉴权初始化                                   L871 / L935
 *     │           项目列表、主体缓存、强制登出订阅及待处理提取恢复         L1001 / L1014 / L1051 / L1478
 *     ├─ [底部导航配置] bottomNavItems                             L1816
 *     └─ [渲染] 页面组合、画布与剪辑导航、Suspense                  L1891
 *
 * ─── 更新记录：2026-10-20 存储损坏不视为空；保存、清理异常统一捕获，失败重试纳入统一链 ───
 *   2026-09-22  新增独立画布列表入口；超长入口保留认证、历史与任务恢复集中编排，本次只接路由，验证导航及刷新，不迁移生成流程
 *   2026-09-18  删除已无运行时引用的旧首页 Toast 展示；反馈统一由 GlobalToast 承接
 *   2026-08-12  智能分镜生成任务轮询超时由 500 秒调整为 3000 秒
 *   2026-08-19  主动退出与鉴权失效时清空创作提示词和参考素材草稿
 *   2026-07-16  修复商务合作二维码定位、无 token 初始化和微信回调错误引用；GlobalSettings 按项目 ID 重建草稿
 *   2026-07-15  修正懒加载、Suspense、主入口状态/函数/副作用的实际结构索引行号
 *   2026-07-15  页面级业务模块改为懒加载
 *   2026-07-15  校正标语动画副作用和懒加载常量的结构索引行号
 *   2026-07-16  迁移 Home 导航与背景视频静态配置至 components/home/HomeNavigationConfig.jsx；页面继续负责导航状态和副作用
 *   2026-07-16  迁移首页品牌 Logo 至 components/home/HomeLogo.jsx；页面继续负责返回首页状态变更
 *   2026-07-16  迁移首页背景视频和底色展示至 components/home/HomeBackground.jsx；页面继续负责视频切换副作用
 *   2026-07-16  迁移无项目头部组合至 components/home/HomeHeader.jsx；页面继续负责认证状态和回调
 *   2026-07-16  迁移 buildEpisodeStatusMap 至 utils/episodeStatusAdapter.js；首页继续负责概览请求和状态写回
 *   2026-07-16  迁移 normalizeProjectList 至 utils/projectAdapter.js；首页继续负责项目请求和状态写回
 *   2026-07-16  迁移 normalizeSubjects 至 utils/subjectAdapter.js；首页继续负责缓存、分页和状态写回
 *   2026-07-16  依据当前代码重新核对首页入口、常量、副作用和渲染区结构索引
 *   2026-07-16  首页标语和开始创作按钮迁移至 components/home，并重新核对真实行号
 *   2026-07-16  迁移底部二维码与更多选项菜单至 components/home/HomeBottomMenus.jsx；页面保留水印设置回调和导航副作用
 *   2026-07-17  迁移 CreationManualButton / LoginButton 至 components/home/HomeHeaderActions.jsx；认证回调仍由页面显式传入
 *   2026-07-16  迁移 WorkflowStepTabs 及 STEP_TABS 配置至 components/home/WorkflowStepTabs.jsx；页面仍负责步骤状态和切换回调
 *   2026-07-16  迁移 WorkflowHeadbar 至 components/home/WorkflowHeadbar.jsx；认证和工作流回调通过显式 props 传递；补齐管理员入口回调
 *   2026-07-16  迁移 API 配置提示气泡至 components/home/ApiConfigBubble.jsx；页面仅负责显示条件和底部导航动作
 *   2026-07-16  迁移首页 Toast 展示；后续改由全局 GlobalToast 承接
 *   2026-07-17  迁移首页主导航与底部快捷导航布局至 components/home/HomeNavigationRail.jsx；页面继续负责导航状态和回调
 *   2026-07-22  主体生成改为发布结构、检查存储用量并轮询剧本任务；完成后强制刷新主体列表并兼容嵌套响应
 *   2026-07-23  持久化主体抽取两阶段任务，刷新浏览器后恢复轮询和加载动画
 *   2026-07-27  主体抽取加载文案优先读取任务轮询 status_message，固定文案作为兜底
 *   2026-09-01  主体抽取运行锁、加载态和错误态按项目隔离，避免跨项目污染
 *   2026-07-24  持久化分镜生成任务，支持刷新/返回后恢复轮询及失败重试
 *   2026-07-30  覆盖重抽任务提交后立即查询任务状态，并统一兼容嵌套任务 ID
 *   2026-07-06  新增 subject cache 订阅 useEffect，实时同步 sharedChars/sharedScenes/sharedProps
 *   2026-07-31  主体缓存订阅接受空列表结果，确保主体音色解绑状态不会被旧缓存保留
 *   2026-07-28  剧集进度改按工作流解锁状态展示，视频生成数量不再等同于“剪辑中”
 *   2026-09-02  修复项目详情 URL 刷新时解析失败及异步加载期间被覆盖的问题
 *   2026-07-28  接入存储空间展示、容量提醒、资产库跳转及写入后的全满警告
 *   2026-08-04  同一项目在主体页与分镜页之间切换时复用分镜缓存，避免无条件清理后重复请求
 *   2026-08-04  资产概况剧本进度卡片跳转到对应分集分镜
 *   2026-07-31  项目列表加载动画占满内容区并垂直、水平居中显示
 *   2026-07-01  初始结构索引建立
 *   2026-10-09  合并 V1.5 画布与剪辑入口，保留双方业务接线并校正结构索引
 *   2026-10-12  同步 V1.5 最新画布导航，保留剪辑入口并校正合并后的索引
 *   2026-10-15  合并远程剪辑模块，保留本地主体请求保护、公告及画布接线；校正结构索引
 */

import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import useStoryboardGenerationScope from '../hooks/useStoryboardGenerationScope';
import { apiGetProjects, apiUpdateProject, apiCopyProject, apiDeleteProject, apiGetProject, apiGetProjectOverview } from '../api/project';
import { useCanvasProjects } from '../components/canvas/UseCanvasProjects';
import { getToken, getRefreshToken, refreshAccessToken, getAuthSessionGeneration } from '../api/request';
import { clearTokens, apiLogout, apiCompleteWechatCallback } from '../api/auth';
import { apiListProviders } from '../api/config';
import { apiAcknowledgeStorageReminder, apiGetCurrentUser, apiGetNotifications, apiGetStorageUsage } from '../api/user';
import { apiGetSubjects, apiGetSubjectsPage, apiGetEpisodes, apiGetScriptWorkspace, apiGetScriptStructure, apiFinalizeScriptWorkspace, apiPublishScriptStructure, apiExtractSubjectsByEpisodes, apiGetScriptTask } from '../api/subject';
import { apiGetStoryboards, apiGenerateStoryboardsFromFinalScript, apiGenerateStoryboardsFromEpisode, apiGetTask } from '../api/storyboard';
import { invalidate } from '../utils/cache';
import { useCreationStore } from '../stores/creationStore';
import { recoverVideoEdits, useVideoEditStore } from '../stores/videoEditStore';
import { normalizeImageUrl } from '../utils/imageUrl';
import { normalizeSubjects, mergeSubjectItems } from '../utils/subjectAdapter';
import { normalizeProjectList } from '../utils/projectAdapter';
import { createProjectSaveQueue, applyProjectSave } from '../utils/ProjectSaveQueue';
import { createProjectRouteRestore } from '../utils/ProjectRouteRestore';
import RemoteReadStatus from '../components/feedback/RemoteReadStatus';
import { buildEpisodeStatusMap } from '../utils/episodeStatusAdapter';
import {
  getStoryboardTaskErrorMessage,
  getStoryboardTaskId,
  getStoryboardTaskStatus,
  getStoryboardTaskStatusMessage,
  isStoryboardTaskInProgress,
} from '../utils/storyboardTaskAdapter';
import { subscribe, peekCache } from '../utils/cache';
import { K, MEDIUM } from '../utils/cacheKeys';
import LoginModal from '../components/LoginModal';
import ApiConfigModal from '../components/ApiConfigModal';
import NoModelNotice from '../components/NoModelNotice';
import ProfileModal from '../components/ProfileModal';
import StorageUsageReminderModal from '../components/StorageUsageReminderModal';
import NewProjectModal from '../components/NewProjectModal';
import WatermarkSettingsModal from '../components/WatermarkSettingsModal';
import NotificationCenterModal from '../components/NotificationCenterModal';
import SystemAnnouncementModal from '../components/announcements/SystemAnnouncementModal';
import DotsLoading from '../components/DotsLoading';
import PageErrorBoundary from '../components/feedback/PageErrorBoundary';
import { showGlobalToast } from '../stores/toastStore';
import { clearCreationDrafts } from '../components/creation/CreationDraftStorage';
import { BG_VIDEOS, NAV_ITEMS, BOTTOM_NAV_ITEMS } from '../components/home/HomeNavigationConfig';
import {
  HomeSloganText,
  StartCreationButton,
  MoreOptionsMenu,
  WorkflowHeadbar,
  ApiConfigBubble,
  HomeBackground,
  HomeHeader,
  HomeNavigationRail,
} from '../components/home';
import CanvasPage from './CanvasPage';
import { createStoryboardGenerationPersistence } from '../utils/StoryboardGenerationPersistence';

const ProjectList = lazy(() => import('./ProjectList'));
const GlobalSettings = lazy(() => import('./GlobalSettings'));
const SubjectPage = lazy(() => import('./SubjectPage'));
const StoryboardPage = lazy(() => import('./StoryboardPage'));
const EditPage = lazy(() => import('./EditPage'));
const AssetsPage = lazy(() => import('./AssetsPage'));
const CreationPage = lazy(() => import('./CreationPage'));

const SUBJECT_EXTRACTION_TASK_KEY_PREFIX = 'miioo:pending_subject_extraction:';
const {
  read: readPendingStoryboardGeneration,
  write: writePendingStoryboardGeneration,
  clear: clearPendingStoryboardGeneration,
} = createStoryboardGenerationPersistence(() => localStorage);

const STEP_PATHS = {
  global: 'overview',
  script: 'script',
  subject: 'subjects',
  storyboard: 'storyboard',
  edit: 'edit',
};

const PATH_STEPS = Object.fromEntries(Object.entries(STEP_PATHS).map(([step, path]) => [path, step]));

function readWorkspaceRoute() {
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  if (pathname === '/') return { key: 'home' };
  if (pathname === '/workspace/project') return { key: 'project' };
  if (pathname === '/workspace/canvas') return { key: 'canvas' };
  const canvasMatch = pathname.match(/^\/workspace\/canvas\/([^/]+)$/);
  if (canvasMatch) return { key: 'canvas-detail', canvasId: decodeURIComponent(canvasMatch[1]) };
  if (pathname === '/workspace/create') return { key: 'create' };
  if (pathname === '/workspace/assets') return { key: 'assets' };

  // 详情页历史上已写入 /project/:id/:step，兼容旧的 /workspace/project/:id/:step。
  const match = pathname.match(/^\/(?:workspace\/)?project\/([^/]+)(?:\/(edit)\/editor|\/([^/]+))?$/);
  if (match && match[1]) {
    return {
      key: 'project',
      projectId: decodeURIComponent(match[1]),
      step: PATH_STEPS[match[2] || match[3]] || 'script',
    };
  }

  return { key: 'home' };
}

function workspacePath({ key, projectId, canvasId, step }) {
  if (key === 'project' && projectId) {
    return `/project/${encodeURIComponent(projectId)}/${STEP_PATHS[step] || STEP_PATHS.script}`;
  }
  if (key === 'project') return '/workspace/project';
  if (key === 'canvas') return '/workspace/canvas';
  if (key === 'canvas-detail' && canvasId) return `/workspace/canvas/${encodeURIComponent(canvasId)}`;
  if (key === 'create') return '/workspace/create';
  if (key === 'assets') return '/workspace/assets';
  return '/';
}

function updateWorkspaceUrl(route, { replace = false } = {}) {
  const nextPath = workspacePath(route);
  if (route.step === 'edit' && window.location.pathname.replace(/\/+$/, '') === `${nextPath}/editor`) return;
  if (window.location.pathname === nextPath) return;
  window.history[replace ? 'replaceState' : 'pushState']({}, '', nextPath);
}

function getSubjectExtractionTaskKey(projectId, ownerId) {
  return `${SUBJECT_EXTRACTION_TASK_KEY_PREFIX}${ownerId ? `${encodeURIComponent(ownerId)}:` : ''}${projectId}`;
}

function readPendingSubjectExtraction(projectId, ownerId) {
  if (!projectId || !ownerId) return null;
  try {
    const raw = localStorage.getItem(getSubjectExtractionTaskKey(projectId, ownerId));
    if (raw) {
      const saved = JSON.parse(raw);
      if (!saved || saved.ownerId !== ownerId || saved.projectId !== projectId
        || (!['failed', 'unknown', 'submitting'].includes(saved.status)
          && (!saved.taskId || !['publish', 'subject', 'results'].includes(saved.phase)))) {
        return { status: 'unknown', error: '抽取记录不完整，请先确认原任务状态，暂不重复提交' };
      }
      return saved;
    }
    const legacy = localStorage.getItem(getSubjectExtractionTaskKey(projectId));
    return legacy ? { status: 'unknown', error: '发现归属不明的历史抽取记录，请先确认原任务状态，暂不重复提交' } : null;
  } catch {
    return { status: 'unknown', error: '无法读取抽取记录，请先确认原任务状态，暂不重复提交' };
  }
}

function writePendingSubjectExtraction(projectId, ownerId, value) {
  if (!projectId || !ownerId || !value) return;
  localStorage.setItem(getSubjectExtractionTaskKey(projectId, ownerId), JSON.stringify({ ...value, ownerId, projectId }));
}

function clearPendingSubjectExtraction(projectId, ownerId) {
  if (!projectId || !ownerId) return;
  localStorage.removeItem(getSubjectExtractionTaskKey(projectId, ownerId));
}

function readUnlockedSteps(projectId) {
  if (!projectId) return new Set();
  try {
    const raw = localStorage.getItem(`miioo_unlocked_steps_${projectId}`);
    const value = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(value) ? value : []);
  } catch {
    localStorage.removeItem(`miioo_unlocked_steps_${projectId}`);
    return new Set();
  }
}

export default function Home({ onGoToAdmin }) {
  const [enqueueProjectSave] = useState(createProjectSaveQueue);
  const initialRoute = readWorkspaceRoute();
  const [projectRouteRestore] = useState(() => createProjectRouteRestore(initialRoute, localStorage, getAuthSessionGeneration()));
  const routeSyncReadyRef = useRef(false);
  const projectDetailVersion = useRef(0);
  const projectDetailOwner = useRef(null);
  const scriptEditVersion = useRef(0);
  const [projectRead, setProjectRead] = useState(null);
  const cancelProjectRead = useCallback(() => {
    projectDetailVersion.current++;
    projectDetailOwner.current = null;
    setProjectRead(null);
    setIsLoadingProject(false);
  }, []);
  useEffect(() => () => {
    projectDetailVersion.current++;
    projectDetailOwner.current = null;
  }, []);
  const [activeKey, setActiveKeyState] = useState(() => {
    if (initialRoute.key !== 'home') return initialRoute.key;
    // 只有明确保存了非 home 的 activeKey 才恢复，否则默认 home
    const savedKey = localStorage.getItem('miioo_active_key');
    return ['project', 'canvas', 'create', 'assets'].includes(savedKey) ? savedKey : 'home';
  });
  const setActiveKey = useCallback((key) => {
    projectRouteRestore.cancel();
    cancelProjectRead();
    setActiveKeyState(key);
  }, [projectRouteRestore, cancelProjectRead]);
  const [assetsEntry, setAssetsEntry] = useState({ module: initialRoute.key === 'assets' && new URLSearchParams(window.location.search).get('module') === 'creative' ? 'creative' : 'project', seedanceTab: 'real' });
  const [bottomActiveKey, setBottomActiveKey] = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [apiConfigOpen, setApiConfigOpen] = useState(false);
  const [noModelNoticeOpen, setNoModelNoticeOpen] = useState(false);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  // mock 模式下也需要检查 token，退出登录后应该显示未登录状态
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [apiConfigured, setApiConfigured] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [watermarkSettingsOpen, setWatermarkSettingsOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [canvasRouteId, setCanvasRouteId] = useState(initialRoute.canvasId || null);
  const canvasProjects = useCanvasProjects({
    context: canvasRouteId || activeKey,
    active: activeKey === 'canvas', isLoggedIn,
    onLogin: () => setLoginOpen(true),
    onOpen: (id) => {
      setCanvasRouteId(id);
      setActiveKey('canvas-detail');
      updateWorkspaceUrl({ key: 'canvas-detail', canvasId: id });
    },
  });
  const [activeProject, setActiveProject] = useState(null);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [projectsLoaded, setProjectsLoaded] = useState(() => !getToken());
  const [projectsError, setProjectsError] = useState('');
  const projectListVersion = useRef(0);
  const [projectListSession, setProjectListSession] = useState(null);
  const readProjects = useCallback(async () => {
    const version = ++projectListVersion.current;
    const session = getAuthSessionGeneration();
    const isCurrent = () => version === projectListVersion.current && session === getAuthSessionGeneration();
    if (!getToken()) return null;
    setProjectsLoaded(false);
    setProjectsError('');
    try {
      const normalized = normalizeProjectList(await apiGetProjects());
      if (!isCurrent()) return null;
      setProjects(normalized.filter((project) => project.project_type !== 'canvas'));
      setProjectListSession(session);
      return normalized;
    } catch {
      if (isCurrent()) setProjectsError('项目列表读取失败，请重试');
      return null;
    } finally {
      if (isCurrent()) setProjectsLoaded(true);
    }
  }, []);
  useEffect(() => () => { projectListVersion.current++; }, []);
  const [, setActiveProjectId] = useState(null);
  const [activeStep, setActiveStep] = useState(initialRoute.step || 'script'); // loadProjectDetails 会按项目恢复正确步骤
  const [subjectInitialTab, setSubjectInitialTab] = useState('char');
  const [sharedChars, setSharedChars] = useState(null);
  const [sharedScenes, setSharedScenes] = useState(null);
  const [sharedProps, setSharedProps] = useState(null);
  // 主体分页 meta：{ cursor, hasMore, loading, rawList }
  const [subjectPageMeta, setSubjectPageMeta] = useState({
    chars:  { nextOffset: null, hasMore: false, loading: true, rawList: [] },
    scenes: { nextOffset: null, hasMore: false, loading: true, rawList: [] },
    props:  { nextOffset: null, hasMore: false, loading: true, rawList: [] },
  });
  // 主体首屏、分页和删除后刷新可能并行返回；按类别隔离代际，旧响应不得覆盖新请求。
  const subjectRequestVersions = useRef({ chars: 0, scenes: 0, props: 0 });
  const subjectInFlight = useRef({ chars: false, scenes: false, props: false });
  const bumpSubjectRequest = useCallback((key) => {
    subjectRequestVersions.current[key] += 1;
    return subjectRequestVersions.current[key];
  }, []);
  const isCurrentSubjectRequest = useCallback((key, version, projectId, session) => (
    subjectRequestVersions.current[key] === version
      && getAuthSessionGeneration() === session
      && Boolean(getToken())
      && projectDetailOwner.current?.id === projectId
      && projectDetailOwner.current?.session === session
  ), []);
  const [extractErrorByProject, setExtractErrorByProject] = useState({});
  const [subjectExtractionByProject, setSubjectExtractionByProject] = useState({});
  const [subjectExtractionStatusByProject, setSubjectExtractionStatusByProject] = useState({});
  const [generateError, setGenerateError] = useState(null);
  const [generateErrorProjectId, setGenerateErrorProjectId] = useState(null);
  const [isGeneratingStoryboards, setIsGeneratingStoryboards] = useState(false);
  const [completedEpisodesCount, setCompletedEpisodesCount] = useState(0);
  const [storyboardStatusMessage, setStoryboardStatusMessage] = useState('');
  const generatingStoryboardsRef = useRef(false); // 同步锁，防止并发调用
  const extractingSubjectsRef = useRef({}); // 按项目保存运行会话，旧会话不能释放新锁
  const extractionMountedRef = useRef(true);
  useEffect(() => {
    extractionMountedRef.current = true;
    return () => { extractionMountedRef.current = false; };
  }, []);
  // 自上次提取主体后，剧本是否又重新定稿过（用于控制"开始提取主体"按钮行为）
  const [scriptFinalizedSinceExtraction, setScriptFinalizedSinceExtraction] = useState(false);
  const [scriptEpisodes, setScriptEpisodes] = useState([]);
  const [scriptPhase, setScriptPhase] = useState('initial');
  const [scriptHasStarted, setScriptHasStarted] = useState(false);
  const [scriptContent, setScriptContent] = useState('');
  const handleScriptContentChange = useCallback((value) => {
    scriptEditVersion.current++;
    setScriptContent(value);
  }, []);
  const handleScriptEpisodesChange = useCallback((value) => {
    scriptEditVersion.current++;
    setScriptEpisodes(value);
  }, []);
  const [scriptDraftContent, setScriptDraftContent] = useState('');
  const [episodeStatuses, setEpisodeStatuses] = useState({});
  const [storyboardInitialEpisodeIndex, setStoryboardInitialEpisodeIndex] = useState(null);
  // Tracks which non-alwaysEnabled steps have ever had content — once unlocked, stays unlocked
  const [unlockedSteps, setUnlockedSteps] = useState(new Set());
  const [currentUser, setCurrentUser] = useState({});
  useLayoutEffect(() => {
    useCreationStore.getState().setAccount(isLoggedIn ? currentUser.id : null);
  }, [isLoggedIn, currentUser.id]);
  useEffect(() => {
    if (isLoggedIn && currentUser.id) recoverVideoEdits(currentUser.id);
    else useVideoEditStore.setState({ ownerId: null });
  }, [isLoggedIn, currentUser.id]);
  const [storageUsage, setStorageUsage] = useState(null);
  const [storageReminder, setStorageReminder] = useState(null);
  const acknowledgedStorageReminderRef = useRef(null);
  const [forceExtract, setForceExtract] = useState(false);
  const [, setNotifications] = useState([]);

  // 同步跟踪当前项目 ID
  useEffect(() => {
    currentProjectIdRef.current = activeProject?.id || null;
  }, [activeProject?.id]);
  // 跨项目异步操作的 pending 结果暂存
  const pendingExtractionsRef = useRef({}); // { projectId: { chars, scenes, props } }
  const currentProjectIdRef = useRef(null);  // 同步跟踪当前项目
  const bgVideoRef = useRef(null);
  const currentVideoIndexRef = useRef(0);
  const activeProjectIdForExtraction = activeProject?.id;
  const activeProjectNameForExtraction = activeProject?.name;
  const extractionOwnerId = isLoggedIn ? currentUser.id : null;
  const captureStoryboardScope = useStoryboardGenerationScope(extractionOwnerId, activeProject?.id, 'project');
  useLayoutEffect(() => {
    generatingStoryboardsRef.current = false;
    const frame = requestAnimationFrame(() => {
      if (generatingStoryboardsRef.current) return;
      setIsGeneratingStoryboards(false);
      setGenerateError(null);
      setGenerateErrorProjectId(null);
      setStoryboardStatusMessage('');
    });
    return () => cancelAnimationFrame(frame);
  }, [activeProject?.id, extractionOwnerId]);
  const activePendingExtraction = readPendingSubjectExtraction(activeProject?.id, extractionOwnerId);
  const activeExtractError = extractErrorByProject[activeProject?.id] || null;
  const activeSubjectExtractionStatusMessage = subjectExtractionStatusByProject[activeProject?.id] || '';

  const showToast = useCallback((msg, type = 'warning') => {
    showGlobalToast(msg, type);
  }, []);

  const refreshStorageUsage = useCallback(async () => {
    if (!getToken()) return null;
    try {
      const usage = await apiGetStorageUsage();
      setStorageUsage(usage);
      return usage;
    } catch {
      return null;
    }
  }, []);

  const getStorageReminderType = useCallback((usage) => {
    if (!usage) return null;
    if (usage.status === 'full' || usage.writeBlocked) return 'full';
    if (Number(usage.availableBytes) < 1024 ** 3) return 'threshold';
    return null;
  }, []);

  const closeStorageReminder = useCallback(async () => {
    setStorageReminder(null);
  }, []);

  const manageStorageAssets = useCallback(() => {
    setStorageReminder(null);
    setActiveKey('assets');
    setActiveProject(null);
    setActiveProjectId(null);
    localStorage.removeItem('miioo_active_project_id');
    localStorage.removeItem('miioo_active_step');
    localStorage.removeItem('miioo_active_key');
  }, [setActiveKey]);

  useEffect(() => {
    const type = getStorageReminderType(storageUsage);
    const version = storageUsage?.reminderVersion;
    if (!type || !storageUsage?.thresholdReminderPending || !version || acknowledgedStorageReminderRef.current === version) return;
    setStorageReminder(type);
    acknowledgedStorageReminderRef.current = version;
    apiAcknowledgeStorageReminder(version).catch(() => {
      acknowledgedStorageReminderRef.current = null;
    });
  }, [getStorageReminderType, storageUsage]);

  useEffect(() => {
    const handleStorageWrite = async () => {
      const usage = await refreshStorageUsage();
      if (usage?.status === 'full' || usage?.writeBlocked) setStorageReminder('full');
    };
    window.addEventListener('storage:write-success', handleStorageWrite);
    return () => window.removeEventListener('storage:write-success', handleStorageWrite);
  }, [refreshStorageUsage]);

  // 背景视频循环：播完当前视频后切换到下一个（纯 ref 操作，不触发 React 重渲染）
  const handleVideoEnded = () => {
    const next = (currentVideoIndexRef.current + 1) % BG_VIDEOS.length;
    currentVideoIndexRef.current = next;
    const video = bgVideoRef.current;
    if (!video) return;
    video.src = BG_VIDEOS[next];
    video.load();
    video.play().catch(() => {});
  };

  // 统一的退出登录处理函数
  const handleLogout = async () => {
    projectRouteRestore.cancel();
    cancelProjectRead();
    try {
      // 调用后端退出登录接口
      await apiLogout();
    } catch (error) {
      console.error('退出登录接口调用失败:', error);
    }

    // 清除登录凭证
    clearTokens();
    await clearCreationDrafts();

    // 只清除当前会话状态，保留项目数据和解锁状态供下次登录使用
    localStorage.removeItem('miioo_active_project_id');
    localStorage.removeItem('miioo_active_step');
    localStorage.removeItem('miioo_active_key');

    // 强制刷新页面并跳转到首页
    // 使用 location.replace 而不是 location.href，确保不会留在历史记录中
    window.location.replace('/');
  };

  // 监听项目切换并保存 ID（仅在有→无切换时清除，初始化/null→null 不操作）
  const prevProjectIdRef = useRef();
  useEffect(() => {
    const prevId = prevProjectIdRef.current;
    const currentId = activeProject?.id;
    if (currentId) {
      localStorage.setItem('miioo_active_project_id', currentId);
    } else if (prevId) {
      // 之前有项目，现在没了 → 用户主动退出项目
      localStorage.removeItem('miioo_active_project_id');
    }
    // 初始化时 prevId=undefined, currentId=undefined → 什么都不做
    prevProjectIdRef.current = currentId;
  }, [activeProject?.id]);

  // 监听步骤切换并保存（按项目 ID 单独存储，避免不同项目间互相污染）
  useEffect(() => {
    if (activeProject?.id) {
      localStorage.setItem(`miioo_active_step_${activeProject.id}`, activeStep);
    }
  }, [activeStep, activeProject?.id]);

  // 监听 activeKey 变化并保存
  useEffect(() => {
    if (activeKey !== 'home' && activeKey !== 'canvas-detail') {
      localStorage.setItem('miioo_active_key', activeKey);
    } else {
      // 回到首页时清除缓存，确保刷新不会跳转
      localStorage.removeItem('miioo_active_key');
    }
  }, [activeKey]);

  // 监听解锁状态变化并保存（按项目 ID）
  useEffect(() => {
    if (activeProject?.id && unlockedSteps.size > 0) {
      const key = `miioo_unlocked_steps_${activeProject.id}`;
      localStorage.setItem(key, JSON.stringify([...unlockedSteps]));
    }
  }, [unlockedSteps, activeProject?.id]);

  // 统一的项目数据加载函数
  const loadProjectDetails = async (projectId, requestedStep = null) => {
    projectRouteRestore.cancel();
    Object.keys(subjectRequestVersions.current).forEach((key) => bumpSubjectRequest(key));
    const subjectVersions = { ...subjectRequestVersions.current };
    Object.keys(subjectInFlight.current).forEach((key) => { subjectInFlight.current[key] = true; });
    const version = ++projectDetailVersion.current;
    const session = getAuthSessionGeneration();
    const isCurrent = () => version === projectDetailVersion.current && session === getAuthSessionGeneration();
    const scriptVersion = scriptEditVersion.current;
    const sameProject = projectDetailOwner.current?.id === projectId && projectDetailOwner.current?.session === session;
    projectDetailOwner.current = { id: projectId, session };
    setProjectRead({ projectId, requestedStep, loading: true, error: '' });
    setIsLoadingProject(!sameProject);
    if (!sameProject) setSubjectPageMeta({
      chars: { nextOffset: null, hasMore: false, loading: true, rawList: [], error: false },
      scenes: { nextOffset: null, hasMore: false, loading: true, rawList: [], error: false },
      props: { nextOffset: null, hasMore: false, loading: true, rawList: [], error: false },
    });
    // 每次进入项目时主动失效 episodes 和 overview 缓存，确保拿到后端最新数据
    invalidate(K.episodes(projectId));
    invalidate(K.projectOverview(projectId));
    try {
      // 0. 切换项目前先清空旧项目所有数据状态，避免闪现旧数据
      if (!sameProject) {
      setActiveProject(null);
      setActiveStep(requestedStep || 'script');
      setScriptContent('');
      setScriptEpisodes([]);
      setScriptPhase('initial');
      setScriptHasStarted(false);
      setScriptFinalizedSinceExtraction(false);
      setForceExtract(false);
      setSharedChars([]);
      setSharedScenes([]);
      setSharedProps([]);
      setEpisodeStatuses({});
      setUnlockedSteps(new Set());
      setExtractErrorByProject((prev) => {
        const next = { ...prev };
        delete next[projectId];
        return next;
      });
      if (generateErrorProjectId !== projectId) {
        setGenerateError(null);
        setGenerateErrorProjectId(null);
      }
      setSubjectInitialTab('char');
      }

      // ── 缓存快速路径：如果核心数据都有缓存，立即填充并关掉 loading ──────────
      const cachedProject = peekCache(K.project(projectId), MEDIUM.CONTENT);
      const cachedEpisodes = peekCache(K.episodes(projectId), MEDIUM.CONTENT);
      const cachedScript = peekCache(K.script(projectId), MEDIUM.CONTENT);
      const cachedChars = peekCache(K.subjects(projectId, 'character'), MEDIUM.CONTENT);
      const cachedScenes = peekCache(K.subjects(projectId, 'scene'), MEDIUM.CONTENT);
      const cachedProps = peekCache(K.subjects(projectId, 'prop'), MEDIUM.CONTENT);

      if (!sameProject && cachedProject && cachedEpisodes) {
        // 从缓存填充状态，立即关掉 loading → StoryboardPage 秒挂载
        setActiveProject(cachedProject);
        setScriptEpisodes(cachedEpisodes);
        if (cachedScript) {
          const scriptContent = cachedScript.script?.content || cachedScript.content || '';
          setScriptContent(scriptContent);
          setScriptPhase(scriptContent ? 'view' : 'initial');
          setScriptHasStarted(!!scriptContent);
        }
        // 确保缓存数据是数组（兼容旧缓存存的 SubjectListResponse 对象）
        const ensureArray = (data) => Array.isArray(data) ? data : (data?.list || data?.items || data?.data || []);
        if (cachedChars) setSharedChars(normalizeSubjects(ensureArray(cachedChars)));
        if (cachedScenes) setSharedScenes(normalizeSubjects(ensureArray(cachedScenes)));
        if (cachedProps) setSharedProps(normalizeSubjects(ensureArray(cachedProps)));
        // 恢复步骤
        const savedStep = requestedStep || localStorage.getItem(`miioo_active_step_${projectId}`);
        setActiveStep(savedStep || 'script');
        setUnlockedSteps(readUnlockedSteps(projectId));
        const savedFinalized = localStorage.getItem(`miioo_finalized_since_extraction_${projectId}`);
        setScriptFinalizedSinceExtraction(savedFinalized === 'true');
        // 立即关掉 loading，让 StoryboardPage 先渲染缓存数据
        setIsLoadingProject(false);
        // 后台继续刷新（不阻塞 UI）
      }
      // ── 结束缓存快速路径 ────────────────────────────────────────────────────
      // 1. 加载项目基本信息
      const projectData = await apiGetProject(projectId);
      if (!isCurrent()) return;
      setActiveProject(projectData);

      // 2. 恢复步骤解锁状态（从 localStorage，按项目 ID）
      const restoredUnlockedSteps = readUnlockedSteps(projectId);
      setUnlockedSteps(restoredUnlockedSteps);

      // 如果后端已有主体数据，自动解锁 subject 步骤
      // （避免换浏览器/清缓存后明明有数据却被锁住）
      if (!restoredUnlockedSteps.has('subject')) {
        try {
          const anySubjects = await apiGetSubjects(projectId, { type: 'character', limit: 1 }).catch(() => null);
          if (!isCurrent()) return;
          if (!anySubjects) setProjectRead({ projectId, requestedStep, loading: true, error: '主体步骤状态读取失败，请重试' });
          if (Array.isArray(anySubjects) && anySubjects.length > 0) {
            setUnlockedSteps(prev => {
              const next = new Set(prev);
              next.add('subject');
              return next;
            });
          }
        } catch {
          // 主体解锁状态恢复失败时保留当前步骤，后续请求仍可继续。
        }
      }

      // 恢复"定稿 flag"（按项目 ID）
      const savedFinalized = localStorage.getItem(`miioo_finalized_since_extraction_${projectId}`);
      setScriptFinalizedSinceExtraction(savedFinalized === 'true');

      // 恢复当前步骤（按项目 ID，新项目默认回到 script）
      // 注意：不使用全局 miioo_active_step，避免不同项目间互相污染
      const savedStep = requestedStep || localStorage.getItem(`miioo_active_step_${projectId}`);
      setActiveStep(savedStep || 'script');

      // 3. 并行加载所有数据
      const SUBJECT_LIMIT = 20;
      const [scriptData, charsPage, scenesPage, propsPage, episodesData, overviewData] = await Promise.all([
        apiGetScriptWorkspace(projectId).catch(err => {
          console.error('加载剧本数据失败:', err);
          return null;
        }),
        // 注意：失败时返回 error 哨兵，而非空列表。
        // 否则某一类主体接口 500（如后端主图脏数据触发 MultipleResultsFound）会被吞成空数组，
        // 直接清空该类卡片，让用户误以为数据被删。error 标记让下方保留原有卡片并提示重试。
        apiGetSubjectsPage(projectId, { type: 'character', limit: SUBJECT_LIMIT }).catch((err) => ({ error: true, err })),
        apiGetSubjectsPage(projectId, { type: 'scene', limit: SUBJECT_LIMIT }).catch((err) => ({ error: true, err })),
        apiGetSubjectsPage(projectId, { type: 'prop', limit: SUBJECT_LIMIT }).catch((err) => ({ error: true, err })),
        apiGetEpisodes(projectId).catch(() => null),
        apiGetProjectOverview(projectId).catch(() => null),
      ]);
      if (!isCurrent()) return;
      if (!scriptData || !episodesData || !overviewData || charsPage.error || scenesPage.error || propsPage.error) {
        setProjectRead({ projectId, requestedStep, loading: false, error: '部分项目数据读取失败，已保留读取成功或已有的内容，请重试' });
      }

      // 4. 更新状态
      const scriptUnchanged = scriptVersion === scriptEditVersion.current;
      if (scriptData && scriptUnchanged) {
      const scriptContent = scriptData.script?.content || scriptData.content || '';
      setScriptContent(scriptContent);
      setScriptPhase(scriptContent ? 'view' : 'initial');
      setScriptHasStarted(!!scriptContent);
      }
      if (episodesData && scriptUnchanged) setScriptEpisodes(episodesData);

      // 某类主体加载失败时：不覆盖已有卡片（避免误清空），仅在 meta 上标记 error 供 UI 提示重试。
      // 加载成功时才写入最新数据。
      const subjectPages = { chars: charsPage, scenes: scenesPage, props: propsPage };
      const subjectSetters = { chars: setSharedChars, scenes: setSharedScenes, props: setSharedProps };
      Object.entries(subjectPages).forEach(([key, page]) => {
        if (!page.error && isCurrentSubjectRequest(key, subjectVersions[key], projectId, session)) {
          subjectSetters[key](normalizeSubjects(page.list));
        }
      });

      const buildMeta = (page) => page.error
        ? { nextOffset: null, hasMore: false, loading: false, rawList: null, error: true }
        : { nextOffset: page.nextOffset, hasMore: page.hasMore, loading: false, rawList: page.list, error: false };
      setSubjectPageMeta((prev) => ({
        // 失败类保留上一次的分页 meta（rawList 等），只把 error 标记合并进去，
        // 这样已加载的卡片和「加载更多」状态不被清掉。
        chars:  !isCurrentSubjectRequest('chars', subjectVersions.chars, projectId, session)
          ? prev.chars
          : (charsPage.error ? { ...(prev?.chars || {}), loading: false, error: true, retryOffset: null } : buildMeta(charsPage)),
        scenes: !isCurrentSubjectRequest('scenes', subjectVersions.scenes, projectId, session)
          ? prev.scenes
          : (scenesPage.error ? { ...(prev?.scenes || {}), loading: false, error: true, retryOffset: null } : buildMeta(scenesPage)),
        props:  !isCurrentSubjectRequest('props', subjectVersions.props, projectId, session)
          ? prev.props
          : (propsPage.error ? { ...(prev?.props || {}), loading: false, error: true, retryOffset: null } : buildMeta(propsPage)),
      }));

      // 从后端数据中提取剧集状态，纯转换交给适配工具。
      const statusMap = overviewData && episodesData ? buildEpisodeStatusMap(overviewData, episodesData) : {};
      if (Object.keys(statusMap).length > 0) setEpisodeStatuses(statusMap);

      // 5. 加载分镜数据（需要剧集 ID）并用最新 episodesData 的 ID 写入缓存
      if (Array.isArray(episodesData) && episodesData.length > 0) {
        // 首页只需要判断是否存在分镜来解锁步骤，不需要预加载整集生成参数。
        // 分镜页进入后再按分页请求当前集数据，避免首页一次写入最多 200 条完整分镜。
        const storyboardsData = await apiGetStoryboards(projectId, {
          episode_id: episodesData[0].id,
          limit: 10,
          include_gen_params: false,
        }).catch((error) => {
          console.warn('[Home] 预加载分镜失败，继续打开项目页面:', error);
          return null;
        });
        if (!isCurrent()) return;
        if (!storyboardsData) setProjectRead({ projectId, requestedStep, loading: false, error: '分镜步骤状态读取失败，请重试' });

        // 根据分镜数据判断是否解锁分镜步骤
        if (storyboardsData?.length > 0) {
          setUnlockedSteps(prev => new Set([...prev, 'storyboard']));
        }
      }

    } catch (error) {
      if (!isCurrent()) return;
      console.error('加载项目详情失败:', error);
      setProjectRead({ projectId, requestedStep, loading: false, error: '项目详情读取失败，请重试' });
    } finally {
      Object.keys(subjectVersions).forEach((key) => {
        if (subjectRequestVersions.current[key] === subjectVersions[key]) subjectInFlight.current[key] = false;
      });
      if (isCurrent()) {
      setSubjectPageMeta(prev => Object.fromEntries(Object.entries(prev).map(([key, meta]) => [
        key, subjectRequestVersions.current[key] === subjectVersions[key] ? { ...meta, loading: false } : meta,
      ])));
      setIsLoadingProject(false);
      setProjectRead((prev) => prev ? { ...prev, loading: false } : prev);
      }
    }
  };

  // 首次读取与失败重试均可恢复；主动导航、打开项目或退出会取消目标。
  useEffect(() => {
    if (!projectsLoaded || projectsError || !getToken() || projectListSession !== getAuthSessionGeneration()) return;
    const target = projectRouteRestore.consume(projects, getAuthSessionGeneration());
    if (!target) return;
    if (target.exists) {
      setActiveProjectId(target.projectId);
      void loadProjectDetails(target.projectId, target.step);
    } else {
      localStorage.removeItem('miioo_active_project_id');
      localStorage.removeItem('miioo_active_step');
      localStorage.removeItem('miioo_active_key');
    }
    // 只由列表读取状态驱动；目标在调用详情前消费，避免详情状态更新重复恢复。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, projectsLoaded, projectsError, projectRouteRestore, projectListSession]);

  // 工作台采用轻量 History 路由，保留现有页面状态和登录边界。
  useEffect(() => {
    const handlePopState = () => {
      const route = readWorkspaceRoute();
      if (route.key === 'assets' && new URLSearchParams(window.location.search).get('module') === 'creative') {
        setAssetsEntry({ module: 'creative', seedanceTab: 'real', requestId: Date.now() });
      }
      setActiveKey(route.key);
      if (route.key === 'project' && route.projectId) {
        setActiveProject(null);
        setActiveProjectId(null);
        setActiveStep(route.step || 'script');
        loadProjectDetails(route.projectId, route.step || 'script');
        return;
      }
      if (route.key === 'canvas-detail') {
        setCanvasRouteId(route.canvasId || null);
        return;
      }
      setCanvasRouteId(null);
      setActiveProject(null);
      setActiveProjectId(null);
      if (route.key !== 'project') setActiveStep('script');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
    // loadProjectDetails intentionally uses the current page closure and is not recreated for route events.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!routeSyncReadyRef.current) {
      routeSyncReadyRef.current = true;
      return;
    }
    if (canvasRouteId) {
      const currentRoute = readWorkspaceRoute();
      if (currentRoute.key !== 'canvas-detail' || currentRoute.canvasId !== canvasRouteId) {
        updateWorkspaceUrl({ key: 'canvas-detail', canvasId: canvasRouteId });
      }
      return;
    }
    if (activeKey === 'canvas-detail') return;
    if (activeKey === 'project') {
      // 项目详情正在异步恢复时，保留地址栏中已经解析出的详情 URL，
      // 避免 activeProject 尚未到达时先被改写成项目列表地址。
      const currentRoute = readWorkspaceRoute();
      if (!activeProject?.id && currentRoute.key === 'project' && currentRoute.projectId) return;
      if (activeProject?.id) {
        updateWorkspaceUrl({ key: activeKey, projectId: activeProject.id, step: activeStep });
      } else {
        updateWorkspaceUrl({ key: activeKey });
      }
      return;
    }
    updateWorkspaceUrl({ key: activeKey });
  }, [activeKey, activeProject?.id, activeStep, canvasRouteId]);

  // 处理微信回调（根路径 ?code=&state=）
  useEffect(() => {
    const handleWechatCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');

      if (!code || !state) return; // 没有微信参数，继续正常流程

      try {
        // 调用后端完成回调
        const result = await apiCompleteWechatCallback({ code, state });
        console.log('[Home] 微信回调完成:', result);

        // 如果是 iframe 内，通知父窗口
        if (window.self !== window.top) {
          try {
            window.parent.postMessage({
              type: 'wechat-callback-complete',
              payload: result,
            }, '*');
          } catch (err) {
            console.error('[Home] postMessage 失败:', err);
          }
        } else {
          // 顶层窗口直接处理回调结果
          if (result?.status === 'confirmed' && result?.access_token) {
            // token 已由 apiCompleteWechatCallback 写入，触发页面刷新完成登录
            window.location.replace('/');
          } else if (result?.status === 'need_bind_mobile') {
            // 通知自身（LoginModal 监听同一个 message 事件）
            window.dispatchEvent(new MessageEvent('message', {
              data: { type: 'wechat-callback-complete', payload: result },
            }));
          }
        }

        // 清理 URL 中的微信参数（避免刷新重复执行）
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      } catch (err) {
        console.error('[Home] 微信回调处理失败:', err);
        // 无论 iframe 还是顶层，均通知 LoginModal 显示错误
        const errorPayload = {
          type: 'wechat-callback-complete',
          payload: { status: 'error', message: err?.message || '微信登录失败，请稍后重试' },
        };
        if (window.self !== window.top) {
          try {
            window.parent.postMessage(errorPayload, '*');
          } catch {
            // 跨窗口通知失败不应阻断当前页面的错误清理流程。
          }
        } else {
          window.dispatchEvent(new MessageEvent('message', { data: errorPayload }));
        }
        // 清理 URL（即使失败也要清理，避免重复尝试）
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    };

    handleWechatCallback();
  }, []);

  useEffect(() => {
    // 没有 token → 跳过所有鉴权请求，避免 401
    if (!getToken()) {
      return;
    }

    // 启动验证：先尝试刷新 token（避免过期 token 直接发 401），再确认 token 有效
    const doAuth = async () => {
      // 先静默刷新一次 token（有 refresh_token 才尝试）
      if (getRefreshToken()) {
        await refreshAccessToken();
      }

      // token 刷新后仍然无效 → 跳过 API 请求，避免无意义的 401
      if (!getToken()) {
        setProjectsLoaded(true);
        return;
      }

      let user;
      try {
        // EdgeOne/开发代理短暂断开时，给当前会话几次恢复机会。
        // 仅对网络错误和 5xx 重试，明确的 401/403 仍立即按失效会话处理。
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            user = await apiGetCurrentUser();
            break;
          } catch (error) {
            const temporaryFailure = error?.isNetworkError || error?.status >= 500;
            if (!temporaryFailure || attempt === 2) throw error;
            await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
          }
        }
        setIsLoggedIn(true);
        setCurrentUser({ ...user, avatar_url: normalizeImageUrl(user.avatar_url) ?? '' });
        refreshStorageUsage();
      } catch (error) {
        // 网络/网关临时失败时保留本地会话，不能把“无法验证”显示成“已退出”。
        // 只有 request 层明确清除 token 并发出 auth:logout 时，才进入登录态。
        if (getToken() && (error?.isNetworkError || error?.status >= 500)) {
          // 保留 token 和当前页面，不弹出登录框；下一次刷新或用户操作时继续验证。
          setIsLoggedIn(true);
          setProjectsError('暂时无法验证登录状态，请重试读取项目');
          setProjectsLoaded(true);
          return;
        }
        setProjectsLoaded(true);
        return; // 阻止后续加载
      }
      // 仅在验证成功时加载鉴权数据（此时 token 必然有效）
      if (!getToken()) return;
      refreshAccessToken().finally(() => {
      void readProjects();
          apiGetNotifications().then(setNotifications).catch(() => {});
          apiListProviders().then((data) => {
            const providers = Array.isArray(data) ? data : (data?.providers || []);
            if (providers.length > 0) setApiConfigured(true);
          }).catch(() => {});
        });
      };
      doAuth(); // 启动鉴权流程
      // 鉴权初始化只执行一次，避免 loadProjectDetails 重建后重复请求项目数据。
      // eslint-disable-next-line react-hooks/exhaustive-deps -- 启动 effect 的生命周期由 token 初始化控制
  }, []);

  // 订阅项目列表后台更新
  useEffect(() => {
    if (projectListSession !== getAuthSessionGeneration()) return;
    const unsubscribe = subscribe(K.projects(), (data) => {
      if (!getToken() || projectListSession !== getAuthSessionGeneration()) return;
      if (Array.isArray(data)) {
        const normalized = normalizeProjectList(data);
        setProjects(normalized.filter((project) => project.project_type !== 'canvas'));
      }
    });
    return unsubscribe;
  }, [projectListSession]);

  // 订阅主体缓存更新 —— 当 SubjectPage 修改主体（如更换定稿图）后，分镜页面自动同步最新参考图
  useEffect(() => {
    if (!activeProject?.id) return;
    const pid = activeProject.id;
    const session = getAuthSessionGeneration();
    const isCurrent = () => Boolean(getToken()) && session === getAuthSessionGeneration()
      && projectDetailOwner.current?.id === pid && projectDetailOwner.current?.session === session;
    // 缓存只有一批数组，没有可靠的游标；不能覆盖多页列表后沿用旧游标。
    // 以通知为刷新信号，重新读取首页并成对更新列表/分页，不合并已删除项。
    const unsubs = [
      ['character', 'chars', setSharedChars],
      ['scene', 'scenes', setSharedScenes],
      ['prop', 'props', setSharedProps],
    ].map(([type, key, setShared]) => subscribe(K.subjects(pid, type), () => {
      if (!isCurrent()) return;
      const version = bumpSubjectRequest(key);
      subjectInFlight.current[key] = true;
      setSubjectPageMeta(prev => ({ ...prev, [key]: { ...prev[key], loading: true } }));
      apiGetSubjectsPage(pid, { type, limit: 20 })
        .then((page) => {
          if (!isCurrentSubjectRequest(key, version, pid, session)) return;
          setShared(normalizeSubjects(page.list));
          setSubjectPageMeta(prev => ({
            ...prev,
            [key]: { nextOffset: page.nextOffset, hasMore: page.hasMore, loading: false, error: false, rawList: page.list },
          }));
        })
        .catch(() => {
          if (!isCurrentSubjectRequest(key, version, pid, session)) return;
          setSubjectPageMeta(prev => ({ ...prev, [key]: { ...prev[key], loading: false, error: true, retryOffset: null } }));
        })
        .finally(() => {
          if (subjectRequestVersions.current[key] === version) subjectInFlight.current[key] = false;
        });
    }));
    return () => unsubs.forEach((fn) => fn());
  }, [activeProject?.id, bumpSubjectRequest, isCurrentSubjectRequest]);

  useEffect(() => {
    const handleForceLogout = () => {
      projectRouteRestore.cancel();
      cancelProjectRead();
      projectListVersion.current++;
      setActiveProject(null);
      setActiveProjectId(null);
      setSharedChars([]);
      setSharedScenes([]);
      setSharedProps([]);
      setProjects([]);
      setProjectsError('');
      setProjectsLoaded(true);
      void clearCreationDrafts();
      setIsLoggedIn(false);
      setApiConfigured(false);
      setApiConfigOpen(false);
      setNoModelNoticeOpen(false);
      setLoginOpen(true);
    };

    // 微信回调 need_bind_mobile：确保登录弹窗打开，再让 LoginModal 内部切换到绑定手机步骤
    const handleWechatNeedBind = (event) => {
      if (event.data?.type === 'wechat-callback-complete' &&
          event.data?.payload?.status === 'need_bind_mobile') {
        setLoginOpen(true);
      }
    };

    const handleProjectAssetsDeleted = (event) => {
      const projectId = event?.detail?.projectId;
      if (!projectId || projectId !== activeProject?.id) return;

      const SUBJECT_LIMIT = 20;
      // subjectType（'character'|'scene'|'prop'）存在时只刷新对应类别，
      // 完全不触碰其它类别的 state —— 删角色不会牵动场景/道具卡片。
      // 缺失（旧事件或非主体资产）时回退刷新全部三类。
      const subjectType = event?.detail?.subjectType;
      const TYPE_TO_KEY = { character: 'chars', scene: 'scenes', prop: 'props' };
      const SETTERS = { chars: setSharedChars, scenes: setSharedScenes, props: setSharedProps };

      const targetTypes = subjectType && TYPE_TO_KEY[subjectType]
        ? [subjectType]
        : ['character', 'scene', 'prop'];

      // 每个请求成功/失败独立处理：失败时保留原 state，不用空数组覆盖，
      // 避免刷新失败导致已有卡片消失。
      targetTypes.forEach((type) => {
        const key = TYPE_TO_KEY[type];
        const version = bumpSubjectRequest(key);
        const session = getAuthSessionGeneration();
        subjectInFlight.current[key] = true;
        setSubjectPageMeta(prev => ({ ...prev, [key]: { ...prev[key], loading: true } }));
        apiGetSubjectsPage(projectId, { type, limit: SUBJECT_LIMIT })
          .then((page) => {
            if (!isCurrentSubjectRequest(key, version, projectId, session)) return;
            SETTERS[key](normalizeSubjects(page.list));
            setSubjectPageMeta((prev) => ({
              ...prev,
              [key]: { nextOffset: page.nextOffset, hasMore: page.hasMore, loading: false, rawList: page.list },
            }));
          })
          .catch((err) => {
            console.error(`资产删除后刷新主体数据失败（${type}）:`, err);
            if (isCurrentSubjectRequest(key, version, projectId, session)) {
              setSubjectPageMeta(prev => ({ ...prev, [key]: { ...prev[key], loading: false, error: true, retryOffset: null } }));
            }
          })
          .finally(() => {
            if (subjectRequestVersions.current[key] === version) subjectInFlight.current[key] = false;
          });
      });
    };

    window.addEventListener('auth:logout', handleForceLogout);
    window.addEventListener('message', handleWechatNeedBind);
    window.addEventListener('project-assets:deleted', handleProjectAssetsDeleted);
    return () => {
      window.removeEventListener('auth:logout', handleForceLogout);
      window.removeEventListener('message', handleWechatNeedBind);
      window.removeEventListener('project-assets:deleted', handleProjectAssetsDeleted);
    };
  }, [activeProject?.id, projectRouteRestore, cancelProjectRead, bumpSubjectRequest, isCurrentSubjectRequest]);

  const handleUnlockStep = (stepKey) => {
    setUnlockedSteps((prev) => {
      if (prev.has(stepKey)) return prev;
      const next = new Set(prev);
      next.add(stepKey);
      return next;
    });
  };

  // 项目步骤只决定状态上限，单集是否已有分镜数据决定该集能否进入下一状态。
  const displayEpisodeStatuses = useMemo(() => Object.fromEntries(
    scriptEpisodes.map((episode, index) => {
      const completed = episodeStatuses[index] === 'edited' || String(episode?.status || '').toLowerCase() === 'edited';
      if (completed) return [index, 'edited'];
      const hasStoryboard = ['storyboarded', 'generated'].includes(episodeStatuses[index])
        || Number(episode?.storyboard_count ?? episode?.storyboardCount) > 0
        || ['storyboarded', 'generated', 'videos_ready', 'no_image', 'images_ready'].includes(String(episode?.status || '').toLowerCase());
      if (hasStoryboard && unlockedSteps.has('edit')) return [index, 'generated'];
      if (hasStoryboard && unlockedSteps.has('storyboard')) return [index, 'storyboarded'];
      return [index, 'pending'];
    }),
  ), [episodeStatuses, scriptEpisodes, unlockedSteps]);

  // 加载更多主体（滚动触底时调用）
  const loadMoreSubjects = async (type) => {
    const key = type === 'character' ? 'chars' : type === 'scene' ? 'scenes' : 'props';
    const meta = subjectPageMeta[key];
    const projectId = activeProject?.id;
    if (!projectId || !meta || meta.loading || meta.error || !meta.hasMore || subjectInFlight.current[key]) return;
    const version = bumpSubjectRequest(key);
    const session = getAuthSessionGeneration();
    subjectInFlight.current[key] = true;
    setSubjectPageMeta(prev => ({ ...prev, [key]: { ...prev[key], loading: true } }));
    try {
      const page = await apiGetSubjectsPage(projectId, { type, limit: 20, offset: meta.nextOffset });
      if (!isCurrentSubjectRequest(key, version, projectId, session)) return;
      const newItems = normalizeSubjects(page.list);
      const setShared = key === 'chars' ? setSharedChars : key === 'scenes' ? setSharedScenes : setSharedProps;
      setShared(prev => mergeSubjectItems(prev, newItems));
      setSubjectPageMeta(prev => ({
        ...prev,
        [key]: {
          nextOffset: page.nextOffset,
          hasMore: page.hasMore,
          loading: false,
          error: false,
          rawList: mergeSubjectItems(prev[key]?.rawList, page.list),
        },
      }));
    } catch (err) {
      console.error(`[Home] 加载更多主体失败 (${type}):`, err);
      if (isCurrentSubjectRequest(key, version, projectId, session)) {
        setSubjectPageMeta(prev => ({ ...prev, [key]: { ...prev[key], loading: false, error: true, retryOffset: meta.nextOffset } }));
      }
    } finally {
      if (subjectRequestVersions.current[key] === version) subjectInFlight.current[key] = false;
    }
  };

  // 重试失败的原页；首屏失败替换，分页失败追加。
  const retrySubjects = async (type, restart = false) => {
    const key = type === 'character' ? 'chars' : type === 'scene' ? 'scenes' : 'props';
    const projectId = activeProject?.id;
    if (!projectId || (!restart && subjectInFlight.current[key])) return;
    const offset = restart ? null : subjectPageMeta[key]?.retryOffset;
    const version = bumpSubjectRequest(key);
    const session = getAuthSessionGeneration();
    subjectInFlight.current[key] = true;
    setSubjectPageMeta(prev => ({ ...prev, [key]: { ...prev[key], loading: true } }));
    try {
      const page = await apiGetSubjectsPage(projectId, { type, limit: 20, offset });
      if (!isCurrentSubjectRequest(key, version, projectId, session)) return;
      const items = normalizeSubjects(page.list);
      const setShared = key === 'chars' ? setSharedChars : key === 'scenes' ? setSharedScenes : setSharedProps;
      setShared(prev => offset != null ? mergeSubjectItems(prev, items) : items);
      setSubjectPageMeta(prev => ({
        ...prev,
        [key]: { nextOffset: page.nextOffset, hasMore: page.hasMore, loading: false, rawList: offset != null ? mergeSubjectItems(prev[key]?.rawList, page.list) : page.list, error: false },
      }));
    } catch (err) {
      console.error(`[Home] 重试加载主体失败 (${type}):`, err);
      if (isCurrentSubjectRequest(key, version, projectId, session)) {
        setSubjectPageMeta(prev => ({ ...prev, [key]: { ...prev[key], loading: false, error: true, retryOffset: offset } }));
      }
    } finally {
      if (subjectRequestVersions.current[key] === version) subjectInFlight.current[key] = false;
    }
  };

  // 提取主体回调（由 SubjectPage 在挂载时调用）：发布结构、提交主体抽取并轮询任务
  const handleExtractSubjects = useCallback(async () => {
    const projectId = activeProjectIdForExtraction;
    const extractionSession = getAuthSessionGeneration();
    const ownerId = extractionOwnerId;
    if (!projectId || !ownerId || !getToken()) return;
    if (extractingSubjectsRef.current[projectId]?.session === extractionSession) return;
    const run = { session: extractionSession };
    extractingSubjectsRef.current[projectId] = run;
    const isCurrent = () => extractionMountedRef.current && getAuthSessionGeneration() === extractionSession
      && Boolean(getToken()) && extractingSubjectsRef.current[projectId] === run;
    const assertCurrent = () => { if (!isCurrent()) throw new Error('抽取会话已结束'); };
    const savePending = (value) => {
      assertCurrent();
      writePendingSubjectExtraction(projectId, ownerId, value);
    };
    setSubjectExtractionByProject((prev) => ({ ...prev, [projectId]: extractionSession }));
    const projectName = activeProjectNameForExtraction || projectId;
    setExtractErrorByProject((prev) => {
      const next = { ...prev };
      delete next[projectId];
      return next;
    });
    try {
      const storedPendingExtraction = readPendingSubjectExtraction(projectId, ownerId);
      if (['unknown', 'submitting'].includes(storedPendingExtraction?.status)) {
        throw new Error(storedPendingExtraction.error || '提交结果待确认，请先确认原任务状态，暂不重复提交');
      }
      const pendingExtraction = storedPendingExtraction?.status === 'failed' ? null : storedPendingExtraction;
      const getTaskStatusMessage = (task) => (
        task?.status_message || task?.statusMessage || task?.params?.status_message || ''
      );
      const pollScriptTask = async (initialTask, taskId, timeoutMessage) => {
        const deadline = Date.now() + 10 * 60 * 1000;
        let task = initialTask;
        let failures = 0;
        let statusMessage = getTaskStatusMessage(task) || pendingExtraction?.statusMessage || '';
        setSubjectExtractionStatusByProject((prev) => ({ ...prev, [projectId]: statusMessage }));
        while (Date.now() < deadline) {
          assertCurrent();
          const status = String(task?.status || '').toLowerCase();
          if (['completed', 'succeeded', 'success'].includes(status)) return task;
          if (['failed', 'error', 'cancelled', 'canceled'].includes(status)) {
            const error = new Error(task?.error?.message || task?.error?.detail || task?.status_message || '主体提取任务失败');
            error.taskTerminal = true;
            throw error;
          }
          await new Promise(resolve => setTimeout(resolve, 2500));
          assertCurrent();
          try {
            task = await apiGetScriptTask(projectId, taskId);
            assertCurrent();
            failures = 0;
          } catch (error) {
            assertCurrent();
            failures += 1;
            if (failures >= 3) throw new Error('网络持续异常，已暂停查询；重试将继续查询原任务', { cause: error });
            continue;
          }
          const nextStatusMessage = getTaskStatusMessage(task);
          if (nextStatusMessage) {
            statusMessage = nextStatusMessage;
            setSubjectExtractionStatusByProject((prev) => ({ ...prev, [projectId]: statusMessage }));
          }
          if (statusMessage) {
            savePending({
              ...(readPendingSubjectExtraction(projectId, ownerId) || {}),
              statusMessage,
            });
          }
        }
        throw new Error(timeoutMessage);
      };

      // 发布接口要求并发校验当前结构版本；主体页可能在剧本页打开后才进入，
      // 因此这里必须绕过缓存读取最新 revision，不能使用 null。
      let structureRevision = pendingExtraction?.sourceRevision;
      if (!pendingExtraction || pendingExtraction.phase === 'publish') {
        const latestStructure = pendingExtraction?.taskId ? null : await apiGetScriptStructure(projectId);
        assertCurrent();
        structureRevision = latestStructure?.revision
          ?? latestStructure?.data?.revision
          ?? latestStructure?.payload?.revision
          ?? structureRevision;
        if (structureRevision === undefined || structureRevision === null) {
          throw new Error('未读取到剧本结构版本，请先返回剧本页刷新后重试');
        }

        if (!pendingExtraction?.taskId) savePending({ phase: 'publish', status: 'submitting', sourceRevision: structureRevision, createdAt: Date.now() });
        const taskResponse = pendingExtraction?.taskId
          ? await apiGetScriptTask(projectId, pendingExtraction.taskId)
          : await apiPublishScriptStructure(projectId, {
            expected_revision: structureRevision,
            base_revision: structureRevision,
            publish_target: ['episodes'],
          });
        assertCurrent();
        const taskId = taskResponse?.task_id || taskResponse?.taskId || pendingExtraction?.taskId;
        if (!taskId) throw new Error('发布剧本结构接口未返回任务 ID');
        savePending({
          phase: 'publish',
          taskId,
          sourceRevision: structureRevision,
          statusMessage: getTaskStatusMessage(taskResponse),
          createdAt: Date.now(),
        });

        const storageUsage = await apiGetStorageUsage();
        assertCurrent();
        if (storageUsage?.writeBlocked) {
          throw new Error('当前存储空间不足，无法生成主体，请先清理项目资产');
        }
        await pollScriptTask(taskResponse, taskId, '剧本发布任务超时，请稍后重试');
      }

      assertCurrent();
      if (pendingExtraction?.phase !== 'results') {
        if (pendingExtraction?.phase !== 'subject') savePending({ phase: 'subject', status: 'submitting', sourceRevision: structureRevision, createdAt: Date.now() });
        const subjectTaskResponse = pendingExtraction?.phase === 'subject'
          ? await apiGetScriptTask(projectId, pendingExtraction.taskId)
          : await apiExtractSubjectsByEpisodes(projectId, {
            episode_ids: [],
            source_revision: structureRevision,
            force_retry: true,
          });
        assertCurrent();
        const subjectTaskId = subjectTaskResponse?.task_id || subjectTaskResponse?.taskId
          || (pendingExtraction?.phase === 'subject' ? pendingExtraction.taskId : null);
        if (!subjectTaskId) throw new Error('主体抽取接口未返回任务 ID');
        savePending({
          phase: 'subject',
          taskId: subjectTaskId,
          sourceRevision: structureRevision,
          statusMessage: getTaskStatusMessage(subjectTaskResponse),
          createdAt: Date.now(),
        });
        await pollScriptTask(subjectTaskResponse, subjectTaskId, '主体抽取任务超时，请稍后刷新主体列表');
        savePending({ phase: 'results', taskId: subjectTaskId, sourceRevision: structureRevision,
          status: 'paused', error: '主体抽取已完成，结果待读取；重试只刷新列表，不会重新抽取', createdAt: Date.now() });
      }

      if (!isCurrent()) return;
      if (currentProjectIdRef.current !== projectId) {
        showToast(`「${projectName}」主体抽取已完成，返回项目后可刷新结果`, 'success');
        return;
      }

      invalidate(K.subjectsPrefix(projectId));
      invalidate(K.projectOverview(projectId));
      const SUBJECT_LIMIT = 20;
      const refreshTargets = [
        ['chars', 'character', setSharedChars],
        ['scenes', 'scene', setSharedScenes],
        ['props', 'prop', setSharedProps],
      ].map(([key, type, setter]) => {
        const version = bumpSubjectRequest(key);
        subjectInFlight.current[key] = true;
        setSubjectPageMeta(prev => ({ ...prev, [key]: { ...prev[key], loading: true } }));
        return { key, type, setter, version };
      });
      const isCurrentRefresh = (target) => isCurrentSubjectRequest(
        target.key, target.version, projectId, extractionSession,
      );
      try {
        // 发布任务完成后可能暂未读到写入结果；只在仍拥有当前列表时继续补读。
        const loadPublishedSubjects = async () => {
          let pages;
          for (let attempt = 0; attempt < 5; attempt += 1) {
            if (!refreshTargets.some(isCurrentRefresh)) return null;
            pages = await Promise.all(refreshTargets.map(({ type }) => (
              apiGetSubjectsPage(projectId, { type, limit: SUBJECT_LIMIT })
            )));
            if (pages.some(page => page.list.length > 0) || attempt === 4) return pages;
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          return pages;
        };
        const pages = await loadPublishedSubjects();
        if (!pages || !refreshTargets.some(isCurrentRefresh)) return;
        if (!pages.some(page => page.list.length > 0)) {
          throw new Error('主体抽取任务已完成，但暂未读取到主体数据，请稍后重试');
        }
        refreshTargets.forEach((target, index) => {
          if (!isCurrentRefresh(target)) return;
          const page = pages[index];
          target.setter(normalizeSubjects(page.list));
          setSubjectPageMeta(prev => ({
            ...prev,
            [target.key]: { nextOffset: page.nextOffset, hasMore: page.hasMore, loading: false, rawList: page.list, error: false },
          }));
        });
        setForceExtract(false);
        clearPendingSubjectExtraction(projectId, ownerId);
        showToast(`「${projectName}」主体抽取完成`, 'success');
      } catch (error) {
        if (!refreshTargets.some(isCurrentRefresh)) return;
        refreshTargets.forEach((target) => {
          if (!isCurrentRefresh(target)) return;
          setSubjectPageMeta(prev => ({
            ...prev,
            [target.key]: { ...prev[target.key], loading: false, error: true, retryOffset: null },
          }));
        });
        throw error;
      } finally {
        refreshTargets.forEach(({ key, version }) => {
          if (subjectRequestVersions.current[key] === version) subjectInFlight.current[key] = false;
        });
      }
    } catch (err) {
      if (!isCurrent()) return;
      console.error('提取主体失败:', err);
      const saved = readPendingSubjectExtraction(projectId, ownerId);
      const unknown = ['submitting', 'unknown'].includes(saved?.status);
      const message = unknown
        ? '提交结果待确认，请先确认原任务状态，暂不重复提交'
        : err?.message || '主体抽取失败，请重试';
      try {
        savePending({
          ...saved,
          status: unknown ? 'unknown' : err.taskTerminal || !saved?.taskId ? 'failed' : 'paused',
          error: message,
          createdAt: Date.now(),
        });
      } catch (storageError) {
        console.error('保存抽取恢复记录失败:', storageError);
      }
      if (currentProjectIdRef.current === projectId) {
        setExtractErrorByProject((prev) => ({
          ...prev,
          [projectId]: message,
        }));
        showToast(message, 'error');
      }
    } finally {
      if (!isCurrent()) {
        if (extractingSubjectsRef.current[projectId] === run) delete extractingSubjectsRef.current[projectId];
      } else {
        delete extractingSubjectsRef.current[projectId];
        setSubjectExtractionByProject((prev) => {
          const next = { ...prev };
          delete next[projectId];
          return next;
        });
        setSubjectExtractionStatusByProject((prev) => {
          const next = { ...prev };
          delete next[projectId];
          return next;
        });
      }
    }
  }, [activeProjectIdForExtraction, activeProjectNameForExtraction, extractionOwnerId, showToast, bumpSubjectRequest, isCurrentSubjectRequest]);

  // 切回项目时，检查是否有暂存的提取结果等待应用
  useEffect(() => {
    const pid = activeProject?.id;
    if (!pid) return;
    const pending = pendingExtractionsRef.current[pid];
    if (!pending) return;
    setSharedChars(pending.chars);
    setSharedScenes(pending.scenes);
    setSharedProps(pending.props);
    setForceExtract(false);
    delete pendingExtractionsRef.current[pid];
  }, [activeProject?.id]);

  // 智能分镜生成回调（由 StoryboardPage 在挂载时调用）
  const handleGenerateStoryboards = async (submitOverride, retryFailed = false) => {
    const isCurrent = captureStoryboardScope();
    const projectId = activeProject?.id;
    const ownerId = extractionOwnerId;
    if (!isCurrent() || generatingStoryboardsRef.current) return;
    const run = {};
    generatingStoryboardsRef.current = run;
    setIsGeneratingStoryboards(true);
    setCompletedEpisodesCount(0);
    setStoryboardStatusMessage('');
    const pendingGeneration = readPendingStoryboardGeneration(projectId, ownerId);
    let taskId = pendingGeneration?.taskId || null;
    let settled = false;
    let submitted = Boolean(taskId);
    if (['unknown', 'submitting'].includes(pendingGeneration?.status) && !taskId) {
      setGenerateError(pendingGeneration.error || '上次提交结果尚未确认，请先核对后台任务，勿重复生成');
      setGenerateErrorProjectId(projectId);
      setIsGeneratingStoryboards(true);
      generatingStoryboardsRef.current = false;
      return;
    }
    if (pendingGeneration?.status === 'failed' && !submitOverride && !retryFailed) {
      setGenerateError(pendingGeneration.error || '分镜生成失败，请重试');
      setGenerateErrorProjectId(activeProject.id);
      setIsGeneratingStoryboards(false);
      generatingStoryboardsRef.current = false;
      return;
    }
    setGenerateError(null);
    setGenerateErrorProjectId(null);
    try {
      if (pendingGeneration?.status === 'failed' && (submitOverride || retryFailed)) {
        // 清理失败时停止，不能把旧任务当成可重新提交。
        submitted = false;
        clearPendingStoryboardGeneration(projectId, ownerId);
        taskId = null;
      }
      let freshEpisodes = await apiGetEpisodes(projectId);
      if (!isCurrent()) return;
      if (freshEpisodes.length === 0 && scriptContent) {
        const finalizeResult = await apiFinalizeScriptWorkspace(activeProject.id, {
          episode_count: null, model: null,
        });
        if (!isCurrent()) return;
        const finalized = finalizeResult?.items || finalizeResult?.episodes || finalizeResult?.data;
        if (Array.isArray(finalized) && finalized.length > 0) {
          freshEpisodes = finalized;
          setScriptEpisodes(freshEpisodes);
        }
      }

      // episode_number → episode_id 映射，用于按集失效缓存
      const episodeNumberToId = {};
      freshEpisodes.forEach(ep => {
        if (ep.episode_number != null && ep.id) {
          episodeNumberToId[ep.episode_number] = ep.id;
        }
      });

      // 1. 启动任务，拿到 taskId
      if (!taskId && submitOverride && !freshEpisodes[0]?.id) throw new Error('未找到可重新抽取的正式分集');
      if (!taskId) {
        writePendingStoryboardGeneration(projectId, ownerId, { status: 'submitting', createdAt: Date.now() });
        submitted = true;
      }
      const taskResp = taskId
        ? await apiGetTask(taskId)
        : await (submitOverride ? submitOverride(freshEpisodes) : apiGenerateStoryboardsFromFinalScript(projectId, { first_episode_only: true }));
      taskId = getStoryboardTaskId(taskResp) || taskId;
      const initialStatus = String(getStoryboardTaskStatus(taskResp) || '').toLowerCase();
      if (!taskId && !['completed', 'succeeded', 'success', 'done', 'partial', 'failed', 'error', 'cancelled', 'canceled'].includes(initialStatus)) {
        throw new Error('未获取到任务 ID');
      }
      if (taskId) {
        writePendingStoryboardGeneration(projectId, ownerId, { taskId, status: 'running', createdAt: pendingGeneration?.createdAt || Date.now() });
      }
      if (!isCurrent()) return;
      setStoryboardStatusMessage(getStoryboardTaskStatusMessage(taskResp));

      // 2. 轮询任务，每完成一集立即失效对应缓存，让 StoryboardPage 实时看到结果
      const TIMEOUT_MS = 3000 * 1000; // 3000 秒超时
      const INTERVAL = 3000;
      let finalTask = ['completed', 'succeeded', 'success', 'done', 'partial', 'failed', 'error', 'cancelled', 'canceled'].includes(initialStatus)
        ? taskResp
        : null;
      const notifiedEpisodeNumbers = new Set(); // 已通知过的分集，避免重复失效
      let prevCurrentEpisodeNumber = null; // 上次轮询时的 current_episode_number
      const pollStartTime = Date.now();

      const flushEpisode = (num) => {
        if (!isCurrent()) return;
        if (notifiedEpisodeNumbers.has(num)) return;
        notifiedEpisodeNumbers.add(num);
        setCompletedEpisodesCount(notifiedEpisodeNumbers.size);
        const epId = episodeNumberToId[num];
        if (!epId) return;
        invalidate(K.storyboards(activeProject.id, epId));
        invalidate(K.storyboards(activeProject.id));
        invalidate(K.storyboardPagePrefix(activeProject.id));
        apiGetStoryboards(activeProject.id, {
          episode_id: epId,
          limit: 10,
          include_gen_params: false,
        }).catch(() => {});
      };

      let pollCount = 0;
      while (!finalTask && Date.now() - pollStartTime < TIMEOUT_MS) {
        // 任务提交后先立即查询一次，后续查询再按 3 秒间隔执行。
        if (pollCount > 0) await new Promise(r => setTimeout(r, INTERVAL));
        if (!isCurrent()) return;
        pollCount += 1;
        if (Date.now() - pollStartTime >= TIMEOUT_MS) break;
        const t = await apiGetTask(taskId);
        if (!isCurrent()) return;
        setStoryboardStatusMessage(getStoryboardTaskStatusMessage(t));

        // 路径1：completed_episode_numbers 字段（后端明确告知哪些集已完成）
        const completedNums = t.completed_episode_numbers || t.params?.completed_episode_numbers;
        if (Array.isArray(completedNums)) {
          completedNums.forEach(num => flushEpisode(num));
        }

        // 路径2：current_episode_number 变化 → 说明上一集已完成
        const currentNum = t.current_episode_number ?? t.params?.current_episode_number;
        if (currentNum != null && prevCurrentEpisodeNumber != null && currentNum !== prevCurrentEpisodeNumber) {
          flushEpisode(prevCurrentEpisodeNumber);
        }
        if (currentNum != null) prevCurrentEpisodeNumber = currentNum;

        // 终态判断
        if (!isStoryboardTaskInProgress(t)) {
          finalTask = t;
          break;
        }
      }

      if (!finalTask) throw new Error('POLL_TIMEOUT');
      const finalStatus = String(getStoryboardTaskStatus(finalTask) || '').toLowerCase();
      if (['failed', 'error', 'cancelled', 'canceled'].includes(finalStatus)) {
        settled = true;
        const msg = getStoryboardTaskErrorMessage(finalTask) || '分镜生成失败';
        throw new Error(msg);
      }

      // OpenAPI 约定 partial 表示任务已结束但存在失败项。保留已成功结果，
      // 同时把失败数量反馈给用户，避免把部分失败静默当成完全成功。
      const failedCount = Number(finalTask.fail_count || finalTask.failCount || 0);
      if (['partial', 'completed_with_errors', 'completed_with_failures'].includes(finalStatus) && failedCount > 0) {
        settled = true;
        const detail = getStoryboardTaskErrorMessage(finalTask);
        throw new Error(detail || `智能分镜失败，失败 ${failedCount} 集`);
      }

      // 3. 任务完成，重新拉取最新 episodes（后端可能已创建新 UUID）
      if (!['completed', 'succeeded', 'success', 'done', 'partial'].includes(finalStatus)) throw new Error('任务状态尚未确认');
      const latestEpisodes = await apiGetEpisodes(projectId);
      if (!isCurrent()) return;

      // 4. 用最新 episodes 做兜底刷新分镜（确保用正确的 episode ID）
      const finalEpisodes = (Array.isArray(latestEpisodes) && latestEpisodes.length > 0)
        ? latestEpisodes : freshEpisodes;
      // 当前提交约定只处理首集，不能为确认结果扫描全项目所有分集。
      for (const ep of finalEpisodes.slice(0, 1)) {
        if (!ep.id) continue;
        invalidate(K.storyboards(activeProject.id, ep.id));
        invalidate(K.storyboardPagePrefix(activeProject.id));
        await apiGetStoryboards(activeProject.id, {
          episode_id: ep.id,
          limit: 10,
          include_gen_params: false,
        });
        if (!isCurrent()) return;
      }
      invalidate(K.storyboards(activeProject.id));
      invalidate(K.storyboardPagePrefix(activeProject.id));
      if (Array.isArray(latestEpisodes) && latestEpisodes.length > 0) setScriptEpisodes(latestEpisodes);
      clearPendingStoryboardGeneration(projectId, ownerId);

    } catch (err) {
      if (!isCurrent()) return;
      console.error('智能分镜生成失败:', err);
      const status = err?.status;
      const msg = err?.message || String(err);
      let errorMsg;
      if (msg === 'POLL_TIMEOUT') {
        errorMsg = '分镜查询超时，恢复后将查询原任务，请勿重复生成';
      } else if (status === 502) {
        errorMsg = '服务器繁忙，请稍后重试';
      } else if (status === 504 || msg.includes('timeout') || msg.includes('Timeout') || msg.includes('abort')) {
        errorMsg = '请求超时，请重试！';
      } else if (status === 500) {
        errorMsg = '服务器内部错误，请稍后重试';
      } else if (status === 503) {
        errorMsg = '服务暂时不可用，请稍后重试';
      } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('network')) {
        errorMsg = '网络连接失败，请检查网络后重试';
      } else if (msg) {
        errorMsg = `分镜生成失败：${msg}`;
      } else {
        errorMsg = '分镜生成失败，请重试';
      }
      if (submitted && !settled) errorMsg = taskId
        ? '生成结果尚未确认，点击重试将查询原任务，不会重复生成'
        : '提交结果尚未确认，请先核对后台任务，勿重复生成';
      setGenerateError(errorMsg);
      setGenerateErrorProjectId(activeProject?.id);
      if (submitted && !readPendingStoryboardGeneration(projectId, ownerId)?.blocked) {
        try {
          writePendingStoryboardGeneration(projectId, ownerId, { taskId, status: settled ? 'failed' : (taskId ? 'running' : 'unknown'), error: errorMsg, createdAt: Date.now() });
        } catch { showToast('任务记录保存失败，请勿重复生成，先核对后台任务', 'error'); }
      }
      showToast(errorMsg, 'error');
    } finally {
      if (isCurrent() && generatingStoryboardsRef.current === run) {
        const remaining = readPendingStoryboardGeneration(projectId, ownerId);
        setIsGeneratingStoryboards(Boolean(remaining && remaining.status !== 'failed'));
        setStoryboardStatusMessage('');
        generatingStoryboardsRef.current = false;
      }
    }
  };

  const handleRetryGenerateStoryboards = async () => {
    return handleGenerateStoryboards(undefined, true);
  };

  // 主体页确认重新生成后，进入分镜页并通过统一恢复链路提交覆盖任务。
  // 不能复用首次抽分镜接口，否则已有分镜状态会让页面只跳转而不发起重新生成请求。
  const handleRegenerateStoryboardsFromSubject = async () => {
    if (generatingStoryboardsRef.current || !activeProject?.id) return;
    const projectId = activeProject.id;
    const isCurrent = captureStoryboardScope();
    handleUnlockStep('storyboard');
    setStoryboardInitialEpisodeIndex(0);
    setActiveStep('storyboard');
    await handleGenerateStoryboards((freshEpisodes) => {
      if (!isCurrent() || !freshEpisodes[0]?.id) throw new Error('未找到可重新抽取的正式分集');
      return apiGenerateStoryboardsFromEpisode(projectId, {
        episode_id: freshEpisodes[0].id,
        model: null,
        overwrite_existing: true,
        confirm_overwrite: true,
      });
    });
  };

  // 刷新或离开分镜页后，恢复仍在执行的分镜任务；失败快照只恢复失败态，不会重复发起任务。
  useEffect(() => {
    const projectId = activeProject?.id;
    const pending = readPendingStoryboardGeneration(projectId, extractionOwnerId);
    if (!projectId) return;
    if (['failed', 'unknown', 'submitting'].includes(pending?.status)) {
      const frameId = requestAnimationFrame(() => {
        setGenerateError(pending.error || '提交结果尚未确认，请先核对后台任务，勿重复生成');
        setGenerateErrorProjectId(projectId);
        setIsGeneratingStoryboards(pending.status !== 'failed');
      });
      return () => cancelAnimationFrame(frameId);
    }
    if (!pending?.taskId || generatingStoryboardsRef.current) return;
    handleGenerateStoryboards();
    // 仅在项目切换时检查一次，避免状态更新导致重复恢复。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject?.id, extractionOwnerId]);

  useEffect(() => {
    const projectId = activeProject?.id;
    const pending = readPendingSubjectExtraction(projectId, extractionOwnerId);
    if (!projectId) return;
    if (!['failed', 'paused', 'unknown', 'submitting'].includes(pending?.status)) {
      const frameId = requestAnimationFrame(() => {
        setExtractErrorByProject((prev) => {
          const next = { ...prev };
          delete next[projectId];
          return next;
        });
        setSubjectExtractionStatusByProject((prev) => ({ ...prev, [projectId]: pending?.statusMessage || '' }));
      });
      return () => cancelAnimationFrame(frameId);
    }
    const frameId = requestAnimationFrame(() => {
      setExtractErrorByProject((prev) => ({
        ...prev,
        [projectId]: pending.error || '主体抽取失败，请重试',
      }));
      setSubjectExtractionStatusByProject((prev) => {
        const next = { ...prev };
        delete next[projectId];
        return next;
      });
    });
    return () => cancelAnimationFrame(frameId);
  }, [activeProject?.id, extractionOwnerId]);

  // 定稿成功回调：标记"提取主体后已重新定稿"，允许用户再次提取（弹确认弹窗）
  const handleScriptFinalized = () => {
    setScriptFinalizedSinceExtraction(true);
    if (activeProject?.id) {
      localStorage.setItem(`miioo_finalized_since_extraction_${activeProject.id}`, 'true');
    }
  };

  const handleNavChange = (key) => {
    if (key === 'assets') setAssetsEntry({ module: 'project', seedanceTab: 'real' });
    setActiveKey(key);
    setCanvasRouteId(null);
    if (key === 'canvas') updateWorkspaceUrl({ key: 'canvas' });
    setActiveProject(null);
    setActiveProjectId(null);
    setForceExtract(false);
    localStorage.removeItem('miioo_active_project_id');
    localStorage.removeItem('miioo_active_step');
          localStorage.removeItem('miioo_active_key');

    // 每次切到项目列表都从后端拉取最新数据
    if (key === 'project') {
      readProjects();
    }
  };

  const handleCreateCanvas = canvasProjects.create;

  const showApiBubble = !apiConfigOpen && (!isLoggedIn || (isLoggedIn && !apiConfigured));

  const bottomNavItems = useMemo(() => BOTTOM_NAV_ITEMS.map((item) => {
    if (item.key === 'menu') {
      return {
        ...item,
        popup: ({ close }) => (
          <MoreOptionsMenu close={close} setWatermarkSettingsOpen={setWatermarkSettingsOpen} />
        ),
      };
    }
    if (item.key !== 'api' || !showApiBubble) return item;
    return {
      ...item,
      bubble: <ApiConfigBubble />,
    };
  }), [showApiBubble, setWatermarkSettingsOpen]);

  const handleBottomNavChange = (key) => {
    if (key === 'api') {
      if (!isLoggedIn) { setLoginOpen(true); return; }
      setBottomActiveKey(null);
      setApiConfigOpen(true);
      return;
    }
    if (key === 'notifications') {
      setBottomActiveKey(null);
      setNotificationCenterOpen(true);
      return;
    }

    setBottomActiveKey((prev) => (prev === key ? null : key));
  };

  const handleProjectCreated = (project) => {
    // 新项目插入到列表最前面，统一字段映射：cover_url -> cover
    const normalized = { ...project, cover: project.cover ?? project.cover_url };
    setProjects((prev) => [normalized, ...prev]);
    // 清空旧项目的残留状态，避免闪现旧数据
    setScriptContent('');
    setScriptEpisodes([]);
    setScriptPhase('initial');
    setScriptHasStarted(false);
    setScriptFinalizedSinceExtraction(false);
    setSharedChars([]);
    setSharedScenes([]);
    setSharedProps([]);
    setEpisodeStatuses({});
    setUnlockedSteps(new Set());
    // 直接用创建接口返回的项目数据，无需再调一次 apiGetProject
    setActiveProject(normalized);
    setActiveProjectId(normalized.id);
    setActiveStep('script');
    setActiveKey('project');
    projectDetailOwner.current = { id: normalized.id, session: getAuthSessionGeneration() };
  };

  // 在 iframe 内（微信 redirect 回调）不渲染完整 UI，只执行 useEffect 回调逻辑
  if (window.self !== window.top) {
    return null;
  }

  if (canvasRouteId) {
    return <CanvasPage key={canvasRouteId} canvasId={canvasRouteId} onSelectCanvas={(id) => {
      setCanvasRouteId(id);
      updateWorkspaceUrl({ key: 'canvas-detail', canvasId: id });
    }} onCreateProject={handleCreateCanvas} onBackHome={() => {
      setCanvasRouteId(null);
      setActiveKey('home');
      updateWorkspaceUrl({ key: 'home' });
    }} onBackProjects={() => {
      setCanvasRouteId(null);
      setActiveKey('canvas');
      updateWorkspaceUrl({ key: 'canvas' });
    }} />;
  }

  return (
    <div className="[font-synthesis:none] overflow-clip w-screen h-screen relative bg-neutral-400 antialiased">
      <HomeBackground
        isHome={activeKey === 'home'}
        videoRef={bgVideoRef}
        videoSrc={BG_VIDEOS[0]}
        onVideoEnded={handleVideoEnded}
      />

      <div className="flex flex-col items-start absolute inset-0" style={{ paddingBottom: "0px" }}>
        {/* headbar */}
        {!activeProject ? (
        <HomeHeader
          activeKey={activeKey}
          isLoggedIn={isLoggedIn}
          currentUser={currentUser}
          onLogoClick={() => setActiveKey('home')}
          onLoginClick={() => setLoginOpen(true)}
          onLogout={handleLogout}
          onOpenProfile={() => setProfileOpen(true)}
          onGoToAdmin={onGoToAdmin}
          storageUsage={storageUsage}
          onGoToAssets={() => handleNavChange('assets')}
        />
        ) : (
        <WorkflowHeadbar
          activeStep={activeStep}
          onStepChange={setActiveStep}
          unlockedSteps={unlockedSteps}
          isLoggedIn={isLoggedIn}
          currentUser={currentUser}
          onLoginClick={() => setLoginOpen(true)}
          onLogout={handleLogout}
          onOpenProfile={() => setProfileOpen(true)}
          onGoToAdmin={onGoToAdmin}
          storageUsage={storageUsage}
          onGoToAssets={() => handleNavChange('assets')}
          onLogoClick={() => {
            setActiveProject(null);
            setActiveProjectId(null);
            setActiveKey('home');
            localStorage.removeItem('miioo_active_project_id');
            localStorage.removeItem('miioo_active_step');
          localStorage.removeItem('miioo_active_key');
          }}
        />
        )}

        {/* body: nav + content */}
        <div className="flex flex-1 min-h-0 overflow-hidden self-stretch w-auto">
          <HomeNavigationRail
            items={NAV_ITEMS}
            activeKey={activeKey}
            onChange={handleNavChange}
            bottomItems={bottomNavItems}
            bottomActiveKey={bottomActiveKey}
            onBottomChange={handleBottomNavChange}
          />

          {/* page content */}
          <Suspense
            fallback={(
              <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden">
                <DotsLoading size={6} color="#2DC3E1" gap={5} />
              </div>
            )}
          >
            <div
              className="flex-1 min-h-0 overflow-auto relative"
              style={{ overflow: activeKey === 'project' && activeProject && activeStep === 'script' ? 'visible' : undefined }}
            >
            <PageErrorBoundary key={`${activeKey}:${activeProject?.id || 'list'}:${activeStep}`} onRetry={() => {
              if (activeProject?.id) loadProjectDetails(activeProject.id);
            }}>
            {activeKey === 'home' && (
              <>
                <HomeSloganText />
                <StartCreationButton onClick={() => {
                  if (!isLoggedIn) { setLoginOpen(true); return; }
                  setNewProjectOpen(true);
                }} />
              </>
            )}
            {activeKey === 'canvas' && (
              <ProjectList
                key="canvas" title="自由画布项目"
                projects={canvasProjects.items}
                loading={canvasProjects.loading}
                error={canvasProjects.error}
                onRetry={canvasProjects.reload}
                onNewProject={handleCreateCanvas}
                onOpenProject={canvasProjects.open}
              />
            )}
            {activeKey === 'project' && projectRead && (
              <RemoteReadStatus loading={projectRead.loading} error={projectRead.error}
                onRetry={() => loadProjectDetails(projectRead.projectId, projectRead.requestedStep)} />
            )}
            {activeKey === 'project' && isLoadingProject && !projectRead && (
              <div style={{ width: '100%', height: '100%', minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DotsLoading size={6} color="#2DC3E1" gap={5} />
              </div>
            )}
            {activeKey === 'project' && !activeProject && !isLoadingProject && (
              <ProjectList
                key="project" title="工作流项目"
                projects={projects}
                loading={!projectsLoaded}
                error={projectsError}
                onRetry={readProjects}
                onNewProject={() => {
                  if (!isLoggedIn) { setLoginOpen(true); return; }
                  if (!apiConfigured) { setNoModelNoticeOpen(true); return; }
                  setNewProjectOpen(true);
                }}
                onOpenProject={(p) => {
                  setActiveKey('project');
                  loadProjectDetails(p.id);
                }}
                onRenameProject={(projectId, newName) => {
                  apiUpdateProject(projectId, { name: newName }).then(() => {
                    setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, name: newName } : p)));
                  });
                }}
                onCopyProject={(project) => {
                  apiCopyProject(project.id).then((created) => {
                    if (!created || !created.id) return;
                    const normalized = { ...created, cover: created.cover ?? created.cover_url };
                    setProjects((prev) => [normalized, ...prev]);
                  });
                }}
                onDeleteProject={(projectId) => {
                  apiDeleteProject(projectId).then(() => {
                    setProjects((prev) => prev.filter((p) => p.id !== projectId));
                  });
                }}
              />
            )}
            {activeKey === 'project' && activeProject && activeStep !== 'subject' && activeStep !== 'storyboard' && activeStep !== 'edit' && (
              <GlobalSettings
                key={`${activeProject.id}:${isLoggedIn ? currentUser.id || '' : ''}`}
                ownerId={isLoggedIn ? currentUser.id : null}
                projectId={activeProject.id}
                projectName={activeProject.name}
                projectDescription={activeProject.description || activeProject.desc}
                projectCoverUrl={activeProject.cover_url || activeProject.cover}
                projectRatio={activeProject.aspect_ratio || activeProject.ratio}
                projectStyle={activeProject.visual_style || activeProject.style}
                projectStyleLabel={activeProject.visual_style_label || activeProject.visualStyleLabel}
                projectStylePrompt={activeProject.visual_style_prompt || activeProject.visualStylePrompt}
                projectCreationType={activeProject.creation_type || activeProject.creation_mode || activeProject.project_type}
                onProjectUpdate={(updates) => {
                  const projectId = activeProject.id;
                  return enqueueProjectSave(projectId, () => apiUpdateProject(projectId, updates)).then(() => {
                    // 字段映射：cover_url -> cover
                    const mappedUpdates = { ...updates };
                    if (updates.cover_url !== undefined) {
                      mappedUpdates.cover = updates.cover_url;
                      showToast('封面保存成功', 'success');
                    }
                    setActiveProject((prev) => applyProjectSave(prev, projectId, mappedUpdates));
                    setProjects((prev) => prev.map((p) => applyProjectSave(p, projectId, mappedUpdates)));
                  });
                }}
                onBack={() => {
                  cancelProjectRead();
                  setActiveProject(null);
                  setActiveProjectId(null);
                  setForceExtract(false);
                  localStorage.removeItem('miioo_active_project_id');
                  localStorage.removeItem('miioo_active_step');
          localStorage.removeItem('miioo_active_key');
                }}
                showToast={showToast}
                activeStep={activeStep}
                onStepChange={setActiveStep}
                onUnlockStep={handleUnlockStep}
                isSubjectUnlocked={unlockedSteps.has('subject')}
                chars={sharedChars ?? []}
                scenes={sharedScenes ?? []}
                props={sharedProps ?? []}
                episodes={scriptEpisodes}
                onEpisodesChange={handleScriptEpisodesChange}
                scriptPhase={scriptPhase}
                onScriptPhaseChange={setScriptPhase}
                scriptHasStarted={scriptHasStarted}
                onScriptHasStartedChange={setScriptHasStarted}
                scriptContent={scriptContent}
                onScriptContentChange={handleScriptContentChange}
                scriptDraftContent={scriptDraftContent}
                onScriptDraftContentChange={setScriptDraftContent}
                onGoToSubject={(tab, options = {}) => {
                  setSubjectInitialTab(tab ?? 'char');
                  setForceExtract(!options.fromOverview);
                  handleUnlockStep('subject');
                  setActiveStep('subject');
                }}
                onGoToStoryboard={(episodeIndex) => {
                  setStoryboardInitialEpisodeIndex(episodeIndex);
                  handleUnlockStep('storyboard');
                  setActiveStep('storyboard');
                }}
                scriptFinalizedSinceExtraction={scriptFinalizedSinceExtraction}
                onScriptFinalized={handleScriptFinalized}
                episodeStatuses={displayEpisodeStatuses}
              />
            )}
            {activeKey === 'project' && activeProject && activeStep === 'subject' && (
              <SubjectPage
                key={activeProject.id}
                onRefreshSubjects={(projectId, session) => {
                  if (!getToken() || getAuthSessionGeneration() !== session
                    || projectDetailOwner.current?.id !== projectId
                    || projectDetailOwner.current?.session !== session) return;
                  return Promise.all(['character', 'scene', 'prop'].map(type => retrySubjects(type, true)));
                }}
                projectRatio={activeProject.aspect_ratio || activeProject.ratio}
                projectId={activeProject.id}
                projectName={activeProject.name}
                onGoToSeedanceLiveMaterials={() => {
                  setAssetsEntry({ module: 'seedance', seedanceTab: 'real' });
                  setActiveKey('assets');
                }}
                onBack={() => {
                  cancelProjectRead();
                  setActiveProject(null);
                  setActiveProjectId(null);
                  setForceExtract(false);
                  localStorage.removeItem('miioo_active_project_id');
                  localStorage.removeItem('miioo_active_step');
          localStorage.removeItem('miioo_active_key');
                }}
                episodeName="第一集"
                onUnlockStep={handleUnlockStep}
                initialTab={subjectInitialTab}
                chars={sharedChars}
                onCharsChange={setSharedChars}
                scenes={sharedScenes}
                onScenesChange={setSharedScenes}
                props={sharedProps}
                onPropsChange={setSharedProps}
                subjectsLoading={subjectPageMeta.chars.loading || subjectPageMeta.scenes.loading || subjectPageMeta.props.loading}
                isExtractingSubjects={subjectExtractionByProject[activeProject.id] === getAuthSessionGeneration() || (!activePendingExtraction?.status && !!activePendingExtraction?.taskId)}
                subjectExtractionStatusMessage={activeSubjectExtractionStatusMessage}
                isStoryboardGenerated={unlockedSteps.has('storyboard')}
                onStartStoryboard={() => {
                  handleUnlockStep('storyboard');
                  handleGenerateStoryboards();
                  setActiveStep('storyboard');
                }}
                onRegenerateStoryboard={handleRegenerateStoryboardsFromSubject}
                onExtractSubjects={(forceExtract || (!activePendingExtraction?.status && !!activePendingExtraction?.taskId))
                  ? handleExtractSubjects
                  : undefined}
                onRetryExtractSubjects={activeExtractError ? async () => {
                  setExtractErrorByProject((prev) => {
                    const next = { ...prev };
                    delete next[activeProject.id];
                    return next;
                  });
                  return handleExtractSubjects();
                } : undefined}
                extractError={activeExtractError}
                onLoadMoreChars={() => loadMoreSubjects('character')}
                onLoadMoreScenes={() => loadMoreSubjects('scene')}
                onLoadMoreProps={() => loadMoreSubjects('prop')}
                hasMoreChars={subjectPageMeta.chars.hasMore}
                hasMoreScenes={subjectPageMeta.scenes.hasMore}
                hasMoreProps={subjectPageMeta.props.hasMore}
                charsLoadError={!!subjectPageMeta.chars.error}
                scenesLoadError={!!subjectPageMeta.scenes.error}
                propsLoadError={!!subjectPageMeta.props.error}
                onRetryChars={() => retrySubjects('character')}
                onRetryScenes={() => retrySubjects('scene')}
                onRetryProps={() => retrySubjects('prop')}
              />
            )}
            {activeKey === 'project' && activeProject && activeStep === 'storyboard' && (
              <StoryboardPage
                ownerId={isLoggedIn ? currentUser.id : null}
                projectId={activeProject.id}
                projectName={activeProject.name}
                projectRatio={activeProject.aspect_ratio || activeProject.ratio}
                chars={sharedChars ?? []}
                scenes={sharedScenes ?? []}
                props={sharedProps ?? []}
                episodes={scriptEpisodes}
                initialEpisodeIndex={storyboardInitialEpisodeIndex}
                onUnlockStep={handleUnlockStep}
                onStartEdit={() => {
                  handleUnlockStep('edit');
                  setActiveStep('edit');
                }}
                onGenerateStoryboards={handleGenerateStoryboards}
                onRetryGenerateStoryboards={handleRetryGenerateStoryboards}
                isGenerating={isGeneratingStoryboards}
                statusMessage={storyboardStatusMessage}
                completedEpisodesCount={completedEpisodesCount}
                generateError={generateError}
              />
            )}
            {activeKey === 'project' && activeProject && activeStep === 'edit' && (
              <EditPage
                projectId={activeProject.id}
                projectName={activeProject.name}
                episodes={scriptEpisodes}
                onStepChange={setActiveStep}
                showToast={showToast}
              />
            )}
            {activeKey === 'assets' && (
              <AssetsPage
                key={assetsEntry.requestId || 'assets'}
                projects={projects}
                isLoggedIn={isLoggedIn}
                initialModule={assetsEntry.module}
                initialSeedanceTab={assetsEntry.seedanceTab}
              />
            )}
            <div style={{ display: activeKey === 'create' ? 'flex' : 'none', flexDirection: 'column', position: 'absolute', inset: 0 }}>
              <CreationPage
                key={isLoggedIn ? currentUser.id : 'guest'}
                ownerId={isLoggedIn ? currentUser.id : null}
                isLoggedIn={isLoggedIn}
                onLoginClick={() => setLoginOpen(true)}
                apiConfigured={apiConfigured}
                onShowNoModelNotice={() => setNoModelNoticeOpen(true)}
              />
            </div>
            </PageErrorBoundary>
            </div>
          </Suspense>
        </div>
      </div>

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onSuccess={async () => {
        setLoginOpen(false);
        setIsLoggedIn(true);
        // 登录成功后立即拉取用户信息，确保头像菜单中手机号等绑定状态即时正确显示
        try {
          const user = await apiGetCurrentUser();
          setCurrentUser({ ...user, avatar_url: normalizeImageUrl(user.avatar_url) ?? '' });
          await refreshStorageUsage();
        } catch (error) {
          console.warn('[Home] 登录后拉取用户信息失败:', error);
        }
        readProjects();
        apiListProviders().then((data) => {
          const providers = Array.isArray(data) ? data : (data?.providers || []);
          if (providers.length > 0) setApiConfigured(true);
        }).catch(() => {});
      }} />
      <ApiConfigModal open={apiConfigOpen} onClose={() => setApiConfigOpen(false)} onConfigured={() => setApiConfigured(true)} />
      {noModelNoticeOpen && (
        <NoModelNotice
          onConfigureAPI={() => {
            setNoModelNoticeOpen(false);
            setApiConfigOpen(true);
          }}
          onViewTutorial={() => setNoModelNoticeOpen(false)}
          onClose={() => setNoModelNoticeOpen(false)}
        />
      )}
      {isLoggedIn && currentUser.id && <SystemAnnouncementModal key={currentUser.id} userId={currentUser.id} showToast={showToast} onViewAll={() => setNotificationCenterOpen('system')} />}
      <NotificationCenterModal
        key={`${isLoggedIn}:${currentUser.id || ''}:${notificationCenterOpen}`}
        userId={isLoggedIn ? currentUser.id : null}
        open={Boolean(notificationCenterOpen)} initialTab={notificationCenterOpen === 'system' ? 'system' : 'creation'}
        onClose={() => setNotificationCenterOpen(false)}
        showToast={showToast}
      />
      <ProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onLogout={handleLogout}
        currentUser={currentUser}
        onProfileUpdated={(updated) => setCurrentUser(prev => ({ ...prev, ...updated, avatar_url: normalizeImageUrl(updated.avatar_url ?? prev.avatar_url) ?? '' }))}
      />
      <NewProjectModal
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
        showToast={showToast}
        onConfirm={(project) => {
          handleProjectCreated(project);
        }}
      />
      {watermarkSettingsOpen && (
        <WatermarkSettingsModal
          onClose={() => setWatermarkSettingsOpen(false)}
          showToast={showToast}
        />
      )}
      <StorageUsageReminderModal
        type={storageReminder}
        onClose={closeStorageReminder}
        onManageAssets={manageStorageAssets}
      />
    </div>
  );
}
