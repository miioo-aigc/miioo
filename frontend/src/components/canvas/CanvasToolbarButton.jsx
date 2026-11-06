/** 统一顶部工具栏按钮尺寸、提示、禁用态及事件透传。 */
import { IconButton, Tooltip } from '../ui';
import './CanvasToolbarSurface.css';

export default function CanvasToolbarButton({ label, children, className = '', ...props }) {
  return <Tooltip label={label} placement="top">
    <span><IconButton {...props} aria-label={label} variant="link" className={'canvas-node__toolbar-button ' + className} contentClassName="canvas-node__toolbar-icon">{children}</IconButton></span>
  </Tooltip>;
}
