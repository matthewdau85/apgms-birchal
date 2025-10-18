if (import.meta.env.DEV && typeof window !== 'undefined') {
  (async () => {
    const [{ default: React }, { default: ReactDOM }, axe] = await Promise.all([
      import('react'),
      import('react-dom'),
      import('@axe-core/react')
    ]);

    axe(React, ReactDOM, 1000, undefined, (results) => {
      if (results.violations.length > 0) {
        // eslint-disable-next-line no-console
        console.warn('[axe]', results);
      }
    });
  })();
}
