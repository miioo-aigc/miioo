import { useCallback, useLayoutEffect, useRef } from 'react';
import { getAuthSessionGeneration, getToken } from '../api/request';

// A new visit owns a new identity, even when returning to the same episode.
export default function useStoryboardGenerationScope(ownerId, projectId, episodeId) {
  const current = useRef(null);
  useLayoutEffect(() => {
    const visit = { ownerId, projectId, episodeId, session: getAuthSessionGeneration() };
    current.current = visit;
    return () => { current.current = null; };
  }, [ownerId, projectId, episodeId]);
  return useCallback(() => {
    const visit = current.current;
    return () => Boolean(visit && visit.ownerId && visit.episodeId && getToken()
      && visit.ownerId === ownerId && visit.projectId === projectId && visit.episodeId === episodeId
      && current.current === visit && visit.session === getAuthSessionGeneration());
  }, [ownerId, projectId, episodeId]);
}
