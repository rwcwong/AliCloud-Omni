import fireAlarmColor from './Fire_Alarm_Color copy.png';

interface FireAlarmIconProps {
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

export function FireAlarmIcon({ size = 24, className = '', style }: FireAlarmIconProps) {
  return (
    <img
      src={fireAlarmColor}
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain', ...style }}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}
