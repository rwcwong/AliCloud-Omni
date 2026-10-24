import { Sun, Moon } from 'lucide-react';
import { Theme } from '../types';
import { useT } from '../lib/i18n';

interface Props {
  current: unknown;
  onChange: (s: unknown) => void;
  theme?: Theme;
  onThemeToggle?: () => void;
}

export function ScenarioSwitcher({ theme, onThemeToggle }: Props) {
  const t = useT();
  if (!onThemeToggle) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={onThemeToggle}
        className="flex items-center justify-center w-9 h-9 bg-gray-800/90 border border-gray-600/60 text-gray-400 rounded-xl shadow-xl backdrop-blur-sm hover:bg-gray-700/90 hover:text-white transition-all"
        title={theme === 'dark' ? t('light_mode') : t('dark_mode')}
      >
        {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
      </button>
    </div>
  );
}
