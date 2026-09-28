import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { HiRefresh } from 'react-icons/hi';
import SetupPage from '../pages/SetupPage';
import { AccountError, accountRequest } from '../api/account';
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
  const retryAttempts = useRef(0);
  const isAdmin = location.pathname.replace(/\/+$/, '') === '/admin';
  const refresh = useCallback(() => { setRetry(value => value + 1); }, []);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: number | undefined;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    setError('');
    void (async () => {
      try {
        const installation = await accountRequest<{ setupRequired: boolean }>('/api/setup/status', { signal: controller.signal });
        controller.signal.throwIfAborted();
        if (cancelled) return;
        setSetup(installation.setupRequired);
        if (installation.setupRequired || isAdmin) { retryAttempts.current = 0; setReady(true); return; }
        const status = await accountRequest<{ authenticated: boolean; enabled: boolean; user: User | null }>('/api/auth/moyu/status', { signal: controller.signal });
        controller.signal.throwIfAborted();
        if (!cancelled) {
          setUser(status.authenticated ? status.user : null);
          setEnabled(status.enabled);
          if (status.authenticated) {
            const videoSources = await accountRequest<{ sources: Array<{ id: string; name: string; proxyUrl: string; enabled: boolean }> }>('/api/video-sources', { signal: controller.signal });
            controller.signal.throwIfAborted();
            if (!cancelled) setVideoSources(videoSources.sources);
          }
          if (cancelled) return;
          retryAttempts.current = 0;
          setReady(true);
        }
      } catch (error) {
        if (cancelled) return;
        const transient = error instanceof AccountError
          ? error.status >= 500 || error.status === 408 || error.status === 429
          : controller.signal.aborted || error instanceof TypeError;
        // A failed background probe must not unmount the player or exit fullscreen.
        // Confirmed auth failures still clear the user; the server remains authoritative.
        if (!transient) setUser(null);
        setError(error instanceof Error ? error.message : '连接失败');
        if (transient) {
          const delay = Math.min(1000 * 2 ** retryAttempts.current, 30000);
          retryAttempts.current = Math.min(retryAttempts.current + 1, 5);
          retryTimer = window.setTimeout(refresh, delay);
        }
      } finally {
        window.clearTimeout(timeout);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
      window.clearTimeout(retryTimer);
    };
  }, [isAdmin, retry, location.pathname, refresh]);

  useEffect(() => {
    const onFocus = () => refresh();
    const expired = () => { setUser(null); refresh(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onFocus);
    window.addEventListener('fish-tv-auth-expired', expired);
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 60000);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onFocus);
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
