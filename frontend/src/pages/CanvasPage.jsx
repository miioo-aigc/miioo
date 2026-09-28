/**
 * @file CanvasPage.jsx
 * @structure-index
 *
 * ─── 页面编排 ─────────────────────────────────────────────────────
 *   CanvasPage L59；grouping L80；referenceGraph L88；handleNodesChange L123；addNode L166
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
 *   节点与连线为本地草稿；文本通过通用 LLM 接口生成，文档保存及媒体生成尚未接入。
 *   2026-09-28：UseCanvasReferences 编排参考图及文本到音频连线，连接时单次导入正文。
 *   2026-09-24：空白面板使用标准双击事件打开菜单，关闭默认双击缩放。
 *   2026-09-24：初始缩放为 100%，新增节点不自动适配视口。
 *   2026-09-24：节点模型选择保存为本地草稿；文本模型加载由节点外壳负责。
 *   2026-09-28：视频卡片及参考入口支持三类媒体，按真实素材类型回填；其他节点仍按类型筛选。
 *   2026-09-28：新增节点按当前同类型最大序号加1，编号由画布工具统一处理。
 *   2026-09-28：接入捏合、框选、修饰键多选和真正组合；组合交互与几何计算独立维护。
 *   2026-09-28：接入20步历史及5任务并发；拖动和删除按事务记录，发送取消延迟选中。
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
import { applyCanvasAsset, toCanvasAsset } from '../components/canvas/CanvasAssets';
import { addCanvasReference } from '../components/canvas/CanvasReferences';
import { useCanvasReferences } from '../components/canvas/UseCanvasReferences';
import { useCanvasGrouping } from '../components/canvas/UseCanvasGrouping';
import { useCanvasTextGeneration } from '../components/canvas/UseCanvasTextGeneration';
import { useCanvasHistory } from '../components/canvas/UseCanvasHistory';
import { fitCanvasGroups, setCanvasSelection } from '../components/canvas/CanvasGroups';
import { CanvasNodeAddMenu, canvasNodeTypes, createCanvasNode, appendCanvasNode, getCanvasNodeMenuPosition, updateSelectedNode } from '../components/canvas';

// 浏览器 click 先于 dblclick 触发；保留极短窗口，避免双击时先展开创作框。
const CANVAS_SINGLE_CLICK_DELAY = 200;

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
  const [assetTarget, setAssetTarget] = useState(null);
  const [nodeMenu, setNodeMenu] = useState(null);
  const [flowInstance, setFlowInstance] = useState(null);
  const dragPositionsRef = useRef(new Map());
  const pendingNodeClicksRef = useRef(new Map());
  const cancelPendingClicks = useCallback(() => {
    pendingNodeClicksRef.current.forEach((timer) => window.clearTimeout(timer));
    pendingNodeClicksRef.current.clear();
  }, []);
  const history = useCanvasHistory(cancelPendingClicks, !assetPickerOpen && !profileOpen);
  const { nodes, setNodes } = history;
  const grouping = useCanvasGrouping(nodes, setNodes, cancelPendingClicks, !assetPickerOpen && !profileOpen);
  const generateText = useCanvasTextGeneration(nodes, setNodes, canvasId, cancelPendingClicks);
  const enterNodeRef = useRef(grouping.enterNode);
  useEffect(() => { enterNodeRef.current = grouping.enterNode; }, [grouping.enterNode]);
  const openReferencePicker = useCallback((target) => {
    setAssetTarget(target);
    setAssetPickerOpen(true);
  }, []);
  const referenceGraph = useCanvasReferences(grouping.nodes, setNodes, openReferencePicker);

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

  useEffect(() => () => {
    pendingNodeClicksRef.current.forEach((timer) => window.clearTimeout(timer));
    pendingNodeClicksRef.current.clear();
  }, []);

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
    if (changes.some((change) => change.type === 'select' || change.type === 'remove')) cancelPendingClicks();
    setNodes((current) => {
      let next = applyNodeChanges(changes, current);
      if (next.filter((node) => node.selected).length !== 1) next = setCanvasSelection(next, next.filter((node) => node.selected).map((node) => node.id));
      return fitCanvasGroups(next);
    }, { record: changes.some((change) => !['select', 'dimensions'].includes(change.type)) });
  }, [cancelPendingClicks, setNodes]);
  const cancelPendingNodeClick = useCallback((nodeId) => {
    const timer = pendingNodeClicksRef.current.get(nodeId);
    if (!timer) return;
    window.clearTimeout(timer);
    pendingNodeClicksRef.current.delete(nodeId);
  }, []);
  const handleNodeDragStart = useCallback((_, node) => {
    cancelPendingClicks();
    history.begin();
    dragPositionsRef.current.set(node.id, node.position);
    setNodes((current) => current.map((item) => item.id === node.id ? { ...item, data: { ...item.data, dragging: true, dragRelease: false } } : item));
  }, [cancelPendingClicks, history, setNodes]);
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
  }, [setNodes]);
  const handleNodeDragStop = useCallback((_, node) => {
    setNodes((current) => current.map((item) => item.id === node.id ? { ...item, data: { ...item.data, dragging: false, dragRelease: true } } : item));
    dragPositionsRef.current.delete(node.id);
    history.end();
    window.setTimeout(() => setNodes((current) => current.map((item) => item.id === node.id ? { ...item, data: { ...item.data, dragRelease: false, dragScaleX: 1, dragScaleY: 1 } } : item)), 280);
  }, [history, setNodes]);
  const addNode = useCallback((type, position) => {
    const node = createCanvasNode(type, position || { x: 160 + (nodes.length % 3) * 280, y: 160 + Math.floor(nodes.length / 3) * 300 });
    node.data.onPromptChange = (nodeId, prompt) => setNodes((current) => current.map((item) => item.id === nodeId ? { ...item, data: { ...item.data, prompt } } : item));
    node.data.onModelChange = (nodeId, model) => setNodes((current) => current.map((item) => item.id === nodeId ? { ...item, data: { ...item.data, model } } : item));
    node.data.onContentChange = (nodeId, content) => setNodes((current) => current.map((item) => item.id === nodeId ? { ...item, data: { ...item.data, content } } : item));
    node.data.onCancelPendingClick = cancelPendingNodeClick;
    node.data.onEnterEditing = (nodeId) => {
      cancelPendingNodeClick(nodeId);
      enterNodeRef.current(nodeId);
    };
    node.data.onGenerate = () => handleUnsupported();
    node.data.onAssetChange = (nodeId, asset) => setNodes((current) => applyCanvasAsset(current, nodeId, asset));
    node.data.onSelectAsset = (nodeId, nodeType) => {
      setAssetTarget({ nodeId, nodeType });
      setAssetPickerOpen(true);
    };
    setNodes((current) => appendCanvasNode(current, node));
    setNodeMenu(null);
  }, [cancelPendingNodeClick, handleUnsupported, nodes.length, setNodes]);
  const handlePaneDoubleClick = useCallback((event) => {
    if (!flowInstance || !event.target.classList.contains('react-flow__pane')) return;
    event.preventDefault();
    window.getSelection()?.removeAllRanges();
    const screen = getCanvasNodeMenuPosition(event, { width: window.innerWidth, height: window.innerHeight });
    setNodeMenu({ screen, flowPosition: flowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY }) });
  }, [flowInstance]);
  const handleNodeClick = (event, node) => {
    if (event.target.closest('.canvas-creation-panel')) return;
    pendingNodeClicksRef.current.forEach((timer, nodeId) => {
      window.clearTimeout(timer);
      pendingNodeClicksRef.current.delete(nodeId);
    });
    if (activeTool === 'hand') return;
    const selectionId = grouping.resolveSelectionId(node);
    if (event.metaKey || event.ctrlKey || event.shiftKey) {
      setNodes((current) => {
        const ids = new Set(current.filter((item) => item.selected).map((item) => item.id));
        if (selectionId !== node.id) {
          if (ids.has(selectionId)) ids.delete(selectionId);
          else ids.add(selectionId);
        }
        return setCanvasSelection(current, [...ids]);
      });
      return;
    }
    if (selectionId !== node.id || node.type === 'canvasGroup') {
      setNodes((current) => setCanvasSelection(current, [selectionId]));
      return;
    }
    if (node.type !== 'text') {
      setNodes((current) => updateSelectedNode(current, node.id));
      return;
    }
    const timer = window.setTimeout(() => {
      pendingNodeClicksRef.current.delete(node.id);
      setNodes((current) => updateSelectedNode(current, node.id));
    }, CANVAS_SINGLE_CLICK_DELAY);
    pendingNodeClicksRef.current.set(node.id, timer);
  };
  const projectName = canvas?.project_name || canvas?.projectName || '自由画布项目';

  return <div className="relative h-screen w-screen overflow-hidden bg-surface-base text-text-primary [font-synthesis:none] antialiased">
    <CanvasProjectHeader canvasName={projectName} onBackHome={onBackHome} />
    <CanvasUserMenu currentUser={currentUser} onLogout={handleLogout} onOpenProfile={() => setProfileOpen(true)} />
    <div className="absolute inset-0 bg-surface-toolbar">
      <ReactFlow defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        nodes={referenceGraph.nodes.map((node) => node.type === 'text' ? { ...node, data: { ...node.data, onGenerate: generateText,
          onContentChange: (nodeId, content) => setNodes((current) => current.map((item) => item.id === nodeId ? { ...item, data: { ...item.data, content } } : item)),
          onPromptChange: (nodeId, prompt) => setNodes((current) => current.map((item) => item.id === nodeId ? { ...item, data: { ...item.data, prompt } } : item)),
          onModelChange: (nodeId, model) => setNodes((current) => current.map((item) => item.id === nodeId ? { ...item, data: { ...item.data, model } } : item)),
          onCancelPendingClick: cancelPendingNodeClick, onEnterEditing: grouping.enterNode,
        } } : node)} edges={referenceGraph.edges} onEdgesChange={referenceGraph.onEdgesChange}
        nodesConnectable={activeTool !== 'hand'} onConnect={referenceGraph.onConnect} isValidConnection={referenceGraph.isValidConnection} nodeTypes={canvasNodeTypes} onInit={setFlowInstance}
        onNodesChange={handleNodesChange} onNodeClick={handleNodeClick}
        onBeforeDelete={async ({ nodes: removedNodes, edges: removedEdges }) => { cancelPendingClicks(); if (removedNodes.length || removedEdges.length) history.begin(); return true; }}
        onDelete={() => history.end()}
        onNodeDoubleClick={(event, node) => {
          if (activeTool !== 'hand' && node.type !== 'canvasGroup' && !event.target.closest('button, input, textarea')) grouping.enterNode(node.id);
        }}
        onNodeDragStart={handleNodeDragStart} onNodeDrag={handleNodeDrag} onNodeDragStop={handleNodeDragStop}
        onDoubleClick={handlePaneDoubleClick} zoomOnDoubleClick={false} zoomOnPinch={true}
        nodesDraggable={activeTool !== 'hand'}
        onPaneClick={() => { cancelPendingClicks(); setNodeMenu(null); setNodes((current) => setCanvasSelection(current, [])); }}
        panOnDrag={activeTool === 'hand'} selectionOnDrag={activeTool === 'select'}
        multiSelectionKeyCode={['Meta', 'Control', 'Shift']} selectionKeyCode={null}
        onSelectionStart={() => { cancelPendingClicks(); setNodeMenu(null); setNodes((current) => setCanvasSelection(current, current.filter((node) => node.selected).map((node) => node.id))); }}
        proOptions={{ hideAttribution: true }} className="bg-surface-toolbar">
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
      canUndo={history.canUndo}
      canRedo={history.canRedo}
      onUndo={() => { cancelPendingClicks(); history.undo(); }}
      onRedo={() => { cancelPendingClicks(); history.redo(); }}
      onOpenAssetPicker={() => { setAssetTarget(null); setAssetPickerOpen(true); }}
    />
    <AssetPickerModal
      open={assetPickerOpen}
      onClose={() => { setAssetPickerOpen(false); setAssetTarget(null); }}
      onConfirm={(assets) => {
        if (assetTarget?.purpose === 'reference') setNodes((current) => addCanvasReference(current, assetTarget.nodeId, assets[0], assetTarget.mode));
        else if (assetTarget) setNodes((current) => applyCanvasAsset(current, assetTarget.nodeId, assets[0]));
        else handleUnsupported();
      }}
      accept={assetTarget?.nodeType === 'video' ? 'all' : assetTarget?.nodeType || 'all'}
      selectionMode={assetTarget ? 'single' : 'multiple'}
      assetFilter={assetTarget ? (asset) => Boolean(toCanvasAsset(asset, assetTarget.nodeType)) : undefined}
      includeSeedanceLibrary
    />
    <ProfileModal open={profileOpen} currentUser={currentUser} onClose={() => setProfileOpen(false)} onLogout={handleLogout} onProfileUpdated={(updated) => setCurrentUser((previous) => ({ ...previous, ...updated }))} />
  </div>;
}
