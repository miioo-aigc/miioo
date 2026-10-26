/** 堆叠成员的只读预览；2026-10-13：内层承载悬停旋转，与外层展开动画隔离。 */
import { useRef } from 'react';
import { useMediaPlayback } from '../../hooks/useMediaPlayback';
import AsyncImagePreview from '../AsyncImagePreview';
import { Music2 } from 'lucide-react';
import { getCanvasImagePreview, getCanvasOriginalImage, getCanvasVideoPoster } from './CanvasMediaSources';

// 240px 卡片旋转后的中心统一对齐 312px 外框中心 (156, 156)。
const CARD_TRANSFORMS = [
  'translate(36px, 36px)',
  'translate(53.869px, 20.467px) rotate(8deg)',
  'translate(73.725px, 7.572px) rotate(16deg)',
];

function MemberPreview({ member }) {
  if (member.type === 'image' && member.asset?.url) return <AsyncImagePreview plain decorative imageClassName="canvas-stack-preview__media" src={getCanvasImagePreview(member.asset)} fallbackSrc={getCanvasOriginalImage(member.asset)} alt="" draggable={false} decoding="async" />;
  if (member.type === 'video' && member.asset?.url) return getCanvasVideoPoster(member.asset)
    ? <AsyncImagePreview plain decorative imageClassName="canvas-stack-preview__media" src={getCanvasVideoPoster(member.asset)} alt="" draggable={false} decoding="async" />
    : <StackVideo key={member.asset.url} src={member.asset.url} />;
  if (member.type === 'audio' && member.asset?.url) return <div className="canvas-stack-preview__empty"><Music2 size={28} /><span>{member.asset.name || member.label}</span></div>;
  if (member.content) return <div className="canvas-stack-preview__text">{member.content}</div>;
  if (member.readOnly) return <div className="canvas-stack-preview__empty">暂无内容</div>;
  const hint = { text: '支持.docx/.txt/.md', image: '支持图片上传', video: '支持视频上传', audio: '支持音频上传' }[member.type];
  return <>
    {member.type === 'text' && <span className="canvas-stack-preview__placeholder">双击编辑</span>}
    <div className="canvas-stack-preview__upload-slot"><span className="canvas-stack-preview__upload">本地上传</span><span>{hint}</span></div>
  </>;
}

export default function CanvasGroupStackPreview({ members = [] }) {
  const cards = [...members].reverse();
  return <div className="canvas-stack-preview" aria-hidden="true">
    {cards.map((member, index) => <div key={member.id} className="canvas-stack-preview__card"
      data-stack-member={member.id}
      style={{ transform: CARD_TRANSFORMS[Math.max(0, index - Math.max(0, cards.length - 3))], opacity: index < cards.length - 3 ? 0 : 1 }}>
      <div className="canvas-stack-preview__surface"><MemberPreview member={member} /></div>
    </div>)}
  </div>;
}

/** 装饰层仅自动恢复；手动操作在展开后的节点进行。 */
function StackVideo({ src }) {
  const ref = useRef(null);
  useMediaPlayback(ref, src);
  return <video ref={ref} className="canvas-stack-preview__media" src={src} muted playsInline preload="metadata" />;
}
