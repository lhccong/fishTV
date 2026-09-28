import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HiArrowRight, HiLockClosed, HiX } from 'react-icons/hi';
import { useRoomSocket } from '../hooks/useRoomSocket';
import Tooltip from './Tooltip';
import '../create-room.css';

export default function JoinRoomDialog({ roomId, roomName, onClose, onJoined }: {
  roomId: string; roomName?: string; onClose: () => void; onJoined: () => void;
}) {
  const { connected, joinRoom } = useRoomSocket();
  const dialog = useRef<HTMLDialogElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const headingId = useId();
  const errorId = useId();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal();
    field.current?.focus();
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  return createPortal(<dialog ref={dialog} className="create-room-dialog join-room-dialog no-invert" aria-labelledby={headingId}
    onCancel={event => { event.preventDefault(); if (!inFlight.current) onClose(); }}
    onClick={event => { if (event.target === event.currentTarget && !inFlight.current) onClose(); }}>
    <div className="create-room-dialog-content">
      <header><h2 id={headingId}><HiLockClosed aria-hidden="true" />加入房间</h2>
        <Tooltip label="关闭"><button type="button" className="create-room-close" aria-label="取消加入房间" disabled={busy} onClick={onClose}><HiX /></button></Tooltip>
      </header>
      <div className="join-room-destination"><strong>{roomName || '密码房间'}</strong><span>房间号 {roomId}</span></div>
      <form onSubmit={async event => {
        event.preventDefault();
        if (inFlight.current || !connected) return;
        inFlight.current = true; setBusy(true); setError('');
        try {
          const result = await joinRoom(roomId, password);
          setPassword('');
          if (result.success) { onJoined(); return; }
          setError(result.error || '加入失败，请重试');
        } catch {
          setPassword('');
          setError('房间服务暂不可用，请重试');
        } finally {
          inFlight.current = false; setBusy(false);
          field.current?.focus();
        }
      }}>
        <label>房间密码<input ref={field} autoFocus required type="password" name="room-access-password" autoComplete="off"
          minLength={4} maxLength={64} readOnly={busy} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined}
          value={password} onChange={event => setPassword(event.target.value)} placeholder="输入房主提供的密码" /></label>
        {error && <p id={errorId} className="create-room-error" role="alert">{error}</p>}
        {!connected && <p role="status">连接已断开，正在重新连接...</p>}
        <button className="create-room-submit" type="submit" disabled={busy || !connected}><HiArrowRight />{busy ? '正在加入...' : '加入房间'}</button>
      </form>
    </div>
  </dialog>, document.body);
}
