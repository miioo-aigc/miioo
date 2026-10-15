export function readMediaDuration(file, type) {
  if (!['video', 'audio'].includes(type)) return Promise.resolve(null);
  return new Promise((resolve) => {
    const media = document.createElement(type);
    const url = URL.createObjectURL(file);
    const finish = (duration) => {
      clearTimeout(timer);
      media.onloadedmetadata = null;
      media.onerror = null;
      media.removeAttribute('src');
      media.load();
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(duration) && duration > 0 ? duration : null);
    };
    const timer = setTimeout(() => finish(null), 10000);
    media.preload = 'metadata';
    media.onloadedmetadata = () => finish(media.duration);
    media.onerror = () => finish(null);
    media.src = url;
  });
}
