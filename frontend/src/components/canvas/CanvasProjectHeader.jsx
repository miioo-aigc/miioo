/**
 * @file CanvasProjectHeader.jsx
 * @structure-index
 *
 * ─── 展示层 ─────────────────────────────────────────────────────
 *   CanvasProjectHeader 画布左上角品牌、项目名称和项目入口 L16
 *   2026-10-09 名称编辑与项目菜单拆分，动作由页面显式回调提供；直接指定箭头图标白色80%
 */

import { useEffect, useRef, useState } from 'react';
import HomeLogo from '../home/HomeLogo';
import { DropdownMenu } from '../ui';
import { ChevronDown } from 'lucide-react';
import { normalizeProjectName, PROJECT_NAME_MAX_LENGTH, validateProjectName } from './CanvasProjectName';

export default function CanvasProjectHeader({ canvasName, onBackHome, onBackProjects, onRename, onImport, onUnsupported }) {
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
      <div className="relative -ml-[10px] flex items-center">
        <button type="button" aria-label="项目菜单" aria-haspopup="menu" aria-expanded={menuOpen} onMouseDown={(event) => event.stopPropagation()} onClick={() => setMenuOpen((open) => !open)} className="flex size-[18px] cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-white-80 hover:text-text-primary">
          <ChevronDown size={16} strokeWidth={1} style={{ color: 'var(--color-white-80)' }} />
        </button>
        {menuOpen && <DropdownMenu width="200px" onClose={() => setMenuOpen(false)} style={{ top: 'calc(100% + 8px)', bottom: 'auto', left: 0, right: 'auto', marginBottom: 0 }} items={[
          { key: 'new', label: '新建项目', onClick: onUnsupported },
          { key: 'copy', label: '复制项目', onClick: onUnsupported },
          { key: 'import', label: '导入画布文件', onClick: onImport },
          { key: 'back', label: '返回全部项目', onClick: onBackProjects },
          { key: 'delete', label: '删除项目', danger: true, onClick: onUnsupported },
        ]} />}
      </div>
    </div>
  );
}
