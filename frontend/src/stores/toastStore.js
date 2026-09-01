import { create } from 'zustand';

const TOAST_DURATIONS = Object.freeze({
  error: 3500,
  warning: 3000,
  success: 2500,
  info: 2500,
});
let nextToastId = 0;

function normalizeToastArgs(first, second, third) {
  const knownTypes = new Set(Object.keys(TOAST_DURATIONS));
  const isTypeFirst = knownTypes.has(first);
  const type = isTypeFirst ? first : (second || 'info');
  const message = isTypeFirst ? second : first;
  const duration = third ?? TOAST_DURATIONS[type] ?? TOAST_DURATIONS.info;
  return { type, message: String(message ?? ''), duration };
}

export const useToastStore = create((set, get) => ({
  toast: null,
  timer: null,
  showToast: (first, second, third) => {
    const { type, message, duration } = normalizeToastArgs(first, second, third);
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
}));

export const showGlobalToast = (...args) => useToastStore.getState().showToast(...args);
