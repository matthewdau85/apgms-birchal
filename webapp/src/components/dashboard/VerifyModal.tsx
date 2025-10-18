import FocusTrap from 'focus-trap-react';
import { useEffect } from 'react';
import { Button } from '../ui/Button';
import styles from './VerifyModal.module.css';

type VerifyModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
};

export const VerifyModal = ({ open, onOpenChange, onConfirm }: VerifyModalProps) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false);
      }
    };

    if (open) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className={styles.overlay} role="presentation" onClick={() => onOpenChange(false)}>
      <FocusTrap>
        <div
          className={styles.dialog}
          role="dialog"
          aria-modal="true"
          aria-labelledby="verify-title"
          aria-describedby="verify-description"
          onClick={(event) => event.stopPropagation()}
        >
          <h2 id="verify-title">Verify Reporting Package</h2>
          <p id="verify-description">
            Confirm that the bank provided reporting package has been reviewed and reconciled. This
            action will set the RPT status to verified.
          </p>
          <div className={styles.actions}>
            <Button variant="ghost" onClick={() => onOpenChange(false)} autoFocus>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                await onConfirm();
              }}
            >
              Mark as verified
            </Button>
          </div>
        </div>
      </FocusTrap>
    </div>
  );
};
