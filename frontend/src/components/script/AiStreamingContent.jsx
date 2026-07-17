/**
 * @file AiStreamingContent.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   SSE 剧本内容的逐字展示、自动滚动和暂停回调
 *
 * ─── 状态与副作用 ───────────────────────────────────────────────────
 *   renderIndex / pageVisible：控制逐字动画和后台标签页跳帧
 *   visibilitychange：页面隐藏时直接展示已接收内容
 *   onPause / onDone：通过 ref 保持最新页面回调
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  从 ScriptPage 抽离，保持流式展示行为不变
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ensureScriptDisplayStyles } from './ScriptDisplayStyles';

const CHAR_INTERVAL = 7;

export default function AiStreamingContent({ content, onDone, paused = false, onPause, sseActive = false }) {
  const allChars = useMemo(() => [...content], [content]);
  const [renderIndex, setRenderIndex] = useState(0);
  const [pageVisible, setPageVisible] = useState(true);
  const containerRef = useRef(null);
  const shouldStickToBottomRef = useRef(true);
  const onDoneRef = useRef(onDone);
  const onPauseRef = useRef(onPause);
  const hasFiredPauseRef = useRef(false);

  useEffect(() => {
    ensureScriptDisplayStyles();
  }, []);

  useEffect(() => {
    onDoneRef.current = onDone;
    onPauseRef.current = onPause;
  }, [onDone, onPause]);

  useEffect(() => {
    const handle = () => {
      const visible = document.visibilityState === 'visible';
      setPageVisible(visible);
      if (!visible && allChars.length > 0) {
        setRenderIndex(allChars.length);
      }
    };
    document.addEventListener('visibilitychange', handle);
    return () => document.removeEventListener('visibilitychange', handle);
  }, [allChars.length]);

  useEffect(() => {
    if (paused && !hasFiredPauseRef.current) {
      hasFiredPauseRef.current = true;
      const displayed = allChars.slice(0, renderIndex).join('');
      onPauseRef.current?.(displayed);
    }
    if (!paused) {
      hasFiredPauseRef.current = false;
    }
  }, [paused, allChars, renderIndex]);

  useEffect(() => {
    if (!pageVisible || paused) return undefined;

    if (renderIndex >= allChars.length) {
      if (allChars.length > 0 && !sseActive) {
        onDoneRef.current?.();
      }
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setRenderIndex((value) => value + 1);
    }, CHAR_INTERVAL);

    return () => window.clearTimeout(timer);
  }, [pageVisible, paused, allChars.length, renderIndex, sseActive]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !shouldStickToBottomRef.current) return;
    container.scrollTop = container.scrollHeight;
  }, [renderIndex]);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldStickToBottomRef.current = distanceToBottom <= 24;
  }, []);

  const displayed = allChars.slice(0, renderIndex).join('');
  const done = renderIndex >= allChars.length;

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={done ? 'script-md script-scroll' : 'script-md script-scroll ai-text--typing'}
      style={{ alignSelf: 'stretch', flex: 1, minHeight: 0, overflowY: 'auto' }}
    >
      <ReactMarkdown
        components={{
          h1: ({ children, ...props }) => <h1 {...props}>{children}</h1>,
          h2: ({ children, ...props }) => <h2 {...props}>{children}</h2>,
        }}
      >
        {displayed}
      </ReactMarkdown>
    </div>
  );
}
