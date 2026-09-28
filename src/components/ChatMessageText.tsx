import { useEffect, useRef, useState } from 'react';
import { parseChatText, qqFaceUrl } from '../lib/qqFace';

export function QQFaceImage({ id, label, observeRoot }: { id: string; label: string; observeRoot?: HTMLElement | null }) {
  const host = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(observeRoot === undefined);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (visible || !observeRoot || !host.current) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { root: observeRoot, rootMargin: '64px' });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, [visible, observeRoot]);
  return <span ref={host} className="watch-qqface-slot">
    {failed ? <span className="watch-qqface-fallback">[{label}]</span> : visible ?
      <img className="watch-qqface" src={qqFaceUrl(id)} alt={`[${label}]`} draggable={false} decoding="async"
        onError={() => setFailed(true)} /> : <span className="watch-qqface-loading" />}
  </span>;
}

export default function ChatMessageText({ text }: { text: string }) {
  return <>{parseChatText(text).map((part, index) => typeof part === 'string' ? part :
    <QQFaceImage key={`${index}:${part.id}`} id={part.id} label={part.label} />)}</>;
}
