import { create } from 'zustand';

const TOAST_DURATIONS = Object.freeze({
  error: 5000,
  warning: 3000,
  success: 2000,
  info: 2000,
});
let nextToastId = 0;
let nextDownloadToastId = 0;

function normalizeToastArgs(first, second) {
  const knownTypes = new Set(Object.keys(TOAST_DURATIONS));
  const isTypeFirst = knownTypes.has(first);
  const type = isTypeFirst ? first : (second || 'info');
  const message = isTypeFirst ? second : first;
  const duration = TOAST_DURATIONS[type] ?? TOAST_DURATIONS.info;
  return { type, message: String(message ?? ''), duration };
}

export const useToastStore = create((set, get) => ({
  toast: null,
  timer: null,
  downloadToasts: [],
  showToast: (first, second) => {
    const { type, message, duration } = normalizeToastArgs(first, second);
    if (!message) return;
    if (get().timer) clearTimeout(get().timer);
    const id = ++nextToastId;
    const timer = setTimeout(() => {
      if (get().toast?.id === id) set({ toast: null, timer: null });
    }, duration);
    set({ toast: { id, type, message }, timer });
  },
  hideToast: () => {
    if (get().timer) clearTimeout(get().timer);
    set({ toast: null, timer: null });
  },
  showDownloadToast: (message = '正在下载', { id } = {}) => {
    const key = id || `download-${++nextDownloadToastId}`;
    const toast = { id: key, message: String(message || '正在下载'), progress: null };
    set((state) => ({
      downloadToasts: [...state.downloadToasts.filter((item) => item.id !== key), toast],
    }));
    return key;
  },
  setDownloadProgress: (id, progress) => {
    const normalized = normalizeDownloadProgress(progress);
    set((state) => ({
      downloadToasts: state.downloadToasts.map((item) => (
        item.id === id ? { ...item, progress: normalized } : item
      )),
    }));
  },
  hideDownloadToast: (id) => {
    set((state) => ({
      downloadToasts: state.downloadToasts.filter((item) => item.id !== id),
    }));
  },
}));

export const showGlobalToast = (...args) => useToastStore.getState().showToast(...args);

function normalizeDownloadProgress(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  const ratio = Number(value) <= 1 ? Number(value) * 100 : Number(value);
  return Math.max(0, Math.min(100, Math.round(ratio)));
}

export const startGlobalDownloadToast = (...args) => useToastStore.getState().showDownloadToast(...args);
export const updateGlobalDownloadProgress = (id, progress) => useToastStore.getState().setDownloadProgress(id, progress);
export const hideGlobalDownloadToast = (id) => useToastStore.getState().hideDownloadToast(id);
