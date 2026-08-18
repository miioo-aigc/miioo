/**
 * @file ScriptPage.jsx
 * @structure-index
 *
 * ─── 全局常量 & 工具函数 ─────────────────────────────────────────────
 *   FONT / CHAT_TIMEOUT_MS / 页面级常量                                  L53–L60
 *   formatEpisodeHeaders                                                   L79
 *
 * ─── 反馈与输入区组件 ─────────────────────────────────────────────────
 *   Toast                                                                  L176
 *
 * ─── 剧本展示与编辑组件 ───────────────────────────────────────────────
 *   ScriptOutlineLoading / ScriptOutlineWorkspace / ScriptEpisodeOutline / ScriptStoryboardDocument / ScriptModifyConfirmModal src/components/script/
 *
 * ─── 主页面入口 ───────────────────────────────────────────────────────
 *   export default ScriptPage()                                         L218
 *     ├─ [状态] 受控/非受控 phase、剧本内容、入口文件、模型、集数/时长、消息和编排任务
 *     ├─ [函数] handleSend L997 / handleScriptFileSelect L723 / handleOpenScriptOutline L273 / handleStop L694
 *     └─ [副作用] 工作区加载、编排任务恢复与轮询、流式请求、剧本和分集同步
 *
 * ─── 更新记录 ────────────────────────────────────────────────────────
 *   2026-07-15  抽离 InputCard、ScriptEmptyState 及输入区子组件，页面仅保留输入区编排
 *   2026-07-16  补齐流式暂停回调的 setPhase 依赖，避免闭包使用旧阶段更新函数
 *   2026-07-21  重做初始创作入口，输入卡移除上传并增加单集时长，分镜文件仅保留本地状态
 *   2026-07-21  接入持久化对话消息区，移除本地输入历史缓存
 *   2026-07-21  移除左侧剧集结构导航，保留剧集数据同步和定稿流程
 *   2026-07-21  接入确认初稿后的结构化编排页、异步任务轮询和刷新恢复
 *   2026-07-21  分集剧情接入后端重排、重写、编辑保存和删除操作
 *   2026-07-21  修复新增分集重排时重复插入 ID 导致中间插入失效
 *   2026-07-21  将项目详情中的后端设定回填到编排页整体设定
 *   2026-07-22  补充编排页下一步箭头，并在主体解锁后提供下载与修改剧本动作
 *   2026-07-22  增加修改剧本二次确认及主体解锁后的分集操作隐藏规则
 *   2026-07-22  下载改为读取最新结构化分集，确认修改后留在编排页并恢复分集编辑操作
 *   2026-07-22  初始创作流程统一使用消息区，移除整稿富文本编辑模式
 *   2026-07-22  上传普通剧本直接进入结构化编排；分镜脚本接入 Excel 异步导入和任务轮询
 *   2026-07-22  将编排页整块内容区设为滚动容器，内部结构继续保持 960px 居中
 *   2026-07-22  保持编排定位器脱离滚动层并绝对垂直居中
 *   2026-07-22  将编排页外层设为非滚动视口，避免定位器随页面滚动
 *   2026-07-22  统一从分镜导入任务和工作区恢复编排类型，避免误渲染分集剧情
 *   2026-07-27  将 OneLinkAI 结构字段提取异常转换为可执行的模型切换提示
 *   2026-07-27  AI 分集与重写处理中仅遮罩剧本内容区，保留导航可见
 *   2026-08-06  分镜脚本下载缺少后端地址时改用项目工作区下载接口兜底
 *   2026-08-07  剧本对话超时后发送前等待旧任务释放，并用同一请求 ID处理忙碌重试
 *   2026-08-10  剧本生成中允许编辑输入；统一剧本对话超时反馈
 *   2026-08-10  移除发送前的前端任务拦截，发送直接透传到后端剧本对话接口
 *   2026-08-11  分集/重写任务对齐后端：幂等头、缓存失效、409 提示、localStorage 恢复与轮询清理
 *   2026-08-18  已确认项目收到 SCRIPT_ALREADY_CONFIRMED 时从工作区恢复已有结构，避免重复 confirm
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { apiGetScriptWorkspace, normalizeScriptMessages, normalizeScriptStructure, normalizeStoryboardFileInfo, isStoryboardScriptSource, apiChatScriptWorkspaceStream, apiInterruptScriptChatTurn, apiUploadScriptWorkspace, apiImportStoryboardXlsx, apiDownloadStoryboardFile, apiConfirmScriptWorkspace, apiGetScriptStructure, apiGetScriptTask, apiResplitScriptStructure, apiRegenerateScriptEpisode, apiPatchScriptStructure, SCRIPT_SCHEMA_VERSION } from '../api/subject';
import { Button } from '../components/ui';
import { InputCard, ScriptEmptyState, ScriptMessageArea, ScriptOutlineLoading, ScriptOutlineWorkspace, ScriptModifyConfirmModal } from '../components/script';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

const CHAT_TIMEOUT_MS = 30 * 60 * 1_000; // 30 分钟客户端超时兜底（后端通常先返回 504）
const SCRIPT_OUTLINE_POLL_INTERVAL_MS = 1_200;
const SCRIPT_OUTLINE_TIMEOUT_MS = 30 * 60 * 1_000;
const SCRIPT_OUTLINE_TYPE_STORAGE_PREFIX = 'miioo:script-outline-type:';
const SCRIPT_OPERATION_STORAGE_PREFIX = 'miioo:script-operation:';

function getScriptTaskId(task) {
  if (!task || typeof task !== 'object') return null;
  return task.task_id
    || task.taskId
    || task.task?.task_id
    || task.task?.taskId
    || task.active_task?.task_id
    || task.active_task?.taskId
    || task.active_operation?.task_id
    || task.active_operation?.taskId
    || null;
}

/**
 * 将后端返回的"第X集"转换为 Markdown 二级标题 `## 第X集`，
 * 以便剧本展示区保持统一的标题层级。
 * 兼容：纯文本"第X集"、已有一级标题"# 第X集"、无空格"#第X集"。
 */
function formatEpisodeHeaders(content) {
  if (!content) return '';
  return content.replace(/^(?:#\s*)?第(\d+)集/gm, '## 第$1集');
}

function sanitizeDownloadName(name, fallback = '剧本') {
  const normalized = String(name || '').trim().replace(/[\\/:*?"<>|]/g, '_');
  return normalized || fallback;
}

function getScriptOutlineTaskErrorMessage(error) {
  const message = typeof error === 'string'
    ? error
    : error?.message || error?.detail || '';
  const detailMessage = typeof error?.details === 'string'
    ? error.details
    : error?.details?.error || error?.details?.message || '';
  const combinedMessage = `${message} ${detailMessage}`;
  const isModelStructureExtractionError = error?.code === 'SCRIPT_TASK_FAILED'
    && combinedMessage.includes('剧本结构字段提取失败')
    && combinedMessage.includes('OneLinkAI')
    && combinedMessage.includes('暂时无法识别');

  if (isModelStructureExtractionError) {
    return '当前模型报错，请尝试切换默认对话模型后重试';
  }

  return message || '剧本解析失败，请重试';
}

function scriptOutlineTypeStorageKey(projectId) {
  return projectId ? `${SCRIPT_OUTLINE_TYPE_STORAGE_PREFIX}${projectId}` : '';
}

function readStoredScriptOutlineType(projectId) {
  if (typeof window === 'undefined') return '';
  const key = scriptOutlineTypeStorageKey(projectId);
  if (!key) return '';
  try {
    return window.sessionStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function storeScriptOutlineType(projectId, type) {
  if (typeof window === 'undefined') return;
  const key = scriptOutlineTypeStorageKey(projectId);
  if (!key) return;
  try {
    if (type) window.sessionStorage.setItem(key, type);
    else window.sessionStorage.removeItem(key);
  } catch {
    // 存储不可用时仍以当前页面状态为准。
  }
}

function scriptOperationStorageKey(projectId) {
  return projectId ? `${SCRIPT_OPERATION_STORAGE_PREFIX}${projectId}` : '';
}

function persistScriptOperation(projectId, taskId) {
  if (typeof window === 'undefined') return;
  const key = scriptOperationStorageKey(projectId);
  if (!key || !taskId) return;
  try {
    window.localStorage.setItem(key, JSON.stringify({ task_id: taskId, started_at: Date.now() }));
  } catch {
    // 存储不可用时仍可依靠后端 active_operation 恢复。
  }
}

function readStoredScriptOperationTaskId(projectId) {
  if (typeof window === 'undefined') return '';
  const key = scriptOperationStorageKey(projectId);
  if (!key) return '';
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return '';
    const stored = JSON.parse(raw);
    return stored?.task_id || stored?.taskId || '';
  } catch {
    return '';
  }
}

function clearStoredScriptOperation(projectId) {
  if (typeof window === 'undefined') return;
  const key = scriptOperationStorageKey(projectId);
  if (!key) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // 忽略存储异常。
  }
}

function Toast({ toasts }) {
  return (
    <div style={{ position: 'fixed', top: '25vh', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', pointerEvents: 'none' }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-center gap-[8px] px-[16px] py-[8px] rounded-medium bg-toast-bg backdrop-blur-[20px]"
          style={{ whiteSpace: 'nowrap', animation: 'slideUpBounce 250ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}
        >
          {t.type === 'success' && (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
              <path d="M8 14.667C9.841 14.667 11.508 13.921 12.714 12.714C13.921 11.508 14.667 9.841 14.667 8C14.667 6.159 13.921 4.492 12.714 3.286C11.508 2.08 9.841 1.333 8 1.333C6.159 1.333 4.492 2.08 3.286 3.286C2.08 4.492 1.333 6.159 1.333 8C1.333 9.841 2.08 11.508 3.286 12.714C4.492 13.921 6.159 14.667 8 14.667Z" fill="#52BF92" stroke="#52BF92" strokeWidth="1.333" strokeLinejoin="round" />
              <path d="M5.333 8L7.333 10L11.333 6" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {t.type === 'warning' && (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
              <path d="M8 14.667C9.841 14.667 11.508 13.921 12.714 12.714C13.921 11.508 14.667 9.841 14.667 8C14.667 6.159 13.921 4.492 12.714 3.286C11.508 2.08 9.841 1.333 8 1.333C6.159 1.333 4.492 2.08 3.286 3.286C2.08 4.492 1.333 6.159 1.333 8C1.333 9.841 2.08 11.508 3.286 12.714C4.492 13.921 6.159 14.667 8 14.667Z" fill="#EB8B14" stroke="#EB8B14" strokeWidth="1.333" strokeLinejoin="round" />
              <path fillRule="evenodd" clipRule="evenodd" d="M8 12.333C8.46 12.333 8.833 11.96 8.833 11.5C8.833 11.04 8.46 10.667 8 10.667C7.54 10.667 7.167 11.04 7.167 11.5C7.167 11.96 7.54 12.333 8 12.333Z" fill="#FFFFFF" />
              <path d="M8 4V9.333" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {t.type === 'info' && (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
              <path d="M8 14.667C9.841 14.667 11.508 13.921 12.714 12.714C13.921 11.508 14.667 9.841 14.667 8C14.667 6.159 13.921 4.492 12.714 3.286C11.508 2.08 9.841 1.333 8 1.333C6.159 1.333 4.492 2.08 3.286 3.286C2.08 4.492 1.333 6.159 1.333 8C1.333 9.841 2.08 11.508 3.286 12.714C4.492 13.921 6.159 14.667 8 14.667Z" fill="#2DC3E1" stroke="#2DC3E1" strokeWidth="1.333" strokeLinejoin="round" />
              <path d="M8 7.333V11.333" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round" />
              <circle cx="8" cy="5" r="0.667" fill="#FFFFFF" />
            </svg>
          )}
          {t.type === 'error' && (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
              <path d="M8 14.667C9.841 14.667 11.508 13.921 12.714 12.714C13.921 11.508 14.667 9.841 14.667 8C14.667 6.159 13.921 4.492 12.714 3.286C11.508 2.08 9.841 1.333 8 1.333C6.159 1.333 4.492 2.08 3.286 3.286C2.08 4.492 1.333 6.159 1.333 8C1.333 9.841 2.08 11.508 3.286 12.714C4.492 13.921 6.159 14.667 8 14.667Z" fill="#F75F5F" stroke="#F75F5F" strokeWidth="1.333" strokeLinejoin="round" />
              <path d="M5.333 5.333L10.667 10.667M10.667 5.333L5.333 10.667" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round" />
            </svg>
          )}
          <span className="text-text-primary text-font-size-16 font-font-weight-regular" style={{ fontFamily: FONT }}>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

export default function ScriptPage({ projectId, projectName = '', projectVisualStyle, projectAspectRatio, projectCreationType, onGoToSubject, onEpisodesChange, phase: phaseProp, onPhaseChange, hasStarted: hasStartedProp, onHasStartedChange, scriptContent: scriptContentProp, onScriptContentChange, isSubjectUnlocked = false }) {
  const [phaseLocal, setPhaseLocalRaw] = useState('initial');
  const [hasStartedLocal, setHasStartedLocalRaw] = useState(false);
  const [scriptContentLocal, setScriptContentLocalRaw] = useState('');

  const isControlled = phaseProp !== undefined;
  const phase = isControlled ? phaseProp : phaseLocal;
  const hasStarted = isControlled ? hasStartedProp : hasStartedLocal;
  const scriptContent = isControlled ? scriptContentProp : scriptContentLocal;

  const setPhase = isControlled ? onPhaseChange : setPhaseLocalRaw;
  const setHasStarted = isControlled ? onHasStartedChange : setHasStartedLocalRaw;
  const setScriptContent = isControlled ? onScriptContentChange : setScriptContentLocalRaw;
  // 仅在超时时设为已发送的内容，触发输入框恢复；成功/用户主动停止保持 '' 不恢复
  const [inputRestoreText, setInputRestoreText] = useState('');
  const [scriptInputFile, setScriptInputFile] = useState(null);
  const [storyboardInputFile, setStoryboardInputFile] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [episodeCount, setEpisodeCount] = useState(null);
  const [episodeDuration, setEpisodeDuration] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeMessageId, setActiveMessageId] = useState(null);
  const [scriptOutlineMode, setScriptOutlineMode] = useState(false);
  const [scriptOutlineLoading, setScriptOutlineLoading] = useState(false);
  const [scriptOutlineError, setScriptOutlineError] = useState('');
  const [scriptOutlineData, setScriptOutlineData] = useState(null);
  const [scriptOutlineTaskId, setScriptOutlineTaskId] = useState(null);
  const [scriptOutlineType, setScriptOutlineType] = useState('script');
  const [storyboardFileName, setStoryboardFileName] = useState('');
  const [storyboardDownloadUrl, setStoryboardDownloadUrl] = useState('');
  const [modifyConfirmOpen, setModifyConfirmOpen] = useState(false);
  const [scriptModificationMode, setScriptModificationMode] = useState(false);
  const [episodeActionLoading, setEpisodeActionLoading] = useState(false);
  const [episodeActionError, setEpisodeActionError] = useState('');
  const stopReasonRef = useRef(null); // 'user-thinking' | 'user-streaming' | null
  const abortControllerRef = useRef(null); // 用于取消进行中的流式请求
  const chatInterruptPromiseRef = useRef(null);
  const chatSendLockRef = useRef(false);
  const outlinePollStartedAtRef = useRef(null);
  const scriptContentContainerRef = useRef(null);

  const setOutlineType = useCallback((type) => {
    setScriptOutlineType(type);
    storeScriptOutlineType(projectId, type);
  }, [projectId]);

  const scriptContentRef = useRef(scriptContent);
  scriptContentRef.current = scriptContent;
  const showToast = (message, type = 'error') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  };

  const handleOpenScriptOutline = useCallback(async ({ skipContentCheck = false, force = false } = {}) => {
    if (!projectId || (scriptOutlineLoading && !force)) return;
    if (!skipContentCheck && !scriptContentRef.current) {
      showToast('当前没有可确认的剧本内容', 'warning');
      return;
    }

    setScriptOutlineMode(true);
    setScriptOutlineLoading(true);
    setScriptOutlineError('');
    setScriptOutlineData(null);
    setScriptOutlineTaskId(null);
    outlinePollStartedAtRef.current = Date.now();

    try {
      // confirm 的并发版本来自主剧本草稿，不是结构草稿 revision。
      // 这里必须绕过页面缓存，避免用旧的 draft_revision 触发 SCRIPT_REVISION_CONFLICT。
      const workspace = await apiGetScriptWorkspace(projectId, { fresh: true });
      const draftRevision = workspace?.script?.draft_revision
        ?? workspace?.draft_revision
        ?? 0;
      let accepted;
      try {
        accepted = await apiConfirmScriptWorkspace(projectId, {
          expected_draft_revision: draftRevision,
          // 确认时提交后端当前支持的结构协议版本。
          schema_version: SCRIPT_SCHEMA_VERSION,
          client_request_id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `script-outline-${Date.now()}`,
          idempotency_key: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `script-outline-key-${Date.now()}`,
        });
      } catch (error) {
        if (error?.status !== 409) throw error;

        // 项目已进入结构化阶段时，confirm 不允许重复调用；直接读取已有结构即可恢复页面。
        if (error?.code === 'SCRIPT_ALREADY_CONFIRMED') {
          const latestWorkspace = await apiGetScriptWorkspace(projectId, { fresh: true });
          if (!latestWorkspace?.structure) {
            throw new Error('剧本已经进入结构化阶段，但结构数据暂时不可用，请刷新后重试', { cause: error });
          }
          setScriptOutlineData(normalizeScriptStructure(latestWorkspace.structure));
          setScriptOutlineLoading(false);
          return;
        }

        // 409 可能表示后端已接受过本次确认，重新读取工作区即可恢复任务或已生成结构。
        const responseTaskId = getScriptTaskId(error?.rawPayload);
        if (responseTaskId) {
          setScriptOutlineTaskId(responseTaskId);
          return;
        }
        const latestWorkspace = await apiGetScriptWorkspace(projectId, { fresh: true });
        const recoveredTaskId = getScriptTaskId(latestWorkspace);
        if (recoveredTaskId) {
          setScriptOutlineTaskId(recoveredTaskId);
          return;
        }
        if (latestWorkspace?.structure) {
          setScriptOutlineData(normalizeScriptStructure(latestWorkspace.structure));
          setScriptOutlineLoading(false);
          return;
        }
        if (error?.code === 'SCRIPT_REVISION_CONFLICT') {
          throw new Error('剧本版本已更新，请重新加载后再确认初稿', { cause: error });
        }
        throw new Error('当前剧本正在处理中，请稍后重试', { cause: error });
      }

      const taskId = getScriptTaskId(accepted);
      const acceptedStatus = String(accepted?.status || '').toLowerCase();
      if (taskId) {
        setScriptOutlineTaskId(taskId);
        return;
      }
      if (accepted?.structure || ['completed', 'success', 'succeeded'].includes(acceptedStatus)) {
        const latestStructure = await apiGetScriptStructure(projectId);
        setScriptOutlineData(normalizeScriptStructure(latestStructure));
        setScriptOutlineLoading(false);
        return;
      }

      // 兼容确认响应不带 task_id、但工作区已经写入 active_task 的后端实现。
      const latestWorkspace = await apiGetScriptWorkspace(projectId, { fresh: true });
      const activeTaskId = getScriptTaskId(latestWorkspace);
      if (activeTaskId) {
        setScriptOutlineTaskId(activeTaskId);
        return;
      }
      if (latestWorkspace?.structure) {
        setScriptOutlineData(normalizeScriptStructure(latestWorkspace.structure));
        setScriptOutlineLoading(false);
        return;
      }
      throw new Error('确认请求未返回任务编号，请稍后重试');
    } catch (error) {
      console.error('[ScriptPage] 确认剧本编排失败:', error);
      setScriptOutlineLoading(false);
      const message = error?.code === 'SCRIPT_SCHEMA_UNSUPPORTED'
        ? `当前后端不支持结构协议「${SCRIPT_SCHEMA_VERSION}」，请确认服务端版本后重试`
        : error?.message || '剧本解析失败，请重试';
      setScriptOutlineError(message);
    }
  }, [projectId, scriptOutlineLoading]);

  const waitForScriptOperation = useCallback(async (taskId) => {
    if (!taskId) throw new Error('剧本操作未返回任务编号');
    const startedAt = Date.now();
    while (Date.now() - startedAt <= SCRIPT_OUTLINE_TIMEOUT_MS) {
      const task = await apiGetScriptTask(projectId, taskId);
      const status = String(task?.status || '').toLowerCase();
      if (['completed', 'success', 'succeeded'].includes(status)) return task;
      if (['failed', 'error', 'cancelled', 'canceled'].includes(status)) {
        const error = task?.error;
        throw new Error(typeof error === 'string' ? error : error?.message || error?.detail || '剧本结构操作失败');
      }
      await new Promise((resolve) => window.setTimeout(resolve, SCRIPT_OUTLINE_POLL_INTERVAL_MS));
    }
    const timeoutError = new Error('剧本任务超时，请刷新页面查看最新结果');
    timeoutError.isTimeout = true;
    throw timeoutError;
  }, [projectId]);

  const refreshScriptOutline = useCallback(async () => {
    const structure = await apiGetScriptStructure(projectId);
    const normalizedStructure = normalizeScriptStructure(structure);
    setScriptOutlineData(normalizedStructure);
    return normalizedStructure;
  }, [projectId]);

  const runEpisodeOperation = useCallback(async (operation) => {
    if (!projectId || episodeActionLoading) return false;
    setEpisodeActionLoading(true);
    setEpisodeActionError('');
    try {
      const accepted = await operation();
      const taskId = getScriptTaskId(accepted);
      if (!taskId) throw new Error('剧本任务已受理但未返回任务 ID，请刷新后重试');
      persistScriptOperation(projectId, taskId);
      await waitForScriptOperation(taskId);
      clearStoredScriptOperation(projectId);
      await refreshScriptOutline();
      return true;
    } catch (error) {
      console.error('[ScriptPage] 分集剧情操作失败:', error);
      if (!error?.isTimeout && error?.code !== 'OPERATION_ACTIVE') clearStoredScriptOperation(projectId);
      let message = error?.message || '分集剧情操作失败，请重试';
      if (error?.code === 'STRUCTURE_REVISION_CONFLICT') {
        message = '结构版本已更新，请刷新后重试';
      } else if (error?.code === 'OPERATION_ACTIVE') {
        message = '当前已有剧本任务正在处理，请稍候';
      }
      setEpisodeActionError(message);
      showToast(message, 'error');
      return false;
    } finally {
      setEpisodeActionLoading(false);
    }
  }, [episodeActionLoading, projectId, refreshScriptOutline, waitForScriptOperation]);

  const runStructurePatch = useCallback(async (operation, { refresh = true, throwOnError = false } = {}) => {
    if (!projectId || episodeActionLoading) return;
    setEpisodeActionLoading(true);
    setEpisodeActionError('');
    try {
      const result = await operation();
      const refreshedStructure = refresh ? await refreshScriptOutline() : null;
      return { result, refreshedStructure };
    } catch (error) {
      console.error('[ScriptPage] 保存分集剧情失败:', error);
      setEpisodeActionError(error?.message || '保存分集剧情失败，请重试');
      if (throwOnError) throw error;
    } finally {
      setEpisodeActionLoading(false);
    }
  }, [episodeActionLoading, projectId, refreshScriptOutline]);

  const handleResplitEpisodes = useCallback((params) => runEpisodeOperation(() => apiResplitScriptStructure(projectId, params)), [projectId, runEpisodeOperation]);
  const handleRegenerateEpisode = useCallback((itemId, params) => runEpisodeOperation(() => apiRegenerateScriptEpisode(projectId, itemId, params)), [projectId, runEpisodeOperation]);
  const handlePatchEpisodeStructure = useCallback((params) => runStructurePatch(() => apiPatchScriptStructure(projectId, params)), [projectId, runStructurePatch]);
  const handleAddEpisode = useCallback((afterEpisodeId) => {
    const clientTempId = `episode-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const previousStructure = scriptOutlineData;
    const previousEpisodes = scriptOutlineData?.episodes || [];
    const optimisticEpisode = { id: clientTempId, title: '未命名', name: '未命名', content: '', summary: '' };
    const insertIndex = afterEpisodeId
      ? Math.max(0, previousEpisodes.findIndex((episode) => episode.id === afterEpisodeId) + 1)
      : previousEpisodes.length;
    const optimisticEpisodes = [...previousEpisodes];
    optimisticEpisodes.splice(insertIndex, 0, optimisticEpisode);

    // 先在点击的间隔位置显示临时分集，接口返回前不让后端的暂时顺序覆盖它。
    setScriptOutlineData((current) => current ? { ...current, episodes: optimisticEpisodes } : current);

    void (async () => {
      try {
      const existingEpisodeIds = new Set(previousEpisodes.map((episode) => episode.id).filter(Boolean));
      await runStructurePatch(async () => {
        const result = await apiPatchScriptStructure(projectId, {
          expected_revision: previousStructure?.revision || 0,
          operations: [{
            type: 'add_item',
            target: 'episode_plots',
            value: { title: '未命名', name: '未命名', content: '', summary: '' },
            client_temp_id: clientTempId,
          }],
          after_item_id: afterEpisodeId || null,
        });

        const refreshedStructure = normalizeScriptStructure(await apiGetScriptStructure(projectId));
        const addedEpisodeId = result?.temp_id_map?.[clientTempId]
          || refreshedStructure?.episodes?.find((episode) => episode.id && !existingEpisodeIds.has(episode.id))?.id;
        if (!addedEpisodeId) throw new Error('新增分集未返回有效的分集编号');

        if (afterEpisodeId) {
          const currentIds = refreshedStructure.episodes
            .map((episode) => episode.id)
            .filter((id) => id && id !== addedEpisodeId);
          const anchorIndex = currentIds.indexOf(afterEpisodeId);
          if (anchorIndex >= 0) {
            const orderedItemIds = [
              ...currentIds.slice(0, anchorIndex + 1),
              addedEpisodeId,
              ...currentIds.slice(anchorIndex + 1),
            ];
            await apiPatchScriptStructure(projectId, {
              expected_revision: refreshedStructure.revision,
              operations: [{ type: 'reorder_items', target: 'episode_plots', ordered_item_ids: orderedItemIds }],
            });
          }
        }

        return { addedEpisodeId };
      }, { refresh: false, throwOnError: true });

      await refreshScriptOutline();
      } catch {
        setScriptOutlineData(previousStructure);
      }
    })();

    return clientTempId;
  }, [projectId, refreshScriptOutline, runStructurePatch, scriptOutlineData]);
  const handleDeleteEpisode = useCallback((itemId, revision) => runStructurePatch(() => apiPatchScriptStructure(projectId, {
    expected_revision: revision,
    operations: [{ type: 'delete_item', target: 'episode_plots', item_id: itemId, impact_policy: 'cascade' }],
  })), [projectId, runStructurePatch]);

  // 页面加载时从后端恢复剧本和编排任务；受控模式只恢复编排状态，不接管父页面的旧剧本状态。
  useEffect(() => {
    if (!projectId) return;

    apiGetScriptWorkspace(projectId)
      .then((data) => {
        const content = data?.script?.content || data?.content;
        const sourceType = data?.script?.source_type || data?.script?.sourceType || data?.source_type || data?.sourceType || '';
        const isStoryboardUpload = isStoryboardScriptSource(data)
          || isStoryboardScriptSource(data?.active_task)
          || isStoryboardScriptSource(data?.active_operation)
          || isStoryboardScriptSource(data?.structure);
        const isUploadedScript = isStoryboardUpload || String(sourceType).toLowerCase() === 'script_upload';
        const restoredStoryboard = normalizeStoryboardFileInfo(data);
        if (restoredStoryboard.fileName) setStoryboardFileName(restoredStoryboard.fileName);
        if (restoredStoryboard.downloadUrl) setStoryboardDownloadUrl(restoredStoryboard.downloadUrl);
        const restoredMessages = normalizeScriptMessages(data?.messages);
        if (restoredMessages.length > 0) {
          setMessages(restoredMessages);
        } else if (content && !isUploadedScript) {
          // 兼容早期只保存整稿、尚未持久化消息列表的工作区，统一转为消息区展示。
          setMessages([{
            id: `assistant-restored-${Date.now()}`,
            role: 'assistant',
            content,
            status: 'completed',
            createdAt: new Date().toISOString(),
          }]);
        }
        const activeTask = data?.active_task || data?.active_operation;
        const activeTaskId = getScriptTaskId(activeTask);
        const hasStoryboardFile = Boolean(restoredStoryboard.fileName || restoredStoryboard.downloadUrl || restoredStoryboard.fileId);
        const storedTaskId = readStoredScriptOperationTaskId(projectId);
        if (data?.structure || activeTaskId || hasStoryboardFile || storedTaskId) {
          setScriptOutlineMode(true);
          const storedOutlineType = readStoredScriptOutlineType(projectId);
          setOutlineType(isStoryboardUpload || storedOutlineType === 'storyboard' ? 'storyboard' : 'script');
          setScriptOutlineError('');
          if (data?.structure) {
            setScriptOutlineData(normalizeScriptStructure(data.structure));
            setScriptOutlineLoading(false);
          } else if (hasStoryboardFile && !activeTaskId) {
            setScriptOutlineData(normalizeScriptStructure({}));
            setScriptOutlineLoading(false);
          }
          if (activeTaskId) {
            if (isStoryboardScriptSource(activeTask)) setOutlineType('storyboard');
            persistScriptOperation(projectId, activeTaskId);
            setScriptOutlineTaskId(activeTaskId);
            setScriptOutlineLoading(true);
            outlinePollStartedAtRef.current = Date.now();
          } else if (storedTaskId) {
            setScriptOutlineTaskId(storedTaskId);
            setScriptOutlineLoading(true);
            outlinePollStartedAtRef.current = Date.now();
          }
        }
        if (content && !isUploadedScript) {
          setScriptContent(content);
          if (!isControlled) {
            setPhase('view');
            setHasStarted(true);
          }
          return { content, hasOutline: Boolean(data?.structure || activeTaskId || hasStoryboardFile) };
        }
        if (restoredMessages.length > 0 && !isControlled) {
          setHasStarted(true);
          setPhase('view');
        }
        return { content: '', hasOutline: Boolean(data?.structure || activeTaskId || hasStoryboardFile) };
      })
      .catch((err) => {
        console.error('[ScriptPage] 加载剧本失败:', err);
        throw err;
      })
      // 新的对话工作流在用户点击“确认初稿，进入剧本编排”后才确认结构。
      // 这里不能再自动调用旧 finalize，否则会在用户点击确认前改写
      // script.draft_revision，导致 confirm 使用旧版本号返回 409。
      ;
  }, [projectId, isControlled, setScriptContent, setPhase, setHasStarted, setOutlineType]);

  // 编排确认任务轮询：页面卸载、任务终态或超过最大等待时间时立即清理。
  useEffect(() => {
    if (!scriptOutlineMode || !scriptOutlineTaskId || !projectId) return undefined;
    let disposed = false;
    let timerId;
    const abortController = new AbortController();

    const poll = async () => {
      if (disposed) return;
      if (Date.now() - (outlinePollStartedAtRef.current || Date.now()) > SCRIPT_OUTLINE_TIMEOUT_MS) {
        setScriptOutlineLoading(false);
        setScriptOutlineTaskId(null);
        setScriptOutlineError('剧本任务超时，请刷新页面查看最新结果');
        return;
      }
      try {
        const task = await apiGetScriptTask(projectId, scriptOutlineTaskId, { signal: abortController.signal });
        if (disposed) return;
        if (isStoryboardScriptSource(task)) setOutlineType('storyboard');
        const status = String(task?.status || '').toLowerCase();
        if (['completed', 'success', 'succeeded'].includes(status)) {
          const structure = await apiGetScriptStructure(projectId);
          if (disposed) return;
          if (scriptOutlineType === 'storyboard' || isStoryboardScriptSource(task)) {
            setOutlineType('storyboard');
            const workspace = await apiGetScriptWorkspace(projectId, { fresh: true });
            const fileInfo = normalizeStoryboardFileInfo(workspace);
            if (fileInfo.fileName) setStoryboardFileName(fileInfo.fileName);
            if (fileInfo.downloadUrl) setStoryboardDownloadUrl(fileInfo.downloadUrl);
          }
          setScriptOutlineData(normalizeScriptStructure(structure));
          setScriptOutlineLoading(false);
          setScriptOutlineTaskId(null);
          clearStoredScriptOperation(projectId);
          return;
        }
        if (status === 'partial') {
          const structure = await apiGetScriptStructure(projectId);
          if (disposed) return;
          const normalized = normalizeScriptStructure(structure);
          if (isStoryboardScriptSource(task)) setOutlineType('storyboard');
          const hasUsableStructure = Boolean(
            normalized.episodes.length
            || normalized.subjects.characters.length
            || normalized.subjects.scenes.length
            || normalized.subjects.props.length
            || normalized.scriptDesign.synopsis
            || normalized.overallSettings.visualStyle,
          );
          if (hasUsableStructure) {
            setScriptOutlineData(normalized);
            setScriptOutlineLoading(false);
            setScriptOutlineTaskId(null);
            clearStoredScriptOperation(projectId);
            return;
          }
          setScriptOutlineLoading(false);
          setScriptOutlineTaskId(null);
          clearStoredScriptOperation(projectId);
          const partialError = task?.error;
          setScriptOutlineError(typeof partialError === 'string' ? partialError : partialError?.message || partialError?.detail || '分镜脚本导入部分失败，暂时没有可展示的结构');
          return;
        }
        if (['failed', 'error', 'cancelled', 'canceled'].includes(status)) {
          const error = task?.error;
          const message = getScriptOutlineTaskErrorMessage(error);
          setScriptOutlineLoading(false);
          setScriptOutlineTaskId(null);
          clearStoredScriptOperation(projectId);
          setScriptOutlineError(message);
          return;
        }
        timerId = window.setTimeout(poll, SCRIPT_OUTLINE_POLL_INTERVAL_MS);
      } catch (error) {
        if (disposed) return;
        if (error?.status === 404) clearStoredScriptOperation(projectId);
        setScriptOutlineLoading(false);
        setScriptOutlineTaskId(null);
        setScriptOutlineError(error?.message || '读取剧本解析状态失败，请重试');
      }
    };

    poll();
    return () => {
      disposed = true;
      window.clearTimeout(timerId);
      abortController.abort();
    };
  }, [projectId, scriptOutlineMode, scriptOutlineTaskId, scriptOutlineType, setOutlineType]);

  // 剧本解析先写入结构工作区，正式 episodes 物化前也要让项目总览即时显示分集卡片。
  // 解析完成、部分完成或刷新恢复结构时都通过同一个回调同步到 Home。
  useEffect(() => {
    const structureEpisodes = scriptOutlineData?.episodes;
    if (!Array.isArray(structureEpisodes) || structureEpisodes.length === 0) return;

    onEpisodesChange?.(structureEpisodes.map((episode, index) => ({
      id: episode.id || `parsed-episode-${index + 1}`,
      title: episode.title || episode.name || `第${index + 1}集`,
      episode_number: episode.episode_number ?? index + 1,
      status: episode.status || 'pending',
    })));
  }, [scriptOutlineData, onEpisodesChange]);
  const handleStop = useCallback(() => {
    // 用 ref 记录停止原因，避免 handleSend 闭包里 phase 是旧快照的问题
    if (phase === 'streaming') {
      stopReasonRef.current = 'user-streaming';
    } else {
      stopReasonRef.current = 'user-thinking';
    }
    abortControllerRef.current?.abort();
    const interruptPromise = apiInterruptScriptChatTurn(projectId).catch((error) => {
      console.error('[ScriptPage] 确认暂停剧本对话失败:', error);
      showToast(error?.message || '暂停剧本创作失败，请重试');
      return null;
    });
    chatInterruptPromiseRef.current = interruptPromise;
    interruptPromise.finally(() => {
      if (chatInterruptPromiseRef.current === interruptPromise) chatInterruptPromiseRef.current = null;
    });
  }, [phase, projectId]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && (phase === 'thinking' || phase === 'streaming')) {
        handleStop();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, handleStop]);

  const handleScriptFileSelect = async (file) => {
    setScriptInputFile(file);
    setHasStarted(true);
    setPhase('thinking');
    setScriptContent('');
    setOutlineType('script');
    setScriptOutlineMode(true);
    setScriptOutlineLoading(true);
    setScriptOutlineError('');
    setMessages([]);

    try {
      const uploadResult = await apiUploadScriptWorkspace(projectId, file);
      const uploadContent = uploadResult?.script?.content ?? uploadResult?.script?.parsed_content ?? uploadResult?.content;
      if (uploadContent) setScriptContent(formatEpisodeHeaders(uploadContent));
      setPhase('view');
      // 上传接口只负责写入主剧本工作区，结构化仍通过 confirm 任务完成。
      await handleOpenScriptOutline({ skipContentCheck: true, force: true });
    } catch (error) {
      console.error('[ScriptPage] 上传剧本失败:', error);
      setScriptOutlineLoading(false);
      setScriptOutlineError(error?.message || '剧本上传或解析失败，请重试');
    }
  };

  const handleStoryboardFileSelect = async (file) => {
    setStoryboardInputFile(file);
    setHasStarted(true);
    setPhase('thinking');
    setScriptContent('');
    setMessages([]);
    setOutlineType('storyboard');
    setScriptOutlineMode(true);
    setScriptOutlineLoading(true);
    setScriptOutlineError('');
    setScriptOutlineData(null);
    setStoryboardFileName(file?.name || '');
    setStoryboardDownloadUrl('');
    setScriptOutlineTaskId(null);
    outlinePollStartedAtRef.current = Date.now();

    try {
      const result = await apiImportStoryboardXlsx(projectId, file);
      const fileInfo = normalizeStoryboardFileInfo(result);
      if (fileInfo.fileName) setStoryboardFileName(fileInfo.fileName);
      if (fileInfo.downloadUrl) setStoryboardDownloadUrl(fileInfo.downloadUrl);
      const taskId = result?.taskId || getScriptTaskId(result);
      if (taskId) {
        setOutlineType('storyboard');
        setScriptOutlineTaskId(taskId);
        return;
      }
      const workspace = await apiGetScriptWorkspace(projectId, { fresh: true });
      const workspaceFile = normalizeStoryboardFileInfo(workspace);
      if (workspaceFile.fileName) setStoryboardFileName(workspaceFile.fileName);
      if (workspaceFile.downloadUrl) setStoryboardDownloadUrl(workspaceFile.downloadUrl);
      const activeTaskId = getScriptTaskId(workspace?.active_task || workspace?.active_operation || workspace);
      if (activeTaskId) {
        setOutlineType('storyboard');
        setScriptOutlineTaskId(activeTaskId);
        return;
      }
      if (workspace?.structure) {
        setOutlineType('storyboard');
        setScriptOutlineData(normalizeScriptStructure(workspace.structure));
        setScriptOutlineLoading(false);
        return;
      }
      throw new Error('分镜脚本导入未返回任务编号，请稍后重试');
    } catch (error) {
      console.error('[ScriptPage] 导入分镜脚本失败:', error);
      setScriptOutlineLoading(false);
      setScriptOutlineError(error?.message || '分镜脚本上传或解析失败，请重试');
    }
  };

  const handleDownloadTemplate = () => {
    const anchor = document.createElement('a');
    anchor.href = '/分镜模板.xlsx';
    anchor.download = '分镜模板.xlsx';
    anchor.click();
  };

  const performSend = async (text, model, epCount, duration) => {
    if (!text || chatSendLockRef.current) return;
    // 用户刚点击暂停时，等待后端确认上一轮 turn 已收口，避免立刻发送造成并发冲突。
    const interruptPromise = chatInterruptPromiseRef.current;
    if (interruptPromise) {
      const interruptResult = await interruptPromise;
      if (interruptResult === null) return false;
    }
    chatSendLockRef.current = true;

    // 保存发送前的内容，超时时可恢复（避免丢失已有剧本）
    const prevContent = scriptContent;
    const clientRequestId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `script-chat-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // 每次发送时清除上次的恢复内容（成功时不恢复）
    setInputRestoreText('');
    stopReasonRef.current = null;

    // 取消上一次未完成的请求
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const userMessageId = `user-${clientRequestId}`;
    const assistantMessageId = `assistant-${clientRequestId}`;
    const updateAssistantMessage = (updates) => {
      setMessages((previous) => previous.map((message) => (
        message.id === assistantMessageId ? { ...message, ...updates } : message
      )));
    };
    setMessages((previous) => [
      ...previous.filter((message) => message.id !== userMessageId && message.id !== assistantMessageId),
      { id: userMessageId, role: 'user', content: text, status: 'completed', createdAt: new Date().toISOString() },
      { id: assistantMessageId, role: 'assistant', content: '', status: 'streaming', createdAt: new Date().toISOString() },
    ]);
    setActiveMessageId(assistantMessageId);

    // 只对真正的流式生成阶段计时，等待旧任务释放的时间不计入本次生成超时。
    let isClientTimeout = false;
    let timeoutId = null;
    const startClientTimeout = () => {
      isClientTimeout = false;
      timeoutId = window.setTimeout(() => {
        isClientTimeout = true;
        abortController.abort();
      }, CHAT_TIMEOUT_MS);
    };
    const clearClientTimeout = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    setHasStarted(true);
    setPhase('thinking');
    setScriptContent('');

    let receivedContent = '';

    // 超时统一处理：toast + 恢复输入 + 恢复内容
    // 关键：不调用 setHasStarted(false)，保持底部 InputCard 同一实例，
    // 通过 disabled(true→false) 转换触发 restoreText 机制，避免重新挂载的时序问题
    const handleTimeout = () => {
      showToast('请求超时，请稍后重试');
      setInputRestoreText(text);
      updateAssistantMessage({ status: 'failed', errorMessage: '请求超时，请稍后重试' });
      setActiveMessageId(null);
      if (receivedContent) {
        // 流式已收到部分内容则保留
        setScriptContent(receivedContent);
        setPhase('view');
      } else {
        // 恢复发送前的内容（如有），否则退回 initial；hasStarted 保持 true
        setScriptContent(prevContent);
        setPhase(prevContent ? 'view' : 'initial');
      }
    };

    try {
      // 点击发送后直接请求后端；后端的任务冲突和业务错误由请求层透传给页面。
      // 客户端只负责为这一次流式请求提供 30 分钟超时兜底。
      startClientTimeout();
      let hasStartedStreaming = false;
      await apiChatScriptWorkspaceStream(
        projectId,
        {
          message: text,
          model,
          episode_count: epCount,
          episode_duration_seconds: duration === 'auto' ? null : duration,
          client_request_id: clientRequestId,
        },
        {
          onChunk: (accumulated) => {
            const formatted = formatEpisodeHeaders(accumulated);
            receivedContent = formatted;
            if (!hasStartedStreaming) {
              hasStartedStreaming = true;
              setScriptContent(formatted);
              setPhase('streaming');
            } else {
              setScriptContent(formatted);
            }
            setMessages((previous) => previous.map((message) => (
              message.id === assistantMessageId
                ? { ...message, content: formatted, status: 'streaming' }
                : message
            )));
          },
          signal: abortController.signal,
        }
      );

      setMessages((previous) => previous.map((message) => (
        message.id === assistantMessageId ? { ...message, content: receivedContent, status: 'completed' } : message
      )));
      setActiveMessageId(null);
      // 网络流读取完成后立即恢复输入卡，允许继续发送下一条消息。
      setPhase('view');
      const latestWorkspace = await apiGetScriptWorkspace(projectId, { fresh: true });
      const latestMessages = normalizeScriptMessages(latestWorkspace?.messages);
      if (latestMessages.length > 0) setMessages(latestMessages);
    } catch (err) {
      // 504 网关超时
      if (err.isGatewayTimeout) {
        handleTimeout();
        return;
      }

      // 网络层错误（DNS 失败、连接被拒等）→ 保留已有内容，不丢失
      if (err.isNetworkError) {
        updateAssistantMessage({ status: 'failed', errorMessage: '网络连接失败，请检查网络后重试' });
        setActiveMessageId(null);
        if (receivedContent) {
          setScriptContent(receivedContent);
          setPhase('view');
        } else {
          setScriptContent(prevContent);
          setPhase(prevContent ? 'view' : 'initial');
        }
        setInputRestoreText(text);
        showToast('网络连接失败，请检查网络后重试');
        return;
      }

      if (err.name === 'AbortError') {
        if (isClientTimeout) {
          // 客户端兜底超时触发
          handleTimeout();
        } else if (stopReasonRef.current === 'user-streaming') {
          // streaming 阶段用户主动暂停：保留已收到的助手正文和消息记录
          stopReasonRef.current = null;
          updateAssistantMessage({ status: 'interrupted', errorMessage: '剧本创作已暂停' });
          setActiveMessageId(null);
          showToast('剧本创作已暂停', 'info');
        } else {
          // thinking 阶段用户主动暂停：尚未收到正文，保留对话记录并恢复输入框
          stopReasonRef.current = null;
          updateAssistantMessage({ status: 'interrupted', errorMessage: '剧本创作已暂停' });
          setActiveMessageId(null);
          setInputRestoreText(text);
          setScriptContent(prevContent);
          setPhase(prevContent ? 'view' : 'initial');
          setHasStarted(true);
          showToast('剧本创作已暂停', 'info');
        }
        return;
      }

      console.error('[ScriptPage] 生成剧本失败:', err);
      updateAssistantMessage({ status: 'failed', errorMessage: err?.message || '剧本生成失败，请稍后重试' });
      setActiveMessageId(null);
      setInputRestoreText(text);
      setPhase('initial');
      setHasStarted(true);
      (() => {
        const rawMsg = err?.message || '';
        let toastMsg;
        // 后端已返回可读错误时，透传原文；只有没有错误正文时才使用兜底文案。
        toastMsg = rawMsg || (err?.status ? `请求失败 (HTTP ${err.status})，请稍后重试` : '剧本生成失败，请稍后重试');
        showToast(toastMsg);
      })();
    } finally {
      clearClientTimeout();
      if (abortControllerRef.current === abortController) abortControllerRef.current = null;
      chatSendLockRef.current = false;
    }
  };

  const handleSend = async (text, model, epCount, duration) => {
    if (!text) return false;
    return performSend(text, model, epCount, duration);
  };

  const handleRequestModifyScript = useCallback(() => {
    setModifyConfirmOpen(true);
  }, []);

  const handleConfirmModifyScript = useCallback(async () => {
    setModifyConfirmOpen(false);
    setScriptModificationMode(true);
    setScriptOutlineMode(true);
    setScriptOutlineError('');
    setScriptOutlineLoading(true);
    try {
      const latestStructure = normalizeScriptStructure(await apiGetScriptStructure(projectId));
      setScriptOutlineData(latestStructure);
    } catch (error) {
      console.error('[ScriptPage] 刷新可编辑剧本结构失败:', error);
      setScriptOutlineError(error?.message || '读取剧本结构失败，请重试');
    } finally {
      setScriptOutlineLoading(false);
    }
  }, [projectId]);

  const handleDownloadScript = useCallback(async () => {
    if (!projectId) {
      showToast('当前没有可下载的剧本内容', 'warning');
      return;
    }

    try {
      const latestStructure = normalizeScriptStructure(await apiGetScriptStructure(projectId));
      const episodes = latestStructure?.episodes || [];
      if (episodes.length === 0) {
        showToast('当前没有可下载的分集剧本', 'warning');
        return;
      }

      setScriptOutlineData(latestStructure);
      const content = episodes.map((episode, index) => {
        const title = episode.title || episode.name || '未命名';
        const episodeContent = episode.content || episode.description || episode.synopsis || '';
        return `## 第${String(index + 1).padStart(2, '0')}集 ${title}\n\n${episodeContent}`.trim();
      }).join('\n\n---\n\n');
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${sanitizeDownloadName(projectName, projectId || '剧本')}.md`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('[ScriptPage] 下载分集剧本失败:', error);
      showToast(error?.message || '下载剧本失败，请重试', 'error');
    }
  }, [projectId, projectName]);

  const handleDownloadStoryboard = useCallback(async () => {
    if (!projectId) {
      showToast('当前没有可下载的分镜脚本', 'warning');
      return;
    }
    try {
      const blob = await apiDownloadStoryboardFile(projectId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = storyboardFileName || `${sanitizeDownloadName(projectName, projectId)}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('[ScriptPage] 下载分镜脚本失败:', error);
      showToast(error?.message || '下载分镜脚本失败，请重试', 'error');
    }
  }, [projectId, projectName, storyboardFileName]);

  return (
    <>
    <div
      ref={scriptContentContainerRef}
      style={{
        display: 'flex',
        minHeight: 0,
        flex: 1,
        alignItems: 'stretch',
        alignSelf: 'stretch',
        borderRadius: '16px',
        paddingTop: '16px',
        paddingBottom: '16px',
        paddingLeft: '24px',
        paddingRight: '24px',
        background: 'var(--color-dark-bg)',
        border: '1px solid #FFFFFF14',
        overflow: 'hidden',
      }}
    >
      {scriptOutlineMode ? (
        <div style={{ position: 'relative', display: 'flex', minHeight: '100%', flex: 1, justifyContent: 'center', alignItems: 'stretch', overflow: 'visible' }}>
          {scriptOutlineLoading ? (
            <ScriptOutlineLoading finalSectionTitle={scriptOutlineType === 'storyboard' ? '分镜脚本' : '分集剧情'} />
          ) : scriptOutlineError ? (
            <div role="alert" style={{ display: 'flex', width: 'min(960px, 100%)', height: '100%', minHeight: 0, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', border: '1px solid #FFFFFF14', borderRadius: '16px', background: '#060606', color: '#FFFFFF', fontFamily: FONT }}>
              <div style={{ color: '#F75F5F', fontSize: '16px', lineHeight: '24px' }}>{scriptOutlineError}</div>
              <Button type="button" variant="secondary" size="small" onClick={handleOpenScriptOutline}>重试解析</Button>
            </div>
          ) : (
            <ScriptOutlineWorkspace
              data={scriptOutlineData}
              projectSettings={{ visualStyle: projectVisualStyle, aspectRatio: projectAspectRatio, creationType: projectCreationType }}
              selectedModel={selectedModel}
              onResplit={handleResplitEpisodes}
              onAddEpisode={handleAddEpisode}
              onRegenerateEpisode={handleRegenerateEpisode}
              onPatchStructure={handlePatchEpisodeStructure}
              onDeleteEpisode={handleDeleteEpisode}
              episodeActionLoading={episodeActionLoading}
              episodeActionError={episodeActionError}
              hideEpisodeActions={isSubjectUnlocked && !scriptModificationMode}
              outlineType={scriptOutlineType}
              storyboardFileName={storyboardFileName || storyboardInputFile?.name || ''}
              storyboardDownloadUrl={storyboardDownloadUrl}
              onDownloadStoryboard={handleDownloadStoryboard}
              loadingContainerRef={scriptContentContainerRef}
            />
          )}
          {!scriptOutlineLoading && !scriptOutlineError && (
            isSubjectUnlocked && !scriptModificationMode ? (
              <div style={{ position: 'absolute', top: 0, right: 0, zIndex: 3, display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <Button type="button" variant="secondary" size="large" style={{ height: '32px' }} onClick={handleDownloadScript}>下载剧本</Button>
                <Button type="button" variant="accent" size="large" style={{ height: '32px' }} onClick={handleRequestModifyScript}>修改剧本</Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="accent"
                size="large"
                icon={(
                  <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" style={{ overflow: 'visible', flexShrink: 0 }} aria-hidden="true">
                    <path d="M14 8H2" fill="none" stroke="#090909" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M10 4L14 8L10 12" fill="none" stroke="#090909" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                iconPosition="right"
                onClick={() => onGoToSubject?.('char')}
                style={{ position: 'absolute', top: 0, right: 0, zIndex: 3 }}
              >
                下一步：生成主体
              </Button>
            )
          )}
        </div>
      ) : !hasStarted ? (
        <ScriptEmptyState
          onSend={handleSend}
          onScriptFileSelect={handleScriptFileSelect}
          scriptFile={scriptInputFile}
          onRemoveScriptFile={() => setScriptInputFile(null)}
          onStoryboardFileSelect={handleStoryboardFileSelect}
          storyboardFile={storyboardInputFile}
          onRemoveStoryboardFile={() => setStoryboardInputFile(null)}
          onDownloadTemplate={handleDownloadTemplate}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          episodeCount={episodeCount}
          onEpisodeCountChange={setEpisodeCount}
          episodeDuration={episodeDuration}
          onEpisodeDurationChange={setEpisodeDuration}
          restoreText={inputRestoreText}
        />
      ) : (
        <div style={{ display: 'flex', minHeight: 0, flex: 1, flexDirection: 'column', alignItems: 'stretch', justifyContent: 'space-between', gap: '24px', alignSelf: 'stretch', overflow: 'hidden' }}>
            <div style={{ display: 'flex', flex: 1, minHeight: 0, justifyContent: 'center', alignItems: 'stretch', overflow: 'hidden' }}>
              <div style={{ display: 'flex', width: '100%', maxWidth: '100%', minWidth: '420px', minHeight: 0, flexDirection: 'column', alignSelf: 'stretch', alignItems: 'center' }}>
                <ScriptMessageArea
                  messages={messages}
                  activeMessageId={activeMessageId}
                  hasScript={Boolean(scriptContent)}
                  onOpenScript={handleOpenScriptOutline}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', alignSelf: 'stretch', paddingTop: '0px', overflow: 'visible', flexShrink: 0 }}>
              <InputCard
                onSend={handleSend}
                onStop={handleStop}
                restoreText={inputRestoreText}
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
                episodeCount={episodeCount}
                onEpisodeCountChange={setEpisodeCount}
                episodeDuration={episodeDuration}
                onEpisodeDurationChange={setEpisodeDuration}
                width="min(700px, 100%)"
                disabled={phase === 'thinking' || phase === 'streaming'}
              />
            </div>
          </div>
      )}
    </div>
    <Toast toasts={toasts} />
    <ScriptModifyConfirmModal
      open={modifyConfirmOpen}
      onConfirm={handleConfirmModifyScript}
      onCancel={() => setModifyConfirmOpen(false)}
    />

    </>  );
}
