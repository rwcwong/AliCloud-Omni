import { AlarmEvent, DeviceType } from '../types';
import { Language } from './i18n';

type TFunc = (key: string) => string;
type AlarmDevice = AlarmEvent['devices'];

function deviceTypeDisplayName(dt: DeviceType | undefined, lang: Language): string {
  if (!dt) return '-';
  if (lang === 'zh-TW') return dt.name_zh_tw || dt.name_zh || dt.name_en;
  if (lang === 'zh-CN') return dt.name_zh || dt.name_zh_tw || dt.name_en;
  return dt.name_en;
}

export function translateAlarmType(
  alarmType: string,
  device: AlarmDevice | DeviceType | undefined,
  lang: Language,
  t: TFunc,
): string {
  if (lang === 'en') return alarmType;
  const dt = device && 'device_types' in device
    ? (device as AlarmDevice)?.device_types
    : (device as DeviceType | undefined);
  const typeName = deviceTypeDisplayName(dt, lang);
  if (alarmType.endsWith(' Alarm')) return `${typeName} ${t('alarm_suffix')}`;
  if (alarmType.endsWith(' Fault')) return `${typeName} ${t('fault_suffix')}`;
  return alarmType;
}

export function translateDescription(
  desc: string,
  device: AlarmDevice | undefined,
  lang: Language,
  t: TFunc,
): string {
  if (lang === 'en') return desc;
  const dt = device?.device_types;
  if (!dt) return desc;
  const match = desc.match(/^(.+) \((.+)\) entered (.+) state$/);
  if (match && match[1] === dt.name_en) {
    const statusZh = t(match[3]) || match[3];
    return `${deviceTypeDisplayName(dt, lang)} (${device?.code || ''}) ${t('alarm_entered_state')} ${statusZh} ${t('alarm_state_suffix')}`;
  }
  return desc;
}
