interface Props {
  label: string;
  value: number | string;
  color?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}

export function KPICard({ label, value, color = '#22c55e', icon, onClick }: Props) {
  return (
    <div
      onClick={onClick}
      className={`bg-gray-800/60 border border-gray-700/50 rounded-xl p-4 flex items-center gap-3 ${onClick ? 'cursor-pointer hover:bg-gray-700/60 transition-colors' : ''}`}
    >
      {icon && (
        <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}20` }}>
          <span style={{ color }}>{icon}</span>
        </div>
      )}
      <div>
        <div className="text-2xl font-bold" style={{ color }}>{value}</div>
        <div className="text-xs text-gray-400 mt-0.5">{label}</div>
      </div>
    </div>
  );
}
