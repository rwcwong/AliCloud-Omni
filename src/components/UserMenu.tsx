import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { User, LogOut, ChevronDown, KeyRound, Shield, Briefcase } from 'lucide-react';
import { useAuth, isGlobalAdmin } from '../lib/auth';
import { useSiteSelector } from '../hooks/useSiteSelector';
import { apiClient } from '../lib/apiCompat';
import { Project, UserRole } from '../types';

const ROLE_LABELS: Record<UserRole, string> = {
  system_admin: 'System Admin',
  admin: 'Administrator',
  executive: 'Executive',
  property_manager: 'Property Manager',
  guard: 'Guard',
  technician: 'Technician',
  readonly: 'Read Only',
  no_access: 'No Access',
};

const MENU_WIDTH = 240;
const PASSWORD_CHANGE_SUPPORTED = false;

interface UserMenuProps {
  onSignOut?: () => void;
  onChangePassword?: () => void;
}

export function UserMenu({ onSignOut, onChangePassword }: UserMenuProps) {
  const { user, role, siteRoles, signOut } = useAuth();
  const { sites } = useSiteSelector(user?.id);
  const [open, setOpen] = useState(false);
  const [projectName, setProjectName] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const accessibleSiteIds = Object.keys(siteRoles).filter(
    (sid) => siteRoles[sid] && siteRoles[sid] !== 'no_access',
  );
  const firstAccessibleSite = sites.find((s) => accessibleSiteIds.includes(s.id));
  const projectId = isGlobalAdmin(role) ? null : (firstAccessibleSite?.project_id ?? null);

  useEffect(() => {
    if (isGlobalAdmin(role)) { setProjectName('All Projects'); return; }
    if (!projectId) { setProjectName(null); return; }
    apiClient
      .from('projects')
      .select('name, name_zh')
      .eq('id', projectId)
      .single()
      .then(({ data }) => {
        if (data) setProjectName((data as Project).name);
      });
  }, [projectId, role]);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        const menu = document.getElementById('user-menu-dropdown');
        if (menu && menu.contains(e.target as Node)) return;
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  function toggleOpen() {
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - MENU_WIDTH) });
    }
    setOpen((v) => !v);
  }

  if (!user) return null;

  async function handleSignOut() {
    setOpen(false);
    if (onSignOut) {
      onSignOut();
    } else {
      await signOut();
    }
  }

  const dropdown = open && menuPos ? (
    <div
      id="user-menu-dropdown"
      className="fixed z-[9999] overflow-hidden rounded-xl border border-cyan-300/20 bg-[#061c3d] shadow-2xl"
      style={{ top: menuPos.top, left: menuPos.left, width: MENU_WIDTH }}
    >
      {/* User identity header */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-cyan-400/40 bg-cyan-400/15">
            <span className="text-sm font-bold text-cyan-200">
              {(user.email?.[0] ?? 'U').toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">
              {user.email}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-cyan-300/70">
              {projectName && (
                <span className="flex items-center gap-1">
                  <Briefcase size={10} />
                  {projectName}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Shield size={10} />
                {role ? ROLE_LABELS[role] : 'User'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-cyan-300/15 p-1.5">
        {PASSWORD_CHANGE_SUPPORTED && onChangePassword && (
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onChangePassword();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-cyan-100/70 transition-colors hover:bg-cyan-300/10"
          >
            <KeyRound size={13} className="text-cyan-300/60" />
            Change Password
          </button>
        )}
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-rose-400 transition-colors hover:bg-rose-500/10"
        >
          <LogOut size={13} />
          Sign Out
        </button>
      </div>
    </div>
  ) : null;

  return (
    <>
      <div className="pointer-events-auto relative" ref={ref}>
        <button
          type="button"
          onClick={toggleOpen}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-cyan-100/70 transition-colors hover:bg-cyan-300/10"
        >
          <User size={17} className="text-cyan-300" />
          <span className="max-w-[100px] truncate font-medium text-white">
            {user.email ?? 'Guest'}
          </span>
          <ChevronDown
            size={12}
            className={`text-cyan-300/60 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </div>
      {dropdown && createPortal(dropdown, document.body)}
    </>
  );
}
