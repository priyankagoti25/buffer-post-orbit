import { useEffect, useRef, type ReactNode } from 'react';
import Icon from '../Icon';

type Props = { title: string; onClose: () => void; children: ReactNode; wide?: boolean };

/** A simple dialog. Closes with the Escape key or a click on the dark background. */
export default function Modal({ title, onClose, children, wide = false }: Props) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-forest-900/40 p-4 sm:p-8"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`card my-auto w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} p-6 outline-none`}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="font-display text-2xl text-forest-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-sage-50" aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
