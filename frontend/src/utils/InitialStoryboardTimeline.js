import { getFinalizedStoryboardMedia, resolveFinalizedStoryboardAssets } from './FinalizedStoryboardAssets';

export function buildInitialStoryboardTimeline(assets) {
  let start = 0;
  return assets.flatMap((asset) => {
    const duration = Number(asset.duration);
    if (asset.asset_type !== 'video' || !asset.id || !asset.file_url
      || !Number.isFinite(duration) || duration < 0.5 || duration > 3600) return [];
    const segment = { type: 'video', clip_id: asset.id, track: 'V1', start, duration, offset: 0, speed: 1, has_audio: true, visual_transform: { version: 1, mode: 'cover' } };
    start = Math.round((start + duration) * 1000000) / 1000000;
    return [segment];
  });
}

export async function prepareInitialStoryboardTimeline(projectId, episodeId) {
  const finalized = (await getFinalizedStoryboardMedia(projectId))
    .filter(({ media, shot }) => (media.mediaType ?? media.media_type) === 'video'
      && (!episodeId || String(shot.episode_id ?? shot.episodeId) === String(episodeId)))
    .sort((a, b) => Number(a.shot.sort_order ?? a.shot.shot_number ?? 0) - Number(b.shot.sort_order ?? b.shot.shot_number ?? 0)
      || Number(a.shot.shot_number ?? 0) - Number(b.shot.shot_number ?? 0));
  const { assets } = await resolveFinalizedStoryboardAssets(projectId, finalized);
  const timeline = buildInitialStoryboardTimeline(assets);
  return { timeline, skipped: finalized.length - timeline.length };
}
