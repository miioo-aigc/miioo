/** 统一顶部工具栏按钮尺寸、提示、禁用态及事件透传。 */
import { Button, IconButton, Tooltip } from '../ui';
import './CanvasToolbarSurface.css';

export default function CanvasToolbarButton({ label, children, showLabel = false, className = '', ...props }) {
  if (showLabel) return <Button {...props} aria-label={label} variant="link" className={'canvas-node__toolbar-button canvas-node__toolbar-button--label ' + className} contentClassName="canvas-node__toolbar-icon">{children}</Button>;
  return <Tooltip variant="canvas" label={label} placement="top">
    <span><IconButton {...props} aria-label={label} variant="link" className={'canvas-node__toolbar-button ' + className} contentClassName="canvas-node__toolbar-icon">{children}</IconButton></span>
  </Tooltip>;
}
