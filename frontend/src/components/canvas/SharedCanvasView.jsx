import { useState } from 'react';
import { ReactFlow, Background, Panel } from '@xyflow/react';
import { Copy, LockKeyhole, Maximize, RefreshCw, ZoomIn, ZoomOut } from 'lucide-react';
import Button from '../ui/Button';
import IconButton from '../ui/IconButton';
import Tooltip from '../ui/Tooltip';
import SharedCanvasNode from './SharedCanvasNode';
import '@xyflow/react/dist/style.css';

const nodeTypes = { shared: SharedCanvasNode };

export default function SharedCanvasView({ title, graph, loading, error, onRetry, onCopy, copying }) {
  const [flow, setFlow] = useState(null);
  const tools = [
    { label: '缩小', icon: <ZoomOut size={16} />, run: () => flow?.zoomOut() },
    { label: '放大', icon: <ZoomIn size={16} />, run: () => flow?.zoomIn() },
    { label: '适应全部', icon: <Maximize size={16} />, run: () => flow?.fitView({ padding: 0.2, maxZoom: 1 }) },
  ];
  return (
    <main className="flex h-dvh min-h-[320px] flex-col bg-surface-base text-text-primary">
      <header className="flex min-h-[64px] shrink-0 flex-wrap items-center gap-[12px] border-b border-stroke-normal bg-surface-toolbar px-[20px] py-[12px]">
        <span className="text-[20px] font-semibold">miioo</span>
        <h1 className="min-w-0 flex-1 basis-[100px] truncate text-[14px]" title={title}>{title || '分享画布'}</h1>
        <span className="flex items-center gap-[4px] text-[12px] text-text-secondary"><LockKeyhole size={14} />只读</span>
        <Button variant="secondary" icon={<Copy size={14} />} loading={copying} onClick={onCopy}>复制链接</Button>
      </header>
      <section className="relative min-h-0 flex-1" aria-label="公开画布">
        {loading || error || !graph?.nodes.length ? (
          <div className="flex h-full flex-col items-center justify-center gap-[16px] px-[24px] text-center" role="status">
            <p className="max-w-[520px] break-words text-[14px] text-text-secondary">{loading ? '正在加载画布…' : error || '此画布暂无内容'}</p>
            {error && <Button variant="secondary" icon={<RefreshCw size={14} />} onClick={onRetry}>重试</Button>}
          </div>
        ) : (
          <ReactFlow nodes={graph.nodes} edges={graph.edges} nodeTypes={nodeTypes} onInit={setFlow}
            nodesDraggable={false} nodesConnectable={false} nodesFocusable={false} edgesFocusable={false}
            elementsSelectable={false} deleteKeyCode={null} selectionKeyCode={null} multiSelectionKeyCode={null}
            fitView fitViewOptions={{ padding: 0.2, maxZoom: 1 }} minZoom={0.05} maxZoom={2} colorMode="dark">
            <Background color="var(--color-stroke-normal)" gap={24} size={1} />
            <Panel position="bottom-center" className="flex gap-[8px] rounded-[8px] border border-stroke-normal bg-surface-toolbar p-[8px]">
              {tools.map((tool) => <Tooltip key={tool.label} label={tool.label}><IconButton size="large" variant="secondary" aria-label={tool.label} icon={tool.icon} onClick={tool.run} /></Tooltip>)}
            </Panel>
          </ReactFlow>
        )}
      </section>
    </main>
  );
}
