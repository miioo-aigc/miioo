/** 屏幕坐标绘制辅助线，缩放不改变线宽和虚线间距。 */
export default function CanvasSnapGuides({ guides, viewport }) {
  if (!guides.length) return null;
  return <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full" aria-hidden="true">
    {guides.map(({ axis, value }) => {
      const position = value * viewport.zoom + viewport[axis];
      return <line key={axis} x1={axis === 'x' ? position : 0} x2={axis === 'x' ? position : '100%'}
        y1={axis === 'y' ? position : 0} y2={axis === 'y' ? position : '100%'}
        stroke="var(--color-white-40)" strokeWidth="0.6" strokeDasharray="5 5" />;
    })}
  </svg>;
}
