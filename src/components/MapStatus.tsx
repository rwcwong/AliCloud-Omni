import { MapPin, RefreshCw } from 'lucide-react';
import { useT, useLang } from '../lib/i18n';
import { hasFloorPlanCoordinates } from '../lib/mapCoordinates';

export function MapTileNotice({ failed, onRetry, missingKey = false }: { failed: boolean; onRetry: () => void; missingKey?: boolean }) {
  const t = useT();
  if (!failed && !missingKey) return null;
  return (
    <div role="status" className="absolute left-14 top-3 z-[1100] flex max-w-[calc(100%-4rem)] items-center gap-2 rounded-lg border border-amber-400/40 bg-slate-950/95 px-3 py-2 text-xs text-amber-100 shadow-lg">
      <span>{t(missingKey ? 'map_key_missing' : 'map_tiles_failed')}</span>
      {!missingKey && <button type="button" onClick={onRetry} className="flex shrink-0 items-center gap-1 rounded px-2 py-1 text-white hover:bg-white/10">
        <RefreshCw size={12} />{t('map_retry')}
      </button>}
    </div>
  );
}

export function MapEmptyState({ visible, light = false }: { visible: boolean; light?: boolean }) {
  const t = useT();
  if (!visible) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center">
      <div className={`rounded-lg px-4 py-3 text-center ${light ? 'bg-white/90 text-slate-600' : 'bg-slate-950/80 text-cyan-100/70'}`}>
        <MapPin size={28} className="mx-auto mb-2 opacity-60" />
        <p className="text-sm">{t('map_no_coords')}</p>
      </div>
    </div>
  );
}

export function FloorPlanCoordinateNotice({ devices }: { devices: { position_x: number | null; position_y: number | null }[] }) {
  const { lang } = useLang();
  const count = devices.filter(device => (device.position_x != null || device.position_y != null) && !hasFloorPlanCoordinates(device)).length;
  if (!count) return null;
  return <div role="status" className="pointer-events-none absolute bottom-3 left-3 z-40 max-w-[calc(100%-5rem)] rounded bg-slate-950/90 px-2 py-1 text-xs text-amber-200">
    {lang === 'en' ? `${count} device coordinates are outside the 0–100% floor-plan range; markers are not drawn.` : lang === 'zh-CN' ? `${count} 个设备的坐标不符合 0–100% 平面图范围，未绘制点位。` : `${count} 個設備的座標不符合 0–100% 平面圖範圍，未繪製點位。`}
  </div>;
}
