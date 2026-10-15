/**
 * @file CanvasProjectHeader.jsx
 * @structure-index
 *
 * ─── 展示层 ─────────────────────────────────────────────────────
 *   CanvasProjectHeader 画布左上角品牌、项目名称和项目入口 L18
 *   2026-10-10 新建项目接收显式回调；未提供时保留原暂不支持行为。名称和菜单样式不变。
 *   2026-10-14 项目菜单图标线宽1.7，继承按钮颜色，默认80%、悬停100%、按下60%白色；菜单文字与项目名称左边缘对齐。
 *   2026-10-15 项目菜单按内容自适应宽度，图标与项目名称左对齐；新建使用方框加号，返回使用指定图标，颜色跟随文字。
 */

import { useEffect, useRef, useState } from 'react';
import HomeLogo from '../home/HomeLogo';
import { DropdownMenu } from '../ui';
import { ChevronDown, Copy, FileInput, Trash2 } from 'lucide-react';
import { normalizeProjectName, PROJECT_NAME_MAX_LENGTH, validateProjectName } from './CanvasProjectName';

export default function CanvasProjectHeader({ canvasName, onBackHome, onBackProjects, onRename, onImport, onUnsupported, onCreateProject }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(canvasName || '未命名项目');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const savingRef = useRef(false);
  const composingRef = useRef(false);
  const originalName = canvasName || '未命名项目';

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startEditing = () => {
    if (savingRef.current) return;
    setMenuOpen(false);
    setDraftName(originalName);
    setError('');
    setEditing(true);
  };

  const cancelEditing = () => {
    if (savingRef.current) return;
    setDraftName(originalName);
    setError('');
    setEditing(false);
  };

  const saveName = async () => {
    if (savingRef.current || composingRef.current) return;
    const nextName = draftName.trim();
    const validationError = validateProjectName(nextName);
    if (validationError) {
      setError(validationError);
      inputRef.current?.focus();
      return;
    }
    if (nextName === originalName) {
      setEditing(false);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      await onRename(nextName);
      setDraftName(nextName);
      setEditing(false);
    } catch (renameError) {
      setDraftName(originalName);
      setError(renameError?.message || '保存项目名称失败，请重试');
      inputRef.current?.focus();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleChange = (event) => {
    setDraftName(composingRef.current ? event.target.value : normalizeProjectName(event.target.value));
    if (error) setError('');
  };

  return (
    <div className="absolute left-0 top-0 z-20 flex h-[60px] items-end gap-[16px] bg-surface-toolbar px-[24px] py-[18px] antialiased">
      <HomeLogo clickable onClick={onBackHome} />
      <div className="h-[16px] w-px shrink-0 bg-stroke-accent" />
      <div className="relative flex items-center gap-[6px]">
        {editing ? (
          <div className="relative flex flex-col items-start">
            <div className="flex items-center gap-[6px]">
              <input
                ref={inputRef}
                value={draftName}
                maxLength={PROJECT_NAME_MAX_LENGTH}
                readOnly={saving}
                onChange={handleChange}
                onCompositionStart={() => { composingRef.current = true; }}
                onCompositionEnd={(event) => {
                  composingRef.current = false;
                  setDraftName(normalizeProjectName(event.currentTarget.value));
                }}
                onBlur={saveName}
                onKeyDown={(event) => {
                  if (composingRef.current || event.nativeEvent.isComposing || event.keyCode === 229) return;
                  if (event.key === 'Enter') { event.preventDefault(); saveName(); }
                  if (event.key === 'Escape') { event.preventDefault(); cancelEditing(); }
                }}
                aria-label="项目名称"
                aria-busy={saving}
                className="h-[22px] w-[220px] border-0 border-b border-stroke-accent bg-transparent p-0 text-[14px] leading-[18px] text-text-primary outline-none"
              />
              {saving && <span className="text-[12px] text-text-hint">保存中</span>}
            </div>
            {error && <span role="alert" className="absolute top-[26px] whitespace-nowrap text-[12px] text-text-danger">{error}</span>}
          </div>
        ) : (
          <button type="button" onClick={onRename ? startEditing : undefined} title={onRename ? '编辑项目名称' : '项目名称暂待后端接入'} disabled={!onRename} className={`flex items-center border-0 bg-transparent p-0 text-left ${onRename ? 'cursor-pointer' : 'cursor-default'}`}>
            <span className="max-w-[220px] truncate text-[14px] leading-[18px] text-text-primary">{originalName}</span>
          </button>
        )}
        <div className="flex items-center">
          <button type="button" aria-label="项目菜单" aria-haspopup="menu" aria-expanded={menuOpen} onMouseDown={(event) => event.stopPropagation()} onClick={() => setMenuOpen((open) => !open)} className="flex size-[18px] cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-white-80 hover:text-text-primary active:text-text-secondary">
            <ChevronDown size={16} strokeWidth={1.7} />
          </button>
        </div>
        {menuOpen && <DropdownMenu width="max-content" className="whitespace-nowrap" onClose={() => setMenuOpen(false)} style={{ top: 'calc(100% + 8px)', bottom: 'auto', left: '-16px', right: 'auto', marginBottom: 0 }} items={[
          { key: 'new', label: '新建项目', icon: (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeLinejoin="round" aria-hidden="true">
              <path d="M13 2H3C2.44772 2 2 2.44772 2 3V13C2 13.5523 2.44772 14 3 14H13C13.5523 14 14 13.5523 14 13V3C14 2.44772 13.5523 2 13 2Z" />
              <path d="M8 5.33337V10.6667" strokeLinecap="round" />
              <path d="M5.33337 8H10.6667" strokeLinecap="round" />
            </svg>
          ), onClick: onCreateProject || onUnsupported },
          { key: 'copy', label: '复制项目', icon: <Copy size={16} strokeWidth={1.7} aria-hidden="true" />, onClick: onUnsupported },
          { key: 'import', label: '导入画布文件', icon: <FileInput size={16} strokeWidth={1.7} aria-hidden="true" />, onClick: onImport },
          { key: 'back', label: '返回全部项目', icon: (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4.33327 2.66663L2 4.66663L4.33327 6.99996" />
              <path d="M2 4.66663H9.6646C11.9589 4.66663 13.9074 6.54009 13.9968 8.83329C14.0913 11.2565 12.089 13.3333 9.6646 13.3333H3.99947" />
            </svg>
          ), onClick: onBackProjects },
          { key: 'delete', label: '删除项目', icon: <Trash2 size={16} strokeWidth={1.7} aria-hidden="true" />, danger: true, onClick: onUnsupported },
        ]} />}
      </div>
    </div>
  );
}
