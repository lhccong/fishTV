import { useId, type ReactNode } from 'react';

export default function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return <span className="watch-tooltip" aria-describedby={id}>
    {children}
    <span id={id} role="tooltip" className="watch-tooltip-label">{label}</span>
  </span>;
}
