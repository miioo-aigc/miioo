/** 节点激活后的内容操作栏。具体动作由节点业务组件传入。 */
import { Copy, Download, Maximize2, Pencil, ChevronDown } from 'lucide-react';
import CanvasToolbarSurface from './CanvasToolbarSurface';
import CanvasToolbarButton from './CanvasToolbarButton';
import ImageEditIcon from '../image-edit/ImageEditIcon';
import VideoEditIcon from '../video-edit/VideoEditIcon';
const VIDEO_ACTIONS = ['智能超清', '去字幕', '选帧', '剪辑'].map((label) => ({ key: label, label }));
const IMAGE_ACTIONS = ['智能超清', '局部重绘', '消除笔', '扩图'].map((label) => ({ key: label, label }));

const ACTIONS = [
  { key: 'edit', label: '编辑内容', Icon: Pencil },
  { key: 'copy', label: '复制内容', Icon: Copy },
  { key: 'download', label: '下载内容', Icon: Download },
];

export default function CanvasNodeToolbar({ nodeType, content, asset, onAction, onMore, moreOpen = false, onPreview }) {
  const enabled = ['text', 'image', 'video', 'audio'].includes(nodeType);
  const hasContent = nodeType === 'image' ? Boolean(asset?.url) : nodeType === 'text' ? Boolean(content?.trim()) : Boolean(asset?.url);
  const mediaActions = nodeType === 'image' ? IMAGE_ACTIONS : nodeType === 'video' ? VIDEO_ACTIONS : [];
  const actions = nodeType === 'text' ? ACTIONS.filter(({ key }) => key !== 'download') : mediaActions;
  const isDisabled = (key) => !enabled || (key !== 'edit' && !hasContent) || (nodeType === 'video' && key !== 'download' && asset?.asset_type !== 'video');
  return <CanvasToolbarSurface className="canvas-node__toolbar--content" label="节点内容工具栏">
    <div className="canvas-node__toolbar-group" role="group" aria-label="内容操作">
      {actions.map(({ key, label, Icon }) => <CanvasToolbarButton key={key} label={label} showLabel disabled={isDisabled(key)} onClick={() => onAction?.(key)}>
        {Icon ? <Icon size={18} strokeWidth={1.5} className="shrink-0" /> : nodeType === 'video' ? <VideoEditIcon label={label} size={18} /> : <ImageEditIcon label={label} size={18} />}
        <span>{label}</span>
      </CanvasToolbarButton>)}
      <CanvasToolbarButton label="更多" aria-haspopup="menu" aria-expanded={moreOpen} showLabel onMouseDown={(event) => event.stopPropagation()} onClick={(event) => onMore?.(event.currentTarget.getBoundingClientRect())}>
        <span>更多</span>
        <ChevronDown size={16} strokeWidth={1.5} className="shrink-0" style={{ transform: moreOpen ? 'rotate(180deg)' : undefined, transition: 'transform 150ms ease' }} />
      </CanvasToolbarButton>
    </div>
    <span className="canvas-node__toolbar-separator" role="separator" aria-orientation="vertical" />
    <div className="canvas-node__toolbar-group" role="group" aria-label="快捷操作">
      {nodeType === 'image' && ['裁剪', '翻转'].map((label) => <CanvasToolbarButton key={label} label={label} disabled={isDisabled(label)} onClick={() => onAction?.(label)}><ImageEditIcon label={label} size={18} /></CanvasToolbarButton>)}
      <CanvasToolbarButton label={nodeType === 'text' ? '下载内容' : '下载'} disabled={isDisabled('download')} onClick={() => onAction?.('download')}>
        <Download size={18} strokeWidth={1.5} className="shrink-0" />
      </CanvasToolbarButton>
      {['image', 'video'].includes(nodeType) && <CanvasToolbarButton label="查看" disabled={!hasContent} onClick={() => onPreview?.(asset)}><Maximize2 size={18} strokeWidth={1.5} className="shrink-0" /></CanvasToolbarButton>}
    </div>
  </CanvasToolbarSurface>;
}
