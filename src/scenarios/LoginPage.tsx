import { useState } from 'react';
import { Shield, Eye, EyeOff, AlertCircle, CheckCircle2, Phone, User, Mail, Lock, ArrowLeft, Monitor, Tablet } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useT, useLang } from '../lib/i18n';

type View = 'login' | 'register' | 'submitted';
type Platform = 'pc' | 'ipad';

export function LoginPage({ onLoginPlatform }: { onLoginPlatform?: (platform: Platform) => void }) {
  const { signIn, registerRequest } = useAuth();
  const t = useT();
  const { lang } = useLang();
  const [view, setView] = useState<View>('login');

  // Login state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [platform, setPlatform] = useState<Platform>('pc');

  // Register state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regShowPw, setRegShowPw] = useState(false);
  const [regTel, setRegTel] = useState('');
  const [regError, setRegError] = useState<string | null>(null);
  const [regLoading, setRegLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    // Publish the platform before sign-in broadcasts the authenticated session.
    onLoginPlatform?.(platform);
    const { error: err } = await signIn(username, password);
    if (err) {
      setLoginError(err);
      setLoginLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegError(null);
    if (regPassword.length < 8) {
      setRegError(t('login_pw_min_8'));
      return;
    }
    setRegLoading(true);
    const { error: err } = await registerRequest(regName, regEmail, regPassword, regTel);
    setRegLoading(false);
    if (err) {
      setRegError(err);
    } else {
      setView('submitted');
    }
  }

  function goToLogin() {
    setLoginError(null);
    setView('login');
  }

  return (
    <div className="h-screen w-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="bg-gray-900/90 border border-gray-800/60 rounded-2xl p-8 shadow-2xl backdrop-blur-sm">

          {/* LOGIN VIEW */}
          {view === 'login' && (
            <>
              <div className="flex flex-col items-center mb-8">
                <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/25 mb-4">
                  <Shield size={28} className="text-red-400" />
                </div>
                <h1 className="text-white text-xl font-bold tracking-tight">Omni OS</h1>
                <p className="text-white text-sm mt-1">智慧物聯網操作平台</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                {/* Platform selector */}
                <div>
                  <label className="block text-xs text-white mb-1.5 font-medium">{t('login_choose_platform')}</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPlatform('pc')}
                      className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition-all ${
                        platform === 'pc'
                          ? 'border-cyan-400/60 bg-cyan-400/15 text-cyan-200'
                          : 'border-gray-700/60 bg-gray-800/40 text-gray-400 hover:border-gray-600/60'
                      }`}
                    >
                      <Monitor size={16} />
                      {t('login_platform_pc')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlatform('ipad')}
                      className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition-all ${
                        platform === 'ipad'
                          ? 'border-cyan-400/60 bg-cyan-400/15 text-cyan-200'
                          : 'border-gray-700/60 bg-gray-800/40 text-gray-400 hover:border-gray-600/60'
                      }`}
                    >
                      <Tablet size={16} />
                      {t('login_platform_ipad')}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-white mb-1.5 font-medium">
                    {lang === 'en' ? 'Username' : lang === 'zh-CN' ? '用户名' : '用戶名'}
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    required
                    autoComplete="username"
                    placeholder="exec_manager"
                    className="w-full bg-gray-800/60 border border-gray-700/60 text-white text-sm rounded-xl px-4 py-2.5 placeholder-gray-600 focus:outline-none focus:border-blue-500/60 focus:bg-gray-800 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs text-white mb-1.5 font-medium">{t('login_password')}</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="w-full bg-gray-800/60 border border-gray-700/60 text-white text-sm rounded-xl px-4 py-2.5 pr-10 placeholder-gray-600 focus:outline-none focus:border-blue-500/60 focus:bg-gray-800 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {loginError && (
                  <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                    <AlertCircle size={13} className="flex-shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium text-sm rounded-xl py-2.5 transition-all mt-2"
                >
                  {loginLoading ? t('login_signing_in') : t('login_sign_in')}
                </button>
              </form>

              <p className="mt-5 text-center text-xs text-gray-400">
                {lang === 'en'
                  ? 'Accounts are created by an administrator.'
                  : lang === 'zh-CN'
                    ? '账号由管理员创建。'
                    : '帳號由管理員建立。'}
              </p>

              <p className="text-center text-xs text-white mt-4">
                Century Harvest Technologies Limited
              </p>
            </>
          )}

          {/* REGISTER VIEW */}
          {view === 'register' && (
            <>
              <div className="flex flex-col items-center mb-7">
                <div className="p-3 rounded-xl bg-blue-500/15 border border-blue-500/25 mb-4">
                  <Shield size={28} className="text-blue-400" />
                </div>
                <h1 className="text-white text-xl font-bold tracking-tight">{t('login_request_access')}</h1>
                <p className="text-white text-sm mt-1">{lang === 'en' ? 'Submit your registration for admin approval' : lang === 'zh-CN' ? '提交您的注册申请以供管理员审批' : '提交您的註冊申請以供管理員審批'}</p>
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-xs text-white mb-1.5 font-medium">{t('login_full_name')}</label>
                  <div className="relative">
                    <User size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    <input
                      type="text"
                      value={regName}
                      onChange={e => setRegName(e.target.value)}
                      required
                      autoComplete="name"
                      placeholder="Your full name"
                      className="w-full bg-gray-800/60 border border-gray-700/60 text-white text-sm rounded-xl pl-9 pr-4 py-2.5 placeholder-gray-600 focus:outline-none focus:border-blue-500/60 focus:bg-gray-800 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-white mb-1.5 font-medium">{t('login_email')}</label>
                  <div className="relative">
                    <Mail size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    <input
                      type="email"
                      value={regEmail}
                      onChange={e => setRegEmail(e.target.value)}
                      required
                      autoComplete="email"
                      placeholder="you@example.com"
                      className="w-full bg-gray-800/60 border border-gray-700/60 text-white text-sm rounded-xl pl-9 pr-4 py-2.5 placeholder-gray-600 focus:outline-none focus:border-blue-500/60 focus:bg-gray-800 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-white mb-1.5 font-medium">{t('login_password')}</label>
                  <div className="relative">
                    <Lock size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    <input
                      type={regShowPw ? 'text' : 'password'}
                      value={regPassword}
                      onChange={e => setRegPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      placeholder="Min. 8 characters"
                      className="w-full bg-gray-800/60 border border-gray-700/60 text-white text-sm rounded-xl pl-9 pr-10 py-2.5 placeholder-gray-600 focus:outline-none focus:border-blue-500/60 focus:bg-gray-800 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setRegShowPw(!regShowPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {regShowPw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-white mb-1.5 font-medium">{t('login_telephone')}</label>
                  <div className="relative">
                    <Phone size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    <input
                      type="tel"
                      value={regTel}
                      onChange={e => setRegTel(e.target.value)}
                      required
                      autoComplete="tel"
                      placeholder="+852 1234 5678"
                      className="w-full bg-gray-800/60 border border-gray-700/60 text-white text-sm rounded-xl pl-9 pr-4 py-2.5 placeholder-gray-600 focus:outline-none focus:border-blue-500/60 focus:bg-gray-800 transition-all"
                    />
                  </div>
                </div>

                {regError && (
                  <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                    <AlertCircle size={13} className="flex-shrink-0" />
                    <span>{regError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={regLoading}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium text-sm rounded-xl py-2.5 transition-all mt-2"
                >
                  {regLoading ? t('login_submitting') : t('login_submit_request')}
                </button>
              </form>

              <div className="mt-5 text-center">
                <button
                  onClick={goToLogin}
                  className="flex items-center gap-1.5 text-xs text-white hover:text-white transition-colors mx-auto"
                >
                  <ArrowLeft size={11} />
                  {t('login_back_to_signin')}
                </button>
              </div>

              <p className="text-center text-xs text-white mt-4">
                Century Harvest Technologies Limited
              </p>
            </>
          )}

          {/* SUBMITTED VIEW */}
          {view === 'submitted' && (
            <>
              <div className="flex flex-col items-center py-6 text-center">
                <div className="p-4 rounded-2xl bg-green-500/15 border border-green-500/25 mb-5">
                  <CheckCircle2 size={32} className="text-green-400" />
                </div>
                <h2 className="text-white text-lg font-bold mb-2">{t('login_request_submitted')}</h2>
                <p className="text-white text-sm leading-relaxed max-w-xs">
                  {t('login_submitted_desc')}
                </p>
                <p className="text-white text-xs mt-3">
                  {t('login_approved_desc')}
                </p>
              </div>

              <button
                onClick={goToLogin}
                className="w-full flex items-center justify-center gap-2 text-sm text-white hover:text-white border border-gray-700/60 hover:border-gray-600 rounded-xl py-2.5 transition-all"
              >
                <ArrowLeft size={13} />
                {t('login_back_to_signin')}
              </button>

              <p className="text-center text-xs text-white mt-5">
                Century Harvest Technologies Limited
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
