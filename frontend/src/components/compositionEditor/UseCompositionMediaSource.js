import { useEffect, useState } from 'react';
import { toVideoMediaUrl } from '../../utils/VideoMediaUrl';
import { isProtectedCompositionSource, loadCompositionMediaBlob } from '../../api/CompositionMediaPlayback';

export function useCompositionMediaSource(source, retryKey = 0) {
  const [loaded, setLoaded] = useState(null);
  const protectedSource = isProtectedCompositionSource(source);
  useEffect(() => {
    if (!protectedSource) return;
    const controller = new AbortController();
    let objectUrl;
    loadCompositionMediaBlob(source, controller.signal).then((blob) => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      setLoaded({ source, retryKey, url: objectUrl });
    }).catch((error) => {
      if (!controller.signal.aborted) setLoaded({ source, retryKey, error: error.message });
    });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source, protectedSource, retryKey]);
  return {
    source: protectedSource ? (loaded?.source === source && loaded?.retryKey === retryKey ? loaded.url : null) : toVideoMediaUrl(source),
    error: protectedSource && loaded?.source === source && loaded?.retryKey === retryKey ? loaded.error : null,
  };
}
