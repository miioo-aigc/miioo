import { useRef, useState } from 'react';
import { apiPrepareEditSource, apiSubmitImageEdit, apiResolveImageEdit, normalizeEditedImage } from '../api/ImageEdit';
import { apiListModels } from '../api/config';
import { showGlobalToast } from '../stores/toastStore';

export default function useImageEditSubmission({ card, onSave, onComplete }) {
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const source = useRef(null);
  const pending = useRef(null);
  const result = useRef(null);
  async function submit(options) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      if (!onSave) throw new Error('当前列表未连接保存回调');
      if (!pending.current && !result.current) {
        let model = card.model;
        if (options.mode === 'outpaint') {
          const models = (await apiListModels({ category: 'image', fresh: true })).filter((item) => item.enabled !== false && item.is_enabled !== false && item.capabilities?.supports_outpainting === true);
          const selected = models.find((item) => (item.model_id || item.id) === model) || models.find((item) => item.is_default) || models[0];
          if (!selected) throw new Error('暂无支持扩图的可用模型，请先配置模型');
          model = selected.model_id || selected.id;
        }
        source.current ||= await apiPrepareEditSource(card);
        pending.current = { accepted: await apiSubmitImageEdit(source.current, { model, ...options }), mode: options.mode };
      }
      if (onSave.pending) {
        await onSave.pending(pending.current);
      } else {
        result.current ||= normalizeEditedImage(await apiResolveImageEdit(pending.current.accepted, pending.current.mode));
        await onSave(result.current);
      }
      showGlobalToast('编辑结果已保存到原列表', 'success');
      onComplete?.();
    } catch (error) {
      if (error.terminal) pending.current = null;
      showGlobalToast(error.message || '图片编辑失败，请重试', 'error');
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return { busy, submit };
}
