import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { HiOutlineCheck } from 'react-icons/hi';
import Tooltip from './Tooltip';

type Props<T extends string | number> = {
  value: T;
  options: readonly { value: T; label: string }[];
  label: string;
  tooltip: string;
  children: ReactNode;
  columns?: 1 | 2;
  canChange: boolean;
  connected: boolean;
  busy: boolean;
  onChange: (value: T) => void;
};

export default function RoomPlayerMenu<T extends string | number>({ value, options: items, label, tooltip, children, columns = 2, canChange, connected, busy, onChange }: Props<T>) {
  const [open, setOpen] = useState(false);
  const [maxHeight, setMaxHeight] = useState(200);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  const disabled = !canChange || !connected || busy;
  const expanded = open && !disabled;

  const close = () => { setOpen(false); trigger.current?.focus(); };

  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  useLayoutEffect(() => {
    if (!expanded) return;
    const player = root.current?.closest('.watch-video');
    const resize = () => {
      if (player && trigger.current) {
        setMaxHeight(Math.max(0, trigger.current.getBoundingClientRect().top - player.getBoundingClientRect().top - 16));
      }
    };
    resize();
    const observer = new ResizeObserver(resize);
    if (player) observer.observe(player);
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    options.current[items.findIndex(item => item.value === value)]?.focus({ preventScroll: true });
    return () => { observer.disconnect(); document.removeEventListener('pointerdown', outside); };
  }, [expanded, value, items]);

  return <div ref={root} className="watch-rate-control" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <Tooltip label={tooltip}>
      <button ref={trigger} id={`${id}-trigger`} type="button" className={columns === 1 ? 'watch-mode-trigger' : 'watch-rate-trigger'}
        aria-label={label} aria-haspopup="menu" aria-expanded={expanded}
        aria-controls={expanded ? `${id}-menu` : undefined} aria-busy={busy} disabled={disabled}
        onClick={() => setOpen(value => !value)}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault(); setOpen(true);
          } else if (event.key === 'Escape' && expanded) {
            event.preventDefault(); event.stopPropagation(); close();
          }
        }}>
        {children}
      </button>
    </Tooltip>
    {expanded && <div id={`${id}-menu`} className={`watch-rate-menu${columns === 1 ? ' watch-mode-menu' : ''}${maxHeight < 146 ? ' watch-rate-menu-compact' : ''}`} role="menu"
      aria-labelledby={`${id}-trigger`} style={{ maxHeight }}
      onKeyDown={event => {
        const index = options.current.findIndex(option => option === document.activeElement);
        let next = index;
        if (event.key === 'ArrowDown') next = (index + columns) % items.length;
        else if (event.key === 'ArrowUp') next = (index + items.length - columns) % items.length;
        else if (event.key === 'ArrowRight') next = (index + 1) % items.length;
        else if (event.key === 'ArrowLeft') next = (index + items.length - 1) % items.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = items.length - 1;
        else if (event.key === 'Escape') {
          event.preventDefault(); event.stopPropagation(); close(); return;
        } else if (event.key === 'Tab') { close(); return; }
        else return;
        event.preventDefault(); event.stopPropagation();
        options.current[next]?.focus();
      }}>
      {items.map((item, index) => <button key={item.value} ref={node => { options.current[index] = node; }}
        type="button" role="menuitemradio" aria-checked={item.value === value} tabIndex={-1}
        className="watch-rate-option" onClick={() => {
          close();
          if (item.value !== value) onChange(item.value);
        }}>
        <span>{item.label}</span><HiOutlineCheck aria-hidden="true" />
      </button>)}
    </div>}
  </div>;
}
