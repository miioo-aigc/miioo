const EXTENSIONS = {
  image: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'bmp', 'svg', 'heic', 'heif'],
  video: ['mp4', 'mov', 'webm', 'm4v', 'avi', 'mkv'],
  audio: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'opus', 'aiff'],
};

export function getCanvasMediaAccept(type) {
  if (type === 'all') return ['image', 'video', 'audio'].map(getCanvasMediaAccept).join(',');
  return type === 'audio' ? EXTENSIONS.audio.map((extension) => `.${extension}`).join(',') : `${type}/*`;
}

export function getCanvasMediaFileType(file, nodeType) {
  return (nodeType === 'video' ? ['image', 'video', 'audio'] : [nodeType])
    .find((type) => isCanvasMediaFile(file, type)) || null;
}

export function isCanvasMediaFile(file, type) {
  if (!file || !file.size || !EXTENSIONS[type]) return false;
  if (type === 'audio') {
    const extension = file.name?.split('.').pop()?.toLowerCase();
    const mime = (file.type || '').toLowerCase();
    return EXTENSIONS.audio.includes(extension)
      && (!mime || mime.startsWith('audio/') || mime === 'application/octet-stream' || (mime === 'application/ogg' && ['ogg', 'opus'].includes(extension)));
  }
  if (file.type) return file.type.startsWith(`${type}/`);
  return EXTENSIONS[type].includes(file.name?.split('.').pop()?.toLowerCase());
}
