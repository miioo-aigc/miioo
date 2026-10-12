import { create } from 'zustand';
import { resolveVideoEdit, submitVideoEdit, videoEditPayload } from '../api/VideoEdit';
import { validateSourceAsset } from '../utils/MediaEditRequest';
import { showGlobalToast } from '../stores/toastStore';
import { invalidate } from '../utils/cache';
import { useCreationStore } from '../stores/creationStore';
import { normalizeCreationHistoryItem } from '../utils/creationHistoryAdapter';
import { openVideoFrameDestination } from '../utils/VideoFrameDestination';

export const EMPTY_VIDEO_EDIT = { busy: false, active: false, result: null, error: '', pending: null };
export const useVideoEditStore = create((set) => ({
  tasks: {},
  notices: [],
  dismissNotice: () => set((state) => ({ notices: state.notices.slice(1) })),
}));
export function videoEditKey(source, mode) {
  try { return `miioo:video-edit:${validateSourceAsset(source)}:${mode}${source?.canvasEditScope ? `:canvas:${source.canvasEditScope}` : ''}`; }
  catch { return ''; }
}
function update(key, patch) {
  useVideoEditStore.setState((state) => ({ tasks: { ...state.tasks, [key]: { ...(state.tasks[key] || EMPTY_VIDEO_EDIT), ...patch } } }));
}
function remember(key, work) {
  try {
    if (work) sessionStorage.setItem(key, JSON.stringify(work));
    else sessionStorage.removeItem(key);
  } catch { /* 存储不可用时由页面内共享状态防止重复提交。 */ }
}

// 弹窗卸载只取消订阅，不中止请求与资产写回。
export async function runVideoEdit(source, options, onStarted) {
    let storageKey = videoEditKey(source, options.mode);
    const current = useVideoEditStore.getState().tasks[storageKey] || EMPTY_VIDEO_EDIT;
    if (current.busy) return;
    const pending = { current: current.pending };
    let started = false;
    let placeholder;
    try {
      validateSourceAsset(source);
      storageKey = videoEditKey(source, options.mode);
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
      if (work.options.persistToCreation !== false && ['trim', 'upscale', 'subtitle_remove'].includes(options.mode)) {
        work.generationId ||= `video-edit-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        work.createdAt ||= new Date().toISOString();
        placeholder = {
          id: work.generationId, createdAt: work.createdAt,
          model: work.options.mode === 'trim' ? source.model : work.options.mode === 'upscale' && work.options.resolution === '4K' ? 'doubao-seedance-2.0' : 'happyhorse-1.0-video-edit',
          ratio: source.ratio, resolution: work.options.resolution || source.resolution,
          cards: [{ id: null, type: 'video', status: 'loading', videoUrl: null }],
        };
        useCreationStore.getState().replaceGeneration('video', work.generationId, placeholder);
      }
      update(storageKey, { busy: true, active: true, error: '', pending: work });
      started = true;
      if (options.mode === 'trim') showGlobalToast('正在保存剪辑片段', 'info');
      onStarted?.();
      if (!work.accepted) {
        work.uncertain = true;
        remember(storageKey, work);
        work.accepted = await submitVideoEdit(source, work.options);
        work.uncertain = false;
        remember(storageKey, work);
      }
      const result = await resolveVideoEdit(work.accepted, work.options.mode);
      const type = work.options.mode === 'frame_extract' ? 'image' : 'video';
      if (work.options.persistToCreation !== false) {
        invalidate(`creation_history:${type}:`);
        invalidate('project-assets:');
        const store = useCreationStore.getState();
        const generation = normalizeCreationHistoryItem(result, type);
        if (placeholder) store.replaceGeneration(type, placeholder.id, { ...generation, id: placeholder.id, createdAt: placeholder.createdAt });
        else store.addGeneration(type, generation);
        store.updateHistoryMeta(type, { page: 0, hasMore: true, initialized: false });
        window.dispatchEvent(new CustomEvent('miioo:video-edit-saved', { detail: { result, type } }));
      }
      if (!work.options.suppressSuccessToast) {
        const href = work.options.resultHref;
        if (type === 'image' && href) {
          showGlobalToast('选帧图片已经保存成功，请', 'success', {
            action: { label: '查看', href, onClick: () => openVideoFrameDestination(href) },
          });
        } else {
          showGlobalToast(type === 'image' ? '选帧图片已经保存成功' : work.options.mode === 'trim' ? '剪辑片段已保存' : '编辑视频已保存', 'success');
        }
      }
      pending.current = null;
      remember(storageKey, null);
      update(storageKey, { result, pending: null, error: '' });
      return result;
    } catch (error) {
      if (placeholder && options.mode === 'trim') useCreationStore.getState().deleteGeneration('video', placeholder.id);
      else if (placeholder) useCreationStore.getState().replaceGeneration('video', placeholder.id, {
        ...placeholder, cards: [{ ...placeholder.cards[0], status: 'error', error: error.message }],
      });
      if (error.rejected || error.terminal) {
        pending.current = null;
        if (storageKey) remember(storageKey, null);
      }
      if (started) update(storageKey, { error: error.message || '视频编辑失败，请重试', pending: pending.current });
      if (started && options.mode === 'trim') {
        useVideoEditStore.setState((state) => ({ notices: [...state.notices, {
          title: '剪辑片段保存失败', message: error.message || '保存失败，请稍后重试',
        }] }));
      } else showGlobalToast(error.message || '视频编辑失败，请重试', 'error');
    } finally {
      if (started) update(storageKey, { busy: false });
    }
  }
