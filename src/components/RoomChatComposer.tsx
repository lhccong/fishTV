import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HiOutlineEmojiHappy, HiPaperAirplane, HiX } from 'react-icons/hi';
import { QQ_FACES, chatFragment, qqFaceToken, readChatEditor } from '../lib/qqFace';
import { QQFaceImage } from './ChatMessageText';
import Tooltip from './Tooltip';

type Props = {
  connected: boolean;
  sendChat: (text: string) => Promise<{ success: boolean; error?: string }>;
  label: string;
  placeholder: string;
  compact?: boolean;
  onSent?: () => void;
};

export default function RoomChatComposer({ connected, sendChat, label, placeholder, compact = false, onSent }: Props) {
  const editor = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const selection = useRef<Range | null>(null);
  const lastValid = useRef('');
  const inFlight = useRef(false);
  const composing = useRef(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [grid, setGrid] = useState<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({ left: 8, top: 8, width: 280, height: 280 });
  const id = useId();
  const disabled = !connected || busy;

  const rememberSelection = () => {
    const current = window.getSelection();
    if (current?.rangeCount && editor.current?.contains(current.anchorNode) && editor.current.contains(current.focusNode)) {
      selection.current = current.getRangeAt(0).cloneRange();
    }
  };
  const focusEnd = () => {
    const node = editor.current;
    if (!node) return;
    node.focus();
    const range = document.createRange();
    range.selectNodeContents(node); range.collapse(false);
    window.getSelection()?.removeAllRanges(); window.getSelection()?.addRange(range);
    rememberSelection();
  };
  const sync = () => {
    const node = editor.current;
    if (!node || composing.current) return;
    const text = readChatEditor(node);
    if (text.length > 500) {
      node.replaceChildren(chatFragment(lastValid.current));
      setError('消息最多 500 字（包含表情占位）'); focusEnd(); return;
    }
    lastValid.current = text;
    setDraft(text);
    rememberSelection();
  };
  const insert = (text: string) => {
    const node = editor.current;
    if (!node || disabled || composing.current) return;
    let range = selection.current;
    if (!range || !node.contains(range.commonAncestorContainer)) {
      range = document.createRange(); range.selectNodeContents(node); range.collapse(false);
    }
    if (readChatEditor(node).length - readChatEditor(range.cloneContents()).length + text.length > 500) {
      setError('消息最多 500 字（包含表情占位）'); node.focus(); return;
    }
    range.deleteContents();
    const fragment = chatFragment(text), last = fragment.lastChild;
    range.insertNode(fragment);
    if (last) range.setStartAfter(last);
    range.collapse(true); node.focus();
    window.getSelection()?.removeAllRanges(); window.getSelection()?.addRange(range);
    setError(''); sync();
  };
  const submit = async () => {
    if (!editor.current) return;
    const text = readChatEditor(editor.current).trim();
    if (!text || disabled || inFlight.current || composing.current) return;
    if (text.length > 500) { setError('消息最多 500 字（包含表情占位）'); return; }
    inFlight.current = true; setBusy(true); setOpen(false); setError('');
    try {
      const result = await sendChat(text);
      if (result.success) {
        editor.current?.replaceChildren();
        selection.current = null; lastValid.current = ''; setDraft(''); onSent?.();
      } else setError(result.error || '消息发送失败，请重试');
    } catch { setError('消息发送失败，请重试'); }
    finally { inFlight.current = false; setBusy(false); }
  };

  useEffect(() => { if (compact) editor.current?.focus(); }, [compact]);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const view = window.visualViewport;
      const width = view?.width || innerWidth, height = view?.height || innerHeight;
      const x = view?.offsetLeft || 0, y = view?.offsetTop || 0;
      const panelWidth = Math.min(280, width - 16), panelHeight = Math.min(280, height - 16);
      setPosition({ width: panelWidth, height: panelHeight,
        left: Math.max(x + 8, Math.min(rect.left, x + width - panelWidth - 8)),
        top: Math.max(y + 8, Math.min(rect.top - panelHeight - 8, y + height - panelHeight - 8)) });
    };
    place();
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target) && !panel.current?.contains(event.target)) setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('fullscreenchange', close);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    window.visualViewport?.addEventListener('resize', place);
    return () => {
      document.removeEventListener('pointerdown', outside); document.removeEventListener('fullscreenchange', close);
      window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true);
      window.visualViewport?.removeEventListener('resize', place);
    };
  }, [open]);

  return <div ref={root} className="watch-chat-composer">
    {error && <p className="watch-composer-error" role="alert">{error}</p>}
    <form className="watch-chat-form" onSubmit={event => { event.preventDefault(); void submit(); }}>
      <Tooltip label="QQ 表情"><button ref={trigger} type="button" className="watch-emoji-trigger" aria-label="QQ 表情"
        disabled={disabled} aria-expanded={open} aria-controls={open ? id : undefined}
        onMouseDown={event => event.preventDefault()} onClick={() => { rememberSelection(); setOpen(value => !value); }}>
        <HiOutlineEmojiHappy aria-hidden="true" />
      </button></Tooltip>
      <div ref={editor} className="watch-chat-editor" role="textbox" aria-label={label} aria-multiline="false"
        aria-disabled={disabled} contentEditable={!disabled} suppressContentEditableWarning data-placeholder={placeholder}
        data-empty={!draft.trim()} onInput={sync} onKeyUp={rememberSelection} onMouseUp={rememberSelection} onBlur={rememberSelection}
        onCompositionStart={() => { composing.current = true; }}
        onCompositionEnd={() => { composing.current = false; sync(); }}
        onPaste={event => { event.preventDefault(); rememberSelection(); insert(event.clipboardData.getData('text/plain').replace(/[\r\n]+/g, ' ')); }}
        onDrop={event => event.preventDefault()}
        onCopy={event => {
          const current = window.getSelection();
          const range = current?.rangeCount ? current.getRangeAt(0) : null;
          if (range && editor.current?.contains(range.commonAncestorContainer)) {
            event.preventDefault(); event.clipboardData.setData('text/plain', readChatEditor(range.cloneContents()));
          }
        }}
        onCut={event => {
          const current = window.getSelection();
          const range = current?.rangeCount ? current.getRangeAt(0) : null;
          if (range && editor.current?.contains(range.commonAncestorContainer)) {
            event.preventDefault(); event.clipboardData.setData('text/plain', readChatEditor(range.cloneContents()));
            if (!disabled) { range.deleteContents(); sync(); }
          }
        }}
        onKeyDown={event => {
          if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); }
          if (event.key === 'Enter') {
            event.preventDefault();
            if (!composing.current && !event.nativeEvent.isComposing && event.keyCode !== 229) void submit();
          }
        }} />
      <Tooltip label="发送消息"><button className="watch-primary" type="submit" aria-label="发送消息" disabled={disabled || !draft.trim()}>
        {compact ? <HiPaperAirplane aria-hidden="true" /> : '发送'}
      </button></Tooltip>
    </form>
    {open && !disabled && createPortal(<section ref={panel} id={id} className="watch-emoji-panel no-invert" role="dialog" aria-label="QQ 表情面板"
      style={position} onKeyDown={event => {
        event.stopPropagation();
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); editor.current?.focus(); }
      }}>
      <header><strong>QQ 表情</strong><Tooltip label="关闭表情"><button type="button" aria-label="关闭表情" onClick={() => { setOpen(false); editor.current?.focus(); }}><HiX /></button></Tooltip></header>
      <div ref={setGrid} className="watch-emoji-grid">
        {QQ_FACES.map(face => <Tooltip key={face.id} label={face.label}><button type="button" aria-label={face.label}
          onMouseDown={event => event.preventDefault()} onClick={() => insert(qqFaceToken(face.id))}>
          <QQFaceImage id={face.id} label={face.label} observeRoot={grid} />
        </button></Tooltip>)}
      </div>
    </section>, document.fullscreenElement || document.body)}
  </div>;
}
