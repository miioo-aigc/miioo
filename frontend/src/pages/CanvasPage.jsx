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
 *   本阶段只提供全屏画布外壳；节点编辑、文档保存和生成任务另行接入。
 */

import { useEffect, useState } from 'react';
import { Background, ReactFlow } from '@xyflow/react';
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

  const notifyUnsupported = () => { setNotice(true); window.setTimeout(() => setNotice(false), 2400); };
  const loading = loadedCanvasId !== canvasId;
  const handleLogout = async () => {
    try {
      await apiLogout();
    } finally {
      clearTokens();
      onBackHome();
    }
  };

  const handleUnsupported = () => { setNotice(true); window.setTimeout(() => setNotice(false), 2400); };
  const projectName = canvas?.project_name || canvas?.projectName || '自由画布项目';

  return <div className="relative h-screen w-screen overflow-hidden bg-surface-base text-text-primary [font-synthesis:none] antialiased">
    <CanvasProjectHeader canvasName={projectName} onBackHome={onBackHome} />
    <CanvasUserMenu currentUser={currentUser} onLogout={handleLogout} onOpenProfile={() => setProfileOpen(true)} />
    <div className="absolute inset-0 bg-surface-toolbar">
      <ReactFlow fitView nodes={[]} edges={[]} panOnDrag={activeTool === 'hand'} selectionOnDrag={activeTool !== 'hand'} proOptions={{ hideAttribution: true }} className="bg-surface-toolbar">
        {/* 固定圆点的屏幕半径，间距和位置仍由 React Flow 随视口变化。 */}
        <Background variant="dots" gap={16} size={1} patternClassName="[r:0.5px]" color="rgba(255,255,255,0.16)" />
        {showMiniMap && <CanvasMiniMap />}
      </ReactFlow>
    </div>
    {loading && <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-[14px] text-text-hint">正在加载画布...</div>}
    {!loading && error && <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-[14px] text-text-danger">{error}</div>}
    {!loading && !error && canvas && <main className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-[16px] pb-[20px]"><CanvasCenterPrompt /><CanvasCenterActions onAction={notifyUnsupported} /></main>}
    {notice && <UnsupportedAction onClose={() => setNotice(false)} />}
    <CanvasToolbar
      activeTool={activeTool}
      onToolChange={setActiveTool}
      showMiniMap={showMiniMap}
      onMiniMapChange={setShowMiniMap}
      onAddNode={handleUnsupported}
      onCreateCanvas={handleUnsupported}
      onShare={handleUnsupported}
      onOpenAssetPicker={() => setAssetPickerOpen(true)}
    />
    <AssetPickerModal open={assetPickerOpen} onClose={() => setAssetPickerOpen(false)} onConfirm={() => { setAssetPickerOpen(false); handleUnsupported(); }} accept="all" includeSeedanceLibrary />
    <ProfileModal open={profileOpen} currentUser={currentUser} onClose={() => setProfileOpen(false)} onLogout={handleLogout} onProfileUpdated={(updated) => setCurrentUser((previous) => ({ ...previous, ...updated }))} />
  </div>;
}
