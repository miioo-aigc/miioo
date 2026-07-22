/**
 * @file ScriptPage.jsx
 * @structure-index
 *
 * ─── 全局常量 & 工具函数 ─────────────────────────────────────────────
 *   FONT / CHAT_TIMEOUT_MS / 页面级常量                                  L39–L41
 *   formatEpisodeHeaders                                                   L43
 *
 * ─── 反馈与输入区组件 ─────────────────────────────────────────────────
 *   Toast                                                                  L80
 *
 * ─── 剧本展示与编辑组件 ───────────────────────────────────────────────
 *   AiThinkingMessage / AiStreamingContent / ScriptRendered              src/components/script/
 *   ScriptEditor（编辑器域组件）                                         src/components/script/ScriptEditor.jsx
 *   EditorToolbar（编辑器域组件）                                        src/components/script/EditorToolbar.jsx
 *   ScriptPanel / ScriptOutlineLoading / ScriptOutlineWorkspace / ScriptEpisodeOutline src/components/script/
 *
 * ─── 主页面入口 ───────────────────────────────────────────────────────
 *   export default ScriptPage()                                         L126
 *     ├─ [状态] 受控/非受控 phase、剧本内容、入口文件、模型、集数/时长、消息和编排任务
 *     ├─ [函数] handleSend / handleScriptFileSelect / handleOpenScriptOutline / handleStop / handleSave
 *     └─ [副作用] 工作区加载、编排任务恢复与轮询、流式请求、剧本和分集同步
 *
 * ─── 更新记录 ────────────────────────────────────────────────────────
 *   2026-07-15  抽离 ScriptPanel、流式展示组件和展示区域样式，页面仅保留状态、数据流与区块编排
 *   2026-07-15  ScriptPanel 动作区、上传入口、文件删除、模型/集数选择器、发送按钮和编辑器工具栏迁移到基础 Button 能力
 *   2026-07-15  抽离 ScriptEditor、EditorToolbar 及编辑器样式，页面入口仅保留编辑器编排和回调
 *   2026-07-15  抽离 InputCard、ScriptEmptyState 及输入区子组件，页面仅保留输入区编排
 *   2026-07-15  为 ScriptPanel 显式传入 hasScript，修复编辑动作禁用判断
 *   2026-07-16  补齐流式暂停回调的 setPhase 依赖，避免闭包使用旧阶段更新函数
 *   2026-07-21  重做初始创作入口，输入卡移除上传并增加单集时长，分镜文件仅保留本地状态
 *   2026-07-21  接入持久化对话消息区，移除本地输入历史缓存
 *   2026-07-21  移除左侧剧集结构导航，保留剧集数据同步和定稿流程
 *   2026-07-21  接入确认初稿后的结构化编排页、异步任务轮询和刷新恢复
 *   2026-07-21  分集剧情接入后端重排、重写、编辑保存和删除操作
 *   2026-07-21  修复新增分集重排时重复插入 ID 导致中间插入失效
 *   2026-07-21  将项目详情中的后端设定回填到编排页整体设定
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { apiSaveScriptWorkspace, apiGetScriptWorkspace, normalizeScriptMessages, normalizeScriptStructure, apiChatScriptWorkspaceStream, apiUploadScriptWorkspace, apiFinalizeScriptWorkspace, apiGetEpisodes, apiConfirmScriptWorkspace, apiGetScriptStructure, apiGetScriptTask, apiResplitScriptStructure, apiRegenerateScriptEpisode, apiPatchScriptStructure, SCRIPT_SCHEMA_VERSION } from '../api/subject';
import ConfirmDialog from '../components/ConfirmDialog';
import { Button } from '../components/ui';
import { InputCard, ScriptEmptyState, ScriptPanel, ScriptMessageArea, ScriptOutlineLoading, ScriptOutlineWorkspace } from '../components/script';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

const CHAT_TIMEOUT_MS = 120_000; // 2 分钟客户端超时兜底（后端通常先返回 504）
const SCRIPT_OUTLINE_POLL_INTERVAL_MS = 1_500;
const SCRIPT_OUTLINE_TIMEOUT_MS = 5 * 60 * 1_000;

function getScriptTaskId(task) {
  if (!task || typeof task !== 'object') return null;
  return task.task_id
    || task.taskId
    || task.operation_id
    || task.operationId
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

// ConfirmExtractModal 已迁移至 ConfirmDialog 共享组件（confirmVariant='orange'）

export default function ScriptPage({ projectId, projectVisualStyle, projectAspectRatio, projectCreationType, onGoToSubject, onScriptFinalized, onEpisodesChange, phase: phaseProp, onPhaseChange, hasStarted: hasStartedProp, onHasStartedChange, scriptContent: scriptContentProp, onScriptContentChange, draftContent: draftContentProp, onDraftContentChange, isSubjectUnlocked = false }) {
  const [phaseLocal, setPhaseLocalRaw] = useState('initial');
  const [hasStartedLocal, setHasStartedLocalRaw] = useState(false);
  const [scriptContentLocal, setScriptContentLocalRaw] = useState('');
  const [draftContentLocal, setDraftContentLocalRaw] = useState('');

  const isControlled = phaseProp !== undefined;
  const phase = isControlled ? phaseProp : phaseLocal;
  const hasStarted = isControlled ? hasStartedProp : hasStartedLocal;
  const scriptContent = isControlled ? scriptContentProp : scriptContentLocal;
  const draftContent = isControlled ? draftContentProp : draftContentLocal;

  const setPhase = isControlled ? onPhaseChange : setPhaseLocalRaw;
  const setHasStarted = isControlled ? onHasStartedChange : setHasStartedLocalRaw;
  const setScriptContent = isControlled ? onScriptContentChange : setScriptContentLocalRaw;
  const setDraftContent = isControlled ? onDraftContentChange : setDraftContentLocalRaw;
  // 仅在超时时设为已发送的内容，触发输入框恢复；成功/用户主动停止保持 '' 不恢复
  const [inputRestoreText, setInputRestoreText] = useState('');
  const [scriptInputFile, setScriptInputFile] = useState(null);
  const [storyboardInputFile, setStoryboardInputFile] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [episodeCount, setEpisodeCount] = useState(null);
  const [episodeDuration, setEpisodeDuration] = useState(null);
  const [backendEpisodes, setBackendEpisodes] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [streamingPaused, setStreamingPaused] = useState(false);
  const [isSseRunning, setIsSseRunning] = useState(false);
  const [messages, setMessages] = useState([]);
  const [activeMessageId, setActiveMessageId] = useState(null);
  const [scriptOutlineMode, setScriptOutlineMode] = useState(false);
  const [scriptOutlineLoading, setScriptOutlineLoading] = useState(false);
  const [scriptOutlineError, setScriptOutlineError] = useState('');
  const [scriptOutlineData, setScriptOutlineData] = useState(null);
  const [scriptOutlineTaskId, setScriptOutlineTaskId] = useState(null);
  const [episodeActionLoading, setEpisodeActionLoading] = useState(false);
  const [episodeActionError, setEpisodeActionError] = useState('');
  const stopReasonRef = useRef(null); // 'user-thinking' | 'user-streaming' | null
  const renderedContentRef = useRef(null);
  const abortControllerRef = useRef(null); // 用于取消进行中的流式请求
  const outlinePollStartedAtRef = useRef(null);

  const scriptContentRef = useRef(scriptContent);
  scriptContentRef.current = scriptContent;
  const showToast = (message, type = 'error') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  };

  const handleOpenScriptOutline = useCallback(async () => {
    if (!projectId || scriptOutlineLoading) return;
    if (!scriptContentRef.current) {
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
    throw new Error('剧本结构操作等待超时，请重试');
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
      await waitForScriptOperation(getScriptTaskId(accepted));
      await refreshScriptOutline();
      return true;
    } catch (error) {
      console.error('[ScriptPage] 分集剧情操作失败:', error);
      const message = error?.message || '分集剧情操作失败，请重试';
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
        const restoredMessages = normalizeScriptMessages(data?.messages);
        if (restoredMessages.length > 0) setMessages(restoredMessages);
        const activeTask = data?.active_task || data?.active_operation;
        const activeTaskId = getScriptTaskId(activeTask);
        if (data?.structure || activeTaskId) {
          setScriptOutlineMode(true);
          setScriptOutlineError('');
          if (data?.structure) {
            setScriptOutlineData(normalizeScriptStructure(data.structure));
            setScriptOutlineLoading(false);
          }
          if (activeTaskId) {
            setScriptOutlineTaskId(activeTaskId);
            setScriptOutlineLoading(true);
            outlinePollStartedAtRef.current = Date.now();
          }
        }
        if (content) {
          setScriptContent(content);
          if (!isControlled) {
            setPhase('view');
            setHasStarted(true);
          }
          return { content, hasOutline: Boolean(data?.structure || activeTaskId) };
        }
        if (restoredMessages.length > 0 && !isControlled) {
          setHasStarted(true);
          setPhase('view');
        }
        return { content: '', hasOutline: Boolean(data?.structure || activeTaskId) };
      })
      .catch((err) => {
        console.error('[ScriptPage] 加载剧本失败:', err);
        throw err;
      })
      // 新的对话工作流在用户点击“确认初稿，进入剧本编排”后才确认结构。
      // 这里不能再自动调用旧 finalize，否则会在用户点击确认前改写
      // script.draft_revision，导致 confirm 使用旧版本号返回 409。
      ;
  }, [projectId, isControlled, setScriptContent, setPhase, setHasStarted]);

  // 编排确认任务轮询：页面卸载、任务终态或超过最大等待时间时立即清理。
  useEffect(() => {
    if (!scriptOutlineMode || !scriptOutlineTaskId || !projectId) return undefined;
    let disposed = false;
    let timerId;

    const poll = async () => {
      if (disposed) return;
      if (Date.now() - (outlinePollStartedAtRef.current || Date.now()) > SCRIPT_OUTLINE_TIMEOUT_MS) {
        setScriptOutlineLoading(false);
        setScriptOutlineTaskId(null);
        setScriptOutlineError('剧本解析等待超时，请重试');
        return;
      }
      try {
        const task = await apiGetScriptTask(projectId, scriptOutlineTaskId);
        if (disposed) return;
        const status = String(task?.status || '').toLowerCase();
        if (['completed', 'success', 'succeeded'].includes(status)) {
          const structure = await apiGetScriptStructure(projectId);
          if (disposed) return;
          setScriptOutlineData(normalizeScriptStructure(structure));
          setScriptOutlineLoading(false);
          setScriptOutlineTaskId(null);
          return;
        }
        if (['failed', 'error', 'cancelled', 'canceled'].includes(status)) {
          const error = task?.error;
          const message = typeof error === 'string' ? error : error?.message || error?.detail;
          setScriptOutlineLoading(false);
          setScriptOutlineTaskId(null);
          setScriptOutlineError(message || '剧本解析失败，请重试');
          return;
        }
        timerId = window.setTimeout(poll, SCRIPT_OUTLINE_POLL_INTERVAL_MS);
      } catch (error) {
        if (disposed) return;
        setScriptOutlineLoading(false);
        setScriptOutlineTaskId(null);
        setScriptOutlineError(error?.message || '读取剧本解析状态失败，请重试');
      }
    };

    poll();
    return () => {
      disposed = true;
      window.clearTimeout(timerId);
    };
  }, [projectId, scriptOutlineMode, scriptOutlineTaskId]);

  useEffect(() => {
    if (backendEpisodes) {
      onEpisodesChange?.(backendEpisodes.map((ep) => ({ id: ep.id, title: ep.title, episode_number: ep.episode_number })));
    }
  }, [backendEpisodes, onEpisodesChange]);
  const handleStop = useCallback(() => {
    // 用 ref 记录停止原因，避免 handleSend 闭包里 phase 是旧快照的问题
    if (phase === 'streaming') {
      stopReasonRef.current = 'user-streaming';
      setStreamingPaused(true);
    } else {
      stopReasonRef.current = 'user-thinking';
    }
    abortControllerRef.current?.abort();
  }, [phase]);

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
    setDraftContent('');
    setBackendEpisodes(null);

    try {
      const uploadResult = await apiUploadScriptWorkspace(projectId, file);
      const uploadContent = uploadResult?.script?.content ?? uploadResult?.script?.parsed_content ?? uploadResult?.content;
      if (!uploadContent) throw new Error('后端未返回剧本内容');

      const formattedContent = formatEpisodeHeaders(uploadContent);
      setScriptContent(formattedContent);
      setPhase('view');
      await apiFinalizeScriptWorkspace(projectId, { split_mode: 'rule_first' });
      const episodes = await apiGetEpisodes(projectId);
      if (Array.isArray(episodes) && episodes.length > 0) setBackendEpisodes(episodes);
    } catch (error) {
      console.error('[ScriptPage] 上传剧本失败:', error);
      setScriptInputFile(null);
      setScriptContent('');
      setPhase('initial');
      setHasStarted(false);
      showToast(error?.message || '剧本上传失败，请稍后重试');
    }
  };

  const handleDownloadTemplate = () => {
    const anchor = document.createElement('a');
    anchor.href = '/分镜模板.xlsx';
    anchor.download = '分镜模板.xlsx';
    anchor.click();
  };

  const handleSend = async (text, model, epCount, duration) => {
    if (!text) return;

    // 发送前保存当前内容，超时时可恢复（避免丢失已有剧本）
    const prevContent = scriptContent;

    // 每次发送前清除上次的恢复内容（成功时不恢复）
    setInputRestoreText('');
    setStreamingPaused(false);

    // 取消上一次未完成的请求
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const assistantMessageId = `assistant-${Date.now()}`;
    const updateAssistantMessage = (updates) => {
      setMessages((previous) => previous.map((message) => (
        message.id === assistantMessageId ? { ...message, ...updates } : message
      )));
    };
    setMessages((previous) => [
      ...previous,
      { id: `user-${Date.now()}`, role: 'user', content: text, status: 'completed', createdAt: new Date().toISOString() },
      { id: assistantMessageId, role: 'assistant', content: '', status: 'streaming', createdAt: new Date().toISOString() },
    ]);
    setActiveMessageId(assistantMessageId);

    // 客户端兜底超时：后端通常先返回 504，此处作为最后保障
    let isClientTimeout = false;
    const timeoutId = setTimeout(() => {
      isClientTimeout = true;
      abortController.abort();
    }, CHAT_TIMEOUT_MS);

    setHasStarted(true);
    setPhase('thinking');
    setScriptContent('');
    setDraftContent('');
    setBackendEpisodes(null);

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
      // 纯文本入口走流式 chat 接口。
      {
        const chatMessage = text;

        // 保持 thinking 阶段（DotsLoading 加载动画），等首个 SSE chunk 到达后再切 streaming
        receivedContent = '';

        let hasStartedStreaming = false;

        setIsSseRunning(true);
        await apiChatScriptWorkspaceStream(
          projectId,
          { message: chatMessage, model, episode_count: epCount, episode_duration_seconds: duration === 'auto' ? null : duration },
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
        // 消息区不再挂载 ScriptPanel，因此不能等待 AiStreamingContent.onDone
        // 来切换阶段。网络流读取完成后立即恢复输入卡，允许继续发送下一条消息。
        setPhase('view');
        const latestWorkspace = await apiGetScriptWorkspace(projectId);
        const latestMessages = normalizeScriptMessages(latestWorkspace?.messages);
        if (latestMessages.length > 0) setMessages(latestMessages);
      }
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
        const upstreamMatch = rawMsg.match(/上游模型服务返回\s*(\d+)/);
        if (upstreamMatch) {
          const code = upstreamMatch[1];
          toastMsg = code === '404' ? '上游模型服务返回 404，请换个模型重试' : `上游模型服务返回 ${code}，请稍后重试`;
        } else if (rawMsg.toLowerCase().includes('deprecated') || rawMsg.toLowerCase().includes('migrate')) {
          toastMsg = '当前模型已废弃，请换个模型重试';
        } else if (err?.status) {
          toastMsg = `请求失败 (HTTP ${err.status})，请稍后重试`;
        } else if (rawMsg.length > 0 && rawMsg.length < 60) {
          toastMsg = rawMsg;
        } else {
          toastMsg = '剧本生成失败，请稍后重试';
        }
        showToast(toastMsg);
      })();
    } finally {
      clearTimeout(timeoutId); setIsSseRunning(false);
    }
  };

  const handleStreamingDone = useCallback(() => {
    setStreamingPaused(false);
    setPhase('view');
    if (projectId && scriptContentRef.current) {
      apiSaveScriptWorkspace(projectId, { content: scriptContentRef.current })
        .catch(() => {});
    }
  }, [projectId, setPhase]);
  // 打字动画暂停回调：用已渲染的文字作为最终内容，切到 view 阶段
  const handleStreamingPause = useCallback((displayedText) => {
    setStreamingPaused(false);
    if (displayedText) {
      setScriptContent(displayedText);
      setPhase('view');
      // 把已渲染的部分内容同步到后端，刷新后显示实际播放到的位置
      apiSaveScriptWorkspace(projectId, { content: displayedText }).catch(() => {});
      apiFinalizeScriptWorkspace(projectId, { split_mode: "rule_first" })
        .then(() => apiGetEpisodes(projectId))
        .then((episodes) => {
          if (Array.isArray(episodes) && episodes.length > 0) {
            setBackendEpisodes(episodes);
          }
        })
        .catch((err) => console.error('[ScriptPage] 定稿失败:', err));
    } else {
      // 动画还没开始播放，退回到发送前的状态，清空后端内容
      setScriptContent('');
      setPhase('initial');
      setHasStarted(false);
      apiSaveScriptWorkspace(projectId, { content: '' }).catch(() => {});
    }
  }, [projectId, setScriptContent, setPhase, setHasStarted]);

  const handleEdit = () => {
    setDraftContent(scriptContent);
    setPhase('edit');
  };

  const handleSave = async () => {
    if (!draftContent) return;

    setIsSaving(true);
    try {
      if (projectId) {
        await apiSaveScriptWorkspace(projectId, { content: draftContent });
      }
      setScriptContent(draftContent);
      setPhase('view');
      onScriptFinalized?.();
      showToast('保存定稿成功！', 'success');
    } catch (err) {
      console.error('[ScriptPage] 定稿失败:', err);
      showToast('保存定稿失败，请重试', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setDraftContent(scriptContent);
    setPhase('view');
  };

// 提取主体按钮点击：已提取过主体 → 弹窗二次确认（覆盖风险）；首次 → 直接跳转
  const [extractConfirmOpen, setExtractConfirmOpen] = useState(false);

  const handleExtractSubjects = useCallback(() => {
    onGoToSubject?.('char');
  }, [onGoToSubject]);

  const handleExtractRequest = () => {
    if (isSubjectUnlocked) {
      setExtractConfirmOpen(true);
      return;
    }
    handleExtractSubjects();
  };

  if (extractConfirmOpen) {
    return (
      <ConfirmDialog
        title="确定要提取主体吗？"
        description="本次提取主体会覆盖之前的主体内容，一旦提取不可撤销，请谨慎操作！"
        confirmText="确认提取主体"
        confirmVariant="orange"
        onConfirm={() => {
          setExtractConfirmOpen(false);
          handleExtractSubjects();
        }}
        onCancel={() => setExtractConfirmOpen(false)}
      />
    );
  }

  return (
    <>
    <div
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
        overflow: scriptOutlineMode ? 'visible' : 'hidden',
      }}
    >
      {scriptOutlineMode ? (
        <div style={{ position: 'relative', display: 'flex', minHeight: 0, flex: 1, justifyContent: 'center', alignItems: 'stretch', overflow: 'visible' }}>
          {scriptOutlineLoading ? (
            <ScriptOutlineLoading />
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
            />
          )}
          {!scriptOutlineLoading && !scriptOutlineError && (
            <Button type="button" variant="accent" size="large" onClick={() => onGoToSubject?.('char')} style={{ position: 'absolute', top: 0, right: 0, zIndex: 3 }}>下一步：生成主体</Button>
          )}
        </div>
      ) : !hasStarted ? (
        <ScriptEmptyState
          onSend={handleSend}
          onScriptFileSelect={handleScriptFileSelect}
          scriptFile={scriptInputFile}
          onRemoveScriptFile={() => setScriptInputFile(null)}
          onStoryboardFileSelect={setStoryboardInputFile}
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
                {messages.length > 0 && phase !== 'edit' ? (
                  <ScriptMessageArea
                    messages={messages}
                    activeMessageId={activeMessageId}
                    hasScript={Boolean(scriptContent)}
                    onOpenScript={handleOpenScriptOutline}
                  />
                ) : (
                  <ScriptPanel
                    phase={phase}
                    hasScript={Boolean(scriptContent)}
                    scriptContent={scriptContent}
                    draftContent={draftContent}
                    onEdit={handleEdit}
                    onSave={handleSave}
                    onCancelEdit={handleCancelEdit}
                    onExtractRequest={handleExtractRequest}
                    onStreamingDone={handleStreamingDone}
                    onStreamingPause={handleStreamingPause}
                    streamingPaused={streamingPaused}
                    isSseActive={isSseRunning}
                    renderedContentRef={renderedContentRef}
                    isSaving={isSaving}
                  />
                )}
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

    </>  );
}
