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
    let active = true;
    const callbacks = callbacksRef.current;
    const isCurrent = () => active;

    const resumeStoryboard = async (task) => {
      let settled = false;
      callbacksRef.current.setIsGenerating(true);
      callbacksRef.current.setEpisodeGenerationError(false);
      try {
        const current = await apiGetTask(task.taskId);
        if (!active) return;
        const finalTask = isStoryboardTaskInProgress(current)
          ? await callbacks.pollTask(task.taskId)
          : current;
        if (!active) return;
        if (isFailedTask(finalTask)) {
          settled = true;
          throw new Error(getStoryboardTaskErrorMessage(finalTask) || '分镜生成失败');
        }
        if (!['completed', 'partial'].includes(getStoryboardTaskStatus(finalTask))) {
          throw new Error('任务状态尚未确认，请重新进入当前分集恢复查询');
        }
        await callbacks.onStoryboardRecovered(episodeId, isCurrent);
        settled = active;
      } catch (error) {
        if (!active) return;
        console.error('[StoryboardPage] 恢复重新分镜任务失败:', task.taskId, error);
        callbacksRef.current.setEpisodeGenerationError(true);
        callbacks.showToast(settled ? getStoryboardTaskErrorMessage(error) : '任务读取暂时失败，已保留任务，请重新进入当前分集恢复查询', 'error');
      } finally {
        if (active && settled) {
          removePendingTask(projectId, task.taskId);
          callbacks.setIsGenerating(false);
        }
      }
    };

    const resumeVideo = async (task) => {
      let settled = false;
      callbacksRef.current.setGeneratingVideoShotIds((prev) => new Set([...prev, task.shotId]));
      callbacksRef.current.addPendingCandidate(task.shotId, 'video', task.taskId, `pending-${task.taskId}`);
      callbacksRef.current.setGenVideoHistoryMap((prev) => ({
        ...prev,
        [task.shotId]: [{ url: null, settled: false, id: `pending-resume-${task.taskId}` }],
      }));
      try {
        const current = await apiGetTask(task.taskId);
        if (!active) return;
        const finalTask = isStoryboardTaskInProgress(current)
          ? await callbacks.pollTask(task.taskId, hasStoryboardVideoTaskResult, 1200)
          : current;
        if (!active) return;
        if (isFailedTask(finalTask)) {
          settled = true;
          throw new Error(getStoryboardTaskErrorMessage(finalTask) || '视频生成失败');
        }
        if (getStoryboardTaskStatus(finalTask) === 'completed' || hasStoryboardVideoTaskResult(finalTask)) {
          const url = extractStoryboardVideoUrl(finalTask);
          if (url) {
            await callbacks.onVideoRecovered(task.shotId, url);
            settled = true;
          }
        }
        if (!settled) throw new Error('任务结果尚未确认');
      } catch (error) {
        if (!active) return;
        console.error('[StoryboardPage] 恢复视频任务失败:', task.taskId, error);
        callbacks.showToast(settled ? error.message : '视频任务读取暂时失败，已保留任务，请重新进入当前分集恢复查询', 'error');
      } finally {
        if (active && settled) {
          removePendingTask(projectId, task.taskId);
          callbacks.removePendingCandidate(task.taskId, task.shotId);
          callbacks.setGeneratingVideoShotIds((prev) => {
            const next = new Set(prev);
            next.delete(task.shotId);
            return next;
          });
        }
      }
    };

    const resumeImage = async (task) => {
      let settled = false;
      callbacksRef.current.setGeneratingImageShotIds((prev) => new Set([...prev, task.shotId]));
      callbacksRef.current.addPendingCandidate(task.shotId, 'image', task.taskId, `pending-${task.taskId}`);
      callbacksRef.current.setGenImageHistoryMap((prev) => ({
        ...prev,
        [task.shotId]: [{ url: null, settled: false, id: `pending-resume-${task.taskId}` }],
      }));
      try {
        const current = await apiGetTask(task.taskId);
        if (!active) return;
        const finalTask = isStoryboardTaskInProgress(current)
          ? await callbacks.pollTask(task.taskId, hasStoryboardImageTaskResult)
          : current;
        if (!active) return;
        if (isFailedTask(finalTask)) {
          settled = true;
          throw new Error(getStoryboardTaskErrorMessage(finalTask) || '图片生成失败');
        }
        const status = getStoryboardTaskStatus(finalTask);
        if (status === 'completed' || status === 'partial' || hasStoryboardImageTaskResult(finalTask)) {
          const url = extractStoryboardImageUrl(finalTask);
          if (url) {
            await callbacks.onImageRecovered(task.shotId, url);
            settled = true;
          }
        }
        if (!settled) throw new Error('任务结果尚未确认');
      } catch (error) {
        if (!active) return;
        console.error('[StoryboardPage] 恢复图片任务失败:', task.taskId, error);
        callbacks.showToast(settled ? error.message : '图片任务读取暂时失败，已保留任务，请重新进入当前分集恢复查询', 'error');
      } finally {
        if (active && settled) {
          removePendingTask(projectId, task.taskId);
          callbacks.removePendingCandidate(task.taskId, task.shotId);
          callbacks.setGeneratingImageShotIds((prev) => {
            const next = new Set(prev);
            next.delete(task.shotId);
            return next;
          });
        }
      }
    };

    pending.forEach((task) => {
      if (task.type === 'storyboard') resumeStoryboard(task);
      else if (task.type === 'video') resumeVideo(task);
      else if (task.type === 'image') resumeImage(task);
    });
    return () => { active = false; };
  }, [projectId, episode]);
}
