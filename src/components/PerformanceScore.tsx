import { Device, AlarmEvent, MaintenancePrediction } from '../types';

export interface PerformanceScoreProps {
  reportedScore?: number | null;
  devices: Device[];
  alarms: AlarmEvent[];
  predictions: MaintenancePrediction[];
  /** Tailwind height class to match the name box, e.g. "h-[56px]" */
  sizeClass?: string;
  label?: string;
}

const COLOR_RED = '#ff4668';
const COLOR_YELLOW = '#f6c945';
const COLOR_CYAN = '#39e6c4';

function scoreColor(score: number): string {
  if (score > 80) return COLOR_CYAN;
  if (score > 60) return COLOR_YELLOW;
  return COLOR_RED;
}

export function PerformanceScore({
  reportedScore,
  sizeClass = 'h-[56px] w-[56px]',
  label = 'Performance Score',
}: PerformanceScoreProps) {
  const score = typeof reportedScore === 'number' && Number.isFinite(reportedScore) ? reportedScore : null;
  const color = score == null ? '#8492a6' : scoreColor(score);

  const widthMatch = sizeClass.match(/w-\[(\d+)px\]/);
  const wrapperWidth = widthMatch ? `${widthMatch[1]}px` : undefined;

  const size = widthMatch ? parseInt(widthMatch[1], 10) : 56;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.375;
  const needleLen = size * 0.275;
  const sw = size * 0.0625;

  const angleAt = (pct: number) => (180 + (pct / 100) * 180) * (Math.PI / 180);
  const pointAt = (pct: number, radius: number) => ({
    x: cx + radius * Math.cos(angleAt(pct)),
    y: cy + radius * Math.sin(angleAt(pct)),
  });

  const zones = [
    { from: 0, to: 60, color: COLOR_RED },
    { from: 60, to: 80, color: COLOR_YELLOW },
    { from: 80, to: 100, color: COLOR_CYAN },
  ];

  const needleAngle = angleAt(score ?? 0);
  const needleEnd = {
    x: cx + needleLen * Math.cos(needleAngle),
    y: cy + needleLen * Math.sin(needleAngle),
  };

  return (
    <div className="flex flex-col items-center flex-shrink-0" style={wrapperWidth ? { width: wrapperWidth } : undefined}>
      <div className="relative overflow-visible" style={{ width: size, height: size * 0.5625 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 overflow-visible">
          <path
            d={`M ${pointAt(0, r).x} ${pointAt(0, r).y} A ${r} ${r} 0 0 1 ${pointAt(100, r).x} ${pointAt(100, r).y}`}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={sw}
            strokeLinecap="round"
          />
          {zones.map(zone => {
            const s = pointAt(zone.from, r);
            const e = pointAt(zone.to, r);
            return (
              <path
                key={zone.color}
                d={`M ${s.x} ${s.y} A ${r} ${r} 0 0 1 ${e.x} ${e.y}`}
                fill="none"
                stroke={zone.color}
                strokeWidth={sw}
                strokeLinecap="round"
              />
            );
          })}
          {score != null && <line
            x1={cx}
            y1={cy}
            x2={needleEnd.x}
            y2={needleEnd.y}
            stroke={color}
            strokeWidth={size * 0.03125}
            strokeLinecap="round"
            style={{ transition: 'all 0.6s ease', filter: `drop-shadow(0 0 3px ${color})` }}
          />
          }
          <circle cx={cx} cy={cy} r={size * 0.04375} fill={color} />
          <circle cx={cx} cy={cy} r={size * 0.075} fill="none" stroke={color} strokeWidth={1} opacity={0.4} />
        </svg>
      </div>
      <div
        className="font-bold tabular-nums"
        style={{ fontSize: size * 0.2125, color, textShadow: `0 0 6px ${color}80`, lineHeight: 1, marginTop: 3 }}
      >
        {score ?? '—'}
      </div>
      <span className="text-[10px] font-medium uppercase tracking-wider text-white leading-[1.1] text-center" style={{ marginTop: '7px', maxWidth: wrapperWidth }}>{label}</span>
    </div>
  );
}
