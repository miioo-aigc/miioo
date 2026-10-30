import { segmentTrack } from './TrackDeletion';

export function trackNumbers(state, prefix) {
  return [...new Set([1, ...Object.keys(state.trackSettings || {}).filter(t => t[0] === prefix).map(t => Number(t.slice(1))),
    ...state.segments.filter(s => segmentTrack(s)[0] === prefix).map(s => Number(segmentTrack(s).slice(1)))])].sort((a, b) => a - b);
}

/** 保持同类轨道顺序，补齐删除后留下的编号空缺。 */
export function compactTimelineTracks(state, includeDefault = true) {
  const names = new Set([...Object.keys(state.trackSettings || {}), ...state.segments.map(segmentTrack)]);
  if (includeDefault) ['V1', 'A1', 'S1'].forEach(t => names.add(t));
  const mapping = new Map();
  for (const prefix of ['V', 'A', 'S']) {
    [...names].filter(t => t[0] === prefix).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
      .forEach((t, i) => mapping.set(t, `${prefix}${i + 1}`));
  }
  const rename = t => mapping.get(t) || t;
  return {
    segments: state.segments.map(s => rename(segmentTrack(s)) === segmentTrack(s) ? s : { ...s, track: rename(segmentTrack(s)) }),
    trackSettings: Object.fromEntries(Object.entries(state.trackSettings || {}).map(([t, settings]) => [rename(t), settings])),
    mainTracks: Object.fromEntries(Object.entries(state.mainTracks || {}).map(([p, t]) => [p, t ? rename(t) : null])),
  };
}

/** 向上只能落在目标上边缘，向下只能落在目标下边缘；感应区不超过行高四分之一。 */
export function trackSwapBoundary(source, target, y) {
  const edge = target.top < source.top ? target.top : target.bottom;
  const tolerance = Math.min(12, (target.bottom - target.top) / 4);
  return Math.abs(y - edge) <= tolerance ? edge : null;
}

export function insertTimelineTrack(state, anchor, side) {
  if (!/^[VAS][1-6]$/.test(anchor) || !['above', 'below'].includes(side)) return null;
  const prefix = anchor[0];
  if (Math.max(...trackNumbers(state, prefix)) >= 6) return null;
  const at = Number(anchor.slice(1)) + ((prefix === 'A') === (side === 'below') ? 1 : 0);
  const rename = t => t[0] === prefix && Number(t.slice(1)) >= at ? `${prefix}${Number(t.slice(1)) + 1}` : t;
  const trackSettings = Object.fromEntries(Object.entries(state.trackSettings).map(([t, settings]) => [rename(t), settings]));
  trackNumbers(state, prefix).forEach(n => { trackSettings[rename(`${prefix}${n}`)] ??= { hidden: false, volume: 1, excludeGaps: false }; });
  trackSettings[`${prefix}${at}`] = { hidden: false, volume: 1, excludeGaps: false, keepEmptyUntilUsed: true };
  return { segments: state.segments.map(s => ({ ...s, track: rename(segmentTrack(s)) })), trackSettings,
    mainTracks: Object.fromEntries(Object.entries(state.mainTracks).map(([p, t]) => [p, t ? rename(t) : null])) };
}

export function swapTimelineTracks(state, source, target) {
  if (source === target || !/^[VAS][1-6]$/.test(source) || !/^[VAS][1-6]$/.test(target) || source[0] !== target[0]) return null;
  if (state.trackSettings[source]?.locked || state.trackSettings[target]?.locked) return null;
  const rename = t => t === source ? target : t === target ? source : t;
  const trackSettings = { ...state.trackSettings, [source]: state.trackSettings[target] || {}, [target]: state.trackSettings[source] || {} };
  return { segments: state.segments.map(s => ({ ...s, track: rename(segmentTrack(s)) })), trackSettings,
    mainTracks: Object.fromEntries(Object.entries(state.mainTracks).map(([p, t]) => [p, t ? rename(t) : null])) };
}

/** 以拖动前窗口计算整组平移；返回null表示整组不允许落位。 */
export function moveTimelineSelection(state, windows, ids, deltaTime, visualRowDelta) {
  const chosen = new Set(ids);
  if (!ids.length || !Number.isFinite(deltaTime) || !Number.isInteger(visualRowDelta)) return null;
  const selected = windows.filter(w => chosen.has(w.seg.id));
  if (selected.length !== chosen.size) return null;
  const moved = selected.map(w => {
    const source = segmentTrack(w.seg);
    const number = Number(source.slice(1)) + (source[0] === 'A' ? visualRowDelta : -visualRowDelta);
    return { ...w, source, track: `${source[0]}${number}`, start: w.start + deltaTime, end: w.end + deltaTime };
  });
  if (moved.some(w => w.start < -1e-6 || !/^[VAS][1-6]$/.test(w.track)
    || !trackNumbers(state, w.track[0]).includes(Number(w.track.slice(1)))
    || state.trackSettings[w.source]?.locked || state.trackSettings[w.track]?.locked
    || state.trackSettings[w.source]?.hidden || state.trackSettings[w.track]?.hidden)) return null;
  if (moved.some(w => windows.some(other => !chosen.has(other.seg.id) && segmentTrack(other.seg) === w.track
    && w.start < other.end - 1e-6 && w.end > other.start + 1e-6))) return null;
  const positions = new Map(windows.map(w => [w.seg.id, w.start]));
  const changes = new Map(moved.map(w => [w.seg.id, { track: w.track, start: Math.max(0, w.start) }]));
  return state.segments.map(s => ({ ...s, start: positions.get(s.id) ?? s.start, ...changes.get(s.id) }))
    .sort((a, b) => segmentTrack(a).localeCompare(segmentTrack(b)) || (a.start || 0) - (b.start || 0));
}

/** 在指定边界插入轨道，并按原始轨间距补齐整组选区需要的轨道。 */
export function insertSelectionTracks(state, windows, ids, draggedId, deltaTime, insertion) {
  const selected = new Set(ids);
  const source = state.segments.find(s => s.id === draggedId);
  if (!source || !selected.has(draggedId) || !Number.isFinite(deltaTime)) return null;
  let plan = insertTimelineTrack(state, insertion.anchor, insertion.side);
  if (!plan) return null;
  const prefix = segmentTrack(source)[0];
  const at = Number(insertion.anchor.slice(1)) + ((prefix === 'A') === (insertion.side === 'below') ? 1 : 0);
  const visualDelta = (at - Number(segmentTrack(source).slice(1))) * (prefix === 'A' ? 1 : -1);
  const targets = new Map();
  for (const s of state.segments.filter(s => selected.has(s.id))) {
    const track = segmentTrack(s);
    if (state.trackSettings[track]?.locked || state.trackSettings[track]?.hidden) return null;
    targets.set(s.id, { prefix: track[0], number: Number(track.slice(1)) + visualDelta * (track[0] === 'A' ? 1 : -1) });
  }
  if (targets.size !== selected.size) return null;
  for (const p of ['V', 'A', 'S']) {
    const group = [...targets.values()].filter(t => t.prefix === p);
    if (!group.length) continue;
    const low = Math.max(0, 1 - Math.min(...group.map(t => t.number)));
    const max = Math.max(...trackNumbers(plan, p));
    const high = Math.max(max, ...group.map(t => t.number)) + low;
    if (high > 6) return null;
    const rename = t => t[0] === p ? p + (Number(t.slice(1)) + low) : t;
    plan = { segments: plan.segments.map(s => ({ ...s, track: rename(segmentTrack(s)) })),
      trackSettings: Object.fromEntries(Object.entries(plan.trackSettings).map(([t, settings]) => [rename(t), settings])),
      mainTracks: Object.fromEntries(Object.entries(plan.mainTracks).map(([key, t]) => [key, t ? rename(t) : null])) };
    for (let n = 1; n <= high; n++) plan.trackSettings[p + n] ??= { hidden: false, volume: 1, excludeGaps: false };
    group.forEach(t => { t.number += low; });
  }
  const timing = new Map(windows.map(w => [w.seg.id, w]));
  plan.segments = plan.segments.map(s => {
    const w = timing.get(s.id);
    const target = targets.get(s.id);
    return { ...s, start: w?.start ?? s.start, ...(target ? { track: target.prefix + target.number, start: (w?.start ?? 0) + deltaTime } : {}) };
  });
  for (const s of plan.segments.filter(s => selected.has(s.id))) {
    const w = timing.get(s.id);
    if (!w || s.start < 0 || plan.trackSettings[s.track]?.locked || plan.trackSettings[s.track]?.hidden) return null;
    if (plan.segments.some(other => !selected.has(other.id) && segmentTrack(other) === s.track
      && s.start < other.start + (timing.get(other.id).end - timing.get(other.id).start) - 1e-6
      && s.start + w.end - w.start > other.start + 1e-6)) return null;
  }
  return plan;
}

/** 默认1号轨常驻；手建空轨首次使用后取消保留，普通空轨清理。 */
export function cleanEmptyTimelineTracks(state) {
  const occupied = new Set(state.segments.map(segmentTrack));
  const trackSettings = {};
  for (const [track, settings] of Object.entries(state.trackSettings || {})) {
    if (occupied.has(track)) {
      const next = { ...settings };
      delete next.keepEmptyUntilUsed;
      trackSettings[track] = next;
    } else if (track.endsWith('1') || settings.keepEmptyUntilUsed) trackSettings[track] = settings;
  }
  const next = { segments: state.segments, trackSettings, mainTracks: Object.fromEntries(Object.entries(state.mainTracks || {}).map(([prefix, track]) =>
    [prefix, track && (occupied.has(track) || trackSettings[track]) ? track : null])) };
  return Object.keys(state.trackSettings || {}).some(track => !trackSettings[track]) ? compactTimelineTracks(next) : next;
}
