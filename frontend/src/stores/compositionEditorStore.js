import { create } from 'zustand';
import { getTrackDeletionState, segmentTrack } from '../utils/TrackDeletion';
import { allocateSubtitles, DEFAULT_SUBTITLE_STYLE } from '../utils/SubtitleImport';
import {
  apiGetCompositions,
  apiCreateComposition,
  apiUpdateComposition,
  apiRenderComposition,
} from '../api/compositions';
import { useCompositionExportStore } from './CompositionExportStore';
import { apiDownloadAsset } from '../api/assets';
import { authFetch } from '../api/request';
import { getErrorMessage } from '../api/error';

/**
 * 轻量剪辑工作台 —— 单一事实源 store。
 * 所有编辑器状态收敛于此，页面与各面板组件只消费 store。
 *
 * 时间线协议：{ type, clip_id, start, duration, offset, track, speed?, transition? }
 * clip_id 引用的是「资产 id」。
 * speed：素材消费速率（源窗口不变时，时间线时长 = 源窗口 ÷ speed；仅 video/audio，默认 1）。
 * transition：图片段固定输出 'none'，避免后端缺省启用淡入淡出。
 * 音频段允许显式 start（对齐分离出的视频原声位置；缺省沿用 A1 串行游标）。
 */

// ── 基础工具 ────────────────────────────────────────────────────────────────

export function formatTime(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function clampNumber(value, min, max) {
  const num = Number(value);
  if (!Number.isFinite(num)) return min;
  return Math.min(max, Math.max(min, num));
}

/** 片段有效倍速（图片恒 1，缺省/非法值回退 1） */
function segmentSpeedOf(seg) {
  if (!seg || seg.type === 'image') return 1;
  const speed = Number(seg.speed);
  return Number.isFinite(speed) && speed > 0 ? speed : 1;
}

/** 素材类型 → 片段类型 */
export function assetTypeToSegment(asset) {
  const type = asset?.asset_type || asset?.type;
  if (type === 'video') return 'video';
  if (type === 'audio') return 'audio';
  if (type === 'subtitle') return 'subtitle';
  return 'image';
}

/** 新建片段的默认时长：视频/音频保留原始时长，图片默认 3s */
export function clampNewDuration(asset) {
  const duration = asset?.duration && Number(asset.duration) > 0
    ? Number(asset.duration)
    : 3.0;
  return clampNumber(duration, 0.5, 3600);
}

/**
 * 计算可视化片段（video/image）在主时间线上的窗口，按数组顺序连续排列。
 * 音频不占可视化窗口。返回 { windows, total }。
 */
export function computeVisualWindows(segments = [], track = null) {
  const windows = [];
  const cursors = new Map();
  segments.forEach((seg) => {
    if ((seg?.type !== 'video' && seg?.type !== 'image') || (track && (seg.track || 'V1') !== track)) return;
    const duration = Math.max(0, Number(seg.duration) || 0);
    const lane = seg.track || 'V1';
    const cursor = cursors.get(lane) || 0;
    const explicit = Number(seg?.start);
    // V1 片段按时间顺序排列，异常的重叠起点向后推到上一片段结束，避免卡片视觉叠层。
    const start = Number.isFinite(explicit) && explicit >= cursor ? explicit : cursor;
    windows.push({ seg, start, end: start + duration, index: windows.length });
    cursors.set(lane, start + duration);
  });
  return { windows, total: Math.max(0, ...cursors.values()) };
}

/**
 * 计算 A1 音频段窗口：start = seg.start ?? 串行游标（尊重显式起点，允许间隙），
 * 游标推进到 start + duration。total 为 A1 最末端（各段 end 的最大值）。
 */
export function computeAudioWindows(segments = [], track = null) {
  const windows = [];
  const cursors = new Map();
  let total = 0;
  segments.forEach((seg) => {
    if (seg?.type !== 'audio' || (track && (seg.track || 'A1') !== track)) return;
    const duration = Math.max(0, Number(seg.duration) || 0);
    const lane = seg.track || 'A1';
    const cursor = cursors.get(lane) || 0;
    const explicit = Number(seg?.start);
    const start = Number.isFinite(explicit) && explicit >= 0 ? explicit : cursor;
    const end = start + duration;
    windows.push({ seg, start, end, index: windows.length });
    cursors.set(lane, end);
    if (end > total) total = end;
  });
  return { windows, total };
}

export function computeSubtitleWindows(segments = [], track = null) {
  const windows = [];
  const cursors = new Map();
  segments.forEach((seg) => {
    if (seg?.type !== 'subtitle' || (track && (seg.track || 'S1') !== track)) return;
    const lane = seg.track || 'S1';
    const cursor = cursors.get(lane) || 0;
    const duration = Math.max(0, Number(seg.duration) || 0);
    const explicit = Number(seg.start);
    const start = Number.isFinite(explicit) && explicit >= 0 ? explicit : cursor;
    windows.push({ seg, start, end: start + duration, index: windows.length });
    cursors.set(lane, start + duration);
  });
  return { windows, total: windows.reduce((max, item) => Math.max(max, item.end), 0) };
}

/** 工程总时长口径：max(V1 可视总长, A1 最末端)，供时间线宽度与进度条统一使用 */
export function computeTotalDuration(segments = []) {
  const visual = computeVisualWindows(segments);
  const audio = computeAudioWindows(segments);
  const subtitle = computeSubtitleWindows(segments);
  return Math.max(visual.total, audio.total, subtitle.total);
}

/** 把片段序列化成后端时间线协议 */
export function serializeTimeline(segments = []) {
  const items = [];
  const starts = new Map([...computeVisualWindows(segments).windows, ...computeAudioWindows(segments).windows, ...computeSubtitleWindows(segments).windows].map((window) => [window.seg.id, window.start]));
  segments.forEach((seg) => {
    const duration = Math.max(0, Number(seg.duration) || 0);
    const track = seg?.track || (seg?.type === 'audio' ? 'A1' : seg?.type === 'subtitle' ? 'S1' : 'V1');
    const start = starts.get(seg.id) || 0;
    const item = {
      type: seg?.type || 'image',
      clip_id: seg?.assetId,
      start,
      duration,
      offset: Number(seg?.offset) || 0,
      track,
    };
    if (seg.type === 'subtitle') {
      delete item.clip_id;
      item.text = seg.text || '';
      item.style = seg.style || DEFAULT_SUBTITLE_STYLE;
    }
    if (track === 'S1') item.start = start;
    // speed 仅 video/audio 段输出（图片恒 1，后端对 image 忽略 speed）
    if (seg?.type === 'video' || seg?.type === 'audio') {
      item.speed = segmentSpeedOf(seg);
    }
    if (seg.type === 'video') item.has_audio = seg.hasAudio !== false;
    if (seg.type === 'audio') item.volume = Math.round(clampNumber(seg.volume ?? 1, 0, 2) * 100) / 100;
    // transition 仅图片段输出
    if (seg?.type === 'image') {
      item.transition = 'none';
    }
    items.push(item);
  });
  return items;
}

/**
 * 单个片段的时长上下限（基于 offset / sourceDuration / type / speed）。
 * video/audio 按源窗口口径：offset + duration × speed ≤ 源时长。
 */
export function durationClampOf(seg) {
  const min = 0.5;
  if (!seg) return { min, max: 30 };
  if (seg.type === 'image') {
    // 图片不受 speed 影响
    const max = seg.sourceDuration && Number(seg.sourceDuration) > 0
      ? clampNumber(Number(seg.sourceDuration), min, 30)
      : 30;
    return { min, max };
  }
  const speed = segmentSpeedOf(seg);
  const srcD = Number(seg.sourceDuration);
  if (Number.isFinite(srcD) && srcD > 0) {
    const max = clampNumber((srcD - (Number(seg.offset) || 0)) / speed, min, 3600);
    return { min, max };
  }
  return { min, max: 30 };
}

/**
 * 入点 offset 上下限（图片恒为 0）。
 * video/audio 按源窗口口径：offset ≤ 源时长 − duration × speed。
 */
export function offsetClampOf(seg) {
  if (!seg || seg.type === 'image') return { min: 0, max: 0 };
  const speed = segmentSpeedOf(seg);
  const srcD = Number(seg.sourceDuration);
  if (Number.isFinite(srcD) && srcD > 0) {
    return { min: 0, max: clampNumber(srcD - (Number(seg.duration) || 0) * speed, 0, srcD) };
  }
  return { min: 0, max: 30 };
}

/**
 * 反序列化补齐新协议字段（speed / transition / start）：
 * 旧草稿无这些字段时按默认值补齐，行为不变。
 */
function normalizeSegmentExtras(item, type) {
  if (type === 'image') {
    return { start: Number.isFinite(Number(item?.start)) ? Math.max(0, Number(item.start)) : undefined, speed: 1, transition: 'none' };
  }
  const speed = Number(item?.speed);
  const extras = { speed: Number.isFinite(speed) && speed > 0 ? clampNumber(speed, 0.5, 4) : 1 };
  if (type === 'video') extras.hasAudio = item.has_audio !== false;
  if (type === 'audio') extras.volume = clampNumber(item.volume ?? 1, 0, 2);
  if (type === 'audio' || type === 'video' || type === 'subtitle') {
    const start = Number(item?.start);
    extras.start = Number.isFinite(start) && start >= 0 ? start : undefined;
  }
  return extras;
}

// ── 导出任务轮询（模块级，避免与 React 生命周期耦合） ─────────────────────────

// ── Store ───────────────────────────────────────────────────────────────────

const initialExportState = {
  status: 'idle',
  progress: 0,
  taskId: null,
  assetId: null,
  outputUrl: null,
  error: null,
};

export const useCompositionEditorStore = create((rawSet, get) => {
  const snapshot = (state) => ({ segments: state.segments, selectedId: state.selectedId, selectedIds: state.selectedIds, album: state.album, libraryAssetIds: state.libraryAssetIds, trackSettings: state.trackSettings, mainTracks: state.mainTracks });
  const moveVisualSegments = (state, id, start, insertion) => {
    if (!Number.isFinite(start) || start < 0) return null;
    const windows = computeVisualWindows(state.segments).windows;
    const source = windows.find((window) => window.seg.id === id);
    if (!source || source.start === start) return null;
    const visual = state.segments.filter((segment) => segment.type === 'video' || segment.type === 'image');
    const withoutSource = visual.filter((segment) => segment.id !== id);
    if (insertion === null && !state.trackSettings.V1?.excludeGaps) {
      // 自由定位不推动其他片段；重叠位置不落位，悬空卡片由组件跟随指针。
      if (windows.some((window) => window.seg.id !== id && start < window.end && start + Number(source.seg.duration) > window.start)) return null;
      const positions = new Map(windows.map((window) => [window.seg.id, window.start]));
      const ordered = visual.map((segment) => ({ ...segment, start: segment.id === id ? start : positions.get(segment.id) })).sort((a, b) => a.start - b.start);
      let index = 0;
      return state.segments.map((segment) => positions.has(segment.id) ? ordered[index++] : segment);
    }
    const targetIndex = withoutSource.findIndex((segment) => {
      const window = windows.find((item) => item.seg.id === segment.id);
      return window && start < window.end;
    });
    const insertIndex = insertion?.index ?? (targetIndex < 0 ? withoutSource.length : targetIndex);
    const reordered = [...withoutSource];
    reordered.splice(insertIndex, 0, source.seg);
    const starts = new Map();
    const snap = state.trackSettings.V1?.excludeGaps;
    let cursor = 0;
    reordered.forEach((segment, index) => {
      if (index === insertIndex) {
        cursor = snap ? cursor : Math.max(start, cursor);
        starts.set(segment.id, cursor);
        cursor += Number(segment.duration) || 0;
        return;
      }
      const original = windows.find((window) => window.seg.id === segment.id);
      const desired = snap ? cursor : (original?.start ?? cursor);
      const safeStart = Math.max(desired, cursor);
      starts.set(segment.id, safeStart);
      cursor = safeStart + (Number(segment.duration) || 0);
    });
    // 窗口计算按数组顺序推进，必须同时写回视觉顺序；其他轨道保留原对象和位置。
    let visualIndex = 0;
    return state.segments.map((segment) => {
      if (!starts.has(segment.id)) return segment;
      const next = reordered[visualIndex++];
      return { ...next, start: starts.get(next.id) };
    });
  };
  const moveAudioSegments = (state, id, start) => {
    if (!Number.isFinite(start) || start < 0) return null;
    const windows = computeAudioWindows(state.segments).windows;
    const source = windows.find((window) => window.seg.id === id);
    if (!source || source.start === start) return null;
    if (state.trackSettings.A1?.excludeGaps) {
      const ordered = windows.filter((window) => window.seg.id !== id).sort((a, b) => a.start - b.start);
      const target = ordered.findIndex((window) => start < window.end);
      ordered.splice(target < 0 ? ordered.length : target, 0, source);
      let cursor = 0;
      const audio = ordered.map(({ seg }) => {
        const next = { ...seg, start: cursor };
        cursor += Number(seg.duration) || 0;
        return next;
      });
      let index = 0;
      return state.segments.map((segment) => segment.type === 'audio' ? audio[index++] : segment);
    }
    if (windows.some((window) => window.seg.id !== id && start < window.end && start + Number(source.seg.duration) > window.start)) return null;
    const positions = new Map(windows.map((window) => [window.seg.id, window.start]));
    return state.segments.map((segment) => segment.type === 'audio'
      ? { ...segment, start: segment.id === id ? start : positions.get(segment.id) } : segment);
  };
  const set = (update) => rawSet((state) => {
    const next = typeof update === 'function' ? update(state) : update;
    if (Object.hasOwn(next, 'selectedId') && !Object.hasOwn(next, 'selectedIds')) next.selectedIds = [];
    if (state.loaded && next.segments && next.segments !== state.segments && next.dirty === true) {
      return { ...next, past: [...state.past, snapshot(state)].slice(-100), future: [] };
    }
    return next;
  });
  return ({
  past: [],
  future: [],
  undo: () => rawSet((state) => {
    if (!state.past.length) return {};
    return { selectedIds: [], ...state.past.at(-1), past: state.past.slice(0, -1), future: [snapshot(state), ...state.future], dirty: true, dirtyRev: state.dirtyRev + 1, playing: false };
  }),
  redo: () => rawSet((state) => {
    if (!state.future.length) return {};
    return { selectedIds: [], ...state.future[0], past: [...state.past, snapshot(state)], future: state.future.slice(1), dirty: true, dirtyRev: state.dirtyRev + 1, playing: false };
  }),
  splitSelected: () => {
    const state = get();
    const subtitle = state.segments.find((seg) => seg.id === state.selectedId && seg.type === 'subtitle');
    if (subtitle) {
      const left = state.cursor - subtitle.start;
      if (left <= 0 || left >= subtitle.duration) return;
      const right = { ...subtitle, id: randomId(), start: state.cursor, duration: subtitle.duration - left };
      set({ segments: state.segments.flatMap((seg) => seg.id === subtitle.id ? [{ ...seg, duration: left }, right] : [seg]), selectedId: right.id, dirty: true, dirtyRev: state.dirtyRev + 1, playing: false });
      return;
    }
    const windows = [...computeVisualWindows(state.segments).windows, ...computeAudioWindows(state.segments).windows];
    const window = windows.find((item) => item.seg.id === state.selectedId);
    if (!window) return;
    const duration = state.cursor - window.start;
    const remainder = window.end - state.cursor;
    if (!Number.isFinite(duration) || !Number.isFinite(remainder) || duration <= 0 || remainder <= 0) return;
    const segment = window.seg;
    const right = { ...segment, id: randomId(), duration: remainder, offset: segment.type === 'image' ? 0 : (Number(segment.offset) || 0) + duration * segmentSpeedOf(segment), ...(segment.type === 'audio' ? { start: state.cursor } : {}) };
    set({ segments: state.segments.flatMap((item) => item.id === segment.id ? [{ ...item, duration }, right] : [item]), selectedId: right.id, dirty: true, dirtyRev: state.dirtyRev + 1, playing: false });
  },
  trimSelected: (side) => {
    const state = get();
    const windows = [...computeVisualWindows(state.segments).windows, ...computeAudioWindows(state.segments).windows];
    const window = windows.find((item) => item.seg.id === state.selectedId);
    if (!window || !['left', 'right'].includes(side)) return;
    const left = state.cursor - window.start;
    const right = window.end - state.cursor;
    if (!(left > 0 && right > 0)) return;
    const segment = window.seg;
    const speed = segmentSpeedOf(segment);
    const patch = side === 'left'
      ? { offset: segment.type === 'image' ? 0 : (Number(segment.offset) || 0) + left * speed, duration: right }
      : { duration: left };
    const nextSegments = state.segments.map((item) => item.id === segment.id ? { ...item, ...patch, ...(segment.type === 'audio' && side === 'left' ? { start: state.cursor } : {}) } : item);
    set({ segments: nextSegments, selectedId: segment.id, dirty: true, dirtyRev: state.dirtyRev + 1, playing: false, cursor: side === 'left' ? state.cursor : window.start });
  },
  projectId: null,
  compositionId: null,
  name: '未命名成片',
  segments: [],
  selectedId: null,
  selectedIds: [],
  selectAll: () => set((state) => ({ selectedIds: state.segments.map((segment) => segment.id), selectedId: state.segments.length === 1 ? state.segments[0].id : null })),
  deleteSelected: () => set((state) => {
    const ids = new Set(state.selectedIds.length ? state.selectedIds : [state.selectedId]);
    if (!state.segments.some((segment) => ids.has(segment.id))) return {};
    return { segments: state.segments.filter((segment) => !ids.has(segment.id)), selectedId: null, selectedIds: [], dirty: true, dirtyRev: state.dirtyRev + 1, playing: false };
  }),
  resolution: '1080p',
  aspectRatio: '16:9',
  dirty: false,
  dirtyRev: 0, // 每次置 dirty 的编辑自增，自动保存据此识别「有新修改」并防重复请求
  saving: false,
  loaded: false,
  album: [],
  libraryAssetIds: [],
  exportState: { ...initialExportState },
  exportModalOpen: false,
  exportSubmitting: false,
  playing: false,
  cursor: 0,
  trackSettings: { V1: { hidden: false, volume: 1, excludeGaps: true }, A1: { hidden: false, volume: 1, excludeGaps: false }, S1: { hidden: false } },
  mainTracks: { V: null, A: null, S: null },
  setMainTrack: (track) => rawSet((state) => {
    if (!/^[VAS][1-6]$/.test(track)) return {};
    return { mainTracks: { ...state.mainTracks, [track[0]]: state.mainTracks[track[0]] === track ? null : track },
      trackSettings: { ...state.trackSettings, [track]: state.trackSettings[track] || { hidden: false, volume: 1, excludeGaps: false } },
      past: [...state.past, snapshot(state)].slice(-100), future: [] };
  }),
  commitTrackDrag: (id, before, insertAt = null) => rawSet((state) => {
    if (!before || state.segments === before.segments) return {};
    let segments = state.segments;
    let trackSettings = { ...state.trackSettings };
    let mainTracks = { ...state.mainTracks };
    if (insertAt) {
      const moved = segments.find((segment) => segment.id === id);
      if (!moved || !Number.isInteger(insertAt) || insertAt < 1 || insertAt > 6) return { segments: before.segments };
      const prefix = moved.track[0];
      const existingNumbers = [...before.segments.map((segment) => segment.track || (segment.type === 'audio' ? 'A1' : segment.type === 'subtitle' ? 'S1' : 'V1')), ...Object.keys(before.trackSettings || state.trackSettings)]
        .filter((track) => track.startsWith(prefix)).map((track) => Number(track.slice(1)));
      if (Math.max(1, ...existingNumbers) >= 6) return { segments: before.segments };
      const temporary = moved.track;
      const rename = (track) => track === temporary ? `${prefix}${insertAt}`
        : track.startsWith(prefix) && Number(track.slice(1)) >= insertAt ? `${prefix}${Number(track.slice(1)) + 1}` : track;
      segments = segments.map((segment) => ({ ...segment, track: rename(segment.track || (segment.type === 'audio' ? 'A1' : segment.type === 'subtitle' ? 'S1' : 'V1')) }));
      trackSettings = Object.fromEntries(Object.entries(before.trackSettings || state.trackSettings).map(([track, settings]) => [rename(track), settings]));
      // Preserve empty source tracks as well as their settings when numbering shifts.
      before.segments.forEach((segment) => {
        const old = segment.track || (segment.type === 'audio' ? 'A1' : segment.type === 'subtitle' ? 'S1' : 'V1');
        trackSettings[rename(old)] ??= { hidden: false, volume: 1, excludeGaps: false };
      });
      trackSettings[`${prefix}${insertAt}`] = { hidden: false, volume: 1, excludeGaps: false };
      mainTracks = Object.fromEntries(Object.entries(mainTracks).map(([type, track]) => [type, track ? rename(track) : null]));
    }
    return { segments, trackSettings, mainTracks, past: [...state.past, before].slice(-100), future: [], selectedId: id, selectedIds: [], dirty: true, dirtyRev: state.dirtyRev + 1 };
  }),
  zoom: 24, // 时间线缩放：pxPerSecond（会话级，不持久化）

  loadAlbum: (assets) => set({ album: Array.isArray(assets) ? assets : [] }),
  addLibraryAssets: (assets) => set((state) => ({
    album: [...new Map([...assets, ...state.album].map((asset) => [String(asset.id), asset])).values()],
    libraryAssetIds: [...new Set([...assets.map((asset) => String(asset.id)), ...state.libraryAssetIds])],
    dirty: true, dirtyRev: state.dirtyRev + 1,
  })),
  importSubtitles: (cues) => {
    const state = get();
    if (!cues.length || cues.some((cue) => !Number.isFinite(cue.start) || !Number.isFinite(cue.duration) || cue.start < 0 || cue.duration <= 0)) throw new Error('字幕时间无效');
    const added = allocateSubtitles(state.segments, cues, state.mainTracks.S).map((cue) => ({ ...cue, id: randomId(), type: 'subtitle', name: cue.text, offset: 0, style: { ...DEFAULT_SUBTITLE_STYLE, ...cue.style } }));
    set({ segments: [...state.segments, ...added], selectedId: added[0].id, playing: false, dirty: true, dirtyRev: state.dirtyRev + 1 });
  },
  addSubtitle: () => {
    const state = get();
    if (state.mainTracks.S) {
      const windows = computeSubtitleWindows(state.segments).windows.filter(({ seg }) => (seg.track || 'S1') === state.mainTracks.S);
      const start = Math.max(0, ...windows.map((window) => window.end));
      state.importSubtitles([{ text: '请输入字幕', start, duration: 3 }]);
      return;
    }
    const end = computeTotalDuration(state.segments);
    state.importSubtitles([{ text: '请输入字幕', start: state.cursor, duration: end > state.cursor ? Math.min(3, end - state.cursor) : 3 }]);
  },
  previewSubtitle: (id, patch) => rawSet((state) => {
    const source = state.segments.find((seg) => seg.id === id && seg.type === 'subtitle');
    if (!source) return {};
    const next = { ...source, ...patch, style: { ...DEFAULT_SUBTITLE_STYLE, ...source.style, ...patch.style } };
    if (!Number.isFinite(next.start) || !Number.isFinite(next.duration) || next.start < 0 || next.duration <= 0) return {};
    if (state.segments.some((seg) => seg.id !== id && seg.type === 'subtitle' && (seg.track || 'S1') === (next.track || 'S1') && next.start < seg.start + seg.duration && next.start + next.duration > seg.start)) return {};
    return { segments: state.segments.map((seg) => seg.id === id ? next : seg), playing: false };
  }),
  applySubtitleStyle: (id) => set((state) => {
    const source = state.segments.find((seg) => seg.id === id && seg.type === 'subtitle');
    if (!source) return {};
    return { segments: state.segments.map((seg) => seg.type === 'subtitle' && (seg.track || 'S1') === (source.track || 'S1') ? { ...seg, style: { ...source.style } } : seg), dirty: true, dirtyRev: state.dirtyRev + 1 };
  }),
  removeAsset: (assetId) => set((state) => {
    const matches = (segment) => String(segment.assetId) === String(assetId);
    const segments = state.segments.filter((segment) => !matches(segment));
    return {
      album: state.album.filter((asset) => String(asset.id) !== String(assetId)),
      libraryAssetIds: state.libraryAssetIds.filter((id) => String(id) !== String(assetId)),
      segments,
      selectedId: state.segments.some((segment) => segment.id === state.selectedId && matches(segment)) ? null : state.selectedId,
      playing: false, dirty: true, dirtyRev: state.dirtyRev + 1,
    };
  }),
  previewTrackSegment: (id, targetTrack, start, before, insertion = null) => rawSet((state) => {
    const base = before.segments;
    const source = base.find((segment) => segment.id === id);
    if (!source || !Number.isFinite(start) || start < 0) return {};
    const audio = source.type === 'audio';
    if (!(audio ? /^A[1-6]$/ : source.type === 'subtitle' ? /^S[1-6]$/ : /^V[1-6]$/).test(targetTrack)) return {};
    const laneOf = (segment) => segment.track || (segment.type === 'audio' ? 'A1' : segment.type === 'subtitle' ? 'S1' : 'V1');
    const sourceTrack = laneOf(source);
    const windowsFor = audio ? computeAudioWindows : source.type === 'subtitle' ? computeSubtitleWindows : computeVisualWindows;
    const snap = (track) => state.trackSettings[track]?.excludeGaps ?? false;
    const target = windowsFor(base, targetTrack).windows.filter((window) => window.seg.id !== id).sort((a, b) => a.start - b.start);
    if (!snap(targetTrack) && !insertion && target.some((window) => start < window.end && start + source.duration > window.start)) {
      return { segments: base, selectedId: id, playing: false };
    }
    const index = insertion?.index ?? target.findIndex((window) => start < window.end);
    target.splice(index < 0 ? target.length : index, 0, { seg: { ...source, track: targetTrack }, start });
    let cursor = 0;
    const arranged = target.map((window) => {
      const nextStart = snap(targetTrack) ? cursor : Math.max(cursor, window.start);
      cursor = nextStart + Number(window.seg.duration);
      return { ...window.seg, start: nextStart };
    });
    const sourceStarts = new Map();
    if (sourceTrack !== targetTrack) {
      let end = 0;
      windowsFor(base, sourceTrack).windows.filter((window) => window.seg.id !== id).forEach((window) => {
        sourceStarts.set(window.seg.id, snap(sourceTrack) ? end : window.start);
        end += Number(window.seg.duration);
      });
    }
    const segments = base.filter((segment) => segment.id !== id && laneOf(segment) !== targetTrack)
      .map((segment) => sourceStarts.has(segment.id) ? { ...segment, start: sourceStarts.get(segment.id) } : segment);
    segments.push(...arranged);
    const unchanged = base.length === segments.length && base.every((segment) => {
      const next = segments.find((item) => item.id === segment.id);
      const original = windowsFor(base, laneOf(segment)).windows.find((window) => window.seg.id === segment.id);
      return next && laneOf(next) === laneOf(segment) && (original?.start ?? segment.start) === (next.start ?? original?.start);
    });
    return { segments: unchanged ? base : segments, selectedId: id, playing: false };
  }),
  setTrackSetting: (track, patch) => set((state) => {
    const current = state.trackSettings[track] || {};
    const nextTrack = { ...current, ...patch };
    const nextSettings = { ...state.trackSettings, [track]: nextTrack };
    if (!/^[VAS][1-6]$/.test(track) || current.excludeGaps === nextTrack.excludeGaps || !nextTrack.excludeGaps) {
      if (JSON.stringify(current) === JSON.stringify(nextTrack)) return {};
      return { trackSettings: nextSettings, dirty: true, dirtyRev: state.dirtyRev + 1 };
    }
    let cursor = 0;
    const audio = computeAudioWindows(state.segments, track).windows.sort((a, b) => a.start - b.start);
    let audioIndex = 0;
    const segments = state.segments.map((segment) => {
      if ((segment.track || (segment.type === 'audio' ? 'A1' : segment.type === 'subtitle' ? 'S1' : 'V1')) !== track) return segment;
      const source = track.startsWith('A') ? audio[audioIndex++].seg : segment;
      const next = { ...source, start: cursor };
      cursor += Number(source.duration) || 0;
      return next;
    });
    return { trackSettings: nextSettings, segments, dirty: true, dirtyRev: state.dirtyRev + 1, playing: false };
  }),
  positionVisualSegment: (id, start) => set((state) => {
    const segments = moveVisualSegments(state, id, start);
    if (!segments) return {};
    return { segments, selectedId: id, dirty: true, dirtyRev: state.dirtyRev + 1, playing: false };
  }),
  previewVisualSegment: (id, start, before, insertion) => rawSet((state) => {
    // 每帧从拖拽前快照计算，避免预览位移累积，并允许拖回原点恢复原始排布。
    const base = before ? { ...state, segments: before.segments } : state;
    const segments = moveVisualSegments(base, id, start, insertion) ?? base.segments;
    return { segments, selectedId: id, playing: false };
  }),
  commitVisualSegment: (id, before) => rawSet((state) => {
    if (!before || state.segments === before.segments || JSON.stringify(state.segments) === JSON.stringify(before.segments)) return {};
    return { past: [...state.past, before].slice(-100), future: [], selectedId: id, dirty: true, dirtyRev: state.dirtyRev + 1 };
  }),

  init: async ({ projectId, compId, compositions, isCancelled = () => false } = {}) => {
    set({ exportModalOpen: false, exportState: { ...initialExportState } });
    if (!projectId) {
      set({ projectId: null, dirty: false, dirtyRev: 0, loaded: true, exportState: { ...initialExportState } });
      return;
    }
    const album = get().album;
    const albumById = new Map(album.map((a) => [a.id, a]));

    set({ projectId, loaded: false, past: [], future: [], mainTracks: { V: null, A: null, S: null }, trackSettings: { V1: { hidden: false, volume: 1, excludeGaps: true }, A1: { hidden: false, volume: 1, excludeGaps: false }, S1: { hidden: false, excludeGaps: false } } });
    try {
      const list = compositions ?? await apiGetCompositions(projectId);
      if (isCancelled()) return;
      let comp = null;
      if (compId) comp = list.find((c) => c.id === compId) || null;
      if (!comp) comp = list[0] || null;

      let segments = [];
      if (comp) {
        set({
          compositionId: comp.id,
          name: comp.name || '未命名成片',
          resolution: comp.resolution || '1080p',
          aspectRatio: comp.aspectRatio || comp.aspect_ratio || '16:9',
          libraryAssetIds: comp.libraryAssetIds ?? comp.library_asset_ids ?? [],
          trackSettings: { ...get().trackSettings, ...(comp.trackSettings ?? comp.track_settings ?? {}) },
        });
        segments = (Array.isArray(comp.timeline) ? comp.timeline : []).map((item) => {
          if (item.type === 'subtitle') return { id: randomId(), type: 'subtitle', text: item.text || '', name: item.text || '字幕', start: Math.max(0, Number(item.start) || 0), duration: Math.max(0.001, Number(item.duration) || 3), track: item.track || 'S1', offset: 0, style: { ...DEFAULT_SUBTITLE_STYLE, ...item.style } };
          const asset = albumById.get(item.clip_id);
          if (asset) {
            const type = item.type || assetTypeToSegment(asset);
            return {
              id: randomId(),
              assetId: asset.id,
              type,
              name: asset.name || '未命名素材',
              sourceUrl: asset.videoUrl || asset.fileUrl || null,
              posterUrl: asset.posterUrl || null,
              thumbnailUrl: asset.url || asset.thumbnailUrl || null,
              duration: clampNumber(item.duration, 0.5, 3600),
              offset: Number(item.offset) || 0,
              sourceDuration: asset.duration && Number(asset.duration) > 0 ? Number(asset.duration) : null,
              track: item.track || (type === 'audio' ? 'A1' : 'V1'),
              ...normalizeSegmentExtras(item, type),
            };
          }
          const type = item.type || 'image';
          return {
            id: randomId(),
            assetId: item.clip_id,
            type,
            name: String(item.clip_id || '未知素材'),
            sourceUrl: null,
            posterUrl: null,
            thumbnailUrl: null,
            duration: clampNumber(item.duration, 0.5, 3600),
            offset: Number(item.offset) || 0,
            sourceDuration: null,
            track: item.track || (type === 'audio' ? 'A1' : 'V1'),
            ...normalizeSegmentExtras(item, type),
          };
        });
      } else {
        // 后端已允许空时间线保存草稿，此处省略 timeline 以体现「新建空工程」
        const created = await apiCreateComposition(projectId, {
          name: '未命名成片',
          resolution: get().resolution,
          aspectRatio: get().aspectRatio,
        });
        if (isCancelled()) return;
        set({ compositionId: created.id, name: created.name || '未命名成片', libraryAssetIds: [] });
      }
      set({ segments, selectedId: null, dirty: false, dirtyRev: 0, saving: false, loaded: true, cursor: 0, playing: false });
    } catch (err) {
      if (isCancelled()) return;
      console.error('[compositionEditor] 初始化失败', err);
      set({ loaded: true });
    }
  },

  addAsset: (asset) => {
    if (!asset || !asset.id) return;
    if (asset.category === 'film') return;
    const type = assetTypeToSegment(asset);
    const sourceDuration = asset.duration && Number(asset.duration) > 0 ? Number(asset.duration) : null;
    const segment = {
      id: randomId(),
      assetId: asset.id,
      type,
      name: asset.name || '未命名素材',
      sourceUrl: asset.videoUrl || asset.fileUrl || null,
      posterUrl: asset.posterUrl || null,
      thumbnailUrl: asset.url || asset.thumbnailUrl || null,
      duration: clampNewDuration(asset),
      offset: 0,
      sourceDuration,
      speed: 1, // 倍速默认 1（图片恒 1）
      transition: type === 'image' ? 'none' : undefined, // 显式关闭后端默认转场
      track: get().mainTracks[type === 'audio' ? 'A' : type === 'subtitle' ? 'S' : 'V'] || (type === 'audio' ? 'A1' : type === 'subtitle' ? 'S1' : 'V1'),
    };
    set((state) => ({
      segments: [...state.segments, segment],
      selectedId: segment.id,
      dirty: true,
      dirtyRev: state.dirtyRev + 1,
      playing: false,
    }));
  },

  deleteTrack: (track) =>
    set((state) => {
      if (getTrackDeletionState(state.segments, state.trackSettings, track).reason) return {};
      const segments = state.segments.filter((segment) => segmentTrack(segment) !== track);
      const trackSettings = { ...state.trackSettings };
      delete trackSettings[track];
      return {
        segments, trackSettings,
        mainTracks: { ...state.mainTracks, [track[0]]: state.mainTracks[track[0]] === track ? null : state.mainTracks[track[0]] },
        selectedId: segments.some((segment) => segment.id === state.selectedId) ? state.selectedId : null,
        dirty: true, dirtyRev: state.dirtyRev + 1, playing: false,
      };
    }),

  removeSegment: (id) =>
    set((state) => ({
      segments: state.segments.filter((s) => s.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
      dirty: true,
      dirtyRev: state.dirtyRev + 1,
      playing: false,
    })),

  moveSegment: (id, dir) =>
    set((state) => {
      const index = state.segments.findIndex((s) => s.id === id);
      if (index < 0) return {};
      const target = dir === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= state.segments.length) return {};
      const next = [...state.segments];
      [next[index], next[target]] = [next[target], next[index]];
      return { segments: next, dirty: true, dirtyRev: state.dirtyRev + 1 };
    }),

  reorderSegment: (id, targetId, after = false) => set((state) => {
    const source = state.segments.find((segment) => segment.id === id);
    const target = state.segments.find((segment) => segment.id === targetId);
    if (!source || !target || id === targetId) return {};
    const sameTrack = (segment) => source.type === 'audio'
      ? segment.type === 'audio' : ['video', 'image'].includes(segment.type);
    if (!sameTrack(source) || !sameTrack(target)) return {};
    const track = state.segments.filter(sameTrack);
    const reordered = track.filter((segment) => segment.id !== id);
    reordered.splice(reordered.findIndex((segment) => segment.id === targetId) + Number(after), 0, source);
    if (reordered.every((segment, index) => segment.id === track[index].id)) return {};
    const audioWindows = computeAudioWindows(state.segments).windows;
    let start = source.type === 'audio' ? Math.min(...audioWindows.map((window) => window.start)) : 0;
    let index = 0;
    const segments = state.segments.map((segment) => {
      if (!sameTrack(segment)) return segment;
      const next = reordered[index++];
      if (source.type !== 'audio') return next;
      const placed = { ...next, start };
      start += Number(next.duration) || 0;
      return placed;
    });
    if (source.type !== 'audio' && state.trackSettings.V1?.excludeGaps) {
      let cursor = 0;
      const compacted = segments.map((segment) => {
        if (segment.type !== 'video' && segment.type !== 'image') return segment;
        const next = { ...segment, start: cursor };
        cursor += Number(segment.duration) || 0;
        return next;
      });
      return { segments: compacted, selectedId: id, dirty: true, dirtyRev: state.dirtyRev + 1, playing: false };
    }
    return { segments, selectedId: id, dirty: true, dirtyRev: state.dirtyRev + 1, playing: false };
  }),

  positionAudioSegment: (id, start) => set((state) => {
    const segments = moveAudioSegments(state, id, start);
    if (!segments) return {};
    return { segments, selectedId: id, dirty: true, dirtyRev: state.dirtyRev + 1, playing: false };
  }),
  previewAudioSegment: (id, start, before) => rawSet((state) => {
    const base = before ? { ...state, segments: before.segments } : state;
    const segments = moveAudioSegments(base, id, start) ?? base.segments;
    return { segments, selectedId: id, playing: false };
  }),
  commitAudioSegment: (id, before) => rawSet((state) => {
    if (!before || state.segments === before.segments || JSON.stringify(state.segments) === JSON.stringify(before.segments)) return {};
    return { past: [...state.past, before].slice(-100), future: [], selectedId: id, dirty: true, dirtyRev: state.dirtyRev + 1 };
  }),

  previewAudioVolume: (id, value) => rawSet((state) => {
    if (!Number.isFinite(value)) return {};
    const volume = Math.max(0, Math.min(2, value));
    return { segments: state.segments.map((segment) => segment.id === id && segment.type === 'audio'
      && (segment.volume ?? 1) !== volume ? { ...segment, volume } : segment) };
  }),
  commitAudioVolume: (before) => rawSet((state) => {
    if (!before || state.segments.every((segment, index) => (segment.volume ?? 1) === (before.segments[index]?.volume ?? 1))) return {};
    return { past: [...state.past, before].slice(-100), future: [], dirty: true, dirtyRev: state.dirtyRev + 1 };
  }),

  setSegmentInPoint: (id) => set((state) => {
    const windows = [...computeVisualWindows(state.segments).windows, ...computeAudioWindows(state.segments).windows];
    const window = windows.find((item) => item.seg.id === id);
    if (!window || !['video', 'audio'].includes(window.seg.type)
      || state.cursor <= window.start || state.cursor >= window.end) return {};
    const source = window.seg;
    const offset = (Number(source.offset) || 0) + (state.cursor - window.start) * segmentSpeedOf(source);
    const remaining = Number(source.sourceDuration) > 0
      ? (Number(source.sourceDuration) - offset) / segmentSpeedOf(source)
      : Number(source.duration);
    // 不回退用户选定的入点，也不把不足最小时长的尾部强行扩展到源文件之外。
    if (remaining < 0.5) return {};
    const duration = Math.min(Number(source.duration), remaining);
    return {
      segments: state.segments.map((segment) => segment.id === id ? { ...segment, offset, duration } : segment),
      cursor: window.start, playing: false, dirty: true, dirtyRev: state.dirtyRev + 1,
    };
  }),

  updateSegment: (id, patch) =>
    set((state) => {
      const segments = state.segments.map((seg) => {
        if (seg.id !== id) return seg;
        let next = { ...seg, ...patch, offset: seg.type === 'image' ? 0 : (patch.offset ?? seg.offset ?? 0) }; // 图片恒无 offset
        // 时长 / offset 相互约束，收敛两轮
        let dc = durationClampOf(next);
        let oc = offsetClampOf(next);
        next.duration = clampNumber(next.duration, dc.min, dc.max);
        next.offset = clampNumber(next.offset || 0, oc.min, oc.max);
        dc = durationClampOf(next);
        next.duration = clampNumber(next.duration, dc.min, dc.max);
        return next;
      });
      return { segments, dirty: true, dirtyRev: state.dirtyRev + 1, playing: false };
    }),

  select: (id) => set({ selectedId: id }),

  /** 设置片段倍速（仅 video/audio；图片恒 1 不可设置）。保持源窗口不变重算时间线时长 */
  setSpeed: (id, speed) => {
    const num = Number(speed);
    if (!Number.isFinite(num) || num <= 0) return;
    const seg = get().segments.find((s) => s.id === id);
    if (!seg || seg.type === 'image') return;
    const nextSpeed = clampNumber(num, 0.5, 4);
    const prevSpeed = segmentSpeedOf(seg);
    if (nextSpeed === prevSpeed) return;
    // 源窗口 = duration × 旧speed，新 duration = 源窗口 ÷ 新speed（再经 clamp 收敛）
    const sourceWindow = (Number(seg.duration) || 0) * prevSpeed;
    get().updateSegment(id, { speed: nextSpeed, duration: sourceWindow / nextSpeed });
  },

  /** 分离视频段原声：原视频关闭音频，在 A1 生成对齐的独立音频段。 */
  detachAudio: (segmentId) => {
    const state = get();
    const seg = state.segments.find((s) => s.id === segmentId);
    if (!seg || seg.type !== 'video' || seg.hasAudio === false || state.hasDetachedAudio(segmentId)) return;
    // 视频段当前时间线起点（V1 串行窗口）
    const { windows } = computeVisualWindows(state.segments);
    const win = windows.find((w) => w.seg.id === segmentId);
    if (!win) return;
    const audioSegment = {
      id: randomId(),
      assetId: seg.assetId,
      type: 'audio',
      name: `${seg.name || '视频片段'}·音频`,
      sourceUrl: seg.sourceUrl,
      posterUrl: seg.posterUrl || null,
      thumbnailUrl: seg.thumbnailUrl || null,
      duration: Number(seg.duration) || 0,
      offset: Number(seg.offset) || 0,
      sourceDuration: seg.sourceDuration ?? null,
      speed: segmentSpeedOf(seg),
      start: win.start, // 显式时间线起点，与视频段对齐
      track: 'A1',
    };
    set((st) => {
      // 追加到 A1 区域（最后一个音频段之后），保持 V1 顺序不变
      let insertAt = st.segments.length;
      for (let i = st.segments.length - 1; i >= 0; i -= 1) {
        if (st.segments[i].type === 'audio') {
          insertAt = i + 1;
          break;
        }
      }
      const next = st.segments.map((segment) => segment.id === segmentId ? { ...segment, hasAudio: false } : segment);
      next.splice(insertAt, 0, audioSegment);
      return { segments: next, dirty: true, dirtyRev: st.dirtyRev + 1, playing: false };
    });
  },

  /** 判定视频段是否已分离过音频：A1 存在同 assetId 且时间线起点对齐（容差 0.05s）的音频段 */
  hasDetachedAudio: (segmentId) => {
    const state = get();
    const seg = state.segments.find((s) => s.id === segmentId);
    if (!seg || seg.type !== 'video') return false;
    if (seg.hasAudio === false) return true;
    const { windows } = computeVisualWindows(state.segments);
    const win = windows.find((w) => w.seg.id === segmentId);
    if (!win) return false;
    return state.segments.some((s) => (
      s.type === 'audio'
      && s.assetId === seg.assetId
      && Math.abs((Number(s.start) || 0) - win.start) < 0.05
    ));
  },

  /** 时间线缩放（pxPerSecond，钳制 4~240；会话级状态，不持久化、不计 dirty） */
  setZoom: (value) =>
    set((state) => {
      const num = Number(value);
      if (!Number.isFinite(num)) return {};
      const next = clampNumber(num, 4, 240);
      if (next === state.zoom) return {};
      return { zoom: next };
    }),

  setName: (name) =>
    set((state) => {
      if (name === state.name) return {};
      return { name, dirty: true, dirtyRev: state.dirtyRev + 1 };
    }),

  setResolution: (resolution) =>
    set((state) => {
      if (resolution === state.resolution) return {};
      return { resolution, dirty: true, dirtyRev: state.dirtyRev + 1 };
    }),

  setAspectRatio: (aspectRatio) =>
    set((state) => {
      if (aspectRatio === state.aspectRatio) return {};
      return { aspectRatio, dirty: true, dirtyRev: state.dirtyRev + 1 };
    }),

  buildTimeline: () => serializeTimeline(get().segments),

  save: async () => {
    const state = get();
    const timeline = serializeTimeline(state.segments);
    const payload = {
      name: state.name,
      resolution: state.resolution,
      aspectRatio: state.aspectRatio,
      timeline,
      libraryAssetIds: state.libraryAssetIds,
      trackSettings: state.trackSettings,
    };
    const revAtStart = state.dirtyRev;
    set({ saving: true });
    try {
      let comp;
      if (!state.compositionId) {
        comp = await apiCreateComposition(state.projectId, payload);
      } else {
        comp = await apiUpdateComposition(state.projectId, state.compositionId, payload);
      }
      const current = get();
      const changedDuringSave = current.dirtyRev !== revAtStart;
      set({
        compositionId: comp.id,
        name: changedDuringSave ? current.name : comp.name || current.name,
        resolution: changedDuringSave ? current.resolution : comp.resolution || current.resolution,
        aspectRatio: changedDuringSave ? current.aspectRatio : comp.aspectRatio || comp.aspect_ratio || current.aspectRatio,
        // 保存期间又有新编辑时保持未保存态，由自动保存继续承接
        dirty: changedDuringSave,
        saving: false,
      });
      if (changedDuringSave) scheduleAutoSave();
      return comp;
    } catch (err) {
      set({ saving: false });
      throw err;
    }
  },

  startExport: async () => {
    const state = get();
    if (!state.projectId) return;
    if (state.exportSubmitting) return;
    const existing = useCompositionExportStore.getState().tasks.find((task) => task.projectId === state.projectId && task.compositionId === state.compositionId && task.status === 'exporting');
    if (existing) { set({ exportState: existing, exportModalOpen: true }); return; }
    set({ exportModalOpen: true });
    if (state.segments.length === 0) {
      set({ exportState: { ...initialExportState, status: 'failed', error: '请先添加素材再导出' } });
      return;
    }
    set({ exportSubmitting: true });
    // 先确保工程已保存
    try {
      await state.save();
    } catch (error) {
      set({ exportSubmitting: false, exportState: { ...initialExportState, status: 'failed', error: getErrorMessage(error, '保存工程失败，无法导出') } });
      return;
    }

    try {
      const compositionId = get().compositionId;
      const comp = await apiRenderComposition(state.projectId, compositionId);
      const taskId = comp.taskId || comp.task_id || null;
      if (!taskId) {
        set({ exportState: { ...initialExportState, status: 'failed', error: '导出任务未创建成功' } });
        return;
      }
      set({ playing: false });
      void useCompositionExportStore.getState().watch({ taskId, projectId: state.projectId, compositionId, name: state.name }, (task) => {
        if (get().projectId === task.projectId && get().compositionId === task.compositionId) set({ exportState: task });
      });
    } catch (error) {
      set({ exportState: { ...initialExportState, status: 'failed', error: getErrorMessage(error, '导出任务提交失败') } });
    } finally {
      set({ exportSubmitting: false });
    }
  },

  retryExport: () => {
    set({ exportState: { ...initialExportState } });
    get().startExport();
  },

  closeExport: () =>
    set({ exportModalOpen: false }),

  downloadExport: async () => {
    const st = get();
    const { assetId, outputUrl } = st.exportState;
    try {
      let blob;
      if (assetId) {
        blob = await apiDownloadAsset(assetId);
      } else if (outputUrl) {
        const res = await authFetch(outputUrl, { headers: { 'Content-Type': 'application/json' } });
        if (!res.ok) throw new Error(`下载失败（${res.status}）`);
        blob = await res.blob();
      } else {
        throw new Error('暂无可用文件');
      }
      triggerDownload(blob, `${st.name || '未命名成片'}.mp4`);
    } catch (err) {
      set((state) => ({
        exportState: {
          ...state.exportState,
          status: 'failed',
          error: getErrorMessage(err, '导出文件下载失败'),
        },
      }));
    }
  },

  resetPreview: () => set({ cursor: 0, playing: false }),

  play: () =>
    set((state) => {
      const total = computeTotalDuration(state.segments);
      if (total <= 0) return { playing: false };
      // 已在末尾则从头播放
      if (state.cursor >= total) return { cursor: 0, playing: true };
      return { playing: true };
    }),

  pause: () => set({ playing: false }),

  seek: (time) =>
    set((state) => {
      const total = computeTotalDuration(state.segments);
      const next = clampNumber(time, 0, total);
      return { cursor: next };
    }),

  onCursorTick: (time) =>
    set({ cursor: clampNumber(time, 0, Number.MAX_SAFE_INTEGER) }),
});
});

// ── 自动保存（防抖）───────────────────────────────────────────────────────────
// 任何置 dirty 的编辑操作停滞后 AUTO_SAVE_DELAY 自动落盘，无需手动点「保存草稿」。
// 保存失败时记录 dirtyRev，避免在无新修改时无限重试；下一次编辑会自动恢复自动保存。
const AUTO_SAVE_DELAY = 1200;

let autoSaveTimer = null;
let autoSaveFailedRev = null;

function scheduleAutoSave() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(runAutoSave, AUTO_SAVE_DELAY);
}

function runAutoSave() {
  const st = useCompositionEditorStore.getState();
  if (!st.dirty || st.saving) return;
  st.save().catch(() => {
    // 失败不自动重试：等待用户再次产生新修改，或手动点「保存草稿」
    autoSaveFailedRev = useCompositionEditorStore.getState().dirtyRev;
  });
}

useCompositionEditorStore.subscribe((state, prev) => {
  if (state.dirtyRev === prev.dirtyRev) return; // 无新编辑，跳过（含 saving/光标等非编辑变化）
  if (!state.dirty || state.saving) return;
  if (!state.projectId || !state.loaded) return;
  if (autoSaveFailedRev === state.dirtyRev) return; // 上次自动保存失败，等新修改再试
  scheduleAutoSave();
});

function randomId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `seg_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
