import { Modal } from '../admin/components/Modal';
import { useT } from '../lib/i18n';
import { ApiUnavailable } from './ApiUnavailable';
export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  return <Modal title={t('cp_title')} onClose={onClose}><ApiUnavailable /></Modal>;
}
