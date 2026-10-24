import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, RefreshCw, Search, UserPlus, UserX, Users } from 'lucide-react';
import type { AdminProject, AdminSite, ApiManagedUser, ApiRole, ManagedUsersFilters } from '../../api/types';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { useLang, useT } from '../../lib/i18n';
import { AdminInput, AdminSelect, FormField } from '../components/FormField';
import { Modal } from '../components/Modal';

type Language = 'zh-TW' | 'zh-CN' | 'en';
type CreateForm = {
  username: string;
  real_name: string;
  password: string;
  role: ApiRole;
  project_code: string;
  site_code: string;
};

const emptyCreateForm = (): CreateForm => ({
  username: '', real_name: '', password: '', role: 'officer', project_code: '', site_code: '',
});

function labels(lang: Language) {
  if (lang === 'en') return {
    userId: 'User ID', username: 'Username', realName: 'Real name', role: 'Role', project: 'Project',
    projectCode: 'Project code', site: 'Site', siteCode: 'Site code', createdAt: 'Created at',
    search: 'Search username or real name', filterRole: 'Filter by role', allRoles: 'All roles',
    selectProject: 'Select a project', selectSite: 'Select a site',
    admin: 'Administrator', executive: 'Project executive', officer: 'Site officer',
    noUsers: 'No user accounts found.', refresh: 'Refresh', create: 'Create account',
    usernameHint: '3 to 32 characters', passwordHint: 'At least 6 characters',
    adminScope: 'Global access; no project or site is assigned.',
    loadingProjects: 'Loading projects…', loadingSites: 'Loading sites…',
    created: 'Account created.', deletePrompt: (name: string) => `Delete the account “${name}”? This cannot be undone.`,
    protected: 'This account cannot be deleted.', cancel: 'Cancel', delete: 'Delete account',
  };
  if (lang === 'zh-CN') return {
    userId: '用户 ID', username: '用户名', realName: '真实姓名', role: '角色', project: '项目',
    projectCode: '项目编码', site: '站点', siteCode: '站点编码', createdAt: '创建时间',
    search: '搜索用户名或真实姓名', filterRole: '按角色筛选', allRoles: '全部角色',
    selectProject: '选择项目', selectSite: '选择站点',
    admin: '系统管理员', executive: '项目主管', officer: '站点值班员',
    noUsers: '没有找到用户账号。', refresh: '刷新', create: '创建账号',
    usernameHint: '3 到 32 个字符', passwordHint: '至少 6 个字符',
    adminScope: '全局访问；无需绑定项目或站点。',
    loadingProjects: '正在加载项目…', loadingSites: '正在加载站点…',
    created: '账号已创建。', deletePrompt: (name: string) => `确定删除账号“${name}”？此操作无法撤销。`,
    protected: '此账号不可删除。', cancel: '取消', delete: '删除账号',
  };
  return {
    userId: '用戶 ID', username: '用戶名稱', realName: '真實姓名', role: '角色', project: '項目',
    projectCode: '項目編碼', site: '站點', siteCode: '站點編碼', createdAt: '建立時間',
    search: '搜尋用戶名稱或真實姓名', filterRole: '按角色篩選', allRoles: '全部角色',
    selectProject: '選擇項目', selectSite: '選擇站點',
    admin: '系統管理員', executive: '項目主管', officer: '站點值班員',
    noUsers: '找不到用戶帳號。', refresh: '重新整理', create: '建立帳戶',
    usernameHint: '3 至 32 個字元', passwordHint: '至少 6 個字元',
    adminScope: '全域存取；無需綁定項目或站點。',
    loadingProjects: '正在載入項目…', loadingSites: '正在載入站點…',
    created: '帳戶已建立。', deletePrompt: (name: string) => `確定刪除帳戶「${name}」？此操作無法復原。`,
    protected: '此帳戶不可刪除。', cancel: '取消', delete: '刪除帳戶',
  };
}

function roleLabel(role: ApiRole, text: ReturnType<typeof labels>) {
  return role === 'admin' ? text.admin : role === 'executive' ? text.executive : text.officer;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Request failed. Please try again.';
}

export function UsersPageV3() {
  const t = useT();
  const { lang } = useLang();
  const text = labels(lang as Language);
  const { user } = useAuth();
  const [users, setUsers] = useState<ApiManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountError, setAccountError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [projectCodeInput, setProjectCodeInput] = useState('');
  const [filters, setFilters] = useState<ManagedUsersFilters>({});
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(emptyCreateForm);
  const [createError, setCreateError] = useState('');
  const [createSaving, setCreateSaving] = useState(false);
  const [createSuccess, setCreateSuccess] = useState('');
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [sites, setSites] = useState<AdminSite[]>([]);
  const [projectLoading, setProjectLoading] = useState(false);
  const [siteLoading, setSiteLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ApiManagedUser | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const reloadUsers = useCallback(async (nextFilters: ManagedUsersFilters = filters) => {
    setLoading(true);
    setAccountError('');
    try {
      setUsers(await api.getUsers(nextFilters));
      return true;
    } catch (error) {
      setAccountError(errorMessage(error));
      return false;
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { void reloadUsers(); }, [reloadUsers]);

  useEffect(() => {
    if (!showCreate) return;
    let active = true;
    setProjectLoading(true);
    setLookupError('');
    api.admin.list('projects')
      .then(rows => { if (active) setProjects(rows); })
      .catch(error => { if (active) setLookupError(errorMessage(error)); })
      .finally(() => { if (active) setProjectLoading(false); });
    return () => { active = false; };
  }, [showCreate]);

  useEffect(() => {
    if (!showCreate || createForm.role !== 'officer' || !createForm.project_code) {
      setSites([]);
      setSiteLoading(false);
      return;
    }
    let active = true;
    setSiteLoading(true);
    setSites([]);
    setCreateForm(current => ({ ...current, site_code: '' }));
    setLookupError('');
    api.admin.list('sites', { project_code: createForm.project_code })
      .then(rows => { if (active) setSites(rows); })
      .catch(error => { if (active) setLookupError(errorMessage(error)); })
      .finally(() => { if (active) setSiteLoading(false); });
    return () => { active = false; };
  }, [showCreate, createForm.role, createForm.project_code]);

  const columns = useMemo(() => [
    { key: 'user_id', label: text.userId, render: (row: ApiManagedUser) => <span className="font-mono text-xs">{row.user_id}</span> },
    { key: 'username', label: text.username, render: (row: ApiManagedUser) => <span className="font-medium text-white">{row.username}</span> },
    { key: 'real_name', label: text.realName, render: (row: ApiManagedUser) => row.real_name || '—' },
    { key: 'role', label: text.role, render: (row: ApiManagedUser) => (
      <span className="rounded-lg border border-cyan-300/20 bg-cyan-400/10 px-2 py-1 text-xs text-cyan-100">{roleLabel(row.role, text)}</span>
    ) },
    { key: 'project', label: text.project, render: (row: ApiManagedUser) => row.project_code
      ? <span>{row.project_code}{row.project_name_zh ? ` · ${row.project_name_zh}` : ''}</span> : '—' },
    { key: 'site', label: text.site, render: (row: ApiManagedUser) => row.site_code
      ? <span>{row.site_code}{row.site_name_zh ? ` · ${row.site_name_zh}` : ''}</span> : '—' },
    { key: 'created_at', label: text.createdAt, render: (row: ApiManagedUser) => <span className="whitespace-nowrap text-xs text-gray-400">{row.created_at || '—'}</span> },
    { key: 'actions', label: '', width: '56px', render: (row: ApiManagedUser) => {
      const isSelf = String(row.user_id) === user?.id || row.username === user?.email;
      const isBuiltInAdmin = row.username === 'admin';
      const protectedAccount = isSelf || isBuiltInAdmin;
      return (
        <button
          type="button"
          disabled={protectedAccount}
          title={protectedAccount ? text.protected : t('users_delete_user')}
          onClick={() => { setDeleteTarget(row); setDeleteError(''); }}
          className="rounded-lg p-2 text-red-300 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:text-gray-600"
        >
          <UserX size={14} />
        </button>
      );
    } },
  ], [text, user?.email, user?.id, t]);

  function setCreateRole(role: ApiRole) {
    setCreateForm(current => ({
      ...current,
      role,
      project_code: role === 'admin' ? '' : current.project_code,
      site_code: role === 'officer' ? current.site_code : '',
    }));
  }

  async function handleCreateUser() {
    setCreateError('');
    const username = createForm.username.trim();
    const realName = createForm.real_name.trim();
    if (username.length < 3 || username.length > 32) {
      setCreateError(lang === 'en' ? 'Username must contain 3 to 32 characters.' : lang === 'zh-CN' ? '用户名长度必须为 3 到 32 个字符。' : '用戶名稱長度必須為 3 至 32 個字元。');
      return;
    }
    if (!realName || createForm.password.length < 6) {
      setCreateError(lang === 'en' ? 'Real name is required and password must contain at least 6 characters.' : lang === 'zh-CN' ? '真实姓名为必填项，密码至少需要 6 个字符。' : '真實姓名為必填項，密碼至少需要 6 個字元。');
      return;
    }
    if (createForm.role !== 'admin' && !createForm.project_code) {
      setCreateError(t('users_select_project_err'));
      return;
    }
    if (createForm.role === 'officer' && !createForm.site_code) {
      setCreateError(t('users_select_site_err'));
      return;
    }

    setCreateSaving(true);
    try {
      const result = await api.createUser({
        username,
        password: createForm.password,
        real_name: realName,
        role: createForm.role,
        ...(createForm.role !== 'admin' ? { project_code: createForm.project_code } : {}),
        ...(createForm.role === 'officer' ? { site_code: createForm.site_code } : {}),
      });
      setShowCreate(false);
      setCreateForm(emptyCreateForm());
      setCreateSuccess(`${text.created} ${result.username}`);
      await reloadUsers();
    } catch (error) {
      setCreateError(errorMessage(error));
    } finally {
      setCreateSaving(false);
    }
  }

  async function handleDeleteUser() {
    if (!deleteTarget) return;
    const isSelf = String(deleteTarget.user_id) === user?.id || deleteTarget.username === user?.email;
    if (isSelf || deleteTarget.username === 'admin') {
      setDeleteError(text.protected);
      return;
    }
    setDeleteSaving(true);
    setDeleteError('');
    try {
      await api.deleteUser(deleteTarget.user_id);
      setDeleteTarget(null);
      await reloadUsers();
    } catch (error) {
      setDeleteError(errorMessage(error));
    } finally {
      setDeleteSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/15 p-2"><Users size={18} className="text-cyan-400" /></div>
          <div>
            <h2 className="font-semibold text-white">{t('users_title')}</h2>
            <p className="text-xs text-gray-500">{users.length} {t('users_count')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void reloadUsers()} className="flex items-center gap-2 rounded-xl border border-gray-700/50 bg-gray-800/50 px-3 py-2 text-xs text-gray-300 hover:text-white">
            <RefreshCw size={13} /> {text.refresh}
          </button>
          <button type="button" onClick={() => { setCreateForm(emptyCreateForm()); setCreateError(''); setLookupError(''); setShowCreate(true); }} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-emerald-500">
            <UserPlus size={14} /> {t('users_create_user')}
          </button>
        </div>
      </div>

      <form onSubmit={event => {
        event.preventDefault();
        setFilters(current => ({ ...current, search: searchInput.trim() || undefined, project_code: projectCodeInput.trim() || undefined }));
      }} className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <AdminInput value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder={text.search} className="pl-9" />
        </div>
        <AdminInput aria-label={text.projectCode} value={projectCodeInput} onChange={event => setProjectCodeInput(event.target.value)} placeholder={text.projectCode} className="w-auto min-w-[150px]" />
        <AdminSelect aria-label={text.filterRole} value={filters.role ?? ''} onChange={event => setFilters(current => ({ ...current, role: (event.target.value || undefined) as ApiRole | undefined }))} className="w-auto min-w-[160px]">
          <option value="">{text.allRoles}</option>
          <option value="admin">{text.admin}</option>
          <option value="executive">{text.executive}</option>
          <option value="officer">{text.officer}</option>
        </AdminSelect>
        <button type="submit" className="rounded-xl bg-cyan-700 px-4 py-2.5 text-sm text-white hover:bg-cyan-600">{lang === 'en' ? 'Search' : lang === 'zh-CN' ? '搜索' : '搜尋'}</button>
      </form>

      {createSuccess && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
          <CheckCircle2 size={15} /> {createSuccess}
        </div>
      )}
      {accountError && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          <AlertCircle size={15} /> <span className="flex-1">{accountError}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setAccountError('')}>×</button>
        </div>
      )}

      {loading ? <div className="py-10 text-center text-sm text-gray-500">{t('users_loading')}</div> : (
        <div className="overflow-x-auto rounded-xl border border-cyan-300/10">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-cyan-300/10 bg-cyan-300/[0.04]">
              {columns.map(column => <th key={column.key} className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">{column.label}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-cyan-300/[0.06]">
              {users.length === 0 ? <tr><td colSpan={columns.length} className="py-10 text-center text-sm text-gray-500">{text.noUsers}</td></tr> : users.map(row => (
                <tr key={row.user_id} className="bg-gray-900/20 transition-colors hover:bg-cyan-400/[0.04]">
                  {columns.map(column => <td key={column.key} className="whitespace-nowrap px-4 py-3 text-gray-300">{column.render(row)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <Modal title={t('users_create_user')} onClose={() => { if (!createSaving) setShowCreate(false); }} width="max-w-xl">
          <div className="space-y-4">
            <FormField label={text.username} required>
              <AdminInput value={createForm.username} onChange={event => setCreateForm(current => ({ ...current, username: event.target.value }))} minLength={3} maxLength={32} autoComplete="username" placeholder={text.usernameHint} />
            </FormField>
            <FormField label={text.realName} required>
              <AdminInput value={createForm.real_name} onChange={event => setCreateForm(current => ({ ...current, real_name: event.target.value }))} autoComplete="name" />
            </FormField>
            <FormField label={t('login_password')} required>
              <AdminInput type="password" value={createForm.password} onChange={event => setCreateForm(current => ({ ...current, password: event.target.value }))} minLength={6} autoComplete="new-password" placeholder={text.passwordHint} />
            </FormField>
            <FormField label={text.role} required>
              <AdminSelect value={createForm.role} onChange={event => setCreateRole(event.target.value as ApiRole)}>
                <option value="admin">{text.admin}</option>
                <option value="executive">{text.executive}</option>
                <option value="officer">{text.officer}</option>
              </AdminSelect>
            </FormField>
            {createForm.role !== 'admin' && (
              <FormField label={text.projectCode} required>
                <AdminSelect value={createForm.project_code} onChange={event => setCreateForm(current => ({ ...current, project_code: event.target.value, site_code: '' }))} disabled={projectLoading}>
                  <option value="">{projectLoading ? text.loadingProjects : text.selectProject}</option>
                  {projects.map(project => <option key={project.project_code} value={project.project_code}>{project.project_code} · {project.project_name_zh || project.project_name}</option>)}
                </AdminSelect>
              </FormField>
            )}
            {createForm.role === 'officer' && (
              <FormField label={text.siteCode} required>
                <AdminSelect value={createForm.site_code} onChange={event => setCreateForm(current => ({ ...current, site_code: event.target.value }))} disabled={!createForm.project_code || siteLoading}>
                  <option value="">{siteLoading ? text.loadingSites : text.selectSite}</option>
                  {sites.map(site => <option key={`${site.project_code}:${site.site_code}`} value={site.site_code}>{site.site_code} · {site.site_name_zh || site.site_name}</option>)}
                </AdminSelect>
              </FormField>
            )}
            {createForm.role === 'admin' && <p className="rounded-lg bg-gray-800/50 px-3 py-2 text-xs text-gray-400">{text.adminScope}</p>}
            {lookupError && <p role="alert" className="text-xs text-amber-300">{lookupError}</p>}
            {createError && <p role="alert" className="flex items-center gap-2 text-sm text-red-300"><AlertCircle size={14} />{createError}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowCreate(false)} disabled={createSaving} className="rounded-xl px-4 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white disabled:opacity-50">{t('admin_cancel')}</button>
              <button type="button" onClick={() => void handleCreateUser()} disabled={createSaving || projectLoading || siteLoading} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500">
                <UserPlus size={14} /> {createSaving ? t('admin_saving') : text.create}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title={t('users_delete_user')} onClose={() => { if (!deleteSaving) { setDeleteTarget(null); setDeleteError(''); } }}>
          <div className="space-y-4">
            <p className="text-sm text-gray-300">{text.deletePrompt(deleteTarget.username)}</p>
            <p className="text-xs text-gray-500">{text.userId}: {deleteTarget.user_id}</p>
            {deleteError && <p role="alert" className="flex items-center gap-2 text-sm text-red-300"><AlertCircle size={14} />{deleteError}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" disabled={deleteSaving} onClick={() => setDeleteTarget(null)} className="rounded-xl border border-gray-700/50 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 disabled:opacity-50">{text.cancel}</button>
              <button type="button" disabled={deleteSaving} onClick={() => void handleDeleteUser()} className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:bg-gray-700">
                <UserX size={14} /> {deleteSaving ? t('users_delete_saving') : text.delete}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
