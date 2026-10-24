import { api } from './api';
import { notifyApiDataChanged } from './apiData';
import { apiClient } from './apiCompat';
import { AlarmEvent, Device, Language } from '../types';
import { translations } from './i18n';

export const SUPPORT_WHATSAPP_NUMBER = '85262016826';

export interface DispatchResult {
  dispatched: true;
}

const ALARM_WORTHY_STATUSES = [
  'Alarm', 'Activated', 'Fault', 'Panel Fire', 'Panel Fault', 'Offline',
];

export function isAlarmWorthy(device: Device): boolean {
  return ALARM_WORTHY_STATUSES.includes(device.status);
}

type LangLabels = Record<string, string>;

function labels(lang: Language): LangLabels {
  return translations[lang] || translations['en'];
}

function localName(en: string, zh: string | undefined, lang: Language): string {
  return lang === 'en' ? en : (zh || en);
}

function deviceTypeDisplayName(dt: Device['device_types'] | undefined, lang: Language): string {
  if (!dt) return '-';
  if (lang === 'zh-TW') return dt.name_zh_tw || dt.name_zh || dt.name_en;
  if (lang === 'zh-CN') return dt.name_zh || dt.name_zh_tw || dt.name_en;
  return dt.name_en;
}

function translateAlarmType(alarmType: string, dt: Device['device_types'] | undefined, lang: Language, L: LangLabels): string {
  if (lang === 'en') return alarmType;
  const typeName = deviceTypeDisplayName(dt, lang);
  if (alarmType.endsWith(' Alarm')) return `${typeName} ${L.alarm_suffix}`;
  if (alarmType.endsWith(' Fault')) return `${typeName} ${L.fault_suffix}`;
  return alarmType;
}

function translateDescription(desc: string, device: AlarmEvent['devices'] | undefined, lang: Language, L: LangLabels): string {
  if (lang === 'en') return desc;
  const dt = device?.device_types;
  if (!dt) return desc;
  const match = desc.match(/^(.+) \((.+)\) entered (.+) state$/);
  if (match && match[1] === dt.name_en) {
    const statusZh = L[match[3]] || match[3];
    return `${deviceTypeDisplayName(dt, lang)} (${device?.code || ''}) ${L.alarm_entered_state} ${statusZh} ${L.alarm_state_suffix}`;
  }
  return desc;
}

function severityLabel(sev: string, lang: Language): string {
  const L = labels(lang);
  return L[sev] || sev;
}

function statusLabel(status: string, lang: Language): string {
  const L = labels(lang);
  return L[status] || status;
}

export function buildDeviceMessage(device: Device, alarm: AlarmEvent | null | undefined, lang: Language = 'en'): string {
  const L = labels(lang);
  const dt = device.device_types;
  const floor = device.floors;
  const building = floor?.buildings;
  const site = building?.sites;

  const lines = [
    `*${L.wa_fire_alert_device}*`,
    '',
    `${L.wa_device_code}: ${device.code}`,
    `${L.wa_device_type}: ${deviceTypeDisplayName(dt, lang)}`,
    `${L.wa_status}: ${statusLabel(device.status, lang)}`,
  ];

  if (device.current_value != null) {
    lines.push(`${L.wa_current_value}: ${device.current_value} ${dt?.unit || ''}`);
  }

  lines.push(
    `${L.wa_site}: ${localName(site?.name || '-', site?.name_zh, lang)}`,
    `${L.wa_building}: ${localName(building?.name || '-', building?.name_zh, lang)}`,
    `${L.wa_floor}: ${floor?.floor_label || '-'}`,
    `${L.wa_location}: ${device.label}`,
  );

  if (alarm) {
    lines.push(
      `${L.wa_alarm_type}: ${translateAlarmType(alarm.alarm_type, dt, lang, L)}`,
      `${L.wa_severity}: ${severityLabel(alarm.severity, lang)}`,
      `${L.wa_action_status}: ${statusLabel(alarm.status, lang)}`,
      `${L.wa_description}: ${translateDescription(alarm.description, alarm.devices, lang, L)}`,
      `${L.wa_triggered_at}: ${new Date(alarm.triggered_at).toLocaleString()}`,
    );
  }

  lines.push(`${L.wa_last_update}: ${new Date(device.last_seen_at).toLocaleString()}`);
  lines.push('', L.wa_screenshot_msg);
  lines.push('', L.wa_dispatch_technician);

  return lines.join('\n');
}

export function buildAlarmMessage(alarm: AlarmEvent, lang: Language = 'en'): string {
  const L = labels(lang);
  const device = alarm.devices;
  const floor = device?.floors;
  const building = floor?.buildings;
  const site = building?.sites;

  const lines = [
    `*${L.wa_fire_alert_alarm}*`,
    '',
    `${L.wa_alarm_type}: ${translateAlarmType(alarm.alarm_type, device?.device_types, lang, L)}`,
    `${L.wa_severity}: ${severityLabel(alarm.severity, lang)}`,
    `${L.wa_action_status}: ${statusLabel(alarm.status, lang)}`,
    `${L.wa_description}: ${translateDescription(alarm.description, device, lang, L)}`,
    `${L.wa_device_code}: ${device?.code || '-'}`,
    `${L.wa_device_type}: ${deviceTypeDisplayName(device?.device_types, lang)}`,
    `${L.wa_site}: ${localName(site?.name || '-', site?.name_zh, lang)}`,
    `${L.wa_building}: ${localName(building?.name || '-', building?.name_zh, lang)}`,
    `${L.wa_floor}: ${floor?.floor_label || '-'}`,
    `${L.wa_triggered_at}: ${new Date(alarm.triggered_at).toLocaleString()}`,
    '',
    L.wa_screenshot_msg,
    '',
    L.wa_dispatch_technician,
  ];

  return lines.join('\n');
}

export function buildBatchAlarmMessage(alarms: AlarmEvent[], lang: Language = 'en'): string {
  const L = labels(lang);
  const lines = [
    `*${L.wa_fire_alert_batch.replace('{n}', String(alarms.length))}*`,
    '',
  ];

  alarms.forEach((alarm, i) => {
    const device = alarm.devices;
    const floor = device?.floors;
    const building = floor?.buildings;
    const site = building?.sites;

    lines.push(`--- ${L.wa_alarm_n.replace('{n}', String(i + 1))} ---`);
    lines.push(`${L.wa_alarm_type}: ${translateAlarmType(alarm.alarm_type, device?.device_types, lang, L)} | ${L.wa_severity}: ${severityLabel(alarm.severity, lang)} | ${L.wa_action_status}: ${statusLabel(alarm.status, lang)}`);
    lines.push(`${L.wa_device_code}: ${device?.code || '-'} (${deviceTypeDisplayName(device?.device_types, lang)})`);
    lines.push(`${L.wa_site}: ${localName(site?.name || '-', site?.name_zh, lang)} | ${L.wa_building}: ${localName(building?.name || '-', building?.name_zh, lang)} | ${L.wa_floor}: ${floor?.floor_label || '-'}`);
    lines.push(`${L.wa_triggered_at}: ${new Date(alarm.triggered_at).toLocaleString()}`);
    lines.push('');
  });

  lines.push('', L.wa_screenshot_msg);
  lines.push(L.wa_dispatch_all_technicians);
  return lines.join('\n');
}

export function openWhatsApp(message: string): void {
  const url = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export async function markAlarmDispatched(alarmId: string, _dispatcherName?: string, _dispatcherContact?: string): Promise<void> {
  await api.actOnAlarm(alarmId, { action: 'dispatch', dispatched_to: 'WhatsApp Support' });
  notifyApiDataChanged();
}

export async function markAlarmsDispatched(alarmIds: string[], dispatcherName?: string, dispatcherContact?: string): Promise<void> {
  // Only successful server actions change displayed work-order state.
  for (const id of alarmIds) await markAlarmDispatched(id, dispatcherName, dispatcherContact);
}

export async function findActiveAlarmForDevice(deviceId: string): Promise<AlarmEvent | null> {
  const { data } = await apiClient
    .from('alarm_events')
    .select('*')
    .eq('device_id', deviceId)
    .eq('status', 'active')
    .order('triggered_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as AlarmEvent | null;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function dispatchDevice(device: Device, lang: Language = 'en', dispatcherName?: string, dispatcherContact?: string): Promise<DispatchResult & { alarm: AlarmEvent | null }> {
  const alarm = await findActiveAlarmForDevice(device.id);
  const message = buildDeviceMessage(device, alarm, lang);
  await delay(300);
  openWhatsApp(message);
  if (alarm) {
    await markAlarmDispatched(alarm.id, dispatcherName, dispatcherContact);
  }
  return { dispatched: true, alarm };
}

export async function dispatchAlarm(alarm: AlarmEvent, lang: Language = 'en', dispatcherName?: string, dispatcherContact?: string): Promise<DispatchResult> {
  const message = buildAlarmMessage(alarm, lang);
  await delay(300);
  openWhatsApp(message);
  await markAlarmDispatched(alarm.id, dispatcherName, dispatcherContact);
  return { dispatched: true };
}

export async function dispatchAllAlarms(alarms: AlarmEvent[], lang: Language = 'en', dispatcherName?: string, dispatcherContact?: string): Promise<DispatchResult> {
  const message = buildBatchAlarmMessage(alarms, lang);
  await delay(300);
  openWhatsApp(message);
  await markAlarmsDispatched(alarms.map(a => a.id), dispatcherName, dispatcherContact);
  return { dispatched: true };
}
