import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HiCog, HiLockClosed, HiPlay, HiPencil, HiX } from 'react-icons/hi';
import { useRoomSocket, type RoomSummary } from '../hooks/useRoomSocket';
import Tooltip from './Tooltip';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function RoomSettings({ open, onOpenChange }: Props) {
  const { room, connected, setRoomName, setRoomPassword, setRoomPlayMode, setRoomAdmins } = useRoomSocket();
  const dialog = useRef<HTMLDialogElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(room?.name || '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const playMode = room?.playMode || 'sequential';
  useEffect(() => { setName(room?.name || ''); }, [room?.name]);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      element.showModal();
      body.current?.scrollTo({ top: 0 });
    }
    if (!open && element.open) element.close();
  }, [open]);

  const saveName = async () => {
    const value = name.trim();
    if (busy || !value) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await setRoomName(value);
      if (!result.success) setMessage(result.error || '房间名称保存失败');
      else setMessage('房间名称已更新');
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async (value: string) => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await setRoomPassword(value);
      if (!result.success) {
        setMessage(result.error || '密码保存失败');
        return;
      }
      setPassword('');
      setMessage(value ? '房间密码已更新' : '房间密码已取消');
    } finally {
      setBusy(false);
    }
  };

  const changePlayMode = async (mode: NonNullable<RoomSummary['playMode']>) => {
    if (busy || mode === playMode) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await setRoomPlayMode(mode);
      if (!result.success) setMessage(result.error || '播放模式保存失败');
      else setMessage('播放模式已更新');
    } finally {
      setBusy(false);
    }
  };

  return <>
    <button type="button" className="watch-settings-trigger" aria-expanded={open}
      onClick={() => onOpenChange(!open)}><HiCog />房间设置</button>
    {createPortal(<dialog ref={dialog} className="watch-settings-dialog no-invert"
      onCancel={event => { event.preventDefault(); onOpenChange(false); }}
      onClick={event => { if (event.target === event.currentTarget) onOpenChange(false); }}>
      <div className="watch-settings-modal">
        <header className="watch-settings-modal-heading">
          <div><span><HiCog /></span><div><h2>房间设置</h2><p>管理房间信息和共同播放选项</p></div></div>
          <Tooltip label="关闭"><button type="button" className="watch-settings-close" aria-label="关闭房间设置" onClick={() => onOpenChange(false)}><HiX /></button></Tooltip>
        </header>
        <div ref={body} className="watch-settings-modal-body">
      <section className="watch-settings-section">
        <h2><HiPencil />房间名称</h2>
        <form onSubmit={event => {
          event.preventDefault();
          void saveName();
        }}>
          <label>名称
            <input required maxLength={80} value={name} onChange={event => setName(event.target.value)} />
          </label>
          <button disabled={busy || !connected || !name.trim() || name.trim() === room?.name} type="submit">保存</button>
        </form>
      </section>
      <section className="watch-settings-section">
        <h2><HiLockClosed />房间密码</h2>
        <form onSubmit={event => {
          event.preventDefault();
          void savePassword(password);
        }}>
          <label>{room?.hasPassword ? '新密码' : '设置密码'}
            <input required type="password" autoComplete="new-password" minLength={4} maxLength={64}
              value={password} onChange={event => setPassword(event.target.value)} placeholder="至少 4 位" />
          </label>
          <button disabled={busy || !connected || !password.trim()} type="submit">保存密码</button>
        </form>
        {room?.hasPassword && <button disabled={busy || !connected} type="button" onClick={() => {
          if (window.confirm('确定取消房间密码吗？')) void savePassword('');
        }}>取消房间密码</button>}
      </section>
      <section className="watch-settings-section">
        <h2><HiPlay />播放模式</h2>
        <select aria-label="房间播放模式" value={playMode} disabled={busy || !connected}
          onChange={event => void changePlayMode(event.target.value as NonNullable<RoomSummary['playMode']>)}>
          <option value="sequential">自动连播</option>
          <option value="single">单集播放</option>
          <option value="random">随机播放</option>
        </select>
      </section>
      <section className="watch-settings-section">
        <h2><HiCog />房间管理员</h2>
        <div className="watch-settings-admins">
          {Array.from(new Set([
            ...(room?.members.filter(member => member.id !== room.ownerId).map(member => member.id) || []),
            ...(room?.adminIds || []),
          ])).map(id => {
            const member = room?.members.find(member => member.id === id);
            return <label key={id}>
              <span>{member?.username || id}{!member && '（离线）'}</span>
              <input type="checkbox" checked={Boolean(room?.adminIds?.includes(id))} disabled={busy || !connected}
                onChange={async event => {
                  const ids = event.target.checked ? [...(room?.adminIds || []), id] : (room?.adminIds || []).filter(value => value !== id);
                  setBusy(true); setMessage('');
                  try {
                    const result = await setRoomAdmins(ids);
                    setMessage(result.success ? '管理员已更新' : result.error || '设置失败');
                  } finally { setBusy(false); }
                }} />
            </label>;
          })}
          {!room?.adminIds?.length && !room?.members.some(member => member.id !== room.ownerId) && <p>暂无可设置的成员</p>}
        </div>
      </section>
      {message && <p role="status">{message}</p>}
        </div>
      </div>
    </dialog>, document.body)}
  </>;
}
