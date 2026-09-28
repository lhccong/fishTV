import { useEffect, useRef, useState } from 'react';
import { HiAnnotation, HiArrowsExpand, HiChatAlt2, HiChevronDown, HiPaperAirplane, HiUserCircle, HiX } from 'react-icons/hi';
import type { RoomChatMessage } from '../hooks/useRoomSocket';
import Tooltip from './Tooltip';
import RoomDanmaku from './RoomDanmaku';

type Props = {
  fullscreen: boolean;
  onFullscreen: () => void;
  connected: boolean;
  userId?: string;
  messages: RoomChatMessage[];
  liveMessages: RoomChatMessage[];
  sendChat: (text: string) => Promise<{ success: boolean; error?: string }>;
};

export default function RoomPlayerChat({ fullscreen, onFullscreen, connected, userId, messages, liveMessages, sendChat }: Props) {
  const [open, setOpen] = useState(false);
  const [danmaku, setDanmaku] = useState(true);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const scroll = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const input = useRef<HTMLInputElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => { if (!fullscreen) setOpen(false); }, [fullscreen]);
  useEffect(() => {
    if (open) { follow.current = true; input.current?.focus(); }
  }, [open, fullscreen]);
  useEffect(() => {
    if (scroll.current && follow.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [messages.length, open, fullscreen]);

  const collapse = () => { setOpen(false); toggle.current?.focus(); };
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.isComposing || event.keyCode === 229 ||
        event.ctrlKey || event.altKey || event.metaKey || document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]')) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable ||
        target.closest('input, textarea, select, [role="textbox"], [contenteditable]:not([contenteditable="false"])'))) return;
      const key = event.key.toLowerCase();
      if (!['f', 'd', 'c'].includes(key)) return;
      event.preventDefault();
      if (key === 'f') onFullscreen();
      else if (key === 'd') setDanmaku(value => !value);
      else setOpen(value => !value);
    };
    document.addEventListener('keydown', shortcut);
    return () => document.removeEventListener('keydown', shortcut);
  }, [onFullscreen]);

  return <>
    <RoomDanmaku events={liveMessages} enabled={danmaku && connected} userId={userId} />
    <div className="watch-player-tools">
      <Tooltip label={`${danmaku ? '关闭弹幕' : '开启弹幕'} (D)`}><button aria-label={danmaku ? '关闭弹幕' : '开启弹幕'} aria-keyshortcuts="d" aria-pressed={danmaku} onClick={() => setDanmaku(value => !value)}><HiAnnotation /></button></Tooltip>
      <Tooltip label={`${open ? '收起聊天' : '展开聊天'} (C)`}><button ref={toggle} aria-label={open ? '收起聊天' : '展开聊天'} aria-keyshortcuts="c" aria-expanded={open} onClick={() => setOpen(value => !value)}><HiChatAlt2 /></button></Tooltip>
      <Tooltip label={`${fullscreen ? '退出全屏' : '全屏观看'} (F)`}><button aria-label={fullscreen ? '退出全屏' : '全屏观看'} aria-keyshortcuts="f" onClick={onFullscreen}>{fullscreen ? <HiX /> : <HiArrowsExpand />}</button></Tooltip>
    </div>
    {open && <section className="watch-floating-chat" aria-label="播放器聊天室">
      <header className="watch-floating-heading"><strong><HiChatAlt2 />聊天室</strong>
        <span>{connected ? '在线' : '连接中'}</span>
        <Tooltip label="收起聊天"><button aria-label="收起悬浮聊天框" onClick={collapse}><HiChevronDown /></button></Tooltip>
      </header>
      <div className="watch-messages" ref={scroll} role="log" aria-label="全屏聊天消息" onScroll={event => {
        const node = event.currentTarget;
        follow.current = node.scrollHeight - node.scrollTop - node.clientHeight < 60;
      }}>
        {!messages.length && <p className="watch-floating-empty">暂无消息</p>}
        {messages.map(message => <article key={message.id} className={`watch-message ${message.userId === userId ? 'watch-message-self' : ''}`}>
          {message.avatarUrl ? <img src={message.avatarUrl} alt="" referrerPolicy="no-referrer" /> : <HiUserCircle />}
          <div className="watch-message-content"><header><strong>{message.username}</strong></header><p>{message.text}</p></div>
        </article>)}
      </div>
      {error && <p className="watch-floating-error" role="alert">{error}</p>}
      <form className="watch-chat-form" onSubmit={async event => {
        event.preventDefault();
        if (!text.trim() || !connected || inFlight.current) return;
        inFlight.current = true; setBusy(true); setError('');
        const sent = text.trim();
        try {
          const result = await sendChat(sent);
          if (result.success) { setText(''); follow.current = true; }
          else setError(result.error || '发送失败，请重试');
        } catch { setError('发送失败，请重试'); }
        finally { inFlight.current = false; setBusy(false); }
      }}>
        <input ref={input} aria-label="全屏聊天内容" value={text} maxLength={500} disabled={busy} placeholder="发条弹幕..." onChange={event => setText(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault(); }} />
        <Tooltip label="发送弹幕"><button className="watch-primary" type="submit" aria-label="发送弹幕" disabled={!connected || busy || !text.trim()}><HiPaperAirplane /></button></Tooltip>
      </form>
    </section>}
  </>;
}
