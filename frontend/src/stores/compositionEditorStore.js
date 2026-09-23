import { create } from 'zustand';
import {
  apiGetCompositions,
  apiCreateComposition,
  apiUpdateComposition,
  apiRenderComposition,
  invalidateCompositionDependents,
} from '../api/compositions';
import { apiGetAssetTask, subscribeAssetTaskEvents } from '../api/tasks';
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
 * transition：图片段转场（'fade' | 'none'，默认 'fade'，仅 image 段输出）。
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
export function computeVisualWindows(segments = []) {
  const windows = [];
  let cursor = 0;
  segments.forEach((seg) => {
    if (seg?.type !== 'video' && seg?.type !== 'image') return;
    const duration = Math.max(0, Number(seg.duration) || 0);
    windows.push({ seg, start: cursor, end: cursor + duration, index: windows.length });
    cursor += duration;
  });
  return { windows, total: cursor };
}

/**
 * 计算 A1 音频段窗口：start = seg.start ?? 串行游标（尊重显式起点，允许间隙），
 * 游标推进到 start + duration。total 为 A1 最末端（各段 end 的最大值）。
 */
export function computeAudioWindows(segments = []) {
  const windows = [];
  let cursor = 0;
  let total = 0;
  segments.forEach((seg) => {
    if (seg?.type !== 'audio') return;
    const duration = Math.max(0, Number(seg.duration) || 0);
    const explicit = Number(seg?.start);
    const start = Number.isFinite(explicit) && explicit >= 0 ? explicit : cursor;
    const end = start + duration;
    windows.push({ seg, start, end, index: windows.length });
    cursor = end;
    if (end > total) total = end;
  });
  return { windows, total };
}

/** 工程总时长口径：max(V1 可视总长, A1 最末端)，供时间线宽度与进度条统一使用 */
export function computeTotalDuration(segments = []) {
  const visual = computeVisualWindows(segments);
  const audio = computeAudioWindows(segments);
  return Math.max(visual.total, audio.total);
}

/** 把片段序列化成后端时间线协议 */
export function serializeTimeline(segments = []) {
  const items = [];
  let vStart = 0;
  let aStart = 0;
  segments.forEach((seg) => {
    const duration = Math.max(0, Number(seg.duration) || 0);
    const track = seg?.type === 'audio' ? 'A1' : 'V1';
    let start;
    if (track === 'A1') {
      // 音频段允许显式 start（对齐分离音频位置）；尊重显式值不钳制，
      // 显式 start 早于游标造成重叠时由后端保存校验暴露错误。
      const explicit = Number(seg?.start);
      start = Number.isFinite(explicit) && explicit >= 0 ? explicit : aStart;
      aStart = start + duration;
    } else {
      start = vStart;
      vStart += duration;
    }
    const item = {
      type: seg?.type || 'image',
      clip_id: seg?.assetId,
      start,
      duration,
      offset: Number(seg?.offset) || 0,
      track,
    };
    // speed 仅 video/audio 段输出（图片恒 1，后端对 image 忽略 speed）
    if (seg?.type === 'video' || seg?.type === 'audio') {
      item.speed = segmentSpeedOf(seg);
    }
    // transition 仅图片段输出
    if (seg?.type === 'image') {
      item.transition = seg?.transition === 'none' ? 'none' : 'fade';
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
    return { speed: 1, transition: item?.transition === 'none' ? 'none' : 'fade' };
  }
  const speed = Number(item?.speed);
  const extras = { speed: Number.isFinite(speed) && speed > 0 ? clampNumber(speed, 0.5, 4) : 1 };
  if (type === 'audio') {
    const start = Number(item?.start);
    extras.start = Number.isFinite(start) && start >= 0 ? start : undefined;
  }
  return extras;
}

// ── 导出任务轮询（模块级，避免与 React 生命周期耦合） ─────────────────────────

let exportPollTimer = null;
let exportEventUnsub = null;

function clearExportPoll() {
  if (exportPollTimer) {
    clearInterval(exportPollTimer);
    exportPollTimer = null;
  }
  if (typeof exportEventUnsub === 'function') {
    exportEventUnsub();
    exportEventUnsub = null;
  }
}

function taskErrorText(task) {
  const results = Array.isArray(task?.results) ? task.results : [];
  const resultError = results.find((r) => r && r.success === false)?.error;
  return getErrorMessage(
    task?.error_msg || task?.errorMsg || task?.error || resultError,
    '导出失败，请稍后重试',
  );
}

// ── Store ───────────────────────────────────────────────────────────────────

const initialExportState = {
  status: 'idle',
  progress: 0,
  taskId: null,
  assetId: null,
  outputUrl: null,
  error: null,
};

export const useCompositionEditorStore = create((set, get) => ({
  projectId: null,
  compositionId: null,
  name: '未命名成片',
  segments: [],
  selectedId: null,
  resolution: '1080p',
  aspectRatio: '16:9',
  dirty: false,
  dirtyRev: 0, // 每次置 dirty 的编辑自增，自动保存据此识别「有新修改」并防重复请求
  saving: false,
  loaded: false,
  album: [],
  exportState: { ...initialExportState },
  playing: false,
  cursor: 0,
  zoom: 24, // 时间线缩放：pxPerSecond（会话级，不持久化）

  loadAlbum: (assets) => set({ album: Array.isArray(assets) ? assets : [] }),

  init: async ({ projectId, compId } = {}) => {
    if (!projectId) {
      set({ projectId: null, dirty: false, dirtyRev: 0, loaded: true, exportState: { ...initialExportState } });
      return;
    }
    const album = get().album;
    const albumById = new Map(album.map((a) => [a.id, a]));

    set({ projectId, loaded: false });
    try {
      const list = await apiGetCompositions(projectId);
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
        });
        segments = (Array.isArray(comp.timeline) ? comp.timeline : []).map((item) => {
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
        set({ compositionId: created.id, name: created.name || '未命名成片' });
      }
      set({ segments, selectedId: null, dirty: false, dirtyRev: 0, saving: false, loaded: true, cursor: 0, playing: false });
    } catch (err) {
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
      transition: type === 'image' ? 'fade' : undefined, // 转场仅图片段
      track: type === 'audio' ? 'A1' : 'V1',
    };
    set((state) => ({
      segments: [...state.segments, segment],
      selectedId: segment.id,
      dirty: true,
      dirtyRev: state.dirtyRev + 1,
      playing: false,
    }));
  },

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

  /** 设置图片段转场（'fade' | 'none'，仅 image 段可设） */
  setTransition: (id, transition) =>
    set((state) => {
      const value = transition === 'none' ? 'none' : 'fade';
      let changed = false;
      const segments = state.segments.map((seg) => {
        if (seg.id !== id || seg.type !== 'image') return seg;
        if ((seg.transition || 'fade') === value) return seg;
        changed = true;
        return { ...seg, transition: value };
      });
      return changed ? { segments, dirty: true, dirtyRev: state.dirtyRev + 1 } : {};
    }),

  /** 分离视频段原声：在 A1 生成对齐该视频段的音频段（视频段本身不变） */
  detachAudio: (segmentId) => {
    const state = get();
    const seg = state.segments.find((s) => s.id === segmentId);
    if (!seg || seg.type !== 'video') return;
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
      const next = [...st.segments];
      next.splice(insertAt, 0, audioSegment);
      return { segments: next, dirty: true, dirtyRev: st.dirtyRev + 1, playing: false };
    });
  },

  /** 判定视频段是否已分离过音频：A1 存在同 assetId 且时间线起点对齐（容差 0.05s）的音频段 */
  hasDetachedAudio: (segmentId) => {
    const state = get();
    const seg = state.segments.find((s) => s.id === segmentId);
    if (!seg || seg.type !== 'video') return false;
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
        name: comp.name || current.name,
        resolution: comp.resolution || current.resolution,
        aspectRatio: comp.aspectRatio || comp.aspect_ratio || current.aspectRatio,
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
    if (state.segments.length === 0) {
      set({ exportState: { ...initialExportState, status: 'failed', error: '请先添加素材再导出' } });
      return;
    }
    // 先确保工程已保存
    try {
      await state.save();
    } catch {
      set({ exportState: { ...initialExportState, status: 'failed', error: '保存工程失败，无法导出' } });
      return;
    }

    clearExportPoll();
    try {
      const comp = await apiRenderComposition(get().projectId, get().compositionId);
      const taskId = comp.taskId || comp.task_id || null;
      if (!taskId) {
        set({ exportState: { ...initialExportState, status: 'failed', error: '导出任务未创建成功' } });
        return;
      }
      set({ exportState: { ...initialExportState, status: 'exporting', progress: 0, taskId }, playing: false });

      const poll = async () => {
        const current = get().exportState;
        if (current.status !== 'exporting') return;
        let task;
        try {
          task = await apiGetAssetTask(current.taskId);
        } catch {
          return; // 瞬时失败，继续轮询
        }
        const status = String(task?.status || '').trim().toLowerCase();
        const progress = Number(task?.progress ?? task?.progress_percent ?? 0) || 0;

        if (['completed', 'success', 'done', 'partial'].includes(status)) {
          clearExportPoll();
          const result = (Array.isArray(task?.results) && task.results[0]) || {};
          const assetId = result?.asset_id || result?.assetId || task?.asset_id || null;
          const taskUrl = result?.url || task?.output_url || task?.outputUrl || null;
          try {
            await invalidateCompositionDependents(get().projectId);
          } catch { /* 失效失败不阻断终态 */ }
          let outputUrl = taskUrl;
          try {
            const list = await apiGetCompositions(get().projectId);
            const found = (list || []).find((c) => c.id === get().compositionId);
            if (found) {
              outputUrl = found.outputUrl || found.output_url || taskUrl;
              if (found.name && found.name !== get().name) set({ name: found.name });
            }
          } catch { /* 详情刷新失败保留任务 URL */ }
          set({
            exportState: {
              ...initialExportState,
              status: 'completed',
              progress: 100,
              taskId: current.taskId,
              assetId,
              outputUrl,
              error: null,
            },
          });
          return;
        }

        if (['failed', 'cancelled', 'expired', 'error'].includes(status)) {
          clearExportPoll();
          set({
            exportState: {
              ...initialExportState,
              status: 'failed',
              progress,
              taskId: current.taskId,
              error: taskErrorText(task),
            },
          });
          return;
        }

        // 进行中
        set((s) => ({ exportState: { ...s.exportState, progress } }));
      };

      poll();
      exportPollTimer = setInterval(poll, 2500);
      // 事件优先回读，加速终态收敛；失败不阻塞低频轮询
      try {
        exportEventUnsub = subscribeAssetTaskEvents(taskId, () => poll());
      } catch { /* SSE 不可用时走低频轮询 */ }
    } catch {
      clearExportPoll();
      set({ exportState: { ...initialExportState, status: 'failed', error: '导出任务提交失败' } });
    }
  },

  retryExport: () => {
    clearExportPoll();
    set({ exportState: { ...initialExportState } });
    get().startExport();
  },

  closeExport: () =>
    set((state) => ({ exportState: { ...state.exportState, status: 'idle' } })),

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
      const { total } = computeVisualWindows(state.segments);
      if (total <= 0) return { playing: false };
      // 已在末尾则从头播放
      if (state.cursor >= total) return { cursor: 0, playing: true };
      return { playing: true };
    }),

  pause: () => set({ playing: false }),

  seek: (time) =>
    set((state) => {
      const { total } = computeVisualWindows(state.segments);
      const next = clampNumber(time, 0, total);
      return { cursor: next };
    }),

  onCursorTick: (time) =>
    set({ cursor: clampNumber(time, 0, Number.MAX_SAFE_INTEGER) }),
}));

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
