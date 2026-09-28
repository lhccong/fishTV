import { useState } from 'react';
import { HiLockClosed } from 'react-icons/hi';
import { useRoomSocket } from '../hooks/useRoomSocket';

export default function RoomPasswordSettings({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { room, connected, setRoomPassword } = useRoomSocket();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const save = async (value: string) => {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      const result = await setRoomPassword(value);
      if (!result.success) { setMessage(result.error || '保存失败'); return; }
      setPassword(''); setMessage(value ? '密码已更新，已在线成员不受影响' : '密码已取消');
    } finally { setBusy(false); }
  };
  return <details className="watch-invite" open={open} onKeyDown={event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onOpenChange(false);
      event.currentTarget.querySelector('summary')?.focus();
    }
  }}>
    <summary aria-expanded={open} onClick={event => { event.preventDefault(); onOpenChange(!open); }}><HiLockClosed />房间密码</summary>
    <div className="watch-invite-panel">
      <form onSubmit={event => { event.preventDefault(); void save(password); }}>
        <label>{room?.hasPassword ? '新房间密码' : '设置房间密码'}<input required type="password" autoComplete="new-password" minLength={4} maxLength={64} value={password} onChange={event => setPassword(event.target.value)} /></label>
        <button disabled={busy || !connected} type="submit">保存密码</button>
      </form>
      {room?.hasPassword && <button disabled={busy || !connected} type="button" onClick={() => {
        if (window.confirm('取消密码后，已登录用户无需房间密码即可加入。确定取消吗？')) void save('');
      }}>取消房间密码</button>}
      {message && <p role="status">{message}</p>}
    </div>
  </details>;
}
