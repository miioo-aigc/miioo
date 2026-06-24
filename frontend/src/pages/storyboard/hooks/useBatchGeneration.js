import { useState } from 'react';
import { apiGenerateStoryboardImage, apiGenerateStoryboardVideo, apiUpdateStoryboard } from '../../../api/storyboard';
import { pollTask, extractVideoUrlFromTask, extractImageUrlFromTask, hasImageTaskResult, hasVideoTaskResult } from '../../../utils/taskPolling';
import { normalizeImageUrl, toAbsoluteUrl } from '../../../utils/imageUrl';
import { getEpisodeId } from '../../../utils/episodeUtils';

export function useBatchGeneration({ projectId, episode, shots, setShots, projectRatio, showToast, onVideoGenerated, activeEpisodes }) {
  const [generatingImages, setGeneratingImages] = useState(false);
  const [generatingVideos, setGeneratingVideos] = useState(false);
  const [generatingImageShotIds, setGeneratingImageShotIds] = useState(new Set());
  const [generatingVideoShotIds, setGeneratingVideoShotIds] = useState(new Set());

 async function generateShotImage(shotId, { model, resolution, prompt, refImages }) {
    setGeneratingImageShotIds((prev) => new Set([...prev, shotId]));
    try {
     const taskResp = await apiGenerateStoryboardImage(projectId, shotId, {
       model,
       resolution,
       prompt,
       aspect_ratio: projectRatio,
       reference_images: (refImages || []).map((r) => toAbsoluteUrl(typeof r === 'string' ? r : r.url)).filter((url) => url && !url.toLowerCase().endsWith('.avif') && !url.includes('/derived/assets/')),
     });
     const task = await pollTask(taskResp.id, hasImageTaskResult);
     if (task.status === 'completed' || task.status === 'partial' || hasImageTaskResult(task)) {
       const imageUrl = extractImageUrlFromTask(task);
       if (imageUrl) {
         const normalizedUrl = normalizeImageUrl(imageUrl);
         setShots((prev) => prev.map((s) => s.id === shotId && !s.storyboardImage
           ? { ...s, storyboardImage: { id: normalizedUrl, url: normalizedUrl, name: 'generated.jpg', type: 'image/jpeg' } }
           : s
         ));
         return { url: normalizedUrl };
       }
     }
     throw new Error('生成失败，请重试');
    } finally {
      setGeneratingImageShotIds((prev) => { const next = new Set(prev); next.delete(shotId); return next; });
    }
 }

 async function generateShotVideo(shotId, { model, resolution, duration, sound, prompt, refImages, firstFrameUrl, lastFrameUrl, refVideoUrl, refAudioUrl }) {
    setGeneratingVideoShotIds((prev) => new Set([...prev, shotId]));
    try {
     const durationValue = (!duration) ? undefined : (isNaN(parseFloat(duration)) ? undefined : parseFloat(duration));
     const taskResp = await apiGenerateStoryboardVideo(projectId, shotId, {
       model,
       resolution,
       duration: durationValue,
       sound_effect: sound,
       prompt,
       ratio: projectRatio,
       reference_images: (refImages || []).map((r) => toAbsoluteUrl(typeof r === 'string' ? r : r.url)).filter((url) => url && !url.toLowerCase().endsWith('.avif') && !url.includes('/derived/assets/')),
       first_frame_url: toAbsoluteUrl(firstFrameUrl),
       last_frame_url: toAbsoluteUrl(lastFrameUrl),
       reference_video_url: toAbsoluteUrl(refVideoUrl),
       reference_audio_url: toAbsoluteUrl(refAudioUrl),
     });
     const task = await pollTask(taskResp.id, hasVideoTaskResult);
     const videoUrl = extractVideoUrlFromTask(task);
     if (videoUrl) {
       const normalizedUrl = normalizeImageUrl(videoUrl);
       setShots((prev) => {
         const updated = prev.map((s) => s.id === shotId && !s.storyboardVideo
           ? { ...s, storyboardVideo: { id: `vid-${shotId}`, url: normalizedUrl, name: 'generated.mp4', type: 'video/mp4' } }
           : s
         );
         const wasEmpty = !prev.find((s) => s.id === shotId)?.storyboardVideo;
         if (wasEmpty) {
           apiUpdateStoryboard(projectId, shotId, { video_url: normalizedUrl }).catch(console.error);
         }
         return updated;
       });
       return { url: normalizedUrl };
     }
     const failStatuses = ['failed', 'cancelled', 'canceled', 'expired', 'error'];
     if (failStatuses.includes(task.status) || (!task.result && !task.results?.length)) {
       const errMsg = task.error_msg || task.errorMsg || (Array.isArray(task.results) && task.results[0]?.error) || (task.status ? `任务状态: ${task.status}` : '');
       throw Object.assign(new Error(errMsg || '视频生成失败'), { status: task.status });
     }
     throw new Error('生成失败，请重试');
    } finally {
      setGeneratingVideoShotIds((prev) => { const next = new Set(prev); next.delete(shotId); return next; });
    }
 }

  async function startBatchGenImages(params) {
    if (generatingImages) return;
    setGeneratingImages(true);
    let successCount = 0, failCount = 0;
    for (const shot of shots) {
      setGeneratingImageShotIds((prev) => new Set([...prev, shot.id]));
      try {
        await generateShotImage(shot.id, { model: params.model, resolution: params.resolution, prompt: params.prompt, refImages: params.refImages });
        successCount++;
      } catch (err) {
        console.error('[BatchGen] 生成分镜图失败:', err);
        failCount++;
      } finally {
        setGeneratingImageShotIds((prev) => { const next = new Set(prev); next.delete(shot.id); return next; });
      }
    }
    setGeneratingImages(false);
    showToast(failCount > 0 ? `分镜图生成完成，成功 ${successCount} 个，失败 ${failCount} 个` : '分镜图生成完成', failCount > 0 ? 'warning' : 'success');
  }

  async function startBatchGenVideos(params) {
    if (generatingVideos) return;
    setGeneratingVideos(true);
    let successCount = 0, failCount = 0;
    for (const shot of shots) {
      setGeneratingVideoShotIds((prev) => new Set([...prev, shot.id]));
      try {
        await generateShotVideo(shot.id, { model: params.model, resolution: params.resolution, duration: params.duration, sound: params.sound, prompt: params.prompt, refImages: params.refImages });
        successCount++;
      } catch (err) {
        console.error('[BatchGen] 生成分镜视频失败:', err);
        failCount++;
      } finally {
        setGeneratingVideoShotIds((prev) => { const next = new Set(prev); next.delete(shot.id); return next; });
      }
    }
    setGeneratingVideos(false);
    onVideoGenerated?.(activeEpisodes.findIndex((ep) => getEpisodeId(ep) === getEpisodeId(episode)));
    showToast(failCount > 0 ? `分镜视频生成完成，成功 ${successCount} 个，失败 ${failCount} 个` : '分镜视频生成完成', failCount > 0 ? 'warning' : 'success');
  }

  return { generatingImages, generatingVideos, generatingImageShotIds, generatingVideoShotIds, startBatchGenImages, startBatchGenVideos, generateShotImage, generateShotVideo };
}
