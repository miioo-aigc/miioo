/**
 * @file ScriptRendered.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   展示已生成剧本并为最后一集补充滚动空间
 *
 * ─── 状态与副作用 ───────────────────────────────────────────────────
 *   paddingRef：维护最后一集标题可滚到顶部所需的底部占位
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  从 ScriptPage 抽离，保持剧本滚动和展示行为不变
 *   2026-07-21  移除仅服务左侧剧集结构导航的当前分集侦测
 */
import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { ensureScriptDisplayStyles } from './ScriptDisplayStyles';

export default function ScriptRendered({ content, contentRef }) {
  const paddingRef = useRef(null);

  useEffect(() => {
    ensureScriptDisplayStyles();
  }, []);

  useEffect(() => {
    const container = contentRef?.current;
    const paddingEl = paddingRef.current;
    if (!container || !paddingEl) return;

    paddingEl.style.height = '0px';

    const headings = container.querySelectorAll('h2');
    if (headings.length === 0) return;

    const lastHeading = headings[headings.length - 1];
    const lastHeadingOffset =
      container.scrollTop +
      lastHeading.getBoundingClientRect().top -
      container.getBoundingClientRect().top;

    const clientHeight = container.clientHeight;
    const scrollHeight = container.scrollHeight;
    const needed = lastHeadingOffset - (scrollHeight - clientHeight);
    if (needed > 0) {
      paddingEl.style.height = `${needed}px`;
    }
  }, [content, contentRef]);

  return (
    <div
      ref={contentRef}
      className="script-md"
      style={{ alignSelf: 'stretch', flex: 1, minHeight: 0, overflowY: 'auto' }}
    >
      <ReactMarkdown
        components={{
          h1: ({ children, ...props }) => <h1 {...props}>{children}</h1>,
          h2: ({ children, ...props }) => <h2 {...props}>{children}</h2>,
        }}
      >
        {content}
      </ReactMarkdown>
      <div ref={paddingRef} aria-hidden="true" />
    </div>
  );
}
