/**
 * @file Home.jsx
 * @structure-index
 *
 * ─── 全局常量 & 配置 ───────────────────────────────────────────────
 *   页面业务模块懒加载                                          L98–L103
 *   NAV_ITEMS / BOTTOM_NAV_ITEMS                                  components/home/HomeNavigationConfig.jsx
 *   STEP_TABS / WorkflowStepTabs                                components/home/WorkflowStepTabs.jsx
 *   BG_VIDEOS                                                   components/home/HomeNavigationConfig.jsx
 *
 * ─── 原子 UI 组件 ────────────────────────────────────────────────
 *   HomeSloganText / StartCreationButton / HomeLogo / HomeBackground / HomeHeader components/home
 *   QRCodePopup / MoreOptionsMenu                                components/home/HomeBottomMenus.jsx
 *   CreationManualButton / LoginButton                          components/home/HomeHeaderActions.jsx
 *   WorkflowHeadbar / ApiConfigBubble / HomeToast / HomeNavigationRail components/home/
 *
 * ─── 工具函数 ───────────────────────────────────────────────────
 *   normalizeSubjects(items) 主体列表标准化                      utils/subjectAdapter.js
 *   normalizeProjectList(data) 项目字段兼容与排序                 utils/projectAdapter.js
 *   buildEpisodeStatusMap(overview, episodes) 剧集状态适配         utils/episodeStatusAdapter.js
 *
 * ─── 主页面入口 ─────────────────────────────────────────────────
 *   export default function Home()                               L105
 *     ├─ [懒加载] 页面业务模块按需加载                             L98–L103
 *     ├─ [状态] 页面导航、模态开关、登录/API 状态、项目及工作流数据   L106–L160
 *     ├─ [函数] showToast / handleVideoEnded / handleLogout          L172 / L179 / L190
 *     │           loadProjectDetails / handleUnlockStep / loadMoreSubjects L252 / L649 / L659
 *     │           handleExtractSubjects / handleGenerateStoryboards        L701 / L766
 *     │           handleScriptFinalized / handleNavChange / handleBottomNavChange / handleProjectCreated
 *                                                               L900 / L907 / L942 / L958
 *     ├─ [副作用] 项目 ID / 步骤 / 导航 / 解锁状态持久化                 L161 / L213 / L227 / L234 / L244
 *     │           微信回调与鉴权初始化                                   L559 / L570
 *     │           项目列表、主体缓存、强制登出订阅及待处理提取恢复         L590 / L753
 *     ├─ [底部导航配置] bottomNavItems / ApiConfigBubble           L926–L940
 *     └─ [渲染] 页面业务模块统一通过 Suspense 按需加载              L984–L1296
 *
 * ─── 更新记录 ──────────────────────────────────────────────────────
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
 *   2026-07-16  迁移首页 Toast 展示至 components/home/HomeToast.jsx；页面继续持有提示状态、定时器和 showToast
 *   2026-07-17  迁移首页主导航与底部快捷导航布局至 components/home/HomeNavigationRail.jsx；页面继续负责导航状态和回调
 *   2026-07-06  新增 subject cache 订阅 useEffect，实时同步 sharedChars/sharedScenes/sharedProps
 *   2026-07-01  初始结构索引建立
 */

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { apiGetProjects, apiUpdateProject, apiCopyProject, apiDeleteProject, apiGetProject, apiGetProjectOverview } from '../api/project';
import { getToken, getRefreshToken, refreshAccessToken } from '../api/request';
import { clearTokens, apiLogout, apiCompleteWechatCallback } from '../api/auth';
import { apiListProviders } from '../api/config';
import { apiGetCurrentUser, apiGetNotifications } from '../api/user';
import { apiGetSubjects, apiGetSubjectsPage, apiGetEpisodes, apiGetScriptWorkspace, apiFinalizeScriptWorkspace, apiExtractSubjectsFromScript } from '../api/subject';
import { apiGetStoryboards, apiGenerateStoryboardsFromFinalScript, apiGetTask } from '../api/storyboard';
import { invalidate } from '../utils/cache';
import { normalizeImageUrl } from '../utils/imageUrl';
import { normalizeSubjects } from '../utils/subjectAdapter';
import { normalizeProjectList } from '../utils/projectAdapter';
import { buildEpisodeStatusMap } from '../utils/episodeStatusAdapter';
import { subscribe, peekCache } from '../utils/cache';
import { K, MEDIUM } from '../utils/cacheKeys';
import LoginModal from '../components/LoginModal';
import ApiConfigModal from '../components/ApiConfigModal';
import NoModelNotice from '../components/NoModelNotice';
import ProfileModal from '../components/ProfileModal';
import NewProjectModal from '../components/NewProjectModal';
import WatermarkSettingsModal from '../components/WatermarkSettingsModal';
import NotificationCenterModal from '../components/NotificationCenterModal';
import DotsLoading from '../components/DotsLoading';
import { BG_VIDEOS, NAV_ITEMS, BOTTOM_NAV_ITEMS } from '../components/home/HomeNavigationConfig';
import {
  HomeSloganText,
  StartCreationButton,
  MoreOptionsMenu,
  WorkflowHeadbar,
  ApiConfigBubble,
  HomeToast,
  HomeBackground,
  HomeHeader,
  HomeNavigationRail,
} from '../components/home';

const ProjectList = lazy(() => import('./ProjectList'));
const GlobalSettings = lazy(() => import('./GlobalSettings'));
const SubjectPage = lazy(() => import('./SubjectPage'));
const StoryboardPage = lazy(() => import('./StoryboardPage'));
const AssetsPage = lazy(() => import('./AssetsPage'));
const CreationPage = lazy(() => import('./CreationPage'));

export default function Home({ onGoToAdmin }) {
  const [activeKey, setActiveKey] = useState(() => {
    // 只有明确保存了非 home 的 activeKey 才恢复，否则默认 home
    const savedKey = localStorage.getItem('miioo_active_key');
    return savedKey || 'home';
  });
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
  const [activeProject, setActiveProject] = useState(null);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [projectsLoaded, setProjectsLoaded] = useState(() => !getToken());
  const [, setActiveProjectId] = useState(null);
  const [activeStep, setActiveStep] = useState('script'); // loadProjectDetails 会按项目恢复正确步骤
  const [subjectInitialTab, setSubjectInitialTab] = useState('char');
  const [sharedChars, setSharedChars] = useState(null);
  const [sharedScenes, setSharedScenes] = useState(null);
  const [sharedProps, setSharedProps] = useState(null);
  // 主体分页 meta：{ cursor, hasMore, loading, rawList }
  const [subjectPageMeta, setSubjectPageMeta] = useState({
    chars:  { nextOffset: null, hasMore: false, loading: false, rawList: [] },
    scenes: { nextOffset: null, hasMore: false, loading: false, rawList: [] },
    props:  { nextOffset: null, hasMore: false, loading: false, rawList: [] },
  });
  const [extractError, setExtractError] = useState(null);
  const [extractErrorProjectId, setExtractErrorProjectId] = useState(null);
  const [generateError, setGenerateError] = useState(null);
  const [generateErrorProjectId, setGenerateErrorProjectId] = useState(null);
  const [isGeneratingStoryboards, setIsGeneratingStoryboards] = useState(false);
  const [completedEpisodesCount, setCompletedEpisodesCount] = useState(0);
  const generatingStoryboardsRef = useRef(false); // 同步锁，防止并发调用
  // 自上次提取主体后，剧本是否又重新定稿过（用于控制"开始提取主体"按钮行为）
  const [scriptFinalizedSinceExtraction, setScriptFinalizedSinceExtraction] = useState(false);
  const [scriptEpisodes, setScriptEpisodes] = useState([]);
  const [scriptPhase, setScriptPhase] = useState('initial');
  const [scriptHasStarted, setScriptHasStarted] = useState(false);
  const [scriptContent, setScriptContent] = useState('');
  const [scriptDraftContent, setScriptDraftContent] = useState('');
  const [episodeStatuses, setEpisodeStatuses] = useState({});
  const [storyboardInitialEpisodeIndex, setStoryboardInitialEpisodeIndex] = useState(null);
  // Tracks which non-alwaysEnabled steps have ever had content — once unlocked, stays unlocked
  const [unlockedSteps, setUnlockedSteps] = useState(new Set());
  const [currentUser, setCurrentUser] = useState({});
  const [forceExtract, setForceExtract] = useState(false);
  const [, setNotifications] = useState([]);

  // 同步跟踪当前项目 ID
  useEffect(() => {
    currentProjectIdRef.current = activeProject?.id || null;
  }, [activeProject?.id]);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  // 跨项目异步操作的 pending 结果暂存
  const pendingExtractionsRef = useRef({}); // { projectId: { chars, scenes, props } }
  const currentProjectIdRef = useRef(null);  // 同步跟踪当前项目
  const bgVideoRef = useRef(null);
  const currentVideoIndexRef = useRef(0);

  const showToast = (msg, type = 'warning') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 2500);
  };

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
    try {
      // 调用后端退出登录接口
      await apiLogout();
    } catch (error) {
      console.error('退出登录接口调用失败:', error);
    }

    // 清除登录凭证
    clearTokens();

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
    if (activeKey !== 'home') {
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
  const loadProjectDetails = async (projectId) => {
    setIsLoadingProject(true);
    // 每次进入项目时主动失效 episodes 和 overview 缓存，确保拿到后端最新数据
    invalidate(K.episodes(projectId));
    invalidate(K.projectOverview(projectId));
    try {
      // 0. 切换项目前先清空旧项目所有数据状态，避免闪现旧数据
      setActiveProject(null);
      setActiveStep('script');
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
      if (extractErrorProjectId !== projectId) {
        setExtractError(null);
        setExtractErrorProjectId(null);
      }
      if (generateErrorProjectId !== projectId) {
        setGenerateError(null);
        setGenerateErrorProjectId(null);
      }
      setSubjectInitialTab('char');

      // ── 缓存快速路径：如果核心数据都有缓存，立即填充并关掉 loading ──────────
      const cachedProject = peekCache(K.project(projectId), MEDIUM.CONTENT);
      const cachedEpisodes = peekCache(K.episodes(projectId), MEDIUM.CONTENT);
      const cachedScript = peekCache(K.script(projectId), MEDIUM.CONTENT);
      const cachedChars = peekCache(K.subjects(projectId, 'character'), MEDIUM.CONTENT);
      const cachedScenes = peekCache(K.subjects(projectId, 'scene'), MEDIUM.CONTENT);
      const cachedProps = peekCache(K.subjects(projectId, 'prop'), MEDIUM.CONTENT);

      if (cachedProject && cachedEpisodes) {
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
        const savedStep = localStorage.getItem(`miioo_active_step_${projectId}`);
        setActiveStep(savedStep || 'script');
        const savedUnlocked = localStorage.getItem(`miioo_unlocked_steps_${projectId}`);
        if (savedUnlocked) setUnlockedSteps(new Set(JSON.parse(savedUnlocked)));
        const savedFinalized = localStorage.getItem(`miioo_finalized_since_extraction_${projectId}`);
        setScriptFinalizedSinceExtraction(savedFinalized === 'true');
        // 立即关掉 loading，让 StoryboardPage 先渲染缓存数据
        setIsLoadingProject(false);
        // 后台继续刷新（不阻塞 UI）
      }
      // ── 结束缓存快速路径 ────────────────────────────────────────────────────
      // 1. 加载项目基本信息
      const projectData = await apiGetProject(projectId);
      setActiveProject(projectData);

      // 2. 恢复步骤解锁状态（从 localStorage，按项目 ID）
      const savedUnlocked = localStorage.getItem(`miioo_unlocked_steps_${projectId}`);
      if (savedUnlocked) {
        setUnlockedSteps(new Set(JSON.parse(savedUnlocked)));
      } else {
        setUnlockedSteps(new Set());
      }

      // 如果后端已有主体数据，自动解锁 subject 步骤
      // （避免换浏览器/清缓存后明明有数据却被锁住）
      if (!savedUnlocked || !JSON.parse(savedUnlocked).includes('subject')) {
        try {
          const anySubjects = await apiGetSubjects(projectId, { type: 'character' }).catch(() => []);
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
      const savedStep = localStorage.getItem(`miioo_active_step_${projectId}`);
      setActiveStep(savedStep || 'script');

      // 3. 并行加载所有数据
      const SUBJECT_LIMIT = 20;
      const [scriptData, charsPage, scenesPage, propsPage, episodesData, overviewData] = await Promise.all([
        apiGetScriptWorkspace(projectId).catch(err => {
          console.error('加载剧本数据失败:', err);
          return { content: '', episodes: [], phase: 'initial' };
        }),
        // 注意：失败时返回 error 哨兵，而非空列表。
        // 否则某一类主体接口 500（如后端主图脏数据触发 MultipleResultsFound）会被吞成空数组，
        // 直接清空该类卡片，让用户误以为数据被删。error 标记让下方保留原有卡片并提示重试。
        apiGetSubjectsPage(projectId, { type: 'character', limit: SUBJECT_LIMIT }).catch((err) => ({ error: true, err })),
        apiGetSubjectsPage(projectId, { type: 'scene', limit: SUBJECT_LIMIT }).catch((err) => ({ error: true, err })),
        apiGetSubjectsPage(projectId, { type: 'prop', limit: SUBJECT_LIMIT }).catch((err) => ({ error: true, err })),
        apiGetEpisodes(projectId).catch(() => []),
        apiGetProjectOverview(projectId).catch(() => null),
      ]);

      // 4. 更新状态
      const scriptContent = scriptData.script?.content || scriptData.content || '';
      setScriptContent(scriptContent);
      setScriptEpisodes(episodesData || []);
      setScriptPhase(scriptContent ? 'view' : 'initial');
      setScriptHasStarted(!!scriptContent);

      // 某类主体加载失败时：不覆盖已有卡片（避免误清空），仅在 meta 上标记 error 供 UI 提示重试。
      // 加载成功时才写入最新数据。
      if (!charsPage.error)  setSharedChars(normalizeSubjects(charsPage.list));
      if (!scenesPage.error) setSharedScenes(normalizeSubjects(scenesPage.list));
      if (!propsPage.error)  setSharedProps(normalizeSubjects(propsPage.list));

      const buildMeta = (page) => page.error
        ? { nextOffset: null, hasMore: false, loading: false, rawList: null, error: true }
        : { nextOffset: page.nextOffset, hasMore: page.hasMore, loading: false, rawList: page.list, error: false };
      setSubjectPageMeta((prev) => ({
        // 失败类保留上一次的分页 meta（rawList 等），只把 error 标记合并进去，
        // 这样已加载的卡片和「加载更多」状态不被清掉。
        chars:  charsPage.error  ? { ...(prev?.chars  || {}), loading: false, error: true } : buildMeta(charsPage),
        scenes: scenesPage.error ? { ...(prev?.scenes || {}), loading: false, error: true } : buildMeta(scenesPage),
        props:  propsPage.error  ? { ...(prev?.props  || {}), loading: false, error: true } : buildMeta(propsPage),
      }));

      // 从后端数据中提取剧集状态，纯转换交给适配工具。
      const statusMap = buildEpisodeStatusMap(overviewData, episodesData);
      if (Object.keys(statusMap).length > 0) setEpisodeStatuses(statusMap);

      // 5. 加载分镜数据（需要剧集 ID）并用最新 episodesData 的 ID 写入缓存
      if (episodesData.length > 0) {
        // 先清空所有旧的分镜缓存（包含旧 episode ID 的 key），避免 StoryboardPage 用错 ID
        invalidate(K.storyboardsPrefix(projectId));
        const storyboardsData = await apiGetStoryboards(projectId, {
          episode_id: episodesData[0].id
        }).catch(() => []);

        // 根据分镜数据判断是否解锁分镜步骤
        if (storyboardsData.length > 0) {
          setUnlockedSteps(prev => new Set([...prev, 'storyboard']));
        }
      }

    } catch (error) {
      console.error('加载项目详情失败:', error);
      // 加载失败时清除缓存
      localStorage.removeItem('miioo_active_project_id');
      localStorage.removeItem('miioo_active_step');
      localStorage.removeItem('miioo_active_key');
      setActiveProject(null);
      setActiveProjectId(null);
    } finally {
      setIsLoadingProject(false);
    }
  };

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

      try {
        const user = await apiGetCurrentUser();
        setIsLoggedIn(true);
        setCurrentUser({ ...user, avatar_url: normalizeImageUrl(user.avatar_url) ?? '' });
      } catch {
        // 401 / 其他鉴权错误 → authFetch 已清 token + 触发 logout 事件
        setProjectsLoaded(true);
        return; // 阻止后续加载
      }
      // 仅在验证成功时加载鉴权数据（此时 token 必然有效）
      if (!getToken()) return;
      refreshAccessToken().finally(() => {
      apiGetProjects().then((data) => {
        const normalized = normalizeProjectList(data);
        // 按创建时间倒序排列，最新的在前
        setProjects(normalized);

        // 只在项目页面（activeKey === 'project'）且有缓存项目 ID 时才恢复
        const savedProjectId = localStorage.getItem('miioo_active_project_id');
        const savedKey = localStorage.getItem('miioo_active_key');

        if (savedKey === 'project' && savedProjectId) {
          const exists = normalized.some(p => p.id === savedProjectId);
          if (exists) {
            setActiveProjectId(savedProjectId);
            loadProjectDetails(savedProjectId);
          } else {
            // 项目已被删除，清除缓存
            localStorage.removeItem('miioo_active_project_id');
            localStorage.removeItem('miioo_active_step');
            localStorage.removeItem('miioo_active_key');
          }
        }
      }).catch(() => {}).finally(() => {
        setProjectsLoaded(true);
      });
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
    const unsubscribe = subscribe(K.projects(), (data) => {
      if (Array.isArray(data)) {
        const normalized = normalizeProjectList(data);
        setProjects(normalized);
      }
    });
    return unsubscribe;
  }, []);

  // 订阅主体缓存更新 —— 当 SubjectPage 修改主体（如更换定稿图）后，分镜页面自动同步最新参考图
  useEffect(() => {
    if (!activeProject?.id) return;
    const pid = activeProject.id;
    const unsubs = [
      subscribe(K.subjects(pid, 'character'), (data) => {
        const list = Array.isArray(data) ? data : (data?.list || data?.items || []);
        if (list.length > 0) setSharedChars(normalizeSubjects(list));
      }),
      subscribe(K.subjects(pid, 'scene'), (data) => {
        const list = Array.isArray(data) ? data : (data?.list || data?.items || []);
        if (list.length > 0) setSharedScenes(normalizeSubjects(list));
      }),
      subscribe(K.subjects(pid, 'prop'), (data) => {
        const list = Array.isArray(data) ? data : (data?.list || data?.items || []);
        if (list.length > 0) setSharedProps(normalizeSubjects(list));
      }),
    ];
    return () => unsubs.forEach((fn) => fn());
  }, [activeProject?.id]);

  useEffect(() => {
    const handleForceLogout = () => {
      if (!localStorage.getItem('token')) return;
      setIsLoggedIn(false);
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
        apiGetSubjectsPage(projectId, { type, limit: SUBJECT_LIMIT })
          .then((page) => {
            SETTERS[key](normalizeSubjects(page.list));
            setSubjectPageMeta((prev) => ({
              ...prev,
              [key]: { nextOffset: page.nextOffset, hasMore: page.hasMore, loading: false, rawList: page.list },
            }));
          })
          .catch((err) => {
            console.error(`资产删除后刷新主体数据失败（${type}）:`, err);
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
  }, [activeProject?.id]);

  const handleUnlockStep = (stepKey) => {
    setUnlockedSteps((prev) => {
      if (prev.has(stepKey)) return prev;
      const next = new Set(prev);
      next.add(stepKey);
      return next;
    });
  };

  // 加载更多主体（滚动触底时调用）
  const loadMoreSubjects = async (type) => {
    const key = type === 'character' ? 'chars' : type === 'scene' ? 'scenes' : 'props';
    const meta = subjectPageMeta[key];
    if (!meta || meta.loading || !meta.hasMore) return;
    setSubjectPageMeta(prev => ({ ...prev, [key]: { ...prev[key], loading: true } }));
    try {
      const page = await apiGetSubjectsPage(activeProject.id, { type, limit: 20, offset: meta.nextOffset });
      const newItems = normalizeSubjects(page.list);
      if (key === 'chars') setSharedChars(prev => [...(prev || []), ...newItems]);
      else if (key === 'scenes') setSharedScenes(prev => [...(prev || []), ...newItems]);
      else setSharedProps(prev => [...(prev || []), ...newItems]);
      setSubjectPageMeta(prev => ({
        ...prev,
        [key]: { nextOffset: page.nextOffset, hasMore: page.hasMore, loading: false, rawList: [...meta.rawList, ...page.list] },
      }));
    } catch (err) {
      console.error(`[Home] 加载更多主体失败 (${type}):`, err);
      setSubjectPageMeta(prev => ({ ...prev, [key]: { ...prev[key], loading: false } }));
    }
  };

  // 重试单类主体首屏加载（首屏 500 后由 SubjectPage 的错误条触发）
  const retrySubjects = async (type) => {
    const key = type === 'character' ? 'chars' : type === 'scene' ? 'scenes' : 'props';
    setSubjectPageMeta(prev => ({ ...prev, [key]: { ...prev[key], loading: true } }));
    try {
      const page = await apiGetSubjectsPage(activeProject.id, { type, limit: 20 });
      const items = normalizeSubjects(page.list);
      if (key === 'chars') setSharedChars(items);
      else if (key === 'scenes') setSharedScenes(items);
      else setSharedProps(items);
      setSubjectPageMeta(prev => ({
        ...prev,
        [key]: { nextOffset: page.nextOffset, hasMore: page.hasMore, loading: false, rawList: page.list, error: false },
      }));
    } catch (err) {
      console.error(`[Home] 重试加载主体失败 (${type}):`, err);
      setSubjectPageMeta(prev => ({ ...prev, [key]: { ...prev[key], loading: false, error: true } }));
    }
  };

  // 提取主体回调（由 SubjectPage 在挂载时调用）
  const handleExtractSubjects = async () => {
    const projectId = activeProject.id;
    const projectName = activeProject.name || projectId;
    setExtractError(null);
    try {
      // 调用主动提取接口（POST）而非仅查询已有主体
      const result = await apiExtractSubjectsFromScript(projectId);
      const allSubjects = [...(result.created || []), ...(result.updated || [])];

      const charsData = allSubjects.filter(s => s.type === 'character');
      const scenesData = allSubjects.filter(s => s.type === 'scene');
      const propsData = allSubjects.filter(s => s.type === 'prop');

      const normalizedChars = normalizeSubjects(charsData);
      const normalizedScenes = normalizeSubjects(scenesData);
      const normalizedProps = normalizeSubjects(propsData);

      if (normalizedChars.length === 0 && normalizedScenes.length === 0 && normalizedProps.length === 0) {
        if (currentProjectIdRef.current === projectId) {
          setExtractError('提取主体失败，请稍后重试');
          setExtractErrorProjectId(projectId);
          showToast('提取主体失败，请稍后重试', 'error');
        }
        return;
      }

      // 项目已切换：暂存结果 + toast 通知
      if (currentProjectIdRef.current !== projectId) {
        pendingExtractionsRef.current[projectId] = {
          chars: normalizedChars,
          scenes: normalizedScenes,
          props: normalizedProps,
        };
        showToast(`「${projectName}」主体抽取完成`, 'success');
        return;
      }

      setSharedChars(normalizedChars);
      setSharedScenes(normalizedScenes);
      setSharedProps(normalizedProps);
      setForceExtract(false);
    } catch (err) {
      console.error('提取主体失败:', err);
      if (currentProjectIdRef.current === projectId) {
        setExtractError('提取主体失败，请重试');
        setExtractErrorProjectId(projectId);
        showToast('提取主体失败，请重试', 'error');
      }
    }
  };

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
  const handleGenerateStoryboards = async () => {
    if (generatingStoryboardsRef.current) return;
    generatingStoryboardsRef.current = true;
    setIsGeneratingStoryboards(true);
    setCompletedEpisodesCount(0);
    setGenerateError(null);
    setGenerateErrorProjectId(null);
    try {
      let freshEpisodes = await apiGetEpisodes(activeProject.id).catch(() => []);
      if (freshEpisodes.length === 0 && scriptContent) {
        const finalizeResult = await apiFinalizeScriptWorkspace(activeProject.id, {
          episode_count: null, model: null,
        });
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
      const taskResp = await apiGenerateStoryboardsFromFinalScript(activeProject.id);
      const taskId = taskResp?.id;
      if (!taskId) throw new Error('未获取到任务 ID');

      // 2. 轮询任务，每完成一集立即失效对应缓存，让 StoryboardPage 实时看到结果
      const TIMEOUT_MS = 500 * 1000; // 500 秒超时
      const INTERVAL = 3000;
      let finalTask = null;
      const notifiedEpisodeNumbers = new Set(); // 已通知过的分集，避免重复失效
      let prevCurrentEpisodeNumber = null; // 上次轮询时的 current_episode_number
      const pollStartTime = Date.now();

      const flushEpisode = (num) => {
        if (notifiedEpisodeNumbers.has(num)) return;
        notifiedEpisodeNumbers.add(num);
        setCompletedEpisodesCount(notifiedEpisodeNumbers.size);
        const epId = episodeNumberToId[num];
        if (!epId) return;
        invalidate(K.storyboards(activeProject.id, epId));
        invalidate(K.storyboards(activeProject.id));
        apiGetStoryboards(activeProject.id, { episode_id: epId }).catch(() => {});
      };

      while (Date.now() - pollStartTime < TIMEOUT_MS) {
        await new Promise(r => setTimeout(r, INTERVAL));
        if (Date.now() - pollStartTime >= TIMEOUT_MS) break;
        const t = await apiGetTask(taskId).catch(() => null);
        if (!t) continue;
        console.log('[poll] task status:', t.status, 'params:', JSON.stringify(t.params));

        // 路径1：completed_episode_numbers 字段（后端明确告知哪些集已完成）
        const completedNums = t.params?.completed_episode_numbers;
        if (Array.isArray(completedNums)) {
          completedNums.forEach(num => flushEpisode(num));
        }

        // 路径2：current_episode_number 变化 → 说明上一集已完成
        const currentNum = t.params?.current_episode_number;
        if (currentNum != null && prevCurrentEpisodeNumber != null && currentNum !== prevCurrentEpisodeNumber) {
          flushEpisode(prevCurrentEpisodeNumber);
        }
        if (currentNum != null) prevCurrentEpisodeNumber = currentNum;

        // 终态判断
        const status = t.status;
        if (status !== 'pending' && status !== 'running') {
          finalTask = t;
          break;
        }
      }

      if (!finalTask) throw new Error('POLL_TIMEOUT');
      if (finalTask.status === 'failed') {
        const msg = finalTask.params?.status_message || finalTask.params?.error || '分镜生成失败';
        throw new Error(msg);
      }

      // 3. 任务完成，重新拉取最新 episodes（后端可能已创建新 UUID）
      const latestEpisodes = await apiGetEpisodes(activeProject.id).catch(() => freshEpisodes);
      if (Array.isArray(latestEpisodes) && latestEpisodes.length > 0) {
        setScriptEpisodes(latestEpisodes);
      }

      // 4. 用最新 episodes 做兜底刷新分镜（确保用正确的 episode ID）
      const finalEpisodes = (Array.isArray(latestEpisodes) && latestEpisodes.length > 0)
        ? latestEpisodes : freshEpisodes;
      finalEpisodes.forEach(ep => {
        if (!ep.id) return;
        invalidate(K.storyboards(activeProject.id, ep.id));
        apiGetStoryboards(activeProject.id, { episode_id: ep.id }).catch(() => {});
      });
      invalidate(K.storyboards(activeProject.id));
      apiGetStoryboards(activeProject.id).catch(() => {});

    } catch (err) {
      console.error('智能分镜生成失败:', err);
      const status = err?.status;
      const msg = err?.message || String(err);
      let errorMsg;
      if (msg === 'POLL_TIMEOUT') {
        errorMsg = '剧本生成超时，请重新生成';
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
      setGenerateError(errorMsg);
      setGenerateErrorProjectId(activeProject?.id);
      showToast(errorMsg, 'error');
    }
    setIsGeneratingStoryboards(false);
    generatingStoryboardsRef.current = false;
  };

  // 定稿成功回调：标记"提取主体后已重新定稿"，允许用户再次提取（弹确认弹窗）
  const handleScriptFinalized = () => {
    setScriptFinalizedSinceExtraction(true);
    if (activeProject?.id) {
      localStorage.setItem(`miioo_finalized_since_extraction_${activeProject.id}`, 'true');
    }
  };

  const handleNavChange = (key) => {
    setActiveKey(key);
    setActiveProject(null);
    setActiveProjectId(null);
    localStorage.removeItem('miioo_active_project_id');
    localStorage.removeItem('miioo_active_step');
          localStorage.removeItem('miioo_active_key');

    // 每次切到项目列表都从后端拉取最新数据
    if (key === 'project') {
      apiGetProjects().then((data) => {
        const normalized = normalizeProjectList(data);
        setProjects(normalized);
      }).catch(() => {});
    }
  };

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
  };

  // 在 iframe 内（微信 redirect 回调）不渲染完整 UI，只执行 useEffect 回调逻辑
  if (window.self !== window.top) {
    return null;
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
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden relative">
            {activeKey === 'home' && (
              <>
                <HomeSloganText />
                <StartCreationButton onClick={() => {
                  if (!isLoggedIn) { setLoginOpen(true); return; }
                  setNewProjectOpen(true);
                }} />
              </>
            )}
            {activeKey === 'project' && isLoadingProject && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DotsLoading size={6} color="#2DC3E1" gap={5} />
              </div>
            )}
            {activeKey === 'project' && !activeProject && !isLoadingProject && projectsLoaded && (
              <ProjectList
                projects={projects}
                onNewProject={() => {
                  if (!isLoggedIn) { setLoginOpen(true); return; }
                  if (!apiConfigured) { setNoModelNoticeOpen(true); return; }
                  setNewProjectOpen(true);
                }}
                onOpenProject={(p) => {
                  loadProjectDetails(p.id);
                  setActiveKey('project');
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
            {activeKey === 'project' && activeProject && activeStep !== 'subject' && activeStep !== 'storyboard' && (
              <GlobalSettings
                key={activeProject.id}
                projectId={activeProject.id}
                projectName={activeProject.name}
                projectDescription={activeProject.description || activeProject.desc}
                projectCoverUrl={activeProject.cover_url || activeProject.cover}
                projectRatio={activeProject.aspect_ratio || activeProject.ratio}
                projectStyle={activeProject.visual_style || activeProject.style}
                onProjectUpdate={(updates) => {
                  return apiUpdateProject(activeProject.id, updates).then(() => {
                    // 字段映射：cover_url -> cover
                    const mappedUpdates = { ...updates };
                    if (updates.cover_url !== undefined) {
                      mappedUpdates.cover = updates.cover_url;
                      showToast('封面保存成功', 'success');
                    }
                    setActiveProject((prev) => ({ ...prev, ...mappedUpdates }));
                    setProjects((prev) => prev.map((p) => (p.id === activeProject.id ? { ...p, ...mappedUpdates } : p)));
                  });
                }}
                onBack={() => {
                  setActiveProject(null);
                  setActiveProjectId(null);
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
                onEpisodesChange={setScriptEpisodes}
                scriptPhase={scriptPhase}
                onScriptPhaseChange={setScriptPhase}
                scriptHasStarted={scriptHasStarted}
                onScriptHasStartedChange={setScriptHasStarted}
                scriptContent={scriptContent}
                onScriptContentChange={setScriptContent}
                scriptDraftContent={scriptDraftContent}
                onScriptDraftContentChange={setScriptDraftContent}
                onGoToSubject={(tab) => {
                  setSubjectInitialTab(tab ?? 'char');
                  setForceExtract(true);
                  handleUnlockStep('subject');
                  setActiveStep('subject');
                }}
                scriptFinalizedSinceExtraction={scriptFinalizedSinceExtraction}
                onScriptFinalized={handleScriptFinalized}
                episodeStatuses={episodeStatuses}
                onGoToStoryboard={(episodeIndex) => {
                  setStoryboardInitialEpisodeIndex(episodeIndex);
                  handleUnlockStep('storyboard');
                  setActiveStep('storyboard');
                }}
              />
            )}
            {activeKey === 'project' && activeProject && activeStep === 'subject' && (
              <SubjectPage
                projectRatio={activeProject.aspect_ratio || activeProject.ratio}
                projectId={activeProject.id}
                projectName={activeProject.name}
                onBack={() => {
                  setActiveProject(null);
                  setActiveProjectId(null);
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
                isStoryboardGenerated={unlockedSteps.has('storyboard')}
                onStartStoryboard={() => {
                  handleUnlockStep('storyboard');
                  handleGenerateStoryboards();
                  setActiveStep('storyboard');
                }}
                onExtractSubjects={forceExtract ? handleExtractSubjects : undefined}
                extractError={extractError}
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
                projectId={activeProject.id}
                projectName={activeProject.name}
                projectRatio={activeProject.aspect_ratio || activeProject.ratio}
                chars={sharedChars ?? []}
                scenes={sharedScenes ?? []}
                props={sharedProps ?? []}
                episodes={scriptEpisodes}
                initialEpisodeIndex={storyboardInitialEpisodeIndex}
                onUnlockStep={handleUnlockStep}
                onGenerateStoryboards={handleGenerateStoryboards}
                isGenerating={isGeneratingStoryboards}
                completedEpisodesCount={completedEpisodesCount}
                generateError={generateError}
                onVideoGenerated={(episodeIndex) => {
                  setEpisodeStatuses((prev) => {
                    if (prev[episodeIndex] === 'generated' || prev[episodeIndex] === 'edited') return prev;
                    return { ...prev, [episodeIndex]: 'generated' };
                  });
                }}
              />
            )}
            {activeKey === 'assets' && (
              <AssetsPage projects={projects} isLoggedIn={isLoggedIn} />
            )}
            {activeKey === 'create' && (
              <CreationPage
                isLoggedIn={isLoggedIn}
                onLoginClick={() => setLoginOpen(true)}
                apiConfigured={apiConfigured}
                onShowNoModelNotice={() => setNoModelNoticeOpen(true)}
              />
            )}
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
        } catch (error) {
          console.warn('[Home] 登录后拉取用户信息失败:', error);
        }
        apiGetProjects().then((data) => {
          const normalized = normalizeProjectList(data);
          setProjects(normalized);
        }).catch(() => {});
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
      <NotificationCenterModal
        open={notificationCenterOpen}
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
      <HomeToast toast={toast} />
    </div>
  );
}
