import { useState } from 'react';
import { HiLogout, HiUserCircle } from 'react-icons/hi';
import { useCurrentUser } from '../context/AccessGate';
import { accountRequest, clearUserCache } from '../api/account';

export default function AccountMenu() {
  const user = useCurrentUser();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [avatarFailed, setAvatarFailed] = useState(false);
  if (!user) return null;
  const logout = async () => {
    setBusy(true);
    setError('');
    try {
      await accountRequest('/api/auth/moyu/logout', { method: 'POST' });
      clearUserCache();
      window.location.assign('/');
    } catch { setError('退出失败，请重试'); setBusy(false); }
  };
  return <div className="relative flex min-w-0 items-center gap-2">
    <div className="flex min-w-0 items-center gap-2">
      {user.avatarUrl && !avatarFailed ? (
        <img
          src={user.avatarUrl}
          alt=""
          className="h-8 w-8 shrink-0 rounded-full border border-gray-200 object-cover"
          referrerPolicy="no-referrer"
          onError={() => setAvatarFailed(true)}
        />
      ) : (
        <HiUserCircle className="h-8 w-8 shrink-0 text-gray-400" aria-hidden="true" />
      )}
      <span className="max-w-[10rem] truncate text-sm text-gray-600 sm:max-w-[14rem] md:max-w-[18rem]">{user.username}</span>
    </div>
    <button disabled={busy} onClick={logout} className="flex shrink-0 items-center gap-1 p-2 text-gray-600 disabled:opacity-50" aria-label="退出登录">
      <HiLogout className="h-5 w-5" /><span className="hidden sm:inline">{busy ? '退出中' : '退出'}</span>
    </button>
    {error && <p role="alert" className="absolute right-0 top-full z-50 w-40 bg-white p-2 text-sm text-red-600 shadow">{error}</p>}
  </div>;
}
