/**
 * @file CanvasProjectHeader.jsx
 * @structure-index
 *   CanvasProjectHeader 左上角返回、双名称编辑和项目内画布管理。
 *   2026-11-04：画布菜单由底部迁至名称右侧，复用现有画布动作与保存保护。
 */
import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { IconButton, Tooltip } from '../ui';
import HomeLogo from '../home/HomeLogo';
import CanvasSaveIndicator from './CanvasSaveIndicator';
import CanvasHeaderName from './CanvasHeaderName';
import CanvasListMenu from './CanvasListMenu';
import { normalizeProjectName, PROJECT_NAME_MAX_LENGTH, validateProjectName } from './CanvasProjectName';
import './CanvasProjectHeader.css';

const normalizeCanvasName = (value) => value.slice(0, 100);
const validateCanvasName = (value) => !value.trim() ? '画布名称不能为空' : value.length > 100 ? '画布名称不能超过100个字符' : '';

export default function CanvasProjectHeader({ saveStatus, projectName, canvasName, onBackHome, onBackProjects, onRename, onImport,
  canvases, activeCanvasId, canvasListBusy, onSelectCanvas, onCreateCanvas, onRenameCanvas, onDuplicateCanvas, onDeleteCanvas }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef(null);
  useEffect(() => {
    const closeOutside = (event) => {
      if (!headerRef.current?.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, []);
  const closeAfter = (action) => async (...args) => {
    if (await action(...args)) setMenuOpen(false);
  };
  return <div ref={headerRef} onKeyDown={(event) => { if (event.key === 'Escape') setMenuOpen(false); }} className="canvas-project-header absolute left-0 right-0 top-0 z-20 flex h-[60px] items-end gap-[16px] px-[24px] py-[18px] antialiased">
    <HomeLogo clickable onClick={onBackHome} />
    <div className="h-[16px] w-px shrink-0 bg-stroke-accent" />
    <div className="flex items-center gap-[8px]">
      <Tooltip label="返回画布项目列表" placement="bottom" offset={8}>
        <IconButton aria-label="返回画布项目列表" variant="link" className="!size-[18px]" onClick={onBackProjects}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="white" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2.00001 8H14" /><path d="M6 4L2 8L6 12" />
          </svg>
        </IconButton>
      </Tooltip>
      <div className="relative flex items-center gap-[6px]">
        <CanvasHeaderName key={'project-' + activeCanvasId} name={projectName || '未命名项目'} label="项目名称" onRename={onRename} onStart={() => setMenuOpen(false)} disabled={canvasListBusy}
          maxLength={PROJECT_NAME_MAX_LENGTH} normalize={normalizeProjectName} validate={validateProjectName} />
        <span className="text-[14px] text-text-hint" aria-hidden="true">/</span>
        <CanvasHeaderName key={activeCanvasId} name={canvasName || '未命名画布'} label="画布名称" onRename={(name) => onRenameCanvas(activeCanvasId, name)} onStart={() => setMenuOpen(false)} disabled={canvasListBusy}
          maxLength={100} normalize={normalizeCanvasName} validate={validateCanvasName} />
        <button type="button" aria-label="画布菜单" aria-haspopup="dialog" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)} className="flex size-[18px] cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-white-80 hover:text-text-primary active:text-text-secondary">
          <ChevronDown size={16} strokeWidth={1.7} />
        </button>
        <CanvasSaveIndicator status={saveStatus} />
        {menuOpen && <CanvasListMenu canvases={canvases} activeCanvasId={activeCanvasId} busy={canvasListBusy} onClose={() => setMenuOpen(false)}
          onSelectCanvas={closeAfter(onSelectCanvas)} onCreateCanvas={closeAfter(onCreateCanvas)} onRenameCanvas={onRenameCanvas}
          onDuplicateCanvas={closeAfter(onDuplicateCanvas)} onDeleteCanvas={onDeleteCanvas} onImport={() => { setMenuOpen(false); onImport(); }} />}
      </div>
    </div>
  </div>;
}
