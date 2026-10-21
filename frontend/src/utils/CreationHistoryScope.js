export function creationHistoryPrefix(ownerId, tab) {
  if (ownerId == null || ownerId === '') throw new Error('创作历史缺少账号归属');
  // 保持类型前缀兼容现有媒体编辑失效通知；不读取旧无账号键。
  return `creation_history:${tab}:owner:${encodeURIComponent(String(ownerId))}:`;
}

export function createCreationHistoryVisit(ownerId, session, readAccount, readSession) {
  let active = true;
  return {
    isCurrent: () => active && ownerId != null
      && readAccount() === String(ownerId) && readSession() === session,
    stop: () => { active = false; },
  };
}
