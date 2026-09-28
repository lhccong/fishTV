import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { RoomChatMessage } from '../hooks/useRoomSocket';
import { clipChatText } from '../lib/qqFace';
import ChatMessageText from './ChatMessageText';

const DURATION = 8000;
type Bullet = { message: RoomChatMessage; lane: number; expires: number };

export default function RoomDanmaku({ events, enabled, userId }: {
  events: RoomChatMessage[]; enabled: boolean; userId?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const seen = useRef(new Set(events.map(message => message.id)));
  const queue = useRef<Array<{ message: RoomChatMessage; received: number }>>([]);
  const running = useRef<Bullet[]>([]);
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [size, setSize] = useState({ width: 0, lanes: 0 });

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, lanes: Math.min(4, Math.max(0, Math.floor(entry.contentRect.height / 38))) });
    });
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    for (const message of events) {
      if (!seen.current.has(message.id) && enabled && document.visibilityState === 'visible') {
        queue.current.push({ message, received: performance.now() });
      }
    }
    seen.current = new Set(events.map(message => message.id));
    queue.current = queue.current.slice(-24);
    if (!enabled) { queue.current = []; running.current = []; setBullets([]); }
  }, [events, enabled]);

  useEffect(() => {
    // A lane stays reserved for the entire flight so long messages cannot catch each other.
    running.current = []; setBullets([]);
    if (!enabled || !size.width || !size.lanes) return;
    const tick = () => {
      const now = performance.now();
      const next = running.current.filter(bullet => bullet.expires > now);
      queue.current = queue.current.filter(item => now - item.received < 12000);
      if (document.visibilityState === 'hidden') { queue.current = []; return; }
      for (let lane = 0; lane < size.lanes && queue.current.length; lane++) {
        if (next.some(bullet => bullet.lane === lane)) continue;
        next.push({ message: queue.current.shift()!.message, lane, expires: now + DURATION });
      }
      running.current = next;
      setBullets(next);
    };
    tick();
    const timer = window.setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [enabled, size.width, size.lanes]);

  return <div ref={container} className="watch-danmaku" aria-hidden="true"
    style={{ '--danmaku-travel': `${size.width}px`, '--danmaku-duration': `${DURATION}ms` } as CSSProperties}>
    {bullets.map(({ message, lane }) => {
      const text = clipChatText(message.text.replace(/\s+/g, ' '), 100);
      return <span key={message.id} className={`watch-bullet ${message.userId === userId ? 'watch-bullet-self' : ''}`}
        style={{ top: `${lane * 38}px` }}>
        {Array.from(message.username).slice(0, 16).join('')}：<ChatMessageText text={text} />
      </span>;
    })}
  </div>;
}
