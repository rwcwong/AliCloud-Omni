import { ChevronRight, Home } from 'lucide-react';
import { useT, useLang } from '../lib/i18n';
import { Project } from '../types';
import { SiteWithBuildings } from '../hooks/useSiteSelector';

interface BreadcrumbProps {
  showOverall: boolean;
  project: Project | null;
  site: SiteWithBuildings | null;
  onNavigateOverall: () => void;
  onNavigateProject: () => void;
}

export function Breadcrumb({
  showOverall,
  project,
  site,
  onNavigateOverall,
  onNavigateProject,
}: BreadcrumbProps) {
  const t = useT();
  const { lang } = useLang();

  function localized(name: string, nameZh: string | null | undefined): string {
    return lang === 'en' ? name : (nameZh || name);
  }

  const segments: { label: string; onClick: (() => void) | null; icon?: React.ElementType }[] = [];

  if (showOverall) {
    segments.push({ label: t('bc_all_projects'), onClick: onNavigateOverall, icon: Home });
  }

  if (project) {
    segments.push({
      label: localized(project.name, project.name_zh),
      onClick: site ? onNavigateProject : null,
    });
  }

  if (site) {
    segments.push({
      label: localized(site.name, site.name_zh),
      onClick: null,
    });
  }

  if (segments.length === 0) return null;

  return (
    <div className="flex items-center gap-1 px-4 py-2 bg-gray-900/40 border-b border-gray-800/40 flex-shrink-0 overflow-x-auto">
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        const Icon = seg.icon;
        const clickable = seg.onClick !== null;
        return (
          <div key={i} className="flex items-center gap-1 flex-shrink-0">
            {i > 0 && <ChevronRight size={13} className="text-gray-600" />}
            <button
              onClick={() => clickable && seg.onClick?.()}
              disabled={!clickable}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                isLast
                  ? 'text-white bg-gray-800/60 cursor-default'
                  : clickable
                    ? 'text-gray-400 hover:text-white hover:bg-gray-800/50 cursor-pointer'
                    : 'text-gray-500 cursor-default'
              }`}
            >
              {Icon && <Icon size={12} className="flex-shrink-0" />}
              <span className="truncate max-w-40">{seg.label}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
