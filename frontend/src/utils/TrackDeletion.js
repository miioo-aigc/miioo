export function segmentTrack(segment) {
  return segment.track || (segment.type === 'audio' ? 'A1' : segment.type === 'subtitle' ? 'S1' : 'V1');
}

export function getTrackDeletionState(segments, trackSettings, track) {
  const clips = segments.filter((segment) => segmentTrack(segment) === track);
  const occupied = new Set(segments.map(segmentTrack));
  const exists = occupied.has(track) || Object.hasOwn(trackSettings, track);
  let reason = '';
  if (!/^[VAS][1-6]$/.test(track) || !exists) reason = '此轨道已不存在';
  else if (occupied.has(track) && occupied.size === 1) reason = '最后一条轨道无法删除';
  else if (!occupied.size && Object.keys(trackSettings).length <= 1) reason = '最后一条轨道无法删除';
  else if (clips.some((clip) => ['video', 'image'].includes(clip.type))
    && !segments.some((clip) => ['video', 'image'].includes(clip.type) && segmentTrack(clip) !== track)) {
    reason = '最后一条含视频或图片的轨道无法删除，保存工程需保留画面片段';
  }
  return { count: clips.length, reason };
}
