import { DeviceStatus } from '../types';
import { statusBgClass } from '../lib/colors';
import { useT } from '../lib/i18n';

interface Props {
  status: DeviceStatus | string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: Props) {
  const t = useT();
  const cls = size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-xs';
  return (
    <span className={`${cls} rounded border font-medium ${statusBgClass(status as DeviceStatus)}`}>
      {t(status)}
    </span>
  );
}
