import { DeviceStatus } from '../types';
import { statusColor, isPulsingStatus } from '../lib/colors';

interface Props {
  status: DeviceStatus;
  size?: number;
  solid?: boolean;
}

export function StatusDot({ status, size = 10, solid = false }: Props) {
  const color = statusColor(status);
  const pulsing = isPulsingStatus(status) && !solid;
  return (
    <span className="relative inline-flex" style={{ width: size, height: size }}>
      {pulsing && (
        <span
          className="absolute inline-flex rounded-full opacity-75 animate-ping"
          style={{ width: size, height: size, backgroundColor: color }}
        />
      )}
      <span
        className="relative inline-flex rounded-full"
        style={{ width: size, height: size, backgroundColor: color }}
      />
    </span>
  );
}
