import CloudSaveIndicator from '../ui/CloudSaveIndicator';

const LABELS = {
  idle: '画布已保存', pending: '有未保存的修改', saving: '正在保存画布',
  success: '画布保存成功', error: '保存失败',
};

export default function CanvasSaveIndicator({ status = 'idle' }) {
  return <CloudSaveIndicator status={status} label={LABELS[status]} style={{ marginLeft: 10 }} />;
}
