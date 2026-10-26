import { useCallback, useEffect, useRef, useState } from 'react';
import { apiUpdateProfile, apiUploadAvatar } from '../api/user';
import { getAuthSessionGeneration } from '../api/request';
import { showGlobalToast } from '../stores/toastStore';

// 资料草稿独立于服务器回执；同会话的写入串行，只提交发生变化的字段。
export function useProfileAutosave(user, onUpdated) {
  const [name, setName] = useState(user.nickname ?? '');
  const [avatar, setAvatar] = useState(user.avatar_url ?? null);
  const confirmed = useRef({ nickname: user.nickname ?? '', avatar_url: user.avatar_url ?? null });
  const callback = useRef(onUpdated);
  const lifecycle = useRef(0);
  const mounted = useRef(true);
  const revisions = useRef({ nickname: 0, avatar_url: 0 });
  const queue = useRef(Promise.resolve());
  const preview = useRef(null);
  const inflight = useRef(null);
  useEffect(() => { callback.current = onUpdated; }, [onUpdated]);
  const clearPreview = useCallback(() => {
    if (preview.current) URL.revokeObjectURL(preview.current);
    preview.current = null;
  }, []);
  useEffect(() => {
    const session = lifecycle;
    mounted.current = true;
    return () => {
      mounted.current = false;
      session.current++;
      clearPreview();
      if (inflight.current === getAuthSessionGeneration()) showGlobalToast('warning', '资料请求已发送，关闭不能撤回，请重新打开核对保存结果。');
    };
  }, [clearPreview]);
  const capture = useCallback(() => {
    const version = lifecycle.current;
    const generation = getAuthSessionGeneration();
    return () => mounted.current && version === lifecycle.current && generation === getAuthSessionGeneration();
  }, []);
  const reportError = useCallback((field, error) => {
    const detail = error?.isNetworkError ? '网络异常，保存结果未确认，请核对后再试。' : (error?.message || '保存失败，请核对后再试。');
    showGlobalToast('error', field === 'nickname' ? detail + '昵称输入已保留，可再次移开输入框重试。' : detail + '已恢复上次确认的头像，可重新选择图片。');
  }, []);
  const save = useCallback((field, value, revision, current) => {
    const execute = async () => {
      if (!current() || revisions.current[field] !== revision) return false;
      if (field === 'nickname' && confirmed.current.nickname === value) return true;
      inflight.current = getAuthSessionGeneration();
      try {
        const result = await apiUpdateProfile({ [field]: value });
        if (!current()) return false;
        confirmed.current[field] = result[field];
        // 同字段新编辑已经发生时，不把旧回执发布为最新资料。
        if (revisions.current[field] !== revision) return false;
        callback.current?.({ [field]: result[field] });
        if (field === 'nickname') setName(result.nickname);
        else { clearPreview(); setAvatar(result.avatar_url); }
        return true;
      } catch (error) {
        if (current() && revisions.current[field] === revision) {
          if (field === 'avatar_url') { clearPreview(); setAvatar(confirmed.current.avatar_url); }
          reportError(field, error);
        }
        return false;
      } finally { inflight.current = null; }
    };
    const pending = queue.current.then(execute, execute);
    queue.current = pending.catch(() => {});
    return pending;
  }, [clearPreview, reportError]);
  const editName = useCallback(value => {
    revisions.current.nickname++;
    setName(value);
  }, []);
  const saveName = useCallback(value => {
    return save('nickname', value, revisions.current.nickname, capture());
  }, [save, capture]);
  const uploadAvatar = useCallback(async file => {
    const revision = ++revisions.current.avatar_url;
    const current = capture();
    const latest = () => current() && revisions.current.avatar_url === revision;
    clearPreview();
    preview.current = URL.createObjectURL(file);
    setAvatar(preview.current);
    try {
      const result = await apiUploadAvatar(file);
      if (!latest()) return;
      await save('avatar_url', result.avatarUrl, revision, current);
    } catch (error) {
      if (latest()) { clearPreview(); setAvatar(confirmed.current.avatar_url); reportError('avatar_url', error); }
    }
  }, [capture, clearPreview, save, reportError]);
  return { name, avatar, editName, saveName, uploadAvatar };
}

