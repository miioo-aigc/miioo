/** 节点、分组及多选顶部工具栏共用外壳；动作和定位由调用方持有。 */
import './CanvasToolbarSurface.css';

export default function CanvasToolbarSurface({ children, label, className = '' }) {
  return <div className={'canvas-node__toolbar nodrag nopan ' + className} role="toolbar" aria-label={label} onClick={(event) => event.stopPropagation()}>
    {children}
  </div>;
}
