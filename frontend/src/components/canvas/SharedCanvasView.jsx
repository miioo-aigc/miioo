import { ReactFlow, Background, PanOnScrollMode } from '@xyflow/react';
import { Copy, LockKeyhole, RefreshCw } from 'lucide-react';
import Button from '../ui/Button';
import HomeLogo from '../home/HomeLogo';
import { CANVAS_GRID_GAP, CANVAS_GRID_DOT_SIZE, CANVAS_GRID_OFFSET } from './CanvasGrid';
import SharedCanvasNode from './SharedCanvasNode';
import '@xyflow/react/dist/style.css';

const nodeTypes = { shared: SharedCanvasNode };

export default function SharedCanvasView({ title, graph, loading, error, onRetry, onCopy, copying }) {
  return (
    <main className="relative h-dvh min-h-[320px] bg-surface-toolbar text-text-primary [font-synthesis:none] antialiased">
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center gap-[16px] px-[24px] py-[16px]">
        <a href="/" aria-label="访问官网首页" className="pointer-events-auto shrink-0"><HomeLogo width={66} height={20} /></a>
        <span aria-hidden="true" className="h-[16px] w-[1px] translate-y-[4px] bg-stroke-accent" />
        <h1 className="min-w-0 flex-1 translate-y-[4px] truncate text-[14px]" title={title}>{title || '分享画布'}</h1>
        <span className="flex items-center gap-[4px] text-[12px] text-text-secondary"><LockKeyhole size={14} />只读</span>
        <Button className="pointer-events-auto" variant="secondary" icon={<Copy size={14} />} loading={copying} onClick={onCopy}>复制链接</Button>
      </header>
      <section className="h-full" aria-label="公开画布">
        {loading || error || !graph?.nodes.length ? (
          <div className="flex h-full flex-col items-center justify-center gap-[16px] px-[24px] text-center" role="status">
            <p className="max-w-[520px] break-words text-[14px] text-text-secondary">{loading ? '正在加载画布…' : error || '此画布暂无内容'}</p>
            {error && <Button variant="secondary" icon={<RefreshCw size={14} />} onClick={onRetry}>重试</Button>}
          </div>
        ) : (
          <ReactFlow nodes={graph.nodes} edges={graph.edges} nodeTypes={nodeTypes}
            nodesDraggable={false} nodesConnectable={false} nodesFocusable={false} edgesFocusable={false}
            elementsSelectable={false} deleteKeyCode={null} selectionKeyCode={null} multiSelectionKeyCode={null}
            panOnDrag panOnScroll panOnScrollMode={PanOnScrollMode.Free} panOnScrollSpeed={0.5}
            zoomOnDoubleClick={false} zoomOnPinch proOptions={{ hideAttribution: true }}
            fitView fitViewOptions={{ padding: 0.2, maxZoom: 1 }} minZoom={0.01} maxZoom={4} colorMode="dark" className="bg-surface-toolbar">
            <Background variant="dots" gap={CANVAS_GRID_GAP} size={CANVAS_GRID_DOT_SIZE} offset={CANVAS_GRID_OFFSET} patternClassName="[r:0.5px]" color="rgba(255,255,255,0.16)" />
          </ReactFlow>
        )}
      </section>
    </main>
  );
}
