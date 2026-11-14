import type { ReactNode } from 'react';
import Icon from '../Icon';

const STYLES = {
  error: 'bg-red-50 text-red-800 border-red-100',
  success: 'bg-sage-100 text-forest-800 border-sage-200',
  info: 'bg-mist-100 text-forest-900 border-mist-200',
  warning: 'bg-sand-100 text-sand-700 border-[#f1e1bb]',
} as const;

type Props = { kind?: keyof typeof STYLES; children: ReactNode; className?: string; onDismiss?: () => void };

export default function Notice({ kind = 'info', children, className = '', onDismiss }: Props) {
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${STYLES[kind]} ${className}`}
    >
      <Icon name={kind === 'success' ? 'check' : kind === 'info' ? 'bulb' : 'alert'} className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
      {onDismiss && (
        <button onClick={onDismiss} aria-label="Dismiss" className="shrink-0 opacity-70 hover:opacity-100">
          <Icon name="close" className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
