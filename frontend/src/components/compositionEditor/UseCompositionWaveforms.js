import { useEffect, useRef, useState } from 'react';
import { apiGetAssetWaveform, apiEnsureAssetWaveform } from '../../api/AssetWaveforms';
import { getAuthSessionGeneration } from '../../api/request';
import { createWaveformSession } from './CompositionWaveforms';

export function useCompositionWaveforms(segments, projectId, compositionId) {
  const [view, setView] = useState(null);
  const session = useRef(null);
  const ids = JSON.stringify([...new Set(segments.filter((s) => ['audio', 'video'].includes(s.type) && s.assetId).map((s) => s.assetId))].sort());
  const auth = getAuthSessionGeneration();
  const key = JSON.stringify([projectId, compositionId, auth]);
  useEffect(() => {
    const controller = createWaveformSession({ read: apiGetAssetWaveform, ensure: apiEnsureAssetWaveform,
      isCurrent: () => getAuthSessionGeneration() === auth,
      publish: (id, value) => setView((old) => ({ key, values: { ...(old?.key === key ? old.values : {}), [id]: value } })),
    });
    session.current = controller;
    return () => { controller.stop(); session.current = null; };
  }, [key, auth]);
  useEffect(() => { session.current?.sync(projectId ? JSON.parse(ids) : []); }, [ids, projectId, key]);
  return { waveforms: view?.key === key ? view.values : {}, retryWaveform: (id) => session.current?.retry(id) };
}
