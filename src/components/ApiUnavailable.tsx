import { useLang } from '../lib/i18n';
export function ApiUnavailable() {
  const { lang } = useLang();
  return <p role="status" className="p-4 text-sm text-gray-400">{lang === 'en'
    ? 'Data not connected'
    : lang === 'zh-CN' ? '未接入数据' : '未接入資料'}</p>;
}
