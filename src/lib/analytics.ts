import { api } from './api';
import { apiData } from './apiData';
import type { TrendRange } from '../api/types';

export function reportApiError(failure: unknown) {
  const message = failure instanceof Error ? failure.message : String(failure);
  window.dispatchEvent(new CustomEvent('omnios:api-error', { detail: { message } }));
}

/** The tag endpoint, not a guessed type code or a current reading, defines numeric capability. */
export async function fetchNumericDevices() {
  const [tags, points] = await Promise.all([api.getTrendDevices(), apiData.devices()]);
  const byCode = new Map(points.map(point => [point.code, point]));
  return tags.map(tag => {
    const device = byCode.get(tag.device_code);
    const floor = device?.floors;
    const building = floor?.buildings;
    const site = building?.sites;
    return {
      id: tag.device_code, code: tag.device_code, label: tag.label, tag_display: tag.tag_display,
      floor_id: floor?.id ?? '', floor_label: floor?.floor_label ?? '',
      building_id: building?.id ?? '', building_name: building?.name ?? '', building_name_zh: building?.name_zh ?? '',
      site_id: site?.id ?? '', site_name: site?.name ?? '', site_name_zh: site?.name_zh ?? '',
      project_id: site?.project_id ?? null, project_name: site?.projects?.name ?? '', project_name_zh: site?.projects?.name_zh ?? '',
      category: device?.device_types?.category ?? '', name_en: device?.device_types?.name_en ?? '', unit: tag.unit,
    };
  });
}

export async function fetchReadings(deviceCodes: string[], range: TrendRange) {
  if (deviceCodes.length === 0) return [];
  const result = await api.getDeviceTrends(deviceCodes, range);
  const selected = new Set(deviceCodes);
  // Preserve the server's irregular timestamps and genuine zeroes. Never fill missing readings.
  return result.series.filter(series => selected.has(series.device_code)).flatMap(series => series.points
    .filter((point): point is [string, number] => typeof point[0] === 'string' && typeof point[1] === 'number' && Number.isFinite(point[1]))
    .map(([recorded_at, value]) => ({ device_id: series.device_code, recorded_at, value })));
}

export function severityOptions(lang: string) {
  return [
    { value: 'all', label: lang === 'en' ? 'All Severities' : lang === 'zh-CN' ? '所有严重程度' : '所有嚴重程度' },
    { value: 'critical', label: lang === 'en' ? 'Critical' : lang === 'zh-CN' ? '严重 (Critical)' : '嚴重 (Critical)' },
    { value: 'alarm', label: lang === 'en' ? 'Alarm' : lang === 'zh-CN' ? '告警 (Alarm)' : '告警 (Alarm)' },
    { value: 'fault', label: lang === 'en' ? 'Fault' : '故障 (Fault)' },
  ];
}
