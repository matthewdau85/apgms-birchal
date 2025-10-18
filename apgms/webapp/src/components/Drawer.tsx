import { ReactNode, useEffect, useId, useRef } from 'react';
import FocusTrap from 'focus-trap-react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/cn';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}

export const Drawer = ({ open, onClose, title, description, children }: DrawerProps) => {
  const previouslyFocusedElement = useRef<Element | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open || typeof document === 'undefined') {
      return;
    }

    previouslyFocusedElement.current = document.activeElement;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocusedElement.current instanceof HTMLElement) {
        previouslyFocusedElement.current.focus();
      }
      previouslyFocusedElement.current = null;
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      aria-modal="true"
      role="dialog"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-900/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <FocusTrap focusTrapOptions={{ clickOutsideDeactivates: true }}>
        <aside
          className={cn(
            'relative h-full w-full max-w-md overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900',
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <header className="flex items-start justify-between gap-4">
            <div>
              <h2 id={titleId} className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {title}
              </h2>
              {description ? (
                <p id={descriptionId} className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-transparent bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Close
            </button>
          </header>
          <div className="mt-4 space-y-4">{children}</div>
        </aside>
      </FocusTrap>
    </div>,
    document.body,
  );
};
