import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HiOutlineAnnotation, HiOutlineChatAlt2, HiOutlineArrowsExpand, HiChatAlt2, HiChevronDown, HiUserCircle, HiOutlineX, HiOutlineCog } from 'react-icons/hi';
import type { RoomChatMessage, RoomSummary } from '../hooks/useRoomSocket';
import Tooltip from './Tooltip';
import RoomDanmaku from './RoomDanmaku';
import RoomPlaybackRate from './RoomPlaybackRate';
import RoomPlayerMenu from './RoomPlayerMenu';
import RoomChatComposer from './RoomChatComposer';
import ChatMessageText from './ChatMessageText';

const playModes: { value: NonNullable<RoomSummary['playMode']>; label: string }[] = [
  { value: 'sequential', label: '自动连播' },
  { value: 'single', label: '单个播放' },
  { value: 'random', label: '随机播放' },
];

type Props = {
  controls: HTMLElement | null;
  playMode: NonNullable<RoomSummary['playMode']>;
  canSetPlayMode: boolean;
  playModeBusy: boolean;
  onPlayModeChange: (mode: NonNullable<RoomSummary['playMode']>) => void;
  playbackRate: number;
  canSetPlaybackRate: boolean;
  rateBusy: boolean;
  onPlaybackRateChange: (rate: number) => void;
  fullscreen: boolean;
  onFullscreen: () => void;
  connected: boolean;
  userId?: string;
  messages: RoomChatMessage[];
  liveMessages: RoomChatMessage[];
  sendChat: (text: string) => Promise<{ success: boolean; error?: string }>;
};

export default function RoomPlayerChat({ controls, playMode, canSetPlayMode, playModeBusy, onPlayModeChange, playbackRate, canSetPlaybackRate, rateBusy, onPlaybackRateChange, fullscreen, onFullscreen, connected, userId, messages, liveMessages, sendChat }: Props) {
  const [open, setOpen] = useState(false);
  const [danmaku, setDanmaku] = useState(true);
  const scroll = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => { if (!fullscreen) setOpen(false); }, [fullscreen]);
  useEffect(() => {
    if (open) follow.current = true;
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
    {controls && createPortal(<div className="watch-player-tools">
      <RoomPlaybackRate rate={playbackRate} canChange={canSetPlaybackRate} connected={connected}
        busy={rateBusy} onChange={onPlaybackRateChange} />
      <Tooltip label={`${danmaku ? '关闭弹幕' : '开启弹幕'} (D)`}><button aria-label={danmaku ? '关闭弹幕' : '开启弹幕'} aria-keyshortcuts="d" aria-pressed={danmaku} onClick={() => setDanmaku(value => !value)}><HiOutlineAnnotation /></button></Tooltip>
      <Tooltip label={`${open ? '收起聊天' : '展开聊天'} (C)`}><button ref={toggle} aria-label={open ? '收起聊天' : '展开聊天'} aria-keyshortcuts="c" aria-expanded={open} onClick={() => setOpen(value => !value)}><HiOutlineChatAlt2 /></button></Tooltip>
      <RoomPlayerMenu value={playMode} options={playModes} columns={1} label="播放设置"
        tooltip={`播放设置：${playModes.find(item => item.value === playMode)?.label}${canSetPlayMode ? '' : '（由房主或管理员调整）'}`}
        canChange={canSetPlayMode} connected={connected} busy={playModeBusy} onChange={onPlayModeChange}>
        <HiOutlineCog aria-hidden="true" />
      </RoomPlayerMenu>
      <Tooltip label={`${fullscreen ? '退出全屏' : '全屏观看'} (F)`}><button aria-label={fullscreen ? '退出全屏' : '全屏观看'} aria-keyshortcuts="f" onClick={onFullscreen}>{fullscreen ? <HiOutlineX /> : <HiOutlineArrowsExpand />}</button></Tooltip>
    </div>, controls)}
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
          <div className="watch-message-content"><header><strong>{message.username}</strong></header><p><ChatMessageText text={message.text} /></p></div>
        </article>)}
      </div>
      <RoomChatComposer compact connected={connected} sendChat={sendChat} label="全屏聊天内容"
        placeholder="发条弹幕..." onSent={() => { follow.current = true; }} />
    </section>}
  </>;
}
