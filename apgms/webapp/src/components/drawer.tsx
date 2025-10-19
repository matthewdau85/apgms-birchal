import { createPortal } from 'react-dom';
import { type ReactNode, useEffect, useRef } from 'react';
import { clsx } from 'clsx';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function Drawer({ open, onClose, title, children, footer }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    previousFocus.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusable = panel ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) : [];
    focusable[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      if (!panel) {
        return;
      }

      const focusableElements = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => !el.hasAttribute('disabled')
      );

      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const isShift = event.shiftKey;

      if (!isShift && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }

      if (isShift && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.classList.add('overflow-hidden');

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.classList.remove('overflow-hidden');
      previousFocus.current?.focus();
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-stretch justify-end">
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        className="absolute inset-0 bg-slate-950/40"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        className={clsx(
          'relative flex h-full w-full max-w-md flex-col bg-white shadow-xl focus:outline-none dark:bg-slate-900'
        )}
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-4 dark:border-slate-700">
          <h2 id="drawer-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-4 text-sm text-slate-600 dark:text-slate-300">{children}</div>
        {footer ? (
          <footer className="border-t border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-950">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
