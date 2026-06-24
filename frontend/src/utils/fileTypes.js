// 文件扩展名常量
export const ALLOWED_EXTS = ['.txt', '.md', '.pdf', '.docx'];
export const ALLOWED_IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff', '.tif', '.heic', '.heif'];
export const ALLOWED_VIDEO_EXTS = ['.mp4', '.mov', '.avi', '.webm', '.mkv', '.wmv', '.flv'];
export const ALLOWED_AUDIO_EXTS = ['.mp3', '.wav', '.aac', '.ogg', '.flac', '.m4a', '.wma'];
export const ALLOWED_MEDIA_EXTS = [...ALLOWED_IMAGE_EXTS, ...ALLOWED_VIDEO_EXTS, ...ALLOWED_AUDIO_EXTS];
