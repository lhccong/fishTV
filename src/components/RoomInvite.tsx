import { useRef, useState } from 'react';
import { HiLink, HiDuplicate, HiCheck } from 'react-icons/hi';

export default function RoomInvite({ roomId, open, onOpenChange }: { roomId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [status, setStatus] = useState('');
  const [copying, setCopying] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const link = new URL(`/rooms/${encodeURIComponent(roomId)}`, window.location.origin).href;

  const copy = async () => {
    if (copying) return;
    setCopying(true);
    setStatus('');
    try {
      await navigator.clipboard.writeText(link);
      setStatus('邀请链接已复制');
    } catch {
      field.current?.focus();
      field.current?.select();
      setStatus('无法自动复制，请手动复制已选中的链接');
    } finally {
      setCopying(false);
    }
  };

  return <details className="watch-invite" open={open} onToggle={() => setStatus('')}
    onKeyDown={event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onOpenChange(false);
        event.currentTarget.querySelector('summary')?.focus();
      }
    }}>
    <summary aria-expanded={open} onClick={event => { event.preventDefault(); onOpenChange(!open); }}><HiLink aria-hidden="true" />邀请好友</summary>
    <div className="watch-invite-panel">
      <label>房间邀请链接
        <input ref={field} readOnly value={link} onFocus={event => event.currentTarget.select()} />
      </label>
      <button type="button" onClick={() => void copy()} disabled={copying}>
        {status === '邀请链接已复制' ? <HiCheck aria-hidden="true" /> : <HiDuplicate aria-hidden="true" />}
        {copying ? '正在复制...' : '复制邀请链接'}
      </button>
      {status && <p role="status">{status}</p>}
    </div>
  </details>;
}
