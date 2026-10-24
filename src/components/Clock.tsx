import { useState, useEffect } from 'react';
import { Clock as ClockIcon } from 'lucide-react';

export function Clock({ className = '' }: { className?: string }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');

  return (
    <span className={`flex items-center gap-1.5 tabular-nums ${className}`}>
      <ClockIcon size={14} className="flex-shrink-0" />
      <span>{y} - {mo} - {d} / {h}:{mi}:{s}</span>
    </span>
  );
}
