import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGetAssetDetail } from '../../api/assets';
import { compositionMediaSource } from '../../utils/CompositionMediaSource';

/** 每次进入原画模式刷新全部视频地址；同一资产去重，媒体文件按播放位置加载。 */
export function useOriginalVideoSources(segments, enabled) {
  const [sources, setSources] = useState({});
  const requests = useRef(new Map());
  const ids = JSON.stringify([...new Set(segments.filter(s => s.type === 'video').map(s => s.assetId))].sort());
  const refresh = useCallback((id) => {
    const token = {};
    requests.current.set(id, token);
    setSources(old => ({ ...old, [id]: { status: 'loading' } }));
    apiGetAssetDetail(id).then(asset => {
      if (requests.current.get(id) !== token) return;
      const url = compositionMediaSource({ ...asset, asset_type: 'video', file_url: asset.original_url || asset.originalUrl || asset.file_url || asset.fileUrl, url: undefined });
      if (!url) throw new Error('原视频地址不可用');
      setSources(old => ({ ...old, [id]: { status: 'ready', url } }));
    }).catch(error => {
      if (requests.current.get(id) === token) setSources(old => ({ ...old, [id]: { status: 'failed', error: error.message } }));
    });
  }, []);
  useEffect(() => {
    const active = requests.current;
    if (enabled) JSON.parse(ids).forEach(refresh);
    return () => active.clear();
  }, [ids, enabled, refresh]);
  const reset = useCallback(() => { requests.current.clear(); setSources({}); }, []);
  return { sources, refresh, reset };
}
