import React, { useEffect, useId, useRef } from 'react';
import clsx from 'clsx';

type DrawerProps = {
  side?: 'left' | 'right';
  title: string;
  description?: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function Drawer({ title, description, open, onClose, children, footer, side = 'right' }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = description ? `${titleId}-description` : undefined;

  useEffect(() => {
    if (!open) return;
    const node = panelRef.current;
    if (!node) return;

    const focusable = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    (first ?? node).focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
      if (event.key === 'Tab' && focusable.length > 0) {
        if (event.shiftKey && document.activeElement === (first ?? node)) {
          event.preventDefault();
          (last ?? node).focus();
        } else if (!event.shiftKey && document.activeElement === (last ?? node)) {
          event.preventDefault();
          (first ?? node).focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className={clsx('fixed inset-0 z-40 flex', side === 'right' ? 'justify-end' : 'justify-start')}>
      <div
        className="fixed inset-0 bg-slate-900/60"
        aria-hidden="true"
        onClick={onClose}
        role="presentation"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className={clsx(
          'relative flex h-full w-full max-w-xl flex-col bg-white shadow-xl dark:bg-slate-900',
          side === 'right'
            ? 'border-l border-slate-200 dark:border-slate-800'
            : 'border-r border-slate-200 dark:border-slate-800'
        )}
      >
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="text-sm text-slate-500 dark:text-slate-400">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-transparent p-2 text-slate-500 transition hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <span className="sr-only">Close drawer</span>
            <CloseIcon aria-hidden="true" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{children}</div>
        {footer ? <div className="border-t border-slate-200 px-6 py-4 dark:border-slate-800">{footer}</div> : null}
      </div>
    </div>
  );
}

function CloseIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="m6 6 8 8m0-8-8 8" />
    </svg>
  );
}
