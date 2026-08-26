import { useEffect, useRef } from 'react';
import { apiGetTask } from '../api/storyboard';
import { getEpisodeId } from '../components/storyboard/storyboardControlUtils';
import {
  extractStoryboardImageUrl,
  extractStoryboardVideoUrl,
  getStoryboardTaskStatus,
  getStoryboardTaskErrorMessage,
  hasStoryboardImageTaskResult,
  hasStoryboardVideoTaskResult,
  isStoryboardTaskInProgress,
} from '../utils/storyboardTaskAdapter';
import { getPendingTasks, removePendingTask } from '../utils/taskPersistence';

function isFailedTask(task) {
  return ['failed', 'error', 'cancelled', 'canceled'].includes(
    String(getStoryboardTaskStatus(task) || '').toLowerCase(),
  );
}

export default function useStoryboardTaskRecovery({
  projectId,
  episode,
  pollTask,
  showToast,
  setIsGenerating,
  setEpisodeGenerationError,
  setGeneratingVideoShotIds,
  setGeneratingImageShotIds,
  addPendingCandidate,
  removePendingCandidate,
  setGenVideoHistoryMap,
  setGenImageHistoryMap,
  onStoryboardRecovered,
  onVideoRecovered,
  onImageRecovered,
}) {
  const callbacksRef = useRef({});
  useEffect(() => {
    callbacksRef.current = {
      pollTask,
      showToast,
      setIsGenerating,
      setEpisodeGenerationError,
      setGeneratingVideoShotIds,
      setGeneratingImageShotIds,
      addPendingCandidate,
      removePendingCandidate,
      setGenVideoHistoryMap,
      setGenImageHistoryMap,
      onStoryboardRecovered,
      onVideoRecovered,
      onImageRecovered,
    };
  }, [
    pollTask,
    showToast,
    setIsGenerating,
    setEpisodeGenerationError,
    setGeneratingVideoShotIds,
    setGeneratingImageShotIds,
    addPendingCandidate,
    removePendingCandidate,
    setGenVideoHistoryMap,
    setGenImageHistoryMap,
    onStoryboardRecovered,
    onVideoRecovered,
    onImageRecovered,
  ]);

  useEffect(() => {
    if (!projectId || typeof episode === 'string') return;
    const episodeId = getEpisodeId(episode);
    if (!episodeId) return;

    const pending = getPendingTasks(projectId, episodeId);
    if (pending.length === 0) return;

    const resumeStoryboard = async (task) => {
      callbacksRef.current.setIsGenerating(true);
      callbacksRef.current.setEpisodeGenerationError(false);
      try {
        const current = await apiGetTask(task.taskId);
        const finalTask = isStoryboardTaskInProgress(current)
          ? await callbacksRef.current.pollTask(task.taskId)
          : current;
        if (isFailedTask(finalTask)) throw new Error(getStoryboardTaskErrorMessage(finalTask) || '分镜生成失败');
        await callbacksRef.current.onStoryboardRecovered(episodeId);
      } catch (error) {
        console.error('[StoryboardPage] 恢复重新分镜任务失败:', task.taskId, error);
        callbacksRef.current.setEpisodeGenerationError(true);
        callbacksRef.current.showToast(getStoryboardTaskErrorMessage(error) || '分镜生成失败，请稍后重试', 'error');
      } finally {
        removePendingTask(projectId, task.taskId);
        callbacksRef.current.setIsGenerating(false);
      }
    };

    const resumeVideo = async (task) => {
      callbacksRef.current.setGeneratingVideoShotIds((prev) => new Set([...prev, task.shotId]));
      callbacksRef.current.addPendingCandidate(task.shotId, 'video', task.taskId, `pending-${task.taskId}`);
      callbacksRef.current.setGenVideoHistoryMap((prev) => ({
        ...prev,
        [task.shotId]: [{ url: null, settled: false, id: `pending-resume-${task.taskId}` }],
      }));
      try {
        const current = await apiGetTask(task.taskId);
        const finalTask = isStoryboardTaskInProgress(current)
          ? await callbacksRef.current.pollTask(task.taskId, hasStoryboardVideoTaskResult, 1200)
          : current;
        if (getStoryboardTaskStatus(finalTask) === 'completed' || hasStoryboardVideoTaskResult(finalTask)) {
          const url = extractStoryboardVideoUrl(finalTask);
          if (url) await callbacksRef.current.onVideoRecovered(task.shotId, url);
        }
      } catch (error) {
        console.error('[StoryboardPage] 恢复视频任务失败:', task.taskId, error);
      } finally {
        removePendingTask(projectId, task.taskId);
        callbacksRef.current.removePendingCandidate(task.taskId, task.shotId);
        callbacksRef.current.setGeneratingVideoShotIds((prev) => {
          const next = new Set(prev);
          next.delete(task.shotId);
          return next;
        });
      }
    };

    const resumeImage = async (task) => {
      callbacksRef.current.setGeneratingImageShotIds((prev) => new Set([...prev, task.shotId]));
      callbacksRef.current.addPendingCandidate(task.shotId, 'image', task.taskId, `pending-${task.taskId}`);
      callbacksRef.current.setGenImageHistoryMap((prev) => ({
        ...prev,
        [task.shotId]: [{ url: null, settled: false, id: `pending-resume-${task.taskId}` }],
      }));
      try {
        const current = await apiGetTask(task.taskId);
        const finalTask = isStoryboardTaskInProgress(current)
          ? await callbacksRef.current.pollTask(task.taskId, hasStoryboardImageTaskResult)
          : current;
        const status = getStoryboardTaskStatus(finalTask);
        if (status === 'completed' || status === 'partial' || hasStoryboardImageTaskResult(finalTask)) {
          const url = extractStoryboardImageUrl(finalTask);
          if (url) await callbacksRef.current.onImageRecovered(task.shotId, url);
        }
      } catch (error) {
        console.error('[StoryboardPage] 恢复图片任务失败:', task.taskId, error);
      } finally {
        removePendingTask(projectId, task.taskId);
        callbacksRef.current.removePendingCandidate(task.taskId, task.shotId);
        callbacksRef.current.setGeneratingImageShotIds((prev) => {
          const next = new Set(prev);
          next.delete(task.shotId);
          return next;
        });
      }
    };

    pending.forEach((task) => {
      if (task.type === 'storyboard') resumeStoryboard(task);
      else if (task.type === 'video') resumeVideo(task);
      else if (task.type === 'image') resumeImage(task);
    });
  }, [projectId, episode]);
}
