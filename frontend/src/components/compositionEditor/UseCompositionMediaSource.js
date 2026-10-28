import { useEffect, useState } from 'react';
import { isProtectedCompositionSource, loadCompositionMediaBlob } from '../../api/CompositionMediaPlayback';

export function useCompositionMediaSource(source) {
  const [loaded, setLoaded] = useState(null);
  const protectedSource = isProtectedCompositionSource(source);
  useEffect(() => {
    if (!protectedSource) return;
    const controller = new AbortController();
    let objectUrl;
    loadCompositionMediaBlob(source, controller.signal).then((blob) => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      setLoaded({ source, url: objectUrl });
    }).catch((error) => {
      if (!controller.signal.aborted) setLoaded({ source, error: error.message });
    });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source, protectedSource]);
  return {
    source: protectedSource ? (loaded?.source === source ? loaded.url : null) : source,
    error: protectedSource && loaded?.source === source ? loaded.error : null,
  };
}
