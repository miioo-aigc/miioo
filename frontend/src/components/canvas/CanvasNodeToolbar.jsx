/** 节点激活后的内容操作栏。具体动作由节点业务组件传入。 */
import { Copy, Download, Pencil, Ellipsis } from 'lucide-react';
import { IconButton, Tooltip } from '../ui';
import ImageEditIcon from '../image-edit/ImageEditIcon';
import VideoEditIcon from '../video-edit/VideoEditIcon';

const VIDEO_ACTIONS = ['智能超清', '去字幕', '选帧', '剪辑'].map((label) => ({ key: label, label }));

const IMAGE_ACTIONS = ['裁剪', '翻转', '多机位', '局部重绘', '智能超清', '消除笔', '扩图']
  .map((label) => ({ key: label, label }));

const ACTIONS = [
  { key: 'edit', label: '编辑内容', Icon: Pencil },
  { key: 'copy', label: '复制内容', Icon: Copy },
  { key: 'download', label: '下载内容', Icon: Download },
];

export default function CanvasNodeToolbar({ nodeType, content, asset, onAction, onMore }) {
  const enabled = ['text', 'image', 'video', 'audio'].includes(nodeType);
  const hasContent = nodeType === 'image' ? Boolean(asset?.url) : nodeType === 'text' ? Boolean(content?.trim()) : Boolean(asset?.url);
  const mediaActions = nodeType === 'image' ? IMAGE_ACTIONS : nodeType === 'video' ? VIDEO_ACTIONS : [];
  const actions = nodeType === 'text' ? ACTIONS : [...mediaActions, { key: 'download', label: '下载', Icon: Download }];
  const isDisabled = (key) => !enabled || (key !== 'edit' && !hasContent) || (nodeType === 'video' && key !== 'download' && asset?.asset_type !== 'video');
  return <div className="canvas-node__toolbar nodrag nopan" role="toolbar" aria-label="节点内容工具栏" onClick={(event) => event.stopPropagation()}>
    {actions.map(({ key, label, Icon }) => <Tooltip key={key} label={label} placement="top">
      <span><IconButton aria-label={label} variant="link" className="canvas-node__toolbar-button" contentClassName="canvas-node__toolbar-icon" disabled={isDisabled(key)} onClick={() => onAction?.(key)}>{Icon ? <Icon size={16} strokeWidth={1.5} className="shrink-0" /> : nodeType === 'video' ? <VideoEditIcon label={label} /> : <ImageEditIcon label={label} />}</IconButton></span>
    </Tooltip>)}
    {enabled && <Tooltip label="更多" placement="top"><span>
      <IconButton aria-label="更多" aria-haspopup="menu" variant="link" className="canvas-node__toolbar-button" contentClassName="canvas-node__toolbar-icon" onClick={(event) => onMore?.(event.currentTarget.getBoundingClientRect())}>
        <Ellipsis size={16} strokeWidth={1.5} className="shrink-0" />
      </IconButton>
    </span></Tooltip>}
  </div>;
}
