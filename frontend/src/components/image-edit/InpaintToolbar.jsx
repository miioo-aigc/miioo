import { Brush, Eraser, Move, ZoomOut, ZoomIn, Undo2, Redo2 } from 'lucide-react';
import IconButton from '../ui/IconButton';
import Tooltip from '../ui/Tooltip';

function Tool({ label, icon, ...props }) {
  return (
    <Tooltip label={label} placement="bottom">
      <IconButton aria-label={label} variant="link" className="inpaint-tool" icon={icon} {...props} />
    </Tooltip>
  );
}

export default function InpaintToolbar({ tool, onToolChange, brushSize, onBrushSizeChange, zoom, onZoomChange, canUndo, canRedo, onUndo, onRedo, disabled }) {
  return (
    <div className="inpaint-toolbar" role="toolbar" aria-label="局部重绘工具">
      <div className="inpaint-tool-group">
        <Tool label="笔刷" icon={<Brush size={16} />} aria-pressed={tool === 'brush'} onClick={() => onToolChange('brush')} disabled={disabled} />
        <Tool label="擦除" icon={<Eraser size={16} />} aria-pressed={tool === 'eraser'} onClick={() => onToolChange('eraser')} disabled={disabled} />
        <Tool label="移动图片" icon={<Move size={16} />} aria-pressed={tool === 'move'} onClick={() => onToolChange('move')} disabled={disabled} />
      </div>
      <span className="inpaint-divider" />
      <label className="inpaint-brush-size">
        <span>笔刷尺寸</span>
        <input type="range" aria-label="笔刷尺寸" aria-valuetext={`${brushSize} 像素`} min={4} max={160} value={brushSize} disabled={disabled || tool === 'move'} onChange={(event) => onBrushSizeChange(Number(event.target.value))} style={{ background: `linear-gradient(to right, var(--color-brand-main) ${(brushSize - 4) / 156 * 100}%, var(--color-white-10) 0%)` }} />
      </label>
      <span className="inpaint-divider" />
      <div className="inpaint-tool-group">
        <Tool label="缩小" icon={<ZoomOut size={16} />} onClick={() => onZoomChange(Math.max(25, zoom - 25))} disabled={disabled || zoom <= 25} />
        <output className="inpaint-zoom" aria-label="图片缩放">{zoom}%</output>
        <Tool label="放大" icon={<ZoomIn size={16} />} onClick={() => onZoomChange(Math.min(400, zoom + 25))} disabled={disabled || zoom >= 400} />
      </div>
      <span className="inpaint-divider" />
      <div className="inpaint-tool-group">
        <Tool label="撤销" icon={<Undo2 size={16} />} onClick={onUndo} disabled={disabled || !canUndo} />
        <Tool label="重做" icon={<Redo2 size={16} />} onClick={onRedo} disabled={disabled || !canRedo} />
      </div>
    </div>
  );
}
