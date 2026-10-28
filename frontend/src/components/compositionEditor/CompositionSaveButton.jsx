import { useEffect, useState } from 'react';
import CloudSaveIndicator from '../ui/CloudSaveIndicator';
import { useCompositionEditorStore } from '../../stores/compositionEditorStore';
import { getErrorMessage } from '../../api/error';

export default function CompositionSaveButton({ ready, disabled, showToast }) {
  const saving = useCompositionEditorStore((s) => s.saving);
  const dirty = useCompositionEditorStore((s) => s.dirty);
  const error = useCompositionEditorStore((s) => s.saveError);
  const sequence = useCompositionEditorStore((s) => s.saveSequence);
  const [acknowledged, setAcknowledged] = useState(sequence);
  useEffect(() => {
    const timer = setTimeout(() => setAcknowledged(sequence), 1000);
    return () => clearTimeout(timer);
  }, [sequence]);
  const status = saving ? 'saving' : error ? 'error' : dirty ? 'pending' : sequence > acknowledged ? 'success' : 'idle';
  const labels = { idle: '草稿已保存，点击保存', pending: '有未保存的修改，点击保存', saving: '正在保存草稿', success: '草稿保存成功', error: '保存失败，点击重试' };
  async function handleSave() {
    if (!ready || disabled || useCompositionEditorStore.getState().saving) return;
    try {
      await useCompositionEditorStore.getState().save();
      showToast?.('草稿已保存', 'success');
    } catch (failure) {
      showToast?.(getErrorMessage(failure, '保存草稿失败'), 'error');
    }
  }
  return <CloudSaveIndicator status={status} label={!ready ? '草稿加载中' : labels[status]}
    onClick={handleSave} disabled={!ready || disabled} style={{ width: 32, height: 32 }} />;
}
