import { useRef, useState } from 'react';
import { resolveVideoEdit, submitVideoEdit, videoEditPayload } from '../api/VideoEdit';
import { validateSourceAsset } from '../utils/MediaEditRequest';
import { showGlobalToast } from '../stores/toastStore';
import { invalidate } from '../utils/cache';
import { useCreationStore } from '../stores/creationStore';
import { normalizeCreationHistoryItem } from '../utils/creationHistoryAdapter';

export default function useVideoEditSubmission(source, onComplete) {
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const pending = useRef(null);
  async function submit(options) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    let storageKey;
    try {
      const sourceId = validateSourceAsset(source);
      storageKey = `miioo:video-edit:${sourceId}:${options.mode}`;
      if (!pending.current) {
        try {
          pending.current = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
        } catch { /* 本地记录不可读时仍可执行参数校验。 */ }
        if (!pending.current) {
          videoEditPayload(options);
          pending.current = { options };
        }
      }
      const work = pending.current;
      if (work.uncertain) throw new Error('上次提交结果尚不明确，请先核查任务或资产库，避免重复生成');
      if (!work.accepted) {
        work.uncertain = true;
        sessionStorage.setItem(storageKey, JSON.stringify(work));
        work.accepted = await submitVideoEdit(source, work.options);
        work.uncertain = false;
        sessionStorage.setItem(storageKey, JSON.stringify(work));
      }
      const result = await resolveVideoEdit(work.accepted, work.options.mode);
      const type = work.options.mode === 'frame_extract' ? 'image' : 'video';
      invalidate(`creation_history:${type}:`);
      invalidate('project-assets:');
      const store = useCreationStore.getState();
      const generation = normalizeCreationHistoryItem(result, type);
      store.addGeneration(type, generation);
      store.updateHistoryMeta(type, { page: 0, hasMore: true, initialized: false });
      window.dispatchEvent(new CustomEvent('miioo:video-edit-saved', { detail: { result, type } }));
      showGlobalToast(type === 'image' ? '选帧图片已保存到平台' : '编辑视频已保存', 'success');
      pending.current = null;
      sessionStorage.removeItem(storageKey);
      onComplete?.();
    } catch (error) {
      if (error.rejected || error.terminal) {
        pending.current = null;
        if (storageKey) sessionStorage.removeItem(storageKey);
      }
      showGlobalToast(error.message || '视频编辑失败，请重试', 'error');
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return { busy, submit };
}
