/** 画布参考图栏：公共菜单、文件筛选及首尾帧槽；文件生命周期归画布管理。 */
import { useRef, useState } from 'react';
import { Plus, Music2 } from 'lucide-react';
import { ReferenceRemoveButton } from '../ui';
import CreationUploadMenu from '../creation/CreationUploadMenu';
import { getCanvasMediaAccept, getCanvasMediaFileType } from './CanvasLocalMedia';

export default function CanvasReferenceBar({ nodeType = 'image', references = [], mode, collapsed = false, onAdd, onRemove }) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(null);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const frame = mode === 'frame';
  const isFrameImage = (reference) => reference.slot < 2 && reference.asset?.asset_type === 'image';
  const full = frame && [0, 1].every((slot) => references.some((reference) => reference.slot === slot && isFrameImage(reference)));
  const slots = frame ? [0, 1].map((slot) => references.find((reference) => reference.slot === slot && isFrameImage(reference)) || { slot }) : references;
  const inactive = frame ? references.filter((reference) => !isFrameImage(reference)) : [];
  return <div className={`canvas-reference-bar nodrag nopan nowheel${collapsed ? ' canvas-reference-bar--collapsed' : ''}`} onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
    <div className={`canvas-reference-bar__menu${collapsed ? ' canvas-reference-bar__menu--collapsed' : ''}`}>
      <button type="button" className="canvas-reference-bar__slot" aria-label="添加参考素材" title="添加参考素材" aria-haspopup="menu" aria-expanded={open}
        onClick={() => setOpen(!open)}><Plus size={14} /></button>
      {open && <CreationUploadMenu onClose={() => setOpen(false)}
        onLocalUpload={() => inputRef.current?.click()}
        onAssetPick={() => onAdd?.('library', mode)} />}
    </div>
    {[...slots, ...inactive].map((reference) => {
      const label = frame ? reference.id && !isFrameImage(reference) ? '未参与' : reference.slot === 0 ? '首帧' : '尾帧' : '参考素材';
      return <div key={reference.id || `empty-${reference.slot}`} className="canvas-reference-bar__item" onMouseEnter={() => setHovered(reference.id)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(reference.id)} onBlur={() => setHovered(null)} tabIndex={reference.id ? 0 : undefined}>
        <div className="canvas-reference-bar__slot" title={reference.asset?.name || label}>
          {reference.asset && (reference.asset.asset_type === 'audio' ? <Music2 size={20} aria-label="参考音频" />
            : reference.asset.asset_type === 'video' ? <video src={reference.asset.url} poster={reference.asset.posterUrl} muted preload="metadata" playsInline aria-label="参考视频" />
              : <img src={reference.asset.url} alt={label} draggable={false} />)}
          {frame && <span className="canvas-reference-bar__label">{label}</span>}
        </div>
        {reference.id && !reference.isCurrentNode && <ReferenceRemoveButton visible={hovered === reference.id} ariaLabel={`移除${label}`} onClick={() => onRemove?.(reference.id)} />}
      </div>;
    })}
    <input ref={inputRef} type="file" hidden accept={getCanvasMediaAccept(nodeType === 'video' ? 'all' : 'image')} onChange={(event) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      const type = getCanvasMediaFileType(file, nodeType);
      if (!type) { setError(nodeType === 'video' ? '请选择有效的图片、视频或音频文件' : '请选择有效的图片文件'); return; }
      if (full && type === 'image') { setError('首尾帧已填满，请先移除需要替换的图片'); return; }
      setError('');
      onAdd?.('local', mode, file);
    }} />
    {error && <span role="alert" className="canvas-node__upload-error">{error}</span>}
  </div>;
}
