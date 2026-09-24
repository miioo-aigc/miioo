/**
 * @file CanvasPage.jsx
 * @structure-index
 *
 * ─── 页面编排 ─────────────────────────────────────────────────────
 *   CanvasPage          画布详情加载、认证资料和画布区块组合
 *
 * ─── 页面区块 ────────────────────────────────────────────────────
 *   CanvasProjectHeader components/canvas；左上角品牌与项目名称
 *   CanvasUserMenu      components/canvas；右上角用户信息与菜单
 *   CanvasCenterPrompt  components/canvas；中央空态提示
 *   CanvasCenterActions components/canvas；中央素材与创作入口
 *   CanvasToolbar       components/canvas；底部画布工具栏
 *   CanvasMiniMap       components/canvas；双层背景的交互预览地图
 *
 * ─── 业务边界 ────────────────────────────────────────────────────
 *   节点组件只提供本地草稿展示和动作回调；文档保存、连接协议和生成任务另行接入。
 *   2026-09-24：空白面板使用标准双击事件打开菜单，关闭默认双击缩放。
 *   2026-09-24：初始缩放为 100%，新增节点不自动适配视口。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { applyNodeChanges, Background, ReactFlow } from '@xyflow/react';
import CanvasMiniMap from '../components/canvas/CanvasMiniMap';
import { X } from 'lucide-react';
import '@xyflow/react/dist/style.css';
import { apiGetCanvasDocument } from '../api/canvas';
import { apiGetCurrentUser } from '../api/user';
import { apiLogout, clearTokens } from '../api/auth';
import CanvasCenterActions from '../components/canvas/CanvasCenterActions';
import CanvasCenterPrompt from '../components/canvas/CanvasCenterPrompt';
import CanvasProjectHeader from '../components/canvas/CanvasProjectHeader';
import CanvasToolbar from '../components/canvas/CanvasToolbar';
import CanvasUserMenu from '../components/canvas/CanvasUserMenu';
import AssetPickerModal from '../components/AssetPickerModal';
import ProfileModal from '../components/ProfileModal';
import { CanvasNodeAddMenu, canvasNodeTypes, createCanvasNode, getCanvasNodeMenuPosition, updateSelectedNode } from '../components/canvas';

function UnsupportedAction({ onClose }) {
  return <div className="absolute bottom-[92px] left-1/2 z-20 flex w-[280px] -translate-x-1/2 items-center justify-between rounded-[12px] border border-white-10 bg-surface-modal px-[14px] py-[10px] text-[13px] text-text-secondary shadow-[0_8px_28px_rgba(0,0,0,0.35)]"><span>该入口将在后续阶段开放</span><button type="button" className="border-0 bg-transparent p-0 text-text-hint" onClick={onClose} aria-label="关闭提示"><X size={16} /></button></div>;
}

export default function CanvasPage({ canvasId, onBackHome }) {
  const [canvas, setCanvas] = useState(null);
  const [currentUser, setCurrentUser] = useState({});
  const [profileOpen, setProfileOpen] = useState(false);
  const [loadedCanvasId, setLoadedCanvasId] = useState(null);
  const [error, setError] = useState('');
  const [activeTool, setActiveTool] = useState('select');
  const [showMiniMap, setShowMiniMap] = useState(false);
  const [notice, setNotice] = useState(false);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [nodes, setNodes] = useState([]);
  const [nodeMenu, setNodeMenu] = useState(null);
  const [flowInstance, setFlowInstance] = useState(null);
  const dragPositionsRef = useRef(new Map());

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([apiGetCanvasDocument(canvasId), apiGetCurrentUser()]).then(([documentResult, userResult]) => {
      if (cancelled) return;
      if (documentResult.status === 'rejected') {
        setError(documentResult.reason?.message || '画布加载失败，请返回重试');
      } else {
        setError('');
        setCanvas(documentResult.value);
      }
      if (userResult.status === 'fulfilled') setCurrentUser(userResult.value || {});
      setLoadedCanvasId(canvasId);
    });
    return () => { cancelled = true; };
  }, [canvasId]);

  const notifyUnsupported = useCallback(() => { setNotice(true); window.setTimeout(() => setNotice(false), 2400); }, []);
  const loading = loadedCanvasId !== canvasId;
  const handleLogout = async () => {
    try {
      await apiLogout();
    } finally {
      clearTokens();
      onBackHome();
    }
  };

  const handleUnsupported = notifyUnsupported;
  const handleNodesChange = useCallback((changes) => {
    setNodes((current) => applyNodeChanges(changes, current));
  }, []);
  const handleNodeDragStart = useCallback((_, node) => {
    dragPositionsRef.current.set(node.id, node.position);
    setNodes((current) => current.map((item) => item.id === node.id ? { ...item, data: { ...item.data, dragging: true, dragRelease: false } } : item));
  }, []);
  const handleNodeDrag = useCallback((_, node) => {
    const previous = dragPositionsRef.current.get(node.id) || node.position;
    const deltaX = node.position.x - previous.x;
    const deltaY = node.position.y - previous.y;
    const distance = Math.hypot(deltaX, deltaY);
    if (distance < 0.01) return;

    const stretch = Math.min(0.2, Math.max(0.02, distance * 0.012));
    const horizontal = Math.abs(deltaX) >= Math.abs(deltaY);
    const dragScaleX = horizontal ? 1 + stretch : 1 - stretch * 0.24;
    const dragScaleY = horizontal ? 1 - stretch * 0.24 : 1 + stretch;
    dragPositionsRef.current.set(node.id, node.position);
    setNodes((current) => current.map((item) => item.id === node.id ? {
      ...item,
      data: { ...item.data, dragging: true, dragRelease: false, dragScaleX, dragScaleY },
    } : item));
  }, []);
  const handleNodeDragStop = useCallback((_, node) => {
    setNodes((current) => current.map((item) => item.id === node.id ? { ...item, data: { ...item.data, dragging: false, dragRelease: true } } : item));
    dragPositionsRef.current.delete(node.id);
    window.setTimeout(() => setNodes((current) => current.map((item) => item.id === node.id ? { ...item, data: { ...item.data, dragRelease: false, dragScaleX: 1, dragScaleY: 1 } } : item)), 280);
  }, []);
  const addNode = useCallback((type, position) => {
    const node = createCanvasNode(type, position || { x: 160 + (nodes.length % 3) * 280, y: 160 + Math.floor(nodes.length / 3) * 300 });
    node.data.onPromptChange = (nodeId, prompt) => setNodes((current) => current.map((item) => item.id === nodeId ? { ...item, data: { ...item.data, prompt } } : item));
    node.data.onContentChange = (nodeId, content) => setNodes((current) => current.map((item) => item.id === nodeId ? { ...item, data: { ...item.data, content } } : item));
    node.data.onAddReference = () => handleUnsupported();
    node.data.onGenerate = () => handleUnsupported();
    node.data.onLocalUpload = () => handleUnsupported();
    setNodes((current) => updateSelectedNode([...current, node], node.id));
    setNodeMenu(null);
  }, [handleUnsupported, nodes.length]);
  const handlePaneDoubleClick = useCallback((event) => {
    if (!flowInstance || !event.target.classList.contains('react-flow__pane')) return;
    event.preventDefault();
    const screen = getCanvasNodeMenuPosition(event, { width: window.innerWidth, height: window.innerHeight });
    setNodeMenu({ screen, flowPosition: flowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY }) });
  }, [flowInstance]);
  const handleNodeClick = useCallback((_, node) => {
    setNodes((current) => updateSelectedNode(current, node.id));
  }, []);
  const projectName = canvas?.project_name || canvas?.projectName || '自由画布项目';

  return <div className="relative h-screen w-screen overflow-hidden bg-surface-base text-text-primary [font-synthesis:none] antialiased">
    <CanvasProjectHeader canvasName={projectName} onBackHome={onBackHome} />
    <CanvasUserMenu currentUser={currentUser} onLogout={handleLogout} onOpenProfile={() => setProfileOpen(true)} />
    <div className="absolute inset-0 bg-surface-toolbar">
      <ReactFlow defaultViewport={{ x: 0, y: 0, zoom: 1 }} nodes={nodes} edges={[]} nodeTypes={canvasNodeTypes} onInit={setFlowInstance} onNodesChange={handleNodesChange} onNodeClick={handleNodeClick} onNodeDragStart={handleNodeDragStart} onNodeDrag={handleNodeDrag} onNodeDragStop={handleNodeDragStop} onDoubleClick={handlePaneDoubleClick} zoomOnDoubleClick={false} nodesDraggable={activeTool !== 'hand'} onPaneClick={() => { setNodeMenu(null); setNodes((current) => current.map((node) => ({ ...node, selected: false, data: { ...node.data, creationPanelOpen: false } }))); }} panOnDrag={activeTool === 'hand'} selectionOnDrag={false} proOptions={{ hideAttribution: true }} className="bg-surface-toolbar">
        {/* 固定圆点的屏幕半径，间距和位置仍由 React Flow 随视口变化。 */}
        <Background variant="dots" gap={16} size={1} patternClassName="[r:0.5px]" color="rgba(255,255,255,0.16)" />
        {showMiniMap && <CanvasMiniMap />}
      </ReactFlow>
      {nodeMenu && <div className="pointer-events-none absolute inset-0 z-30"><div className="pointer-events-auto absolute" style={{ left: nodeMenu.screen.left, top: nodeMenu.screen.top }}><CanvasNodeAddMenu onAddNode={(type) => addNode(type, nodeMenu.flowPosition)} /></div></div>}
    </div>
    {loading && <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-[14px] text-text-hint">正在加载画布...</div>}
    {!loading && error && <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-[14px] text-text-danger">{error}</div>}
    {!loading && !error && canvas && nodes.length === 0 && <main className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-[16px] pb-[20px]"><CanvasCenterPrompt /><CanvasCenterActions onAction={notifyUnsupported} /></main>}
    {notice && <UnsupportedAction onClose={() => setNotice(false)} />}
    <CanvasToolbar
      activeTool={activeTool}
      onToolChange={setActiveTool}
      showMiniMap={showMiniMap}
      onMiniMapChange={setShowMiniMap}
      nodes={nodes}
      onAddNode={addNode}
      onCreateCanvas={handleUnsupported}
      onShare={handleUnsupported}
      onOpenAssetPicker={() => setAssetPickerOpen(true)}
    />
    <AssetPickerModal open={assetPickerOpen} onClose={() => setAssetPickerOpen(false)} onConfirm={() => { setAssetPickerOpen(false); handleUnsupported(); }} accept="all" includeSeedanceLibrary />
    <ProfileModal open={profileOpen} currentUser={currentUser} onClose={() => setProfileOpen(false)} onLogout={handleLogout} onProfileUpdated={(updated) => setCurrentUser((previous) => ({ ...previous, ...updated }))} />
  </div>;
}
