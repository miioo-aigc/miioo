/**
 * @file CanvasPage.jsx
 * @structure-index
 *
 * ─── 页面编排 ─────────────────────────────────────────────────────
 *   CanvasPage L127；grouping L168；referenceGraph L182；mediaPreview L149；文档加载 L195；handleNodesChange L250；addNode L313；工具栏新增 L358；批量导入 L370；React Flow L724
 *
 * ─── 页面区块 ────────────────────────────────────────────────────
 *   CanvasProjectHeader components/canvas；2026-10-10 接通开发态新建项目回调；模拟详情跳过用户接口，重命名仍为会话内。删除接入撤销，仅运行/排队任务确认。
 *   CanvasUserMenu      components/canvas；右上角用户信息与菜单
 *   CanvasCenterPrompt  components/canvas；中央空态提示
 *   CanvasToolbar       components/canvas；底部画布工具栏；2026-10-10 文本节点更多入口复用右键菜单，仅选当前卡片。
 *   CanvasMediaPreview  components/canvas；2026-10-10 图片/视频双击打开悬浮预览，视频接续进度；固定关闭按钮与模糊遮罩。
 *   CanvasMiniMap       components/canvas；双层背景的交互预览地图
 *
 * ─── 业务边界 ─── 2026-10-15：堆叠拖动坐标转换回展开布局坐标，双击点作为堆叠中心。
 *   2026-10-14：UseCanvasList 接通同项目列表、新增、切换与重命名；切换先保存，失败保留当前画布。
 *   2026-10-10：图片、视频、音频共用工具栏；CanvasVideoEditor 复用四项编辑弹窗，后台结果新增对应媒体节点并保留源节点。
 *   2026-10-09：名称双击原地重命名接入历史，右键与快捷键弹窗保留；组合双击切换、展开平滑聚焦。
 *   节点与连线支持文档读取；本地上传完成后尝试保存，完整持久化流程仍待验收。
 *   2026-10-13：初始化仅依赖画布编号与稳定 setNodes，避免 history 包装对象变化导致重复加载；不调整上传流程。
 *   2026-10-08：音频文本按连线顺序追加；音频任务独立编排，请求前建立结果节点及直连素材关系。
 *   2026-09-28：UseCanvasReferences 编排参考图及文本到音频连线，连接时单次导入正文。
 *   2026-09-24：空白面板使用标准双击事件打开菜单，关闭默认双击缩放。
 *   2026-10-14：工具栏新增在内容最右侧放置，空画布居中；保持缩放并平滑聚焦。其他创建入口位置不变。
 *   2026-09-24：节点模型选择保存为本地草稿；文本模型加载由节点外壳负责。
 *   2026-09-28：视频卡片及参考入口支持三类媒体，按真实素材类型回填；其他节点仍按类型筛选。
 *   2026-10-12：视频节点上传混合素材时，视频填充当前节点，图片/音频及多余视频创建为上游输入节点。
 *   2026-09-28：新增节点按当前同类型最大序号加1，编号由画布工具统一处理。
 *   2026-09-29：连接端口拆分为贴边真实锚点与 44px 独立命中层；只高亮当前悬停的合法目标卡片。
 *   2026-09-28：接入捏合、框选、修饰键多选和真正组合；组合交互与几何计算独立维护。
 *   2026-09-28：接入20步历史及5任务并发；拖动和删除按事务记录，发送取消延迟选中。
 *   2026-09-29：触控板双指捏合缩放，双指自由方向滚动画布；输入区域继续隔离画布滚动。
 *   2026-09-29：图片参考按模型 max_reference_images 能力允许图片连线；未声明能力或达到上限时拒绝并提示。
 *   2026-09-30：左侧端口支持反向拖拽，为当前节点添加上游节点；复用统一连接校验和新增节点菜单。
 *   2026-09-30：反向连线预览改用画布容器坐标，补充指针取消、失焦、Esc 和鼠标左键生命周期清理。
 *   2026-10-08：移除空画布中央四个操作按钮，保留空态提示与底部工具栏。
 *   2026-10-08：连线拖拽目标区分可连接与不可连接状态，分别反馈蓝色和红色描边。
 *   2026-10-08：左侧拖拽优先添加上游，不合法时校验反向输出；手动接线与拖线新建统一触发一次流光。
 *   2026-10-08：工具栏资产批量导入当前视口并合并历史；V/H 工具切换隔离编辑和弹窗。
 *   2026-10-09：资产与本地文件多选，填充首项并创建其余节点；参考批量校验，整批撤销。
 *   2026-10-09：工具栏批量导入整块避让并聚焦，批量操作保留原输入框状态；媒体预读尺寸，按实际卡片边界排列及聚焦。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getCanvasAssetNodeSize, prepareCanvasMediaAsset } from '../components/canvas/CanvasMediaSize';
import { applyNodeChanges, Background, PanOnScrollMode, ReactFlow } from '@xyflow/react';
import CanvasMiniMap from '../components/canvas/CanvasMiniMap';
import { X } from 'lucide-react';
import { showGlobalToast } from '../stores/toastStore';
import '@xyflow/react/dist/style.css';
import { apiGetCanvasDocument, apiUpdateCanvasDocument } from '../api/canvas';
import { uploadCanvasAsset } from '../api/canvasAssets';
import { isDevelopmentCanvas } from '../api/CanvasDevelopment';
import { apiGetCurrentUser } from '../api/user';
import { apiLogout, clearTokens } from '../api/auth';
import CanvasCenterPrompt from '../components/canvas/CanvasCenterPrompt';
import CanvasProjectHeader from '../components/canvas/CanvasProjectHeader';
import CanvasFileInput from '../components/canvas/CanvasFileInput';
import { useCanvasFileActions } from '../components/canvas/UseCanvasFileActions';
import CanvasToolbar from '../components/canvas/CanvasToolbar';
import CanvasSearchModal from '../components/canvas/CanvasSearchModal';
import { useCanvasSearch } from '../components/canvas/UseCanvasSearch';
import CanvasUserMenu from '../components/canvas/CanvasUserMenu';
import AssetPickerModal from '../components/AssetPickerModal';
import ProfileModal from '../components/ProfileModal';
import { applyCanvasAsset, planCanvasAssetImport, toCanvasAsset } from '../components/canvas/CanvasAssets';
import { getCanvasToolShortcut } from '../components/canvas/CanvasToolShortcuts';
import { addCanvasReference, getCanvasReferenceNodePosition } from '../components/canvas/CanvasReferences';
import { planCanvasReferenceBatch } from '../components/canvas/CanvasReferenceBatch';
import { getCanvasImportBounds, getCanvasToolbarNodePosition, preserveCanvasImportPanels } from '../components/canvas/CanvasImportLayout';
import { getCanvasMediaFileType } from '../components/canvas/CanvasLocalMedia';
import { useCanvasReferences } from '../components/canvas/UseCanvasReferences';
import { useCanvasGrouping } from '../components/canvas/UseCanvasGrouping';
import { useCanvasTextGeneration } from '../components/canvas/UseCanvasTextGeneration';
import { useCanvasImageGeneration } from '../components/canvas/UseCanvasImageGeneration';
import { useCanvasVideoGeneration } from '../components/canvas/UseCanvasVideoGeneration';
import { useCanvasHistory } from '../components/canvas/UseCanvasHistory';
import { fitCanvasGroups, setCanvasSelection } from '../components/canvas/CanvasGroups';
import { CanvasNodeAddMenu, CANVAS_NODE_MENU_ITEMS, canvasNodeTypes, createCanvasNode, appendCanvasNode, getCanvasNodeMenuPosition, updateSelectedNode } from '../components/canvas';
import CanvasConnectionEdge from '../components/canvas/CanvasConnectionEdge';
import { useCanvasAudioGeneration } from '../components/canvas/UseCanvasAudioGeneration';
import { resolveCanvasLeftConnection } from '../components/canvas/CanvasLeftConnection';
import { useCanvasNodeActions } from '../components/canvas/UseCanvasNodeActions';
import { getCanvasStackPresentation, restoreCanvasStackPositionChange } from '../components/canvas/CanvasNodeActions';
import CanvasNodeActionOverlays from '../components/canvas/CanvasNodeActionOverlays';
import CanvasMediaPreview from '../components/canvas/CanvasMediaPreview';
import LocalImageEditor from '../components/image-edit/LocalImageEditor';
import { useCanvasImageEdits } from '../components/canvas/UseCanvasImageEdits';
import { useCanvasVideoEdits } from '../components/canvas/UseCanvasVideoEdits';
import CanvasVideoEditor from '../components/canvas/CanvasVideoEditor';
import { readCanvasDocument, serializeCanvasDocument } from '../components/canvas/CanvasDocument';
import { useCanvasList } from '../components/canvas/UseCanvasList';

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

export default function CanvasPage({ canvasId, onBackHome, onBackProjects, onCreateProject, onSelectCanvas }) {
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
  const [viewportZoom, setViewportZoom] = useState(1);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [canvasRevision, setCanvasRevision] = useState(null);
  const [connectingNodeId, setConnectingNodeId] = useState(null);
  const [connectingHandleType, setConnectingHandleType] = useState('');
  const [connectionTargetId, setConnectionTargetId] = useState(null);
  const [connectionTargetStatus, setConnectionTargetStatus] = useState('');
  const [pendingConnection, setPendingConnection] = useState(null);
  const [upstreamConnection, setUpstreamConnection] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [actionDialog, setActionDialog] = useState(null);
  const canvasContainerRef = useRef(null);
  const importAssetsRef = useRef(null);
  const uploadFilesRef = useRef(null);
  const dragPositionsRef = useRef(new Map());
  const pendingNodeClicksRef = useRef(new Map());
  const cancelPendingClicks = useCallback(() => {
    pendingNodeClicksRef.current.forEach((timer) => window.clearTimeout(timer));
    pendingNodeClicksRef.current.clear();
  }, []);
  const [searchOpen, setSearchOpen] = useState(false);
  const history = useCanvasHistory(cancelPendingClicks, !assetPickerOpen && !profileOpen && !actionDialog && !searchOpen);
  const { nodes, setNodes } = history;
  const imageEdits = useCanvasImageEdits({ nodes, setNodes, canvasId, cancelPendingClicks });
  const videoEdits = useCanvasVideoEdits({ nodes, setNodes, canvasId, cancelPendingClicks });
  const projectName = canvas?.project_name || canvas?.projectName || '自由画布项目';
  const canvasFiles = useCanvasFileActions({ nodes, setNodes, name: projectName, flowInstance, canvasId });
  const search = useCanvasSearch({ nodes, setNodes, flowInstance, containerRef: canvasContainerRef, cancelPendingClicks, open: searchOpen, setOpen: setSearchOpen });
  const grouping = useCanvasGrouping(nodes, setNodes, cancelPendingClicks, false);
  const nodeActions = useCanvasNodeActions({ nodes, setNodes, undo: history.undo, getUndoToken: history.getUndoToken, cancelPendingClicks, flowInstance,
    containerRef: canvasContainerRef, enabled: loadedCanvasId === canvasId && !error && !assetPickerOpen && !profileOpen && !searchOpen,
    dialog: actionDialog, setDialog: setActionDialog });
  const generateText = useCanvasTextGeneration(nodes, setNodes, canvasId, cancelPendingClicks);
  const generateImage = useCanvasImageGeneration(nodes, setNodes, cancelPendingClicks);
  const generateVideo = useCanvasVideoGeneration(nodes, setNodes, cancelPendingClicks);
  const generateAudio = useCanvasAudioGeneration(nodes, setNodes, cancelPendingClicks);
  const enterNodeRef = useRef(grouping.enterNode);
  useEffect(() => { enterNodeRef.current = grouping.enterNode; }, [grouping.enterNode]);
  const openReferencePicker = useCallback((target) => {
    setAssetTarget(target);
    setAssetPickerOpen(true);
  }, []);
  const referenceGraph = useCanvasReferences(grouping.nodes, setNodes, openReferencePicker);
  const presentation = getCanvasStackPresentation(referenceGraph.nodes, referenceGraph.edges);

  const clearPendingConnection = useCallback(() => {
    setPendingConnection(null);
    setConnectingNodeId(null);
    setConnectingHandleType('');
    setConnectionTargetId(null);
    setConnectionTargetStatus('');
    setNodeMenu(null);
    setUpstreamConnection(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([apiGetCanvasDocument(canvasId), isDevelopmentCanvas(canvasId) ? Promise.resolve({}) : apiGetCurrentUser()]).then(([documentResult, userResult]) => {
      if (cancelled) return;
      if (documentResult.status === 'rejected') {
        setError(documentResult.reason?.message || '画布加载失败，请返回重试');
      } else {
        setError('');
        setCanvas(documentResult.value);
        const document = readCanvasDocument(documentResult.value);
        setNodes(document.nodes, { record: false });
        setViewport(document.viewport);
        setViewportZoom(document.viewport.zoom || 1);
        setCanvasRevision(documentResult.value?.revision || null);
      }
      if (userResult.status === 'fulfilled') setCurrentUser(userResult.value || {});
      setLoadedCanvasId(canvasId);
    });
    return () => { cancelled = true; };
  }, [canvasId, setNodes]);

  useEffect(() => () => {
    pendingNodeClicksRef.current.forEach((timer) => window.clearTimeout(timer));
    pendingNodeClicksRef.current.clear();
  }, []);

  const notifyUnsupported = useCallback(() => { setNotice(true); window.setTimeout(() => setNotice(false), 2400); }, []);
  const loading = loadedCanvasId !== canvasId;
  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f'
        && !event.altKey && !event.shiftKey
        && !event.target.closest?.('input, textarea, select, [contenteditable="true"]')) {
        event.preventDefault();
        search.show();
        return;
      }
      const tool = getCanvasToolShortcut(event, !loading && !error && !assetPickerOpen && !profileOpen && !actionDialog && !searchOpen);
      if (!tool) return;
      event.preventDefault();
      setActiveTool(tool);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [loading, error, assetPickerOpen, profileOpen, actionDialog, searchOpen, search]);
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
      const persistedChanges = changes.filter((change) => !(change.type === 'dimensions' && current.find((node) => node.id === change.id)?.data.stacked));
      let next = applyNodeChanges(persistedChanges.map((change) => restoreCanvasStackPositionChange(change, current)), current);
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
  const addNode = useCallback((type, position, connection = null, asset = null) => {
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
      if (type === 'audio') return generateAudio(payload);
      return handleUnsupported();
    };
    node.data.onAssetChange = (nodeId, asset) => {
      const assets = Array.isArray(asset) ? asset : [asset];
      const files = assets.map((item) => item.file).filter(Boolean);
      return files.length ? uploadFilesRef.current?.(files, { nodeId }) : importAssetsRef.current?.(assets, { nodeId });
    };
    node.data.onSelectAsset = (nodeId, nodeType) => {
      setAssetTarget({ nodeId, nodeType });
      setAssetPickerOpen(true);
    };
    if (!connection) setNodes((current) => {
      const next = appendCanvasNode(current, node);
      return asset ? applyCanvasAsset(next, node.id, asset) : next;
    });
    else {
      const resolvedConnection = connection.direction === 'upstream' ? {
          source: node.id,
          sourceHandle: `${node.type}-output`,
          target: connection.currentNodeId,
          targetHandle: connection.targetHandle,
        } : { ...connection, target: node.id };
      referenceGraph.onConnect(resolvedConnection, node);
    }
    setNodeMenu(null);
    setPendingConnection(null);
  }, [cancelPendingNodeClick, generateAudio, generateImage, generateText, generateVideo, handleGenerationModeChange, handleImageReferenceLimitChange, handleUnsupported, handleVideoCapabilitiesChange, nodes.length, referenceGraph, setNodes]);
  const handleToolbarAddNode = useCallback((type) => {
    if (loading || error || !flowInstance || !canvasContainerRef.current) return;
    const rect = canvasContainerRef.current.getBoundingClientRect();
    const center = flowInstance.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    const visibleNodes = getCanvasStackPresentation(history.getSnapshot().nodes, []).nodes;
    const size = getCanvasAssetNodeSize(null);
    const position = getCanvasToolbarNodePosition(visibleNodes, center, size);
    cancelPendingClicks();
    addNode(type, position);
    flowInstance.setCenter(position.x + size.width / 2, position.y + size.height / 2,
      { zoom: flowInstance.getZoom(), duration: 300 });
  }, [addNode, cancelPendingClicks, error, flowInstance, history, loading]);
  const importAssets = useCallback(async (assets, target = null) => {
    assets = await Promise.all(assets.map((asset) => prepareCanvasMediaAsset(toCanvasAsset(asset, 'video') || asset)));
    if (!canvasContainerRef.current) return false;
    const current = history.getSnapshot().nodes;
    if (target?.purpose === 'reference') {
      const result = planCanvasReferenceBatch(current, target.nodeId, assets, target.mode);
      if (!result.allowed) { showGlobalToast('warning', result.message); return false; }
      cancelPendingClicks();
      setNodes(result.nodes);
      return true;
    }
    const anchor = current.find((node) => node.id === target?.nodeId);
    if (target && !anchor) return false;
    const valid = assets.map((asset) => toCanvasAsset(asset, anchor?.type || 'video')).filter(Boolean);
    if (!valid.length) return false;
    const rect = canvasContainerRef.current?.getBoundingClientRect();
    if (!anchor && (!flowInstance || !rect)) return false;
    cancelPendingClicks();
    history.begin();
    let importBounds = null;
    try {
      if (anchor) {
        if (anchor.type === 'video') {
          const videoAsset = valid.find((asset) => asset.asset_type === 'video');
          const upstreamAssets = valid.filter((asset) => asset !== videoAsset);
          let next = videoAsset ? applyCanvasAsset(current, anchor.id, videoAsset) : current;
          // 上传流程先保留完整的素材关系；视频能力限制在生成时统一校验，避免能力异步加载期间误拒绝上传。
          upstreamAssets.forEach((asset) => { next = addCanvasReference(next, anchor.id, asset, 'all'); });
          setNodes(next);
        } else {
          setNodes((items) => applyCanvasAsset(items, anchor.id, valid[0]));
          valid.slice(1).forEach((asset) => {
            const position = getCanvasReferenceNodePosition(history.getSnapshot().nodes, anchor, getCanvasAssetNodeSize(asset));
            addNode(asset.asset_type, position, null, asset);
          });
        }
      } else {
        const center = flowInstance.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
        const imports = planCanvasAssetImport(valid, center, current);
        imports.forEach(({ type, position, asset }) => addNode(type, position, null, asset));
        if (valid.length > 1) importBounds = getCanvasImportBounds(imports.map((item) => ({ ...item.position, ...getCanvasAssetNodeSize(item.asset) })));
      }
      if (valid.length > 1) setNodes((items) => preserveCanvasImportPanels(current, items));
    } finally { history.end(); }
    if (importBounds) {
      const zoom = Math.max(0.01, Math.min(1, (rect.width - 96) / importBounds.width, (rect.height - 160) / importBounds.height));
      flowInstance.setCenter(importBounds.x + importBounds.width / 2, importBounds.y + importBounds.height / 2, { zoom, duration: 300 });
    }
    if (valid.length < assets.length) showGlobalToast('warning', '部分资产缺少可用媒体地址，已跳过');
    return true;
  }, [history, setNodes, cancelPendingClicks, addNode, flowInstance]);
  useEffect(() => { importAssetsRef.current = importAssets; }, [importAssets]);
  const persistCanvas = useCallback(async () => {
    if (!canvasId || !Number.isInteger(canvasRevision)) return false;
    const snapshot = history.getSnapshot();
    if (snapshot.nodes.some((node) => node.data?.generating || node.data?.generationPending)) return false;
    if (snapshot.nodes.some((node) => {
      const asset = node.data?.asset;
      return asset && (!asset.asset_id || asset.uploadStatus === 'uploading' || asset.uploadStatus === 'error');
    })) return false;
    const result = await apiUpdateCanvasDocument(canvasId, {
      baseRevision: canvasRevision,
      document: serializeCanvasDocument(snapshot.nodes, referenceGraph.edges, viewport),
      clientSavedAt: new Date().toISOString(),
    });
    if (Number.isInteger(result?.revision)) setCanvasRevision(result.revision);
    return true;
  }, [canvasId, canvasRevision, history, referenceGraph.edges, viewport]);
  const canvasList = useCanvasList({ canvas, persistCanvas, onSelectCanvas,
    onRenamed: (title, revision) => { setCanvas((current) => ({ ...current, title })); setCanvasRevision(revision); } });
  const uploadFiles = useCallback(async (files, target = null) => {
    const validFiles = files.filter((file) => getCanvasMediaFileType(file, 'all'));
    if (!validFiles.length) {
      showGlobalToast('warning', '请选择有效的图片、视频或音频文件');
      return;
    }
    if (validFiles.length !== files.length) showGlobalToast('warning', '已跳过不支持的文件');
    const assets = validFiles.map((file) => ({
      name: file.name,
      asset_type: getCanvasMediaFileType(file, 'all'),
      url: URL.createObjectURL(file),
      previewUrl: null,
      source: 'local-upload',
      uploadStatus: 'uploading',
      uploadError: null,
      file,
    }));
    const imported = await importAssets(assets, target);
    if (!imported) {
      assets.forEach((asset) => URL.revokeObjectURL(asset.url));
      return;
    }
    const importedNodes = history.getSnapshot().nodes.filter((node) => assets.some((asset) => node.data?.asset?.url === asset.url));
    await Promise.all(assets.map(async (asset) => {
      const node = importedNodes.find((item) => item.data?.asset?.url === asset.url);
      if (!node) return;
      try {
        const uploaded = await uploadCanvasAsset(asset.file, asset.asset_type, { projectId: canvas?.project_id, });
        setNodes((current) => current.map((item) => item.id === node.id
          ? { ...item, data: { ...item.data, asset: { ...item.data.asset, ...uploaded, file: undefined } } }
          : item));
      } catch (uploadError) {
        setNodes((current) => current.map((item) => item.id === node.id
          ? { ...item, data: { ...item.data, asset: { ...item.data.asset, uploadStatus: 'error', uploadError: uploadError.message } } }
          : item));
        showGlobalToast('error', `${asset.name} 上传失败：${uploadError.message}`);
      } finally {
        URL.revokeObjectURL(asset.url);
      }
    }));
    try {
      await persistCanvas();
    } catch (saveError) {
      showGlobalToast('error', `素材已上传，但画布保存失败：${saveError.message}`);
    }
  }, [canvas, history, importAssets, persistCanvas, setNodes]);
  useEffect(() => { uploadFilesRef.current = uploadFiles; }, [uploadFiles]);
  const handleCanvasDrop = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    const files = [...(event.dataTransfer?.files || [])];
    if (files.length) uploadFiles(files);
  }, [uploadFiles]);
  const handleCanvasDragOver = useCallback((event) => {
    if (event.dataTransfer?.types?.includes('Files')) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    }
  }, []);
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
    setConnectionTargetStatus('');
  }, []);
  const handleUpstreamConnectStart = useCallback((nodeId, event) => {
    if (activeTool === 'hand' || event.button !== 0) return;
    cancelPendingClicks();
    setNodeMenu(null);
    setPendingConnection(null);
    setConnectingNodeId(null);
    setConnectingHandleType('');
    setConnectionTargetId(null);
    setConnectionTargetStatus('');
    const rect = canvasContainerRef.current?.getBoundingClientRect();
    setUpstreamConnection({ nodeId, pointerId: event.pointerId,
      pointer: { x: event.clientX, y: event.clientY },
      start: getLeftPortCenter(nodeId, rect),
      end: { x: event.clientX - (rect?.left || 0), y: event.clientY - (rect?.top || 0) },
    });
  }, [activeTool, cancelPendingClicks]);
  useEffect(() => {
    if (!connectingNodeId) return undefined;
    const handlePointerMove = (event) => {
      const targetId = getConnectionTarget(event);
      const source = grouping.nodes.find((node) => node.id === connectingNodeId);
      const target = grouping.nodes.find((node) => node.id === targetId);
      if (!source || !target || target.id === source.id || connectingHandleType !== 'source') {
        setConnectionTargetId(null);
        setConnectionTargetStatus('');
        return;
      }
      const connection = { source: source.id, sourceHandle: `${source.type}-output`, target: target.id, targetHandle: target.data?.ports?.input?.id };
      setConnectionTargetId(target.id);
      setConnectionTargetStatus(referenceGraph.isValidConnection(connection) ? 'valid' : 'invalid');
    };
    window.addEventListener('pointermove', handlePointerMove);
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, [connectingHandleType, connectingNodeId, getConnectionTarget, grouping.nodes, referenceGraph]);
  const resolveUpstreamTarget = useCallback((event, currentNodeId) => {
    const targetId = getConnectionTarget(event);
    const currentNode = grouping.nodes.find((node) => node.id === currentNodeId);
    const sourceNode = grouping.nodes.find((node) => node.id === targetId);
    return resolveCanvasLeftConnection(currentNode, sourceNode, referenceGraph.isValidConnection);
  }, [getConnectionTarget, grouping.nodes, referenceGraph]);
  const finishUpstreamConnection = useCallback((event) => {
    if (!upstreamConnection) return;
    const currentNode = grouping.nodes.find((node) => node.id === upstreamConnection.nodeId);
    const hoveredId = getConnectionTarget(event);
    const connection = resolveUpstreamTarget(event, upstreamConnection.nodeId);
    if (connection) {
      referenceGraph.onConnect(connection);
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
      const connection = resolveUpstreamTarget(event, upstreamConnection.nodeId);
      const hoveredId = getConnectionTarget(event);
      const targetId = hoveredId === upstreamConnection.nodeId ? null : hoveredId;
      setConnectionTargetId(targetId || null);
      setConnectionTargetStatus(targetId ? (connection ? 'valid' : 'invalid') : '');
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
  }, [clearPendingConnection, finishUpstreamConnection, getConnectionTarget, resolveUpstreamTarget, upstreamConnection]);
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
    setConnectionTargetId(null);
    setConnectionTargetStatus('');
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

  return <div className="relative h-screen w-screen overflow-hidden bg-surface-base text-text-primary [font-synthesis:none] antialiased">
    {imageEdits.editor && <LocalImageEditor key={`${imageEdits.editor.card.imageUrl}:${imageEdits.editor.mode}`} {...imageEdits.editor} onClose={imageEdits.close} />}
    {videoEdits.editor && <CanvasVideoEditor key={`${videoEdits.editor.videoUrl}:${videoEdits.editor.mode}`} editor={videoEdits.editor} onClose={videoEdits.close} />}
    <CanvasFileInput inputRef={canvasFiles.inputRef} onChange={canvasFiles.importFile} />
    <CanvasProjectHeader canvasName={projectName} onBackHome={onBackHome} onBackProjects={onBackProjects} onCreateProject={onCreateProject} onImport={canvasFiles.open} onUnsupported={handleUnsupported} onRename={(name) => setCanvas((current) => ({ ...current, project_name: name }))} />
    <CanvasUserMenu currentUser={currentUser} onLogout={handleLogout} onOpenProfile={() => setProfileOpen(true)} />
    <div ref={canvasContainerRef} className="absolute inset-0 bg-surface-toolbar">
      <ReactFlow viewport={viewport} minZoom={0.01}
        onDragOver={handleCanvasDragOver} onDrop={handleCanvasDrop}
        onWheelCapture={handleCanvasWheelCapture}
        onMove={(_, nextViewport) => { setViewport(nextViewport); setViewportZoom(nextViewport.zoom); }}
        nodes={presentation.nodes.map((node) => ({ ...node, data: { ...node.data, viewportZoom, onRenameStart: cancelPendingClicks, onRename: (label) => setNodes((current) => current.map((item) => item.id === node.id ? { ...item, data: { ...item.data, label } } : item)), connectionTarget: node.id === connectionTargetId, connectionTargetStatus: node.id === connectionTargetId ? connectionTargetStatus : '', connectingType: node.id === connectingNodeId ? connectingHandleType : (node.id === upstreamConnection?.nodeId ? 'target' : ''), onUpstreamConnectStart: handleUpstreamConnectStart, onImageReferenceLimitChange: handleImageReferenceLimitChange, onVideoCapabilitiesChange: handleVideoCapabilitiesChange, onGenerationModeChange: handleGenerationModeChange, ...(node.type === 'text' ? { onGenerate: generateText,
          onMore: (rect) => { clearPendingConnection(); nodeActions.onMore(node.id, rect); },
          onContentChange: (nodeId, content) => setNodes((current) => current.map((item) => item.id === nodeId ? { ...item, data: { ...item.data, content } } : item)),
          onPromptChange: (nodeId, prompt, promptSnapshot) => setNodes((current) => current.map((item) => item.id === nodeId ? { ...item, data: { ...item.data, prompt, promptSnapshot } } : item)),
          onModelChange: (nodeId, model) => setNodes((current) => current.map((item) => item.id === nodeId ? { ...item, data: { ...item.data, model } } : item)),
          onCancelPendingClick: cancelPendingNodeClick, onEnterEditing: grouping.enterNode } : node.type === 'image' ? { onGenerate: generateImage, onImageEdit: imageEdits.open, onMore: (rect) => { clearPendingConnection(); nodeActions.onMore(node.id, rect); }, onPreview: (asset) => setMediaPreview({ asset, nodeType: node.type }) } : node.type === 'video' ? { onGenerate: generateVideo, onVideoEdit: videoEdits.open, onMore: (rect) => { clearPendingConnection(); nodeActions.onMore(node.id, rect); }, onPreview: (asset) => setMediaPreview({ asset, nodeType: node.type }) } : node.type === 'audio' ? { onGenerate: generateAudio, onMore: (rect) => { clearPendingConnection(); nodeActions.onMore(node.id, rect); } } : {}) } }))} edges={presentation.edges} edgeTypes={CANVAS_EDGE_TYPES} onEdgesChange={referenceGraph.onEdgesChange}
        deleteKeyCode={null}
        onNodeContextMenu={(event, node) => { clearPendingConnection(); nodeActions.onContextMenu(event, node); }}
        onSelectionContextMenu={(event, selectedNodes) => { if (selectedNodes[0]) { clearPendingConnection(); nodeActions.onContextMenu(event, selectedNodes[0]); } }}
        onMoveStart={nodeActions.closeMenu}
        nodesConnectable={activeTool !== 'hand'} onConnect={referenceGraph.onConnect} isValidConnection={referenceGraph.isValidConnection} nodeTypes={canvasNodeTypes} onInit={setFlowInstance}
        onNodesChange={handleNodesChange} onNodeClick={handleNodeClick}
        onConnectStart={handleConnectStart}
        onConnectEnd={handleConnectEnd}
        onBeforeDelete={async ({ nodes: removedNodes, edges: removedEdges }) => { cancelPendingClicks(); if (removedNodes.length || removedEdges.length) history.begin(); return true; }}
        onDelete={() => history.end()}
        onNodeDoubleClick={(event, node) => {
          if (node.type === 'canvasGroup') { nodeActions.onGroupDoubleClick(event, node); return; }
          if (activeTool !== 'hand' && ['image', 'video'].includes(node.type) && node.data.asset?.url
            && node.data.asset.asset_type !== 'audio' && event.target.closest('.canvas-node__frame')
            && !event.target.closest('button, input, textarea, .canvas-node__port')) {
            event.stopPropagation();
            cancelPendingClicks();
            const video = event.target.closest('.canvas-node__frame').querySelector('video');
            const playback = video ? { time: video.currentTime, muted: video.muted, volume: video.volume } : null;
            video?.pause();
            setMediaPreview({ asset: node.data.asset, nodeType: node.type, playback });
            return;
          }
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
    {!loading && !error && canvas && nodes.length === 0 && <main className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-[16px] pb-[20px]"><CanvasCenterPrompt /></main>}
    {notice && <UnsupportedAction onClose={() => setNotice(false)} />}
    <CanvasToolbar
      activeTool={activeTool}
      onToolChange={setActiveTool}
      showMiniMap={showMiniMap}
      onMiniMapChange={setShowMiniMap}
      onOpenSearch={() => { nodeActions.closeMenu(); setNodeMenu(null); search.show(); }}
      onAddNode={handleToolbarAddNode}
      canvases={canvasList.items}
      activeCanvasId={canvasId}
      canvasListBusy={canvasList.busy || loading || !!error}
      onSelectCanvas={canvasList.select}
      onCreateCanvas={canvasList.create}
      onRenameCanvas={canvasList.rename}
      onShare={canvasFiles.share}
      canUndo={history.canUndo}
      canRedo={history.canRedo}
      onUndo={() => { cancelPendingClicks(); history.undo(); }}
      onRedo={() => { cancelPendingClicks(); history.redo(); }}
      onOpenAssetPicker={() => { setAssetTarget(null); setAssetPickerOpen(true); }}
    />
    {search.open && <CanvasSearchModal nodes={nodes} onClose={search.close} onSelect={search.select} />}
    <AssetPickerModal
      open={assetPickerOpen}
      onClose={() => { setAssetPickerOpen(false); setAssetTarget(null); }}
      onConfirm={(assets) => importAssets(assets, assetTarget)}
      validateSelection={assetTarget?.purpose === 'reference' ? (assets) => {
        const result = planCanvasReferenceBatch(history.getSnapshot().nodes, assetTarget.nodeId, assets, assetTarget.mode);
        if (!result.allowed) showGlobalToast('warning', result.message);
        return result.allowed;
      } : undefined}
      accept={assetTarget?.nodeType === 'video' ? 'all' : assetTarget?.nodeType || 'all'}
      selectionMode="multiple"
      assetFilter={assetTarget ? (asset) => Boolean(toCanvasAsset(asset, assetTarget.nodeType)) : undefined}
      includeSeedanceLibrary
    />
    <ProfileModal open={profileOpen} currentUser={currentUser} onClose={() => setProfileOpen(false)} onLogout={handleLogout} onProfileUpdated={(updated) => setCurrentUser((previous) => ({ ...previous, ...updated }))} />
    {mediaPreview && <CanvasMediaPreview asset={mediaPreview.asset} nodeType={mediaPreview.nodeType} playback={mediaPreview.playback} onClose={() => setMediaPreview(null)} />}
    <CanvasNodeActionOverlays menu={nodeActions.menu} dialog={nodeActions.dialog} nodes={nodes}
      canPaste={nodeActions.clipboard.length > 0} onAction={nodeActions.execute} onCloseMenu={nodeActions.closeMenu}
      onCloseDialog={nodeActions.closeDialog} onNameChange={nodeActions.setName} onConfirm={nodeActions.confirm} />
  </div>;
}
