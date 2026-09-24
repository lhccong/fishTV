import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { HiRefresh } from 'react-icons/hi';
import SetupPage from '../pages/SetupPage';
import { accountRequest } from '../api/account';
import { setVideoSources } from '../api/config';
import '../account.css';

type User = { id: string; username: string; avatarUrl?: string };
const UserContext = createContext<User | null>(null);
export const useCurrentUser = () => useContext(UserContext);

export default function AccessGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [setup, setSetup] = useState<boolean | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const isAdmin = location.pathname.replace(/\/+$/, '') === '/admin';
  const refresh = useCallback(() => { setRetry(value => value + 1); }, []);

  useEffect(() => {
    let cancelled = false;
    setError('');
    void (async () => {
      try {
        const installation = await accountRequest<{ setupRequired: boolean }>('/api/setup/status');
        if (cancelled) return;
        setSetup(installation.setupRequired);
        if (installation.setupRequired || isAdmin) { setReady(true); return; }
        const status = await accountRequest<{ authenticated: boolean; enabled: boolean; user: User | null }>('/api/auth/moyu/status');
        if (!cancelled) {
          setUser(status.authenticated ? status.user : null);
          setEnabled(status.enabled);
          if (status.authenticated) {
            const videoSources = await accountRequest<{ sources: Array<{ id: string; name: string; proxyUrl: string; enabled: boolean }> }>('/api/video-sources');
            if (!cancelled) setVideoSources(videoSources.sources);
          }
          setReady(true);
        }
      } catch (error) {
        if (!cancelled) { setUser(null); setError(error instanceof Error ? error.message : '连接失败'); }
      }
    })();
    return () => { cancelled = true; };
  }, [isAdmin, retry, location.pathname]);

  useEffect(() => {
    const onFocus = () => refresh();
    const expired = () => { setUser(null); refresh(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('fish-tv-auth-expired', expired);
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 60000);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('fish-tv-auth-expired', expired);
      clearInterval(interval);
    };
  }, [refresh]);

  useEffect(() => {
    if (!ready || isAdmin || user || !enabled || error) return;
    const loginError = new URLSearchParams(location.search).has('loginError');
    if (loginError) return;
    const returnPath = `${location.pathname}${location.search}${location.hash}`;
    window.location.replace(`/api/auth/moyu/start?returnPath=${encodeURIComponent(returnPath)}`);
  }, [enabled, error, isAdmin, location.hash, location.pathname, location.search, ready, user]);

  if (setup === true) return <SetupPage onComplete={() => window.location.assign('/admin')} />;
  if (ready && (isAdmin || user)) return <UserContext.Provider key={isAdmin ? 'admin' : user?.id} value={user}>{children}</UserContext.Provider>;
  if (error) {
    return <main className="account-page account-centered"><div className="account-login">
      <p role="alert" className="account-error">{error}</p>
      <button onClick={refresh}><HiRefresh />重试</button>
    </div></main>;
  }
  return <main className="account-page account-centered"><p role="status">正在跳转认证...</p></main>;
}
