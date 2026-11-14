import { useCallback, useRef, useState, type ReactNode } from 'react';
import Modal from '../Modal';

export type ConfirmOptions = {
  title: string;
  message: ReactNode;
  /** Text on the main button. Default "Confirm". */
  confirmLabel?: string;
  /** Text on the other button. Pass null to show only one button (a simple notice). */
  cancelLabel?: string | null;
  /** Use red styling for actions that delete something. */
  danger?: boolean;
};

/**
 * Replaces the browser's confirm() and alert() with our own dialog.
 *
 *   const { confirm, dialog } = useConfirm();
 *   if (!(await confirm({ title: 'Delete?', message: '...', danger: true }))) return;
 *   ...
 *   return <>{dialog} ...page...</>;
 */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback(
    (o: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolver.current?.(false);
        resolver.current = resolve;
        setOptions(o);
      }),
    [],
  );

  const close = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOptions(null);
  }, []);

  const dialog = options && (
    <Modal title={options.title} onClose={() => close(false)}>
      <div className="text-sm leading-6 text-muted">{options.message}</div>
      <div className="mt-6 flex justify-end gap-2">
        {options.cancelLabel !== null && (
          <button className="btn btn-ghost" onClick={() => close(false)}>
            {options.cancelLabel ?? 'Cancel'}
          </button>
        )}
        <button className={`btn ${options.danger ? 'btn-danger' : 'btn-primary'}`} autoFocus onClick={() => close(true)}>
          {options.confirmLabel ?? 'Confirm'}
        </button>
      </div>
    </Modal>
  );

  return { confirm, dialog };
}
