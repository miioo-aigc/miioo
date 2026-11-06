/** 节点激活后的内容操作栏。具体动作由节点业务组件传入。 */
import { Copy, Download, Eye, Pencil, Ellipsis } from 'lucide-react';
import CanvasToolbarSurface from './CanvasToolbarSurface';
import CanvasToolbarButton from './CanvasToolbarButton';
import ImageEditIcon from '../image-edit/ImageEditIcon';
import VideoEditIcon from '../video-edit/VideoEditIcon';
import { SHOW_MULTI_ANGLE_ENTRIES } from '../../config/MultiAngleEntryVisibility';

const VIDEO_ACTIONS = ['智能超清', '去字幕', '选帧', '剪辑'].map((label) => ({ key: label, label }));

const IMAGE_ACTIONS = ['裁剪', '翻转', '多机位', '局部重绘', '智能超清', '消除笔', '扩图']
  .filter((label) => label !== '多机位' || SHOW_MULTI_ANGLE_ENTRIES)
  .map((label) => ({ key: label, label }));

const ACTIONS = [
  { key: 'edit', label: '编辑内容', Icon: Pencil },
  { key: 'copy', label: '复制内容', Icon: Copy },
  { key: 'download', label: '下载内容', Icon: Download },
];

export default function CanvasNodeToolbar({ nodeType, content, asset, onAction, onMore, onPreview }) {
  const enabled = ['text', 'image', 'video', 'audio'].includes(nodeType);
  const hasContent = nodeType === 'image' ? Boolean(asset?.url) : nodeType === 'text' ? Boolean(content?.trim()) : Boolean(asset?.url);
  const mediaActions = nodeType === 'image' ? IMAGE_ACTIONS : nodeType === 'video' ? VIDEO_ACTIONS : [];
  const actions = nodeType === 'text' ? ACTIONS : [...mediaActions, { key: 'download', label: '下载', Icon: Download }];
  const isDisabled = (key) => !enabled || (key !== 'edit' && !hasContent) || (nodeType === 'video' && key !== 'download' && asset?.asset_type !== 'video');
  return <CanvasToolbarSurface label="节点内容工具栏">
    {actions.map(({ key, label, Icon }) => <CanvasToolbarButton key={key} label={label} disabled={isDisabled(key)} onClick={() => onAction?.(key)}>
      {Icon ? <Icon size={16} strokeWidth={1.5} className="shrink-0" /> : nodeType === 'video' ? <VideoEditIcon label={label} /> : <ImageEditIcon label={label} />}
    </CanvasToolbarButton>)}
    {['image', 'video'].includes(nodeType) && <CanvasToolbarButton label="查看详情" disabled={!hasContent} onClick={() => onPreview?.(asset)}>
      <Eye size={16} strokeWidth={1.5} className="shrink-0" />
    </CanvasToolbarButton>}
    {enabled && <CanvasToolbarButton label="更多" aria-haspopup="menu" onClick={(event) => onMore?.(event.currentTarget.getBoundingClientRect())}>
      <Ellipsis size={16} strokeWidth={1.5} className="shrink-0" />
    </CanvasToolbarButton>}
  </CanvasToolbarSurface>;
}
