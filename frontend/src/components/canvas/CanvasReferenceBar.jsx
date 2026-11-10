/** 画布参考图栏：公共菜单、文件筛选、点击引用及首尾帧槽；文件生命周期归画布管理。 */
import { useRef, useState } from 'react';
import { getCanvasImagePreview, getCanvasVideoPoster } from './CanvasMediaSources';
import StoryboardMediaPreview from '../storyboard/StoryboardMediaPreview';
import { Plus, FileText } from 'lucide-react';
import { ReferenceRemoveButton, Tooltip } from '../ui';
import CreationUploadMenu from '../creation/CreationUploadMenu';
import { getCanvasMediaAccept, getCanvasMediaFileType } from './CanvasLocalMedia';
import CanvasNodeIcon from './CanvasNodeIcon';

export default function CanvasReferenceBar({ nodeType = 'image', references = [], mode, collapsed = false, insertableIds = [], onInsert, onAdd, onRemove }) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(null);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const frame = mode === 'frame' || mode === 'start_end' || mode === 'first_frame';
  const frameSlots = mode === 'first_frame' ? [0] : [0, 1];
  const isFrameImage = (reference) => frameSlots.includes(reference.slot) && reference.asset?.asset_type === 'image';
  const full = frame && frameSlots.every((slot) => references.some((reference) => reference.slot === slot && isFrameImage(reference)));
  const slots = frame ? frameSlots.map((slot) => references.find((reference) => reference.slot === slot && isFrameImage(reference)) || { slot }) : references;
  const inactive = frame ? references.filter((reference) => !isFrameImage(reference)) : [];
  return <div className={`canvas-reference-bar nodrag nopan nowheel${collapsed ? ' canvas-reference-bar--collapsed' : ''}`} onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
    {nodeType !== 'text' && <div className={`canvas-reference-bar__menu${collapsed ? ' canvas-reference-bar__menu--collapsed' : ''}`}>
      <button type="button" className="canvas-reference-bar__slot" aria-label="添加参考素材" title="添加参考素材" aria-haspopup="menu" aria-expanded={open}
        onClick={() => setOpen(!open)}><Plus size={14} /></button>
      {open && <CreationUploadMenu onClose={() => setOpen(false)}
        onLocalUpload={() => inputRef.current?.click()}
        onAssetPick={() => onAdd?.('library', mode)} />}
    </div>}
    {[...slots, ...inactive].map((reference) => {
      const textReference = reference.type === 'text';
      const label = textReference ? '参考文本' : frame ? reference.id && !isFrameImage(reference) ? '未参与' : reference.slot === 0 ? '首帧' : '尾帧' : '参考素材';
      const canInsert = Boolean(onInsert && insertableIds.includes(reference.id));
      return <Tooltip key={reference.id || `empty-${reference.slot}`} label={reference.id ? reference.label || label : label} placement="top"><div className={'canvas-reference-bar__item' + (textReference ? ' canvas-reference-bar__item--text' : '')} onMouseEnter={() => setHovered(reference.id)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(reference.id)} onBlur={() => setHovered(null)}>
        <div role={textReference ? 'img' : 'button'} tabIndex={canInsert ? 0 : -1} className={'canvas-reference-bar__slot' + (frame && reference.asset?.asset_type === 'video' ? ' canvas-reference-bar__slot--inactive-video' : '')}
          aria-label={'引用' + (reference.label || reference.asset?.name || label)} aria-disabled={!canInsert}
          onKeyDown={event => { if (event.target === event.currentTarget && canInsert && ['Enter', ' '].includes(event.key)) { event.preventDefault(); onInsert(reference.id); } }}
          onClick={() => { if (canInsert) onInsert(reference.id); }}>
          {textReference && <FileText size={20} aria-label="参考文本" />}
          {reference.asset && (reference.asset.asset_type === 'audio' ? <CanvasNodeIcon nodeType="audio" size={20} />
            : <StoryboardMediaPreview media={{ ...reference.asset, media_type: reference.asset.asset_type, media_preview_url: reference.asset.asset_type === 'video' ? getCanvasVideoPoster(reference.asset) : getCanvasImagePreview(reference.asset) }} />)}
          {frame && !textReference && <span className="canvas-reference-bar__label">{label}</span>}
        </div>
        {reference.id && !reference.isCurrentNode && <ReferenceRemoveButton visible={hovered === reference.id} ariaLabel={`移除${label}`} onClick={() => onRemove?.(reference.id)} />}
      </div></Tooltip>;
    })}
    <input ref={inputRef} type="file" multiple hidden accept={getCanvasMediaAccept(nodeType === 'video' ? 'all' : 'image')} onChange={(event) => {
      const files = Array.from(event.target.files || []);
      event.target.value = '';
      if (!files.length) return;
      if (files.some((file) => !getCanvasMediaFileType(file, nodeType))) { setError(nodeType === 'video' ? '请选择有效的图片、视频或音频文件' : '请选择有效的图片文件'); return; }
      if (full && files.some((file) => getCanvasMediaFileType(file, nodeType) === 'image')) { setError('首尾帧已填满，请先移除需要替换的图片'); return; }
      setError('');
      onAdd?.('local', mode, files);
    }} />
    {error && <span role="alert" className="canvas-node__upload-error">{error}</span>}
  </div>;
}
