/**
 * @file ScriptPage.jsx
 * @structure-index
 *
 * ─── 全局常量 & 工具函数 ─────────────────────────────────────────────
 *   FONT / CHAT_TIMEOUT_MS / 页面级常量                                  L39–L41
 *   parseScriptOutline / formatEpisodeHeaders                            L43 / L75
 *
 * ─── 反馈与输入区组件 ─────────────────────────────────────────────────
 *   Toast                                                                  L80
 *
 * ─── 剧本展示与编辑组件 ───────────────────────────────────────────────
 *   EpisodeItem / EpisodeList（分集导航域组件）                            src/components/script/
 *   AiThinkingMessage / AiStreamingContent / ScriptRendered              src/components/script/
 *   ScriptEditor（编辑器域组件）                                         src/components/script/ScriptEditor.jsx
 *   EditorToolbar（编辑器域组件）                                        src/components/script/EditorToolbar.jsx
 *   ScriptPanel                                                          src/components/script/ScriptPanel.jsx
 *
 * ─── 主页面入口 ───────────────────────────────────────────────────────
 *   export default ScriptPage()                                         L126
 *     ├─ [状态] 受控/非受控 phase、剧本内容、入口文件、模型、集数/时长和流式状态
 *     ├─ [函数] handleSend / handleScriptFileSelect / handleStop / handleSave / handleExtractRequest
 *     └─ [副作用] 工作区加载、草稿恢复、流式请求、剧本和分集同步
 *
 * ─── 更新记录 ────────────────────────────────────────────────────────
 *   2026-07-15  抽离 ScriptPanel、流式展示组件和展示区域样式，页面仅保留状态、数据流与区块编排
 *   2026-07-15  ScriptPanel 动作区、上传入口、文件删除、模型/集数选择器、发送按钮和编辑器工具栏迁移到基础 Button 能力
 *   2026-07-15  抽离 ScriptEditor、EditorToolbar 及编辑器样式，页面入口仅保留编辑器编排和回调
 *   2026-07-15  抽离 EpisodeItem、EpisodeList 分集导航业务组件，保留选中态、骨架态和选择回调
 *   2026-07-15  抽离 InputCard、ScriptEmptyState 及输入区子组件，页面仅保留输入区编排
 *   2026-07-15  为 ScriptPanel 显式传入 hasScript，修复编辑动作禁用判断
 *   2026-07-16  补齐流式暂停回调的 setPhase 依赖，避免闭包使用旧阶段更新函数
 *   2026-07-21  重做初始创作入口，输入卡移除上传并增加单集时长，分镜文件仅保留本地状态
 */
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { apiSaveScriptWorkspace, apiGetScriptWorkspace, apiChatScriptWorkspaceStream, apiUploadScriptWorkspace, apiFinalizeScriptWorkspace, apiGetEpisodes } from '../api/subject';
import ConfirmDialog from '../components/ConfirmDialog';
import { EpisodeList, InputCard, ScriptEmptyState, ScriptPanel } from '../components/script';

import { saveDraft } from '../utils/scriptDraftCache';
const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

const CHAT_TIMEOUT_MS = 120_000; // 2 分钟客户端超时兜底（后端通常先返回 504）

function parseScriptOutline(markdown) {
  if (!markdown) return [];

  const entries = [];
  let offset = 0;

  markdown.split('\n').forEach((line) => {
    if (/^#\s/.test(line)) {
      entries.push({
        title: line.replace(/^#\s+/, '').trim(),
        level: 1,
        offset,
      });
    } else if (/^##\s/.test(line)) {
      entries.push({
        title: line.replace(/^##\s+/, '').replace(/\*\*/g, '').replace(/\*/g, '').replace(/__/g, '').replace(/_/g, '').trim(),
        level: 2,
        offset,
      });
    }

    offset += line.length + 1;
  });

  return entries;
}

/**
 * 将后端返回的"第X集"转换为 Markdown 二级标题 `## 第X集`，
 * 以便 parseScriptOutline 正确识别并生成分集导航。
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

export default function ScriptPage({ projectId, onGoToSubject, onScriptFinalized, onEpisodesChange, phase: phaseProp, onPhaseChange, hasStarted: hasStartedProp, onHasStartedChange, scriptContent: scriptContentProp, onScriptContentChange, draftContent: draftContentProp, onDraftContentChange, isSubjectUnlocked = false }) {
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
  const [selectedEpisode, setSelectedEpisode] = useState(0);
  // 仅在超时时设为已发送的内容，触发输入框恢复；成功/用户主动停止保持 '' 不恢复
  const [inputRestoreText, setInputRestoreText] = useState('');
  const [scriptInputFile, setScriptInputFile] = useState(null);
  const [storyboardInputFile, setStoryboardInputFile] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [episodeCount, setEpisodeCount] = useState(null);
  const [episodeDuration, setEpisodeDuration] = useState(60);
  const [backendEpisodes, setBackendEpisodes] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [streamingPaused, setStreamingPaused] = useState(false);
  const [isSseRunning, setIsSseRunning] = useState(false);
  const stopReasonRef = useRef(null); // 'user-thinking' | 'user-streaming' | null
  const renderedContentRef = useRef(null);
  const editorContentRef = useRef(null);
  const abortControllerRef = useRef(null); // 用于取消进行中的流式请求

  const scriptContentRef = useRef(scriptContent);
  scriptContentRef.current = scriptContent;
  const showToast = (message, type = 'error') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  };

  // 页面加载时从后端恢复剧本（仅非受控模式下自行加载，受控模式由父组件负责）
  useEffect(() => {
    if (!projectId || isControlled) return;

    apiGetScriptWorkspace(projectId)
      .then((data) => {
        const content = data?.script?.content || data?.content;
        if (content) {
          setScriptContent(content);
          setPhase('view');
          setHasStarted(true);
          return content;
        }
      })
      .catch((err) => {
        console.error('[ScriptPage] 加载剧本失败:', err);
        throw err; // 阻止继续链到 finalize
      })
      .then((content) => {
        if (content && projectId) {
        return apiFinalizeScriptWorkspace(projectId, { split_mode: "rule_first" })
          .then(() => apiGetEpisodes(projectId))
          .then((episodes) => {
            if (Array.isArray(episodes) && episodes.length > 0) {
              setBackendEpisodes(episodes);
            }
          });
        }
      });
  }, [projectId, isControlled, setScriptContent, setPhase, setHasStarted]);

  const visibleContent = phase === 'edit' ? draftContent : scriptContent;
  const markdownOutline = useMemo(() => parseScriptOutline(visibleContent).filter((item) => item.level === 2), [visibleContent]);
  const outline = useMemo(
    () => (phase !== 'edit' && backendEpisodes)
      ? backendEpisodes.map((ep, idx) => ({ ...ep, title: ep.title, level: 2, offset: idx }))
      : markdownOutline,
    [phase, backendEpisodes, markdownOutline],
  );

  useEffect(() => {
    if (backendEpisodes) {
      onEpisodesChange?.(backendEpisodes.map((ep) => ({ id: ep.id, title: ep.title, episode_number: ep.episode_number })));
    }
  }, [backendEpisodes, onEpisodesChange]);
  const safeSelectedEpisode = outline.length > 0 ? Math.min(selectedEpisode, outline.length - 1) : 0;

  const episodeRailLoading = hasStarted && (phase === "thinking" || phase === "streaming");
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
    setSelectedEpisode(0);
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

    // 暂存输入到本地缓存（fire-and-forget）
    saveDraft(projectId, { text, modelId: model, episodeCount: epCount, episodeDuration: duration });

    // 发送前保存当前内容，超时时可恢复（避免丢失已有剧本）
    const prevContent = scriptContent;

    // 每次发送前清除上次的恢复内容（成功时不恢复）
    setInputRestoreText('');
    setStreamingPaused(false);

    // 取消上一次未完成的请求
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

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
    setSelectedEpisode(0);
    setBackendEpisodes(null);

    let receivedContent = '';

    // 超时统一处理：toast + 恢复输入 + 恢复内容
    // 关键：不调用 setHasStarted(false)，保持底部 InputCard 同一实例，
    // 通过 disabled(true→false) 转换触发 restoreText 机制，避免重新挂载的时序问题
    const handleTimeout = () => {
      showToast('请求超时，请稍后重试');
      setInputRestoreText(text);
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
        const chatMessage = epCount != null
          ? `${text}（集数要求：${epCount} 集）`
          : text;

        // 保持 thinking 阶段（DotsLoading 加载动画），等首个 SSE chunk 到达后再切 streaming
        receivedContent = '';

        let hasStartedStreaming = false;

        setIsSseRunning(true);
        await apiChatScriptWorkspaceStream(
          projectId,
          { message: chatMessage, model, episode_count: epCount },
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
            },
            signal: abortController.signal,
          }
        );
        // SSE 完成后不立即切 view，由 AiStreamingContent 的打字动画播完后
        // 通过 onDone → handleStreamingDone 来切换到 view 阶段
      }
    } catch (err) {
      // 504 网关超时
      if (err.isGatewayTimeout) {
        handleTimeout();
        return;
      }

      // 网络层错误（DNS 失败、连接被拒等）→ 保留已有内容，不丢失
      if (err.isNetworkError) {
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
          // streaming 阶段用户主动暂停：交给 onStreamingPause 回调处理，此处只提示
          stopReasonRef.current = null;
          showToast('剧本创作已暂停', 'info');
        } else {
          // thinking 阶段用户主动暂停：尚未收到任何内容，恢复输入框并清空后端剧本
          stopReasonRef.current = null;
          setInputRestoreText(text);
          setScriptContent(prevContent);
          setPhase(prevContent ? 'view' : 'initial');
          setHasStarted(!!prevContent);
          showToast('剧本创作已暂停', 'info');
          // 清空后端保存的内容，确保刷新后不显示未完成的剧本
          apiSaveScriptWorkspace(projectId, { content: prevContent || '' }).catch(() => {});
        }
        return;
      }

      console.error('[ScriptPage] 生成剧本失败:', err);
      setInputRestoreText(text);
      setPhase('initial');
      setHasStarted(false);
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

  // 提取主体二次确认弹窗
  const handleSelectEpisode = useCallback(
    (index) => {
      setSelectedEpisode(index);
      requestAnimationFrame(() => {
        const item = outline[index];
        if (!item) return;
        const container = phase === 'edit'
          ? editorContentRef.current
          : renderedContentRef.current;
        if (!container) return;
        const headings = container.querySelectorAll('h2');
        const heading = Array.from(headings).find((el) => el.textContent.trim() === item.title.trim());
        if (!heading) return;
        const containerTop = container.getBoundingClientRect().top;
        const headingTop = heading.getBoundingClientRect().top;
        container.scrollTop += headingTop - containerTop - 20;
      });
    },
    [outline, phase],
  );

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
        gap: '24px',
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
      {!hasStarted ? (
        <ScriptEmptyState
          onSend={handleSend}
          onScriptFileSelect={handleScriptFileSelect}
          scriptFile={scriptInputFile}
          onRemoveScriptFile={() => setScriptInputFile(null)}
          onStoryboardFileSelect={setStoryboardInputFile}
          storyboardFile={storyboardInputFile}
          onRemoveStoryboardFile={() => setStoryboardInputFile(null)}
          onDownloadTemplate={handleDownloadTemplate}
          projectId={projectId}
          showToast={showToast}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          episodeCount={episodeCount}
          onEpisodeCountChange={setEpisodeCount}
          episodeDuration={episodeDuration}
          onEpisodeDurationChange={setEpisodeDuration}
          restoreText={inputRestoreText}
        />
      ) : (
        <div style={{ display: 'flex', minHeight: 0, flex: 1, alignItems: 'stretch', gap: '24px', alignSelf: 'stretch' }}>
          <EpisodeList outline={outline} selectedIndex={safeSelectedEpisode} onSelect={handleSelectEpisode} loading={episodeRailLoading} />

          <div style={{ display: 'flex', minHeight: 0, flex: 1, flexDirection: 'column', alignItems: 'stretch', justifyContent: 'space-between', gap: '24px', alignSelf: 'stretch', overflow: 'hidden' }}>
            <div style={{ display: 'flex', flex: 1, minHeight: 0, justifyContent: 'center', alignItems: 'stretch', overflow: 'hidden' }}>
              <div style={{ display: 'flex', width: '80%', maxWidth: '80%', minWidth: '420px', minHeight: 0, flexDirection: 'column', alignSelf: 'stretch' }}>
                <ScriptPanel
                  phase={phase}
                  hasScript={Boolean(scriptContent)}
                  scriptContent={scriptContent}
                  draftContent={draftContent}
                  onDraftChange={setDraftContent}
                  onEdit={handleEdit}
                  onSave={handleSave}
                  onCancelEdit={handleCancelEdit}
                  onExtractRequest={handleExtractRequest}
                  onStreamingDone={handleStreamingDone}
                  onStreamingPause={handleStreamingPause}
                  streamingPaused={streamingPaused}
                  isSseActive={isSseRunning}
                  onActiveIndexChange={setSelectedEpisode}
                  renderedContentRef={renderedContentRef}
                  editorContentRef={editorContentRef}
                  isSaving={isSaving}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', alignSelf: 'stretch', paddingTop: '8px', overflow: 'visible', flexShrink: 0 }}>
              <InputCard
                onSend={handleSend}
                projectId={projectId}
                showToast={showToast}
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
        </div>
      )}
    </div>
    <Toast toasts={toasts} />

    </>  );
}
