import styles from './ScreenLoadingState.module.css';

export const ScreenLoadingState = () => (
  <div role="status" className={styles.container} aria-live="polite">
    <div className={styles.spinner} aria-hidden />
    <p>Loading dashboard…</p>
  </div>
);
