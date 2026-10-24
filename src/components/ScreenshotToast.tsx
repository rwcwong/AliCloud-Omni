import { useEffect, useState, useCallback } from 'react';
import { CheckCircle, XCircle, X, Info } from 'lucide-react';
import { ScreenshotResult } from '../lib/screenCapture';

interface ToastState {
  visible: boolean;
  success: boolean;
  message: string;
}

let externalShowToast: ((success: boolean, message: string) => void) | null = null;

export function showScreenshotToast(result: ScreenshotResult): void {
  if (externalShowToast) {
    const success = result.success;
    const message = success
      ? result.method === 'screen'
        ? 'Screenshot saved to Downloads. Attach it in the WhatsApp chat.'
        : 'Screenshot saved to Downloads (page capture). Attach it in the WhatsApp chat.'
      : result.error || 'Screenshot failed. Please use Print Screen manually.';
    externalShowToast(success, message);
  }
}

export function ScreenshotToast() {
  const [toast, setToast] = useState<ToastState>({ visible: false, success: false, message: '' });

  const show = useCallback((success: boolean, message: string) => {
    setToast({ visible: true, success, message });
  }, []);

  useEffect(() => {
    externalShowToast = show;
    return () => { externalShowToast = null; };
  }, [show]);

  useEffect(() => {
    if (!toast.visible) return;
    const timer = setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 6000);
    return () => clearTimeout(timer);
  }, [toast.visible]);

  if (!toast.visible) return null;

  const Icon = toast.success ? CheckCircle : XCircle;
  const accentColor = toast.success ? 'text-emerald-400' : 'text-rose-400';
  const borderColor = toast.success ? 'border-emerald-500/30' : 'border-rose-500/30';
  const bgColor = toast.success ? 'bg-emerald-500/10' : 'bg-rose-500/10';

  return (
    <div className="fixed bottom-6 right-6 z-[9999] animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className={`flex items-start gap-3 rounded-xl border ${borderColor} ${bgColor} backdrop-blur-md px-4 py-3 shadow-2xl max-w-sm`}>
        <Icon size={20} className={`flex-shrink-0 mt-0.5 ${accentColor}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${accentColor}`}>
            {toast.success ? 'Screenshot Captured' : 'Screenshot Failed'}
          </p>
          <p className="text-xs text-gray-300 mt-0.5 leading-relaxed">{toast.message}</p>
        </div>
        <button
          onClick={() => setToast(prev => ({ ...prev, visible: false }))}
          className="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

export function InfoToast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 right-6 z-[9999] animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-start gap-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 backdrop-blur-md px-4 py-3 shadow-2xl max-w-sm">
        <Info size={20} className="flex-shrink-0 mt-0.5 text-cyan-400" />
        <p className="text-xs text-gray-300 flex-1 leading-relaxed">{message}</p>
        <button onClick={onClose} className="flex-shrink-0 text-gray-400 hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
