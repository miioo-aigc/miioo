/**
 * @file VideoCircleBadge.jsx
 * 视频中央圆形徽标底：半透明毛玻璃圆 + 白色图标，视觉对齐创作视频详情弹窗的播放反馈。
 * 详情弹窗的播放反馈与画布视频卡片的常驻播放按钮共用同一份样式，尺寸由调用方传入。
 */
export default function VideoCircleBadge({ size = 56, style, children }) {
  return <div aria-hidden="true" style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: `${size}px`, height: `${size}px`, borderRadius: '50%',
    background: '#FFFFFF1F', border: '1px solid #FFFFFF33',
    backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
    color: '#FFFFFF', ...style,
  }}>{children}</div>;
}
