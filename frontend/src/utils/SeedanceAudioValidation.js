/**
 * Seedance 2.0 家族（2.0 / 2.0 Fast / 2.0 Mini）音频参考素材的统一规则与校验。
 *
 * 仅在「点击生成」时调用：
 * - 本地 File 读取真实时长；资产或历史数据优先使用 duration / duration_ms /
 *   metadata_json 等元数据。
 * - 远程素材缺少时长或大小时保留后端兜底，不因无法读取而误拦截。
 * - 仅当模型属于 Seedance 2.0 家族时生效，2.5 不限制。
 */
import { readMediaDuration } from './ReadMediaDuration.js';
import { isSeedance20VideoModel } from './videoModelCapabilities.js';

export const SEEDANCE_AUDIO_RULES = Object.freeze({
  minSeconds: 2,
  maxSeconds: 15,
  maxTotalSeconds: 15,
  maxSegments: 3,
  maxBytes: 15 * 1024 * 1024,
  formats: Object.freeze(['mp3', 'wav']),
});

export const SEEDANCE_AUDIO_MESSAGES = Object.freeze({
  format: '参考音频仅支持 MP3、WAV 格式',
  duration: '参考音频单段时长需在 2 到 15 秒之间',
  maxSegments: '参考音频最多支持 3 段',
  totalDuration: '参考音频合计时长不能超过 15 秒',
  fileSize: '参考音频单个文件不能超过 15MB',
});

const SUPPORTED_FORMATS = new Set(SEEDANCE_AUDIO_RULES.formats);
// MIME 子类型到扩展名的别名，保证 mpeg/x-wav 等写法与 mp3/wav 等价。
const FORMAT_ALIASES = {
  mpeg: 'mp3',
  mp3: 'mp3',
  'x-mp3': 'mp3',
  wav: 'wav',
  wave: 'wav',
  'x-wav': 'wav',
  'vnd.wave': 'wav',
};

function toPositiveNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function parseMetadata(item) {
  const raw = item?.metadata_json ?? item?.metadataJson;
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// 只根据文件名/扩展名或 MIME 判断格式；不依据 URL，因为后端存储路径的扩展名不可信。
export function getSeedanceAudioFormat(item) {
  const name = String(item?.name || item?.filename || '').split(/[?#]/)[0].toLowerCase();
  const extension = name.match(/\.([a-z0-9]+)$/)?.[1];
  if (extension) return FORMAT_ALIASES[extension] || extension;
  const mime = String(item?.type || item?.mime_type || item?.mimeType || '').toLowerCase();
  const subtype = mime.match(/^audio\/([a-z0-9.+-]+)/)?.[1];
  if (subtype) return FORMAT_ALIASES[subtype] || subtype;
  return '';
}

export function getSeedanceAudioSize(item) {
  return toPositiveNumber(item?.size) ?? toPositiveNumber(item?.file?.size);
}

async function getSeedanceAudioDuration(item) {
  const file = (typeof File !== 'undefined' && item instanceof File)
    ? item
    : (typeof File !== 'undefined' && item?.file instanceof File ? item.file : null);
  if (file) {
    const read = await readMediaDuration(file, 'audio');
    if (read !== null) return read;
  }
  const metadata = parseMetadata(item);
  const seconds = toPositiveNumber(item?.duration)
    ?? toPositiveNumber(metadata?.duration)
    ?? toPositiveNumber(metadata?.seconds);
  if (seconds !== null) return seconds;
  const milliseconds = toPositiveNumber(item?.duration_ms)
    ?? toPositiveNumber(item?.durationMs)
    ?? toPositiveNumber(metadata?.duration_ms)
    ?? toPositiveNumber(metadata?.durationMs);
  if (milliseconds !== null) return milliseconds / 1000;
  return null;
}

export function isSeedance20AudioModel({ modelId = '', modelName = '' } = {}) {
  return isSeedance20VideoModel({ modelId, modelName });
}

/**
 * 校验一组音频参考素材是否满足 Seedance 2.0 家族的要求。
 * 返回 { ok, message, totalSeconds, unverified }；unverified 表示因缺少元数据未校验时长的段数。
 */
export async function validateSeedance20AudioReferences(items = [], { modelId = '', modelName = '' } = {}) {
  const list = (Array.isArray(items) ? items : [items]).filter(Boolean);
  if (list.length === 0 || !isSeedance20VideoModel({ modelId, modelName })) {
    return { ok: true, message: '', totalSeconds: 0, unverified: 0 };
  }
  if (list.length > SEEDANCE_AUDIO_RULES.maxSegments) {
    return { ok: false, message: SEEDANCE_AUDIO_MESSAGES.maxSegments };
  }
  let totalSeconds = 0;
  let unverified = 0;
  for (const item of list) {
    const format = getSeedanceAudioFormat(item);
    if (format && !SUPPORTED_FORMATS.has(format)) {
      return { ok: false, message: SEEDANCE_AUDIO_MESSAGES.format };
    }
    const size = getSeedanceAudioSize(item);
    if (size !== null && size > SEEDANCE_AUDIO_RULES.maxBytes) {
      return { ok: false, message: SEEDANCE_AUDIO_MESSAGES.fileSize };
    }
    const duration = await getSeedanceAudioDuration(item);
    if (duration === null) {
      unverified += 1;
      continue;
    }
    if (duration < SEEDANCE_AUDIO_RULES.minSeconds || duration > SEEDANCE_AUDIO_RULES.maxSeconds) {
      return { ok: false, message: SEEDANCE_AUDIO_MESSAGES.duration };
    }
    totalSeconds += duration;
  }
  if (totalSeconds > SEEDANCE_AUDIO_RULES.maxTotalSeconds) {
    return { ok: false, message: SEEDANCE_AUDIO_MESSAGES.totalDuration };
  }
  return { ok: true, message: '', totalSeconds, unverified };
}
