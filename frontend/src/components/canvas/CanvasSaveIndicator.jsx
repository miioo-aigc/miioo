import { CloudUpload } from 'lucide-react';
import Tooltip from '../ui/Tooltip';
import './CanvasSaveIndicator.css';

const LABELS = {
  idle: '画布已保存', pending: '有未保存的修改', saving: '正在保存画布',
  success: '画布保存成功', error: '保存失败',
};

/** 纯展示：真实保存状态由页面传入，复用云上传图标和通用提示。 */
export default function CanvasSaveIndicator({ status = 'idle' }) {
  return <Tooltip label={LABELS[status]} placement="bottom" offset={8}>
    <span className="canvas-save-indicator" data-status={status} role="status" aria-label={LABELS[status]}>
      <CloudUpload size={16} strokeWidth={1.7} aria-hidden="true" />
      {status === 'saving' && <CloudUpload className="canvas-save-indicator__progress" size={16} strokeWidth={1.7} aria-hidden="true" />}
    </span>
  </Tooltip>;
}
