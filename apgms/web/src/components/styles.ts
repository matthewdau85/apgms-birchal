const styles = `
@keyframes apgms-skeleton {
  0% {
    background-position: -200px 0;
  }
  100% {
    background-position: calc(200px + 100%) 0;
  }
}

.apgms-card {
  background-color: var(--apgms-color-surface);
  border-radius: var(--apgms-radius-md);
  border: 1px solid var(--apgms-color-border);
  box-shadow: var(--apgms-shadow-sm);
  padding: var(--apgms-spacing-lg);
  color: var(--apgms-color-text-primary);
  font-family: var(--apgms-typography-font-family);
}

.apgms-card h2 {
  font-size: var(--apgms-typography-size-lg);
  line-height: var(--apgms-typography-line-height-tight);
  font-weight: var(--apgms-typography-weight-semibold);
  margin-bottom: var(--apgms-spacing-md);
}

.apgms-status-message {
  display: grid;
  gap: var(--apgms-spacing-sm);
  justify-items: flex-start;
  padding: var(--apgms-spacing-lg);
  border-radius: var(--apgms-radius-md);
  background-color: var(--apgms-color-surface-muted);
  border: 1px dashed var(--apgms-color-border);
}

.apgms-status-message[data-variant='error'] {
  border-color: var(--apgms-color-destructive);
  color: var(--apgms-color-destructive);
}

.apgms-status-message button {
  padding: var(--apgms-spacing-xs) var(--apgms-spacing-md);
  border-radius: var(--apgms-radius-sm);
  border: none;
  background-color: var(--apgms-color-accent);
  color: var(--apgms-color-text-inverted);
  font-weight: var(--apgms-typography-weight-medium);
  cursor: pointer;
}

.apgms-status-message button:focus-visible {
  outline: 3px solid var(--apgms-color-focus);
  outline-offset: 2px;
}

.apgms-data-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--apgms-spacing-sm);
}

.apgms-skeleton {
  background-size: 200px 100%;
  position: relative;
  overflow: hidden;
}
`;

export const injectComponentStyles = (doc: Document = document) => {
  const existing = doc.getElementById('apgms-component-styles');
  if (existing) {
    existing.textContent = styles;
    return existing as HTMLStyleElement;
  }

  const style = doc.createElement('style');
  style.id = 'apgms-component-styles';
  style.textContent = styles;
  doc.head.appendChild(style);
  return style;
};

export { styles as componentStyles };
