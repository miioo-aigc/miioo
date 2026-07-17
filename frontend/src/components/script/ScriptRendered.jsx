/**
 * @file ScriptRendered.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   展示已生成剧本、侦测当前分集并为最后一集补充滚动空间
 *
 * ─── 状态与副作用 ───────────────────────────────────────────────────
 *   paddingRef：维护最后一集标题可滚到顶部所需的底部占位
 *   calcActiveIndex：根据标题可视区域计算当前分集并回调页面
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  从 ScriptPage 抽离，保持分集高亮和滚动行为不变
 */
import { useCallback, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { ensureScriptDisplayStyles } from './ScriptDisplayStyles';

export default function ScriptRendered({ content, contentRef, onActiveIndexChange }) {
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

  const calcActiveIndex = useCallback(() => {
    const container = contentRef?.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const containerTop = containerRect.top;
    const containerBottom = containerRect.bottom;
    const containerHeight = containerRect.height;
    const headings = container.querySelectorAll('h2');

    if (headings.length === 0) { onActiveIndexChange?.(0); return; }

    const threshold = containerHeight * 0.3;
    let activeIndex = 0;
    let foundByThreshold = false;

    for (let i = headings.length - 1; i >= 0; i--) {
      const headingTop = headings[i].getBoundingClientRect().top - containerTop;
      if (headingTop >= 0 && headingTop <= threshold) {
        activeIndex = i;
        foundByThreshold = true;
        break;
      }
      if (headingTop < 0) {
        activeIndex = i;
        foundByThreshold = true;
        break;
      }
    }

    if (!foundByThreshold) {
      let maxVisible = -1;
      for (let i = 0; i < headings.length; i++) {
        const sectionTop = headings[i].getBoundingClientRect().top;
        const sectionBottom = i + 1 < headings.length
          ? headings[i + 1].getBoundingClientRect().top
          : containerBottom + 99999;
        const visibleTop = Math.max(sectionTop, containerTop);
        const visibleBottom = Math.min(sectionBottom, containerBottom);
        const visibleHeight = Math.max(0, visibleBottom - visibleTop);
        if (visibleHeight > maxVisible) {
          maxVisible = visibleHeight;
          activeIndex = i;
        }
      }
    }

    onActiveIndexChange?.(activeIndex);
  }, [contentRef, onActiveIndexChange]);

  return (
    <div
      ref={contentRef}
      className="script-md"
      style={{ alignSelf: 'stretch', flex: 1, minHeight: 0, overflowY: 'auto' }}
      onScroll={calcActiveIndex}
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
