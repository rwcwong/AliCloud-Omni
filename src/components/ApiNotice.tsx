import { useEffect, useState } from 'react';

/** A failed request is never presented as a successful empty response. */
export function ApiNotice() {
  const [message, setMessage] = useState('');
  useEffect(() => {
    const onError = (event: Event) => setMessage((event as CustomEvent<{ message: string }>).detail.message);
    const onAuth = () => setMessage('');
    window.addEventListener('omnios:api-error', onError);
    window.addEventListener('omnios:auth-changed', onAuth);
    return () => {
      window.removeEventListener('omnios:api-error', onError);
      window.removeEventListener('omnios:auth-changed', onAuth);
    };
  }, []);
  if (!message) return null;
  return <div role="alert" className="fixed bottom-4 left-4 z-[200] max-w-lg rounded-lg border border-rose-400/40 bg-slate-950 p-3 text-sm text-rose-200 shadow-lg">
    {message}<button type="button" aria-label="Dismiss API error" onClick={() => setMessage('')} className="ml-4 px-2 text-white">×</button>
  </div>;
}
