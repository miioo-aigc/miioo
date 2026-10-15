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
  ownerId: null,
  notices: [],
  dismissNotice: () => set((state) => ({ notices: state.notices.slice(1) })),
}));

export function recoverVideoEdits(ownerId) {
  if (!ownerId) return;
  useVideoEditStore.setState({ ownerId });
  const records = [];
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key?.startsWith('miioo:video-edit:')) continue;
      try {
        const work = JSON.parse(sessionStorage.getItem(key));
        if (work?.ownerId === ownerId && work.source && work.accepted
          && !work.uncertain && work.options?.persistToCreation !== false) records.push(work);
      } catch { /* 单条损坏记录不影响其他任务恢复。 */ }
    }
  } catch { return; }
  for (const work of records) void runVideoEdit(work.source, work.options);
}
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
          if (pending.current?.ownerId && pending.current.ownerId !== useVideoEditStore.getState().ownerId) pending.current = null;
        } catch { /* 本地记录不可读时仍可执行参数校验。 */ }
        if (!pending.current) {
          videoEditPayload(options);
          pending.current = {
            options, ownerId: useVideoEditStore.getState().ownerId,
            source: { asset_id: validateSourceAsset(source), model: source.model, ratio: source.ratio, resolution: source.resolution },
          };
        }
      }
      const work = pending.current;
      if (work.ownerId && work.ownerId !== useVideoEditStore.getState().ownerId) return;
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
      update(storageKey, { busy: true, active: true, error: '', pending: work, placeholder });
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
      let result;
      // 受理后的读取失败不代表生成失败，只查询原任务，禁止重复提交。
      for (;;) {
        if (work.ownerId && work.ownerId !== useVideoEditStore.getState().ownerId) return;
        try {
          result = await resolveVideoEdit(work.accepted, work.options.mode);
          break;
        } catch (error) {
          const retryable = !error.resultInvalid && (error.name === 'TypeError'
            || /超时/.test(error.message) || error.status === 408 || error.status === 429 || error.status >= 500);
          if (error.terminal || error.rejected || !retryable) throw error;
          await new Promise((resolve) => setTimeout(resolve, 10000));
        }
      }
      const type = work.options.mode === 'frame_extract' ? 'image' : 'video';
      if (work.ownerId && work.ownerId !== useVideoEditStore.getState().ownerId) return;
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
      update(storageKey, { result, pending: null, error: '', placeholder: null });
      return result;
    } catch (error) {
      // 无法自动恢复的读取异常也退出加载展示，但保留受理信息供人工继续读取。
      if (placeholder && (error.rejected || error.terminal || !pending.current?.uncertain)) {
        useCreationStore.getState().deleteGeneration('video', placeholder.id);
      }
      if (error.rejected || error.terminal) {
        pending.current = null;
        if (storageKey) remember(storageKey, null);
      }
      if (started) update(storageKey, { error: error.message || '视频编辑失败，请重试', pending: pending.current, placeholder: null });
      if (started) {
        useVideoEditStore.setState((state) => ({ notices: [...state.notices, {
          title: pending.current?.uncertain ? '视频任务提交结果待确认' : options.mode === 'trim' ? '剪辑片段保存失败' : '视频编辑失败',
          message: pending.current?.uncertain
            ? `${error.message || '网络异常'}。暂时无法确认后台是否已受理，请先核查任务或资产库，不要重复生成。`
            : error.message || '视频编辑失败，请稍后重试',
        }] }));
      } else showGlobalToast(error.message || '视频编辑失败，请重试', 'error');
    } finally {
      if (started) update(storageKey, { busy: false });
    }
  }
