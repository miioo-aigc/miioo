import { useEffect, useState } from 'react';

export default function useAdminRemoteList(fetcher, query, refreshSignal) {
  const [result, setResult] = useState(null);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    fetcher({ ...query, signal: controller.signal }).then(
      (data) => { if (active) setResult({ query, refreshSignal, data }); },
      (error) => { if (active) setResult({ query, refreshSignal, error }); },
    );
    return () => { active = false; controller.abort(); };
  }, [fetcher, query, refreshSignal]);
  const current = result?.query === query && result?.refreshSignal === refreshSignal;
  return {
    loading: !current, data: current ? result.data : null,
    error: current ? result.error?.message || '' : '',
  };
}
