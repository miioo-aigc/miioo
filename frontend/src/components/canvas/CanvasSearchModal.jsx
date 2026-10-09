/** 画布名称搜索：独立弹窗、类型筛选、匹配高亮与键盘导航。 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Folders, LayoutDashboard, Search } from 'lucide-react';
import CanvasNodeIcon from './CanvasNodeIcon';
import { CANVAS_SEARCH_TYPES, canvasSearchName, canvasSearchParts, filterCanvasSearchNodes } from './CanvasSearch.js';

function SearchTypeIcon({ type }) {
  if (type === 'all') return <LayoutDashboard size={16} />;
  if (type === 'canvasGroup') return <Folders size={16} />;
  return <CanvasNodeIcon nodeType={type} />;
}

export default function CanvasSearchModal({ nodes, onClose, onSelect }) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [activeIndex, setActiveIndex] = useState(0);
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const results = filterCanvasSearchNodes(nodes, query, type);
  const currentIndex = Math.min(activeIndex, results.length - 1);
  useEffect(() => {
    const previous = document.activeElement;
    inputRef.current?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  useEffect(() => {
    dialogRef.current?.querySelector('[data-search-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [currentIndex, query, type]);

  const onKeyDown = (event) => {
    event.stopPropagation();
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    if (['ArrowDown', 'ArrowUp'].includes(event.key) && results.length) {
      event.preventDefault();
      setActiveIndex((currentIndex + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length);
    }
    if (event.key === 'Enter' && event.target === inputRef.current && results[currentIndex]) {
      event.preventDefault(); onSelect(results[currentIndex].id);
    }
    if (event.key === 'Tab') {
      const controls = [...dialogRef.current.querySelectorAll('input, button')];
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  };

  return createPortal(<div className="fixed inset-0 z-[100] flex items-center justify-center bg-surface-overlay p-[16px]" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }} onKeyDown={onKeyDown}>
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-label="搜索节点" className="flex h-[520px] max-h-[calc(100dvh-32px)] w-[600px] max-w-full flex-col overflow-hidden rounded-large border border-stroke-normal bg-surface-modal" style={{ boxShadow: '0px 2px 4px var(--color-shadow)' }}>
      <div className="flex shrink-0 items-center gap-[12px] border-b border-stroke-normal px-[16px] py-[8px]">
        <Search size={16} className="shrink-0 text-text-hint" />
        <input ref={inputRef} aria-label="搜索节点名称" value={query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }} placeholder="搜索节点..." className="h-[40px] min-w-0 flex-1 border-0 bg-transparent text-[14px] text-text-primary outline-none placeholder:text-text-hint" />
      </div>
      <div role="group" aria-label="节点类型" className="flex shrink-0 overflow-x-auto border-b border-stroke-normal pl-[4px]">
        {CANVAS_SEARCH_TYPES.map((item) => <button key={item.value} type="button" aria-pressed={type === item.value} onClick={() => { setType(item.value); setActiveIndex(0); }} className={`flex shrink-0 cursor-pointer items-center gap-[6px] border-0 bg-transparent p-[12px] text-[12px] leading-[16px] focus-visible:outline focus-visible:outline-stroke-active ${type === item.value ? 'font-medium text-text-primary' : 'text-text-hint hover:text-text-primary'}`}><SearchTypeIcon type={item.value} />{item.label}</button>)}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[16px] py-[8px]" aria-label="搜索结果">
        {!results.length && <div role="status" className="py-[32px] text-center text-[14px] text-text-hint">{nodes.length ? '未找到匹配节点' : '暂无节点'}</div>}
        {results.map((node, index) => <button key={node.id} type="button" data-search-active={index === currentIndex} onFocus={() => setActiveIndex(index)} onClick={() => onSelect(node.id)} className={`flex w-full cursor-pointer items-start gap-[12px] rounded-medium border-0 px-[12px] py-[10px] text-left text-text-hint hover:bg-white-5 focus-visible:outline focus-visible:outline-stroke-active ${index === currentIndex ? 'bg-white-5' : 'bg-transparent'}`}>
          <span className="mt-[2px] flex size-[36px] shrink-0 items-center justify-center rounded-medium border border-stroke-normal bg-white-8"><SearchTypeIcon type={node.type} /></span>
          <span className="min-w-0 flex-1">
            <span className={`block truncate text-[14px] font-medium leading-[20px] ${index === currentIndex ? 'text-text-primary' : ''}`} title={canvasSearchName(node)}>{canvasSearchParts(canvasSearchName(node), query).map((part, partIndex) => part.match ? <mark key={partIndex} className="bg-transparent text-text-accent">{part.text}</mark> : part.text)}</span>
            <span className="mt-[4px] block truncate text-[12px] leading-[16px]">{node.type === 'canvasGroup' ? `${nodes.filter((item) => item.parentId === node.id).length} 个成员` : String(node.data?.prompt || node.data?.content || node.data?.transcript || '无提示词')}</span>
          </span>
        </button>)}
      </div>
    </section>
  </div>, document.body);
}
