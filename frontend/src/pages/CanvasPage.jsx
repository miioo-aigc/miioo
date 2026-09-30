/**
 * @file CanvasPage.jsx
 * @structure-index
 *
 * ─── 页面编排 ─────────────────────────────────────────────────────
 *   CanvasPage L93；grouping L120；referenceGraph L130；handleNodesChange L174；addNode L236；connection flow L283–433；反向上游连接 L296–400；React Flow viewport L496–537
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
 *   2026-09-29：连接端口拆分为贴边真实锚点与 44px 独立命中层；只高亮当前悬停的合法目标卡片。
 *   2026-09-28：接入捏合、框选、修饰键多选和真正组合；组合交互与几何计算独立维护。
 *   2026-09-28：接入20步历史及5任务并发；拖动和删除按事务记录，发送取消延迟选中。
 *   2026-09-29：触控板双指捏合缩放，双指自由方向滚动画布；输入区域继续隔离画布滚动。
 *   2026-09-29：图片参考按模型 max_reference_images 能力允许图片连线；未声明能力或达到上限时拒绝并提示。
 *   2026-09-30：左侧端口支持反向拖拽，为当前节点添加上游节点；复用统一连接校验和新增节点菜单。
 *   2026-09-30：反向连线预览改用画布容器坐标，补充指针取消、失焦、Esc 和鼠标左键生命周期清理。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { applyNodeChanges, Background, PanOnScrollMode, ReactFlow } from '@xyflow/react';
import CanvasMiniMap from '../components/canvas/CanvasMiniMap';
import { X } from 'lucide-react';
import { showGlobalToast } from '../stores/toastStore';
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
import { useCanvasImageGeneration } from '../components/canvas/UseCanvasImageGeneration';
import { useCanvasVideoGeneration } from '../components/canvas/UseCanvasVideoGeneration';
import { validateCanvasVideoReferenceAddition } from '../components/canvas/CanvasVideoGeneration';
import { useCanvasHistory } from '../components/canvas/UseCanvasHistory';
import { fitCanvasGroups, setCanvasSelection } from '../components/canvas/CanvasGroups';
import { CanvasNodeAddMenu, CANVAS_NODE_MENU_ITEMS, canvasNodeTypes, createCanvasNode, appendCanvasNode, getCanvasNodeMenuPosition, updateSelectedNode } from '../components/canvas';
import CanvasConnectionEdge from '../components/canvas/CanvasConnectionEdge';

// 浏览器 click 先于 dblclick 触发；保留极短窗口，避免双击时先展开创作框。
const CANVAS_SINGLE_CLICK_DELAY = 200;
const CANVAS_EDGE_TYPES = { canvasConnection: CanvasConnectionEdge };
const CANVAS_DOWNSTREAM_TYPES = {
  text: ['text', 'image', 'video', 'audio'],
  image: ['image', 'video'],
  video: ['video'],
  audio: ['video', 'audio'],
};

function getCanvasUpstreamTypes(targetType) {
  return Object.entries(CANVAS_DOWNSTREAM_TYPES)
    .filter(([, targetTypes]) => targetTypes.includes(targetType))
    .map(([sourceType]) => sourceType);
}

function getLeftPortCenter(nodeId, containerRect) {
  const nodeElement = [...document.querySelectorAll('.react-flow__node[data-id]')]
    .find((element) => element.getAttribute('data-id') === nodeId);
  const port = nodeElement?.querySelector('.canvas-node__port-anchor');
  if (!port) return null;
  const rect = port.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2 - (containerRect?.left || 0),
    y: rect.top + rect.height / 2 - (containerRect?.top || 0),
  };
}

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
  const [connectingNodeId, setConnectingNodeId] = useState(null);
  const [connectingHandleType, setConnectingHandleType] = useState('');
  const [connectionTargetId, setConnectionTargetId] = useState(null);
  const [pendingConnection, setPendingConnection] = useState(null);
  const [upstreamConnection, setUpstreamConnection] = useState(null);
  const canvasContainerRef = useRef(null);
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
  const generateImage = useCanvasImageGeneration(nodes, setNodes, cancelPendingClicks);
  const generateVideo = useCanvasVideoGeneration(nodes, setNodes, cancelPendingClicks);
  const enterNodeRef = useRef(grouping.enterNode);
  useEffect(() => { enterNodeRef.current = grouping.enterNode; }, [grouping.enterNode]);
  const openReferencePicker = useCallback((target) => {
    setAssetTarget(target);
    setAssetPickerOpen(true);
  }, []);
  const referenceGraph = useCanvasReferences(grouping.nodes, setNodes, openReferencePicker);

  const clearPendingConnection = useCallback(() => {
    setPendingConnection(null);
    setConnectingNodeId(null);
    setConnectingHandleType('');
    setConnectionTargetId(null);
    setNodeMenu(null);
    setUpstreamConnection(null);
  }, []);

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
  const handleImageReferenceLimitChange = useCallback((nodeId, imageReferenceLimit) => {
    setNodes((current) => {
      const target = current.find((item) => item.id === nodeId);
      if (!target || target.data.imageReferenceLimit === imageReferenceLimit) return current;
      return current.map((item) => item.id === nodeId
        ? { ...item, data: { ...item.data, imageReferenceLimit } }
        : item);
    });
  }, [setNodes]);
  const handleVideoCapabilitiesChange = useCallback((nodeId, capabilities) => {
    setNodes((current) => current.map((item) => item.id === nodeId
      ? { ...item, data: { ...item.data, videoCapabilities: capabilities } }
      : item));
  }, [setNodes]);
  const handleGenerationModeChange = useCallback((nodeId, generationMode) => {
    setNodes((current) => current.map((item) => item.id === nodeId
      ? { ...item, data: { ...item.data, generationMode } }
      : item));
  }, [setNodes]);
  const addNode = useCallback((type, position, connection = null) => {
    const node = createCanvasNode(type, position || { x: 160 + (nodes.length % 3) * 280, y: 160 + Math.floor(nodes.length / 3) * 300 });
    node.data.onPromptChange = (nodeId, prompt, promptSnapshot) => setNodes((current) => current.map((item) => item.id === nodeId ? { ...item, data: { ...item.data, prompt, promptSnapshot } } : item));
    node.data.onModelChange = (nodeId, model) => setNodes((current) => current.map((item) => item.id === nodeId ? { ...item, data: { ...item.data, model } } : item));
    node.data.onImageReferenceLimitChange = handleImageReferenceLimitChange;
    node.data.onVideoCapabilitiesChange = handleVideoCapabilitiesChange;
    node.data.onGenerationModeChange = handleGenerationModeChange;
    node.data.onContentChange = (nodeId, content) => setNodes((current) => current.map((item) => item.id === nodeId ? { ...item, data: { ...item.data, content } } : item));
    node.data.onCancelPendingClick = cancelPendingNodeClick;
    node.data.onEnterEditing = (nodeId) => {
      cancelPendingNodeClick(nodeId);
      enterNodeRef.current(nodeId);
    };
    node.data.onGenerate = (payload) => {
      if (type === 'text') return generateText(payload);
      if (type === 'image') return generateImage(payload);
      if (type === 'video') return generateVideo(payload);
      return handleUnsupported();
    };
    node.data.onAssetChange = (nodeId, asset) => setNodes((current) => applyCanvasAsset(current, nodeId, asset));
    node.data.onSelectAsset = (nodeId, nodeType) => {
      setAssetTarget({ nodeId, nodeType });
      setAssetPickerOpen(true);
    };
    setNodes((current) => {
      const next = appendCanvasNode(current, node);
      if (!connection) return next;
      if (connection.direction === 'upstream') {
        return referenceGraph.connectNodes(next, {
          source: node.id,
          sourceHandle: `${node.type}-output`,
          target: connection.currentNodeId,
          targetHandle: connection.targetHandle,
        });
      }
      return referenceGraph.connectNodes(next, { ...connection, target: node.id });
    });
    setNodeMenu(null);
    setPendingConnection(null);
  }, [cancelPendingNodeClick, generateImage, generateText, generateVideo, handleGenerationModeChange, handleImageReferenceLimitChange, handleUnsupported, handleVideoCapabilitiesChange, nodes.length, referenceGraph, setNodes]);
  const handlePaneDoubleClick = useCallback((event) => {
    if (!flowInstance || !event.target.classList.contains('react-flow__pane')) return;
    event.preventDefault();
    window.getSelection()?.removeAllRanges();
    const screen = getCanvasNodeMenuPosition(event, { width: window.innerWidth, height: window.innerHeight });
    setNodeMenu({ screen, flowPosition: flowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY }) });
  }, [flowInstance]);
  const getConnectionTarget = useCallback((event) => {
    if (!event || typeof event.clientX !== 'number' || typeof event.clientY !== 'number') return null;
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const nodeElement = element?.closest?.('.react-flow__node[data-id]');
    return nodeElement?.getAttribute('data-id') || null;
  }, []);
  const handleConnectStart = useCallback((_, { nodeId, handleType }) => {
    setNodeMenu(null);
    setPendingConnection(null);
    setConnectingNodeId(nodeId);
    setConnectingHandleType(handleType || '');
    setConnectionTargetId(null);
  }, []);
  const handleUpstreamConnectStart = useCallback((nodeId, event) => {
    if (activeTool === 'hand' || event.button !== 0) return;
    cancelPendingClicks();
    setNodeMenu(null);
    setPendingConnection(null);
    setConnectingNodeId(null);
    setConnectingHandleType('');
    setConnectionTargetId(null);
    const rect = canvasContainerRef.current?.getBoundingClientRect();
    setUpstreamConnection({ nodeId, pointerId: event.pointerId,
      pointer: { x: event.clientX, y: event.clientY },
      start: getLeftPortCenter(nodeId, rect),
      end: { x: event.clientX - (rect?.left || 0), y: event.clientY - (rect?.top || 0) },
    });
  }, [activeTool, cancelPendingClicks]);
  const resolveConnectionTarget = useCallback((event) => {
    const targetId = getConnectionTarget(event);
    const source = connectingNodeId && grouping.nodes.find((node) => node.id === connectingNodeId);
    const target = grouping.nodes.find((node) => node.id === targetId);
    if (!source || !target || target.id === source.id || connectingHandleType !== 'source') return null;
    const connection = { source: source.id, sourceHandle: `${source.type}-output`, target: target.id, targetHandle: target.data?.ports?.input?.id };
    return referenceGraph.isValidConnection(connection) ? target.id : null;
  }, [connectingHandleType, connectingNodeId, getConnectionTarget, grouping.nodes, referenceGraph]);
  useEffect(() => {
    if (!connectingNodeId) return undefined;
    const handlePointerMove = (event) => setConnectionTargetId(resolveConnectionTarget(event));
    window.addEventListener('pointermove', handlePointerMove);
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, [connectingNodeId, resolveConnectionTarget]);
  const resolveUpstreamTarget = useCallback((event, currentNodeId) => {
    const targetId = getConnectionTarget(event);
    const currentNode = grouping.nodes.find((node) => node.id === currentNodeId);
    const sourceNode = grouping.nodes.find((node) => node.id === targetId);
    if (!currentNode || !sourceNode || sourceNode.id === currentNode.id) return null;
    const connection = {
      source: sourceNode.id,
      sourceHandle: `${sourceNode.type}-output`,
      target: currentNode.id,
      targetHandle: currentNode.data?.ports?.input?.id,
    };
    return referenceGraph.isValidConnection(connection) ? sourceNode.id : null;
  }, [getConnectionTarget, grouping.nodes, referenceGraph]);
  const finishUpstreamConnection = useCallback((event) => {
    if (!upstreamConnection) return;
    const currentNode = grouping.nodes.find((node) => node.id === upstreamConnection.nodeId);
    const hoveredId = getConnectionTarget(event);
    const sourceNode = grouping.nodes.find((node) => node.id === resolveUpstreamTarget(event, upstreamConnection.nodeId));
    if (currentNode && sourceNode) {
      const connection = {
        source: sourceNode.id,
        sourceHandle: `${sourceNode.type}-output`,
        target: currentNode.id,
        targetHandle: currentNode.data?.ports?.input?.id,
      };
      if (referenceGraph.isValidConnection(connection)) referenceGraph.onConnect(connection);
      clearPendingConnection();
      return;
    }
    if (!currentNode || hoveredId || !event.target?.closest?.('.react-flow')) {
      clearPendingConnection();
      return;
    }
    const clientX = event?.clientX ?? upstreamConnection.pointer.x;
    const clientY = event?.clientY ?? upstreamConnection.pointer.y;
    setPendingConnection({
      direction: 'upstream',
      currentNodeId: currentNode.id,
      targetHandle: currentNode.data?.ports?.input?.id,
      screen: getCanvasNodeMenuPosition({ clientX, clientY }, { width: window.innerWidth, height: window.innerHeight }),
      flowPosition: flowInstance?.screenToFlowPosition({ x: clientX, y: clientY }) || { x: 0, y: 0 },
    });
    setUpstreamConnection(null);
    setConnectionTargetId(null);
  }, [clearPendingConnection, flowInstance, getConnectionTarget, grouping.nodes, referenceGraph, resolveUpstreamTarget, upstreamConnection]);
  useEffect(() => {
    if (!upstreamConnection) return undefined;
    const handlePointerMove = (event) => {
      if (event.pointerId !== upstreamConnection.pointerId) return;
      const rect = canvasContainerRef.current?.getBoundingClientRect();
      const start = getLeftPortCenter(upstreamConnection.nodeId, rect);
      setUpstreamConnection((current) => current ? { ...current, start,
        pointer: { x: event.clientX, y: event.clientY },
        end: { x: event.clientX - (rect?.left || 0), y: event.clientY - (rect?.top || 0) },
      } : current);
      setConnectionTargetId(resolveUpstreamTarget(event, upstreamConnection.nodeId));
    };
    const handlePointerUp = (event) => {
      if (event.pointerId === upstreamConnection.pointerId) finishUpstreamConnection(event);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') clearPendingConnection();
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', clearPendingConnection);
    window.addEventListener('blur', clearPendingConnection);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', clearPendingConnection);
      window.removeEventListener('blur', clearPendingConnection);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [clearPendingConnection, finishUpstreamConnection, resolveUpstreamTarget, upstreamConnection]);
  const handleConnectEnd = useCallback((event, connectionState) => {
    const source = typeof connectionState?.from === 'string' ? connectionState.from : connectionState?.fromNode?.id || connectingNodeId;
    const sourceNode = grouping.nodes.find((node) => node.id === source);
    const sourceHandle = connectionState?.fromHandle?.id || (connectingHandleType === 'source' ? `${sourceNode?.type || 'text'}-output` : '');
    const targetFromState = typeof connectionState?.to === 'string' ? connectionState.to : connectionState?.to?.id || connectionState?.toNode?.id;
    const targetId = targetFromState || getConnectionTarget(event);
    const target = grouping.nodes.find((node) => node.id === targetId);
    const connection = { source, sourceHandle, target: target?.id, targetHandle: target?.data?.ports?.input?.id };
    if (source && target && target.id !== source && referenceGraph.isValidConnection(connection)) {
      if (!connectionState?.isValid) referenceGraph.onConnect(connection);
      clearPendingConnection();
      return;
    }
    if (!source || connectingHandleType !== 'source' || target) {
      if (source && target && sourceNode?.type === 'image' && target.type === 'image') {
        showGlobalToast(target.data?.imageReferenceLimit > 0
          ? `当前图片模型最多支持 ${target.data.imageReferenceLimit} 张参考图，无法继续连接`
          : '当前图片模型不支持图片参考，无法连接图片节点', 'error');
      }
      clearPendingConnection();
      return;
    }
    const clientX = event?.clientX ?? connectionState?.pointer?.x ?? 0;
    const clientY = event?.clientY ?? connectionState?.pointer?.y ?? 0;
    setPendingConnection({
      source,
      sourceHandle,
      screen: getCanvasNodeMenuPosition({ clientX, clientY }, { width: window.innerWidth, height: window.innerHeight }),
      flowPosition: flowInstance?.screenToFlowPosition({ x: clientX, y: clientY }) || { x: 0, y: 0 },
    });
    setConnectingNodeId(null);
    setConnectingHandleType('');
  }, [clearPendingConnection, connectingHandleType, connectingNodeId, flowInstance, getConnectionTarget, grouping.nodes, referenceGraph]);
  const pendingSource = pendingConnection?.direction === 'upstream'
    ? grouping.nodes.find((node) => node.id === pendingConnection.currentNodeId)
    : pendingConnection && grouping.nodes.find((node) => node.id === pendingConnection.source);
  const pendingMenuItems = pendingSource
    ? CANVAS_NODE_MENU_ITEMS.filter((item) => (pendingConnection.direction === 'upstream'
      ? getCanvasUpstreamTypes(pendingSource.type).includes(item.value)
      : CANVAS_DOWNSTREAM_TYPES[pendingSource.type]?.includes(item.value)))
    : [];
  useEffect(() => {
    if (!pendingConnection) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') clearPendingConnection();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearPendingConnection, pendingConnection]);
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
  // React Flow 会给可拖动节点自动添加 nopan；触控板滚动需要临时放行卡片事件，输入区域仍由 nowheel 保持隔离。
  const handleCanvasWheelCapture = useCallback((event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest('.nowheel')) return;
    const nodeElement = target.closest('.react-flow__node');
    if (!nodeElement?.classList.contains('nopan')) return;
    nodeElement.classList.remove('nopan');
    window.requestAnimationFrame(() => {
      if (nodeElement.isConnected) nodeElement.classList.add('nopan');
    });
  }, []);
  const projectName = canvas?.project_name || canvas?.projectName || '自由画布项目';

  return <div className="relative h-screen w-screen overflow-hidden bg-surface-base text-text-primary [font-synthesis:none] antialiased">
    <CanvasProjectHeader canvasName={projectName} onBackHome={onBackHome} />
    <CanvasUserMenu currentUser={currentUser} onLogout={handleLogout} onOpenProfile={() => setProfileOpen(true)} />
    <div ref={canvasContainerRef} className="absolute inset-0 bg-surface-toolbar">
      <ReactFlow defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        onWheelCapture={handleCanvasWheelCapture}
        nodes={referenceGraph.nodes.map((node) => ({ ...node, data: { ...node.data, connectionTarget: node.id === connectionTargetId, connectingType: node.id === connectingNodeId ? connectingHandleType : (node.id === upstreamConnection?.nodeId ? 'target' : ''), onUpstreamConnectStart: handleUpstreamConnectStart, onImageReferenceLimitChange: handleImageReferenceLimitChange, onVideoCapabilitiesChange: handleVideoCapabilitiesChange, onGenerationModeChange: handleGenerationModeChange, ...(node.type === 'text' ? { onGenerate: generateText,
          onContentChange: (nodeId, content) => setNodes((current) => current.map((item) => item.id === nodeId ? { ...item, data: { ...item.data, content } } : item)),
          onPromptChange: (nodeId, prompt, promptSnapshot) => setNodes((current) => current.map((item) => item.id === nodeId ? { ...item, data: { ...item.data, prompt, promptSnapshot } } : item)),
          onModelChange: (nodeId, model) => setNodes((current) => current.map((item) => item.id === nodeId ? { ...item, data: { ...item.data, model } } : item)),
          onCancelPendingClick: cancelPendingNodeClick, onEnterEditing: grouping.enterNode } : node.type === 'image' ? { onGenerate: generateImage } : node.type === 'video' ? { onGenerate: generateVideo } : {}) } }))} edges={referenceGraph.edges} edgeTypes={CANVAS_EDGE_TYPES} onEdgesChange={referenceGraph.onEdgesChange}
        nodesConnectable={activeTool !== 'hand'} onConnect={referenceGraph.onConnect} isValidConnection={referenceGraph.isValidConnection} nodeTypes={canvasNodeTypes} onInit={setFlowInstance}
        onNodesChange={handleNodesChange} onNodeClick={handleNodeClick}
        onConnectStart={handleConnectStart}
        onConnectEnd={handleConnectEnd}
        onBeforeDelete={async ({ nodes: removedNodes, edges: removedEdges }) => { cancelPendingClicks(); if (removedNodes.length || removedEdges.length) history.begin(); return true; }}
        onDelete={() => history.end()}
        onNodeDoubleClick={(event, node) => {
          if (activeTool !== 'hand' && node.type !== 'canvasGroup' && !event.target.closest('button, input, textarea')) grouping.enterNode(node.id);
        }}
        onNodeDragStart={handleNodeDragStart} onNodeDrag={handleNodeDrag} onNodeDragStop={handleNodeDragStop}
        onDoubleClick={handlePaneDoubleClick} zoomOnDoubleClick={false} zoomOnPinch={true}
        panOnScroll={true} panOnScrollMode={PanOnScrollMode.Free} panOnScrollSpeed={0.5}
        nodesDraggable={activeTool !== 'hand'}
        onPaneClick={() => {
          cancelPendingClicks();
          if (pendingConnection) { clearPendingConnection(); return; }
          setNodeMenu(null);
          setNodes((current) => setCanvasSelection(current, []));
        }}
        panOnDrag={activeTool === 'hand'} selectionOnDrag={activeTool === 'select'}
        multiSelectionKeyCode={['Meta', 'Control', 'Shift']} selectionKeyCode={null}
        onSelectionStart={() => { cancelPendingClicks(); setNodeMenu(null); setNodes((current) => setCanvasSelection(current, current.filter((node) => node.selected).map((node) => node.id))); }}
        proOptions={{ hideAttribution: true }} className="bg-surface-toolbar">
        {/* 固定圆点的屏幕半径，间距和位置仍由 React Flow 随视口变化。 */}
        <Background variant="dots" gap={16} size={1} patternClassName="[r:0.5px]" color="rgba(255,255,255,0.16)" />
        {showMiniMap && <CanvasMiniMap />}
      </ReactFlow>
      {upstreamConnection && <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full" aria-hidden="true"><line x1={upstreamConnection.start?.x ?? upstreamConnection.end.x} y1={upstreamConnection.start?.y ?? upstreamConnection.end.y} x2={upstreamConnection.end.x} y2={upstreamConnection.end.y} stroke="var(--color-brand-main)" strokeWidth="2" /></svg>}
      {(nodeMenu || pendingConnection) && <div className="pointer-events-none absolute inset-0 z-30"><div className="pointer-events-auto absolute" style={{ left: (pendingConnection || nodeMenu).screen.left, top: (pendingConnection || nodeMenu).screen.top }}><CanvasNodeAddMenu items={pendingConnection ? pendingMenuItems : CANVAS_NODE_MENU_ITEMS} onAddNode={(type) => pendingConnection
        ? addNode(type, pendingConnection.flowPosition, pendingConnection)
        : addNode(type, nodeMenu.flowPosition)} /></div></div>}
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
        if (assetTarget?.purpose === 'reference') setNodes((current) => {
          const target = current.find((node) => node.id === assetTarget.nodeId);
          const asset = toCanvasAsset(assets[0], target?.type);
          const validation = target?.type === 'video'
            ? validateCanvasVideoReferenceAddition(current, assetTarget.nodeId, asset)
            : { allowed: true };
          if (!validation.allowed) { showGlobalToast('warning', validation.message); return current; }
          return addCanvasReference(current, assetTarget.nodeId, assets[0], assetTarget.mode);
        });
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
