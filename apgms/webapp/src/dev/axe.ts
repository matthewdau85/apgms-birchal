if (import.meta.env.DEV) {
  void Promise.all([
    import('@axe-core/react'),
    import('react'),
    import('react-dom')
  ]).then(([axe, React, ReactDOM]) => {
    axe.default(React, ReactDOM, 1000);
  });
}
