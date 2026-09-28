import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { HiArrowRight, HiFilm, HiX } from 'react-icons/hi';
import { useRoomSocket, type RoomSummary } from '../hooks/useRoomSocket';
import Tooltip from './Tooltip';
import '../create-room.css';

type Props = {
  initialName?: string;
  onClose: () => void;
  onCreated: (room: RoomSummary) => Promise<void>;
};

export default function CreateRoomDialog({ initialName = '', onClose, onCreated }: Props) {
  const { connected, createRoom } = useRoomSocket();
  const dialog = useRef<HTMLDialogElement>(null);
  const inFlight = useRef(false);
  const created = useRef<RoomSummary | null>(null);
  const headingId = useId();
  const [name, setName] = useState(initialName);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [existingId, setExistingId] = useState('');
  const [createdId, setCreatedId] = useState('');

  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);

  return createPortal(<dialog ref={dialog} className="create-room-dialog no-invert" aria-labelledby={headingId}
    onCancel={event => { event.preventDefault(); if (!inFlight.current) onClose(); }}
    onClick={event => { if (event.target === event.currentTarget && !inFlight.current) onClose(); }}>
    <div className="create-room-dialog-content">
      <header><h2 id={headingId}>创建新房间</h2>
        <Tooltip label="关闭"><button type="button" className="create-room-close" aria-label="关闭创建房间" disabled={busy} onClick={onClose}><HiX /></button></Tooltip>
      </header>
      <form onSubmit={async event => {
        event.preventDefault();
        if (inFlight.current || !connected) return;
        inFlight.current = true; setBusy(true); setError('');
        try {
          if (!created.current) {
            const result = await createRoom(name, password);
            if (!result.success || !result.room) {
              if (result.code === 'ROOM_ALREADY_OWNED' && result.roomId) setExistingId(result.roomId);
              throw new Error(result.error || '创建房间失败');
            }
            created.current = result.room;
            setCreatedId(result.room.id);
            setPassword('');
          }
          await onCreated(created.current);
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : '进入房间失败，请重试');
        } finally { inFlight.current = false; setBusy(false); }
      }}>
        <fieldset disabled={busy || Boolean(createdId) || Boolean(existingId)}>
          <label>给房间起个名字<input autoFocus maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="例如：周末电影夜、经典重映" /></label>
          <label>访问密码（可选，至少 4 位）<input type="password" minLength={4} maxLength={64} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="留空即为公开房间" /></label>
        </fieldset>
        {error && <p className="create-room-error" role="alert">{error}</p>}
        {!connected && <p role="status">正在连接房间服务...</p>}
        {existingId ? <Link className="create-room-submit" to={`/rooms/${encodeURIComponent(existingId)}`} onClick={onClose}>进入已有房间<HiArrowRight /></Link>
          : <button type="submit" className="create-room-submit" disabled={busy || !connected}><HiFilm />{busy ? '正在进入房间...' : createdId ? '重试进入房间' : '开启观影之旅'}</button>}
      </form>
    </div>
  </dialog>, document.body);
}
