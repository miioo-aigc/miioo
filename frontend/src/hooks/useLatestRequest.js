import { useCallback, useEffect, useRef } from 'react';

// A completion may update state only while it belongs to the latest read.
export default function useLatestRequest() {
  const version = useRef(0);
  useEffect(() => () => { version.current++; }, []);
  return useCallback(() => {
    const current = ++version.current;
    return () => current === version.current;
  }, []);
}
