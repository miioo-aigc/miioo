import { useRef, useState } from 'react';
import { buildImageEditRequest } from '../utils/MediaEditRequest';
import { showGlobalToast } from '../stores/toastStore';

export default function useImageEditSubmission({ card, onPrepare }) {
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const pending = useRef(null);
  async function submit(options) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      pending.current = buildImageEditRequest(card, options);
      await onPrepare?.(pending.current);
      showGlobalToast('编辑参数已准备，等待后端编辑接口接入', 'info');
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
