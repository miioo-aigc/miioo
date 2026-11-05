/**
 * @file CanvasSearchNodeRow.jsx
 * @structure-index
 *   CanvasSearchNodeRow 工具栏搜索弹窗与节点导航器列表模式共用的节点结果行。
 */
import { Folders, LayoutDashboard } from 'lucide-react';
import CanvasNodeIcon from './CanvasNodeIcon';
import { canvasSearchName, canvasSearchParts } from './CanvasSearch.js';

export function CanvasSearchTypeIcon({ type }) {
  if (type === 'all') return <LayoutDashboard size={16} aria-hidden="true" />;
  if (type === 'canvasGroup') return <Folders size={16} aria-hidden="true" />;
  return <CanvasNodeIcon nodeType={type} />;
}

export default function CanvasSearchNodeRow({
  node,
  nodes,
  query,
  active = false,
  onClick,
  onFocus,
}) {
  const name = canvasSearchName(node);
  const description = node.type === 'canvasGroup'
    ? `${nodes.filter((item) => item.parentId === node.id).length} 个成员`
    : String(node.data?.prompt || node.data?.content || node.data?.transcript || '无提示词');

  return <button type="button" data-search-active={active ? 'true' : 'false'} onFocus={onFocus} onClick={onClick}
    className={`flex w-full cursor-pointer items-start gap-[12px] rounded-medium border-0 px-[12px] py-[10px] text-left text-text-hint hover:bg-white-5 focus-visible:outline focus-visible:outline-stroke-active ${active ? 'bg-white-5' : 'bg-transparent'}`}>
    <span className="mt-[2px] flex size-[36px] shrink-0 items-center justify-center rounded-medium border border-stroke-normal bg-white-8">
      <CanvasSearchTypeIcon type={node.type} />
    </span>
    <span className="min-w-0 flex-1">
      <span className={`canvas-search-node-row__title block truncate text-[14px] font-medium leading-[20px] ${active ? 'text-text-primary' : ''}`} title={name}>
        {canvasSearchParts(name, query).map((part, index) => part.match
          ? <mark key={index} className="bg-transparent text-text-accent">{part.text}</mark>
          : part.text)}
      </span>
      <span className="mt-[4px] block truncate text-[12px] leading-[16px]">{description}</span>
    </span>
  </button>;
}
