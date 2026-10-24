import { useCallback, useEffect, useRef, useState } from 'react';
import { refreshApiData } from '../lib/apiData';

/** Shared refresh, stale-response protection and error handling for API-backed views. */
export function useApiQuery<T>(key: string, loader: () => Promise<T>, initial: T, interval = 30_000) {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const initialRef = useRef(initial);
  const sequence = useRef(0);
  const mounted = useRef(false);
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cancel = useCallback(() => { mounted.current = false; sequence.current++; }, []);
  const refetch = useCallback(async (force = true) => {
    const request = ++sequence.current;
    if (force) refreshApiData();
    try {
      const result = await loaderRef.current();
      if (mounted.current && request === sequence.current) { setData(result); setError(null); }
      return result;
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : 'API request failed';
      if (mounted.current && request === sequence.current) {
        setError(message);
        window.dispatchEvent(new CustomEvent('omnios:api-error', { detail: { message } }));
      }
      return undefined;
    } finally {
      if (mounted.current && request === sequence.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    setData(initialRef.current); setError(null); setLoading(true);
    void refetch(false);
    const onChange = () => { void refetch(false); };
    window.addEventListener('omnios:data-changed', onChange);
    const telemetry = /^(dashboard:|projects$|hierarchy:|alarms:|snapshot:)/.test(key);
    if (telemetry) window.addEventListener('omnios:telemetry-changed', onChange);
    const timer = interval > 0 ? window.setInterval(onChange, interval) : null;
    return () => {
      cancel();
      window.removeEventListener('omnios:data-changed', onChange);
      if (telemetry) window.removeEventListener('omnios:telemetry-changed', onChange);
      if (timer !== null) clearInterval(timer);
    };
  }, [key, interval, refetch, cancel]);
  return { data, setData, loading, error, refetch };
}
