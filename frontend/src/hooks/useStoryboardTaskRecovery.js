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
  ownerId,
  captureGenerationScope,
  episode,
  pollTask,
  showToast,
  setIsGenerating,
  setEpisodeGenerationError,
  beginMediaTask,
  addPendingCandidate,
  removePendingCandidate,
  setGenVideoHistoryMap,
  setGenImageHistoryMap,
  onStoryboardRecovered,
  onVideoRecovered,
  onImageRecovered,
}) {
  const episodeId = typeof episode === 'string' ? null : getEpisodeId(episode);
  const callbacksRef = useRef({});
  useEffect(() => {
    callbacksRef.current = {
      pollTask,
      showToast,
      setIsGenerating,
      setEpisodeGenerationError,
      beginMediaTask,
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
    beginMediaTask,
    addPendingCandidate,
    removePendingCandidate,
    setGenVideoHistoryMap,
    setGenImageHistoryMap,
    onStoryboardRecovered,
    onVideoRecovered,
    onImageRecovered,
  ]);

  useEffect(() => {
    if (!projectId || !episodeId) return;

    let pending;
    try {
      pending = getPendingTasks(projectId, episodeId).filter((task) => (
        ownerId && String(task.ownerId) === String(ownerId)
      ));
    } catch (error) {
      callbacksRef.current.showToast(error.message, 'error');
      return;
    }
    if (pending.length === 0) return;
    let active = true;
    const callbacks = callbacksRef.current;
    const isScopeCurrent = captureGenerationScope();
    const isCurrent = () => active && isScopeCurrent();
    const finishMediaTask = (task, setHistory, finish) => {
      try { removePendingTask(projectId, task.taskId, ownerId); }
      catch (error) {
        callbacks.showToast(error.message, 'error');
        return;
      }
      callbacks.removePendingCandidate(task.taskId, task.shotId);
      setHistory((prev) => isCurrent() ? ({
        ...prev,
        [task.shotId]: (prev[task.shotId] ?? []).filter((item) => item.id !== `pending-resume-${task.taskId}`),
      }) : prev);
      finish();
    };

    const resumeStoryboard = async (task) => {
      let settled = false;
      callbacksRef.current.setIsGenerating(true);
      callbacksRef.current.setEpisodeGenerationError(false);
      try {
        if (task.submissionUnknown) throw new Error('提交结果尚未确认，请先核对后台任务，勿重复生成');
        const current = await apiGetTask(task.taskId);
        if (!isCurrent()) return;
        const finalTask = isStoryboardTaskInProgress(current)
          ? await callbacks.pollTask(task.taskId, undefined, 1000, isCurrent)
          : current;
        if (!isCurrent()) return;
        const partialFailure = ['partial', 'completed_with_errors', 'completed_with_failures'].includes(getStoryboardTaskStatus(finalTask))
          && Number(finalTask?.fail_count || finalTask?.failCount || 0) > 0;
        if (isFailedTask(finalTask) || partialFailure) {
          settled = true;
          throw new Error(getStoryboardTaskErrorMessage(finalTask) || '分镜生成失败');
        }
        if (!['completed', 'success', 'succeeded', 'done', 'partial'].includes(getStoryboardTaskStatus(finalTask))) {
          throw new Error('任务状态尚未确认，请重新进入当前分集恢复查询');
        }
        await callbacks.onStoryboardRecovered(episodeId, isCurrent);
        settled = isCurrent();
      } catch (error) {
        if (!isCurrent()) return;
        console.error('[StoryboardPage] 恢复重新分镜任务失败:', task.taskId, error);
        callbacksRef.current.setEpisodeGenerationError(true);
        callbacks.showToast(task.submissionUnknown ? error.message : settled ? error.message : '任务读取暂时失败，已保留任务，请重新进入当前分集恢复查询', 'error');
      } finally {
        if (isCurrent() && settled) {
          try {
            removePendingTask(projectId, task.taskId, ownerId);
            callbacks.setIsGenerating(false);
          } catch (error) {
            callbacks.setEpisodeGenerationError(true);
            callbacks.showToast(error.message, 'error');
          }
        }
      }
    };

    const resumeVideo = async (task) => {
      let settled = false;
      const finish = callbacks.beginMediaTask('video', task.shotId, task.taskId);
      callbacksRef.current.addPendingCandidate(task.shotId, 'video', task.taskId, `pending-${task.taskId}`);
      callbacksRef.current.setGenVideoHistoryMap((prev) => isCurrent() ? ({
        ...prev,
        [task.shotId]: [
          ...(prev[task.shotId] ?? []).filter((item) => item.id !== `pending-resume-${task.taskId}`),
          { url: null, settled: false, id: `pending-resume-${task.taskId}` },
        ],
      }) : prev);
      try {
        const current = await apiGetTask(task.taskId);
        if (!isCurrent()) return;
        const finalTask = isStoryboardTaskInProgress(current)
          ? await callbacks.pollTask(task.taskId, hasStoryboardVideoTaskResult, 1200, isCurrent)
          : current;
        if (!isCurrent()) return;
        if (isFailedTask(finalTask)) {
          settled = true;
          throw new Error(getStoryboardTaskErrorMessage(finalTask) || '视频生成失败');
        }
        if (getStoryboardTaskStatus(finalTask) === 'completed' || hasStoryboardVideoTaskResult(finalTask)) {
          const url = extractStoryboardVideoUrl(finalTask);
          if (url) {
            await callbacks.onVideoRecovered(task.shotId, url, task.taskId, isCurrent);
            if (!isCurrent()) return;
            settled = true;
          }
        }
        if (!settled) throw new Error('任务结果尚未确认');
      } catch (error) {
        if (!isCurrent()) return;
        console.error('[StoryboardPage] 恢复视频任务失败:', task.taskId, error);
        callbacks.showToast(settled ? error.message : '视频任务读取或候选保存暂时失败，已保留任务，请重新进入当前分集恢复查询', 'error');
      } finally {
        if (isCurrent() && settled) {
          finishMediaTask(task, callbacks.setGenVideoHistoryMap, finish);
        }
      }
    };

    const resumeImage = async (task) => {
      let settled = false;
      const finish = callbacks.beginMediaTask('image', task.shotId, task.taskId);
      callbacksRef.current.addPendingCandidate(task.shotId, 'image', task.taskId, `pending-${task.taskId}`);
      callbacksRef.current.setGenImageHistoryMap((prev) => isCurrent() ? ({
        ...prev,
        [task.shotId]: [
          ...(prev[task.shotId] ?? []).filter((item) => item.id !== `pending-resume-${task.taskId}`),
          { url: null, settled: false, id: `pending-resume-${task.taskId}` },
        ],
      }) : prev);
      try {
        const current = await apiGetTask(task.taskId);
        if (!isCurrent()) return;
        const finalTask = isStoryboardTaskInProgress(current)
          ? await callbacks.pollTask(task.taskId, hasStoryboardImageTaskResult, 1000, isCurrent)
          : current;
        if (!isCurrent()) return;
        if (isFailedTask(finalTask)) {
          settled = true;
          throw new Error(getStoryboardTaskErrorMessage(finalTask) || '图片生成失败');
        }
        const status = getStoryboardTaskStatus(finalTask);
        if (status === 'completed' || status === 'partial' || hasStoryboardImageTaskResult(finalTask)) {
          const url = extractStoryboardImageUrl(finalTask);
          if (url) {
            await callbacks.onImageRecovered(task.shotId, url, task.taskId, isCurrent);
            if (!isCurrent()) return;
            settled = true;
          }
        }
        if (!settled) throw new Error('任务结果尚未确认');
      } catch (error) {
        if (!isCurrent()) return;
        console.error('[StoryboardPage] 恢复图片任务失败:', task.taskId, error);
        callbacks.showToast(settled ? error.message : '图片任务读取或候选保存暂时失败，已保留任务，请重新进入当前分集恢复查询', 'error');
      } finally {
        if (isCurrent() && settled) {
          finishMediaTask(task, callbacks.setGenImageHistoryMap, finish);
        }
      }
    };

    pending.forEach((task) => {
      if (!isCurrent()) return;
      if (task.type === 'storyboard') resumeStoryboard(task);
      else if (task.type === 'video') resumeVideo(task);
      else if (task.type === 'image') resumeImage(task);
    });
    return () => { active = false; };
  }, [projectId, ownerId, episodeId, captureGenerationScope]);
}
