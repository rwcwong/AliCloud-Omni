import { useState } from 'react';
import { reportApiError } from '../../lib/analytics';
import { X } from 'lucide-react';
import { useT } from '../../lib/i18n';

interface Props {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
}

export function Modal({ title, onClose, children, width = 'max-w-lg' }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative w-full ${width} rounded-2xl shadow-2xl border border-cyan-300/20`}
        style={{
          background: 'linear-gradient(160deg, #031535 0%, #020d25 100%)',
        }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-300/10">
          <h2 className="text-white font-semibold text-sm">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-700/50">
            <X size={16} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
  destructive?: boolean;
}

export function ConfirmModal({ title, message, confirmLabel, onConfirm, onClose, destructive }: ConfirmModalProps) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-gray-400 text-sm mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white bg-gray-800/50 hover:bg-gray-700/50 rounded-xl transition-all border border-gray-700/50">
          {t('confirm_cancel')}
        </button>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try { await onConfirm(); onClose(); }
            catch (failure) { reportApiError(failure); }
            finally { setBusy(false); }
          }}
          className={`px-4 py-2 text-sm font-medium rounded-xl transition-all ${destructive ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-cyan-600 hover:bg-cyan-500 text-white'}`}
        >
          {confirmLabel || t('confirm_confirm')}
        </button>
      </div>
    </Modal>
  );
}
