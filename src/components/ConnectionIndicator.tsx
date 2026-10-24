import { TransportConnectionState } from '../transport/ITransport';
import { useT } from '../lib/i18n';

interface Props {
  state: TransportConnectionState;
}

export function ConnectionIndicator({ state }: Props) {
  const t = useT();
  const config = {
    connected: { color: '#22c55e', label: t('connected') },
    connecting: { color: '#eab308', label: t('connecting') },
    disconnected: { color: '#ef4444', label: t('disconnected') },
    error: { color: '#ef4444', label: t('disconnected') },
  }[state];
  return (
    <div className="flex items-center gap-1.5">
      <span className="relative flex w-2 h-2">
        {state === 'connected' && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50" style={{ backgroundColor: config.color }} />
        )}
        <span className="relative inline-flex rounded-full w-2 h-2" style={{ backgroundColor: config.color }} />
      </span>
      <span className="text-xs" style={{ color: config.color }}>{config.label}</span>
    </div>
  );
}
