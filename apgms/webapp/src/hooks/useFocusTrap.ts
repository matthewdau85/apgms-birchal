import { MutableRefObject, useEffect } from 'react';

export function useFocusTrap<T extends HTMLElement>(ref: MutableRefObject<T | null>, active: boolean) {
  useEffect(() => {
    if (!active) {
      return;
    }

    const node = ref.current;
    if (!node) {
      return;
    }

    const focusableSelectors = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ];

    const getFocusable = () => Array.from(node.querySelectorAll<HTMLElement>(focusableSelectors.join(',')));

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') {
        return;
      }

      const focusable = getFocusable();
      if (!focusable.length) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    node.addEventListener('keydown', handleKeyDown);

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const toFocus = getFocusable()[0];
    toFocus?.focus();

    return () => {
      node.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [ref, active]);
}
