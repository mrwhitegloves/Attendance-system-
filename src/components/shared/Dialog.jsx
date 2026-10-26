'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from './ui.jsx';

/** A centred window over the page. Closes with Escape or the close button. */
export function Dialog({ open, onClose, title, children, footer, size = 'md' }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' };
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className={`w-[calc(100%-2rem)] ${widths[size]} rounded-xl border border-border bg-surface p-0 text-text shadow-xl backdrop:bg-black/50`}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="text-base font-semibold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-muted hover:bg-raised"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && (
            <div className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>
          )}
        </div>
      )}
    </dialog>
  );
}

/** Asks before something hard to undo. */
export function ConfirmDialog({
  open,
  title,
  text,
  confirmLabel = 'Confirm',
  danger,
  busy,
  onConfirm,
  onClose,
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted">{text}</p>
    </Dialog>
  );
}
