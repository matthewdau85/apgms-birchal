const rootElement = document.querySelector('#root');

if (rootElement) {
  rootElement.textContent = 'webapp';
}

if (import.meta.env.DEV) {
  requestAnimationFrame(async () => {
    const { runAxe } = await import('./dev/axe');
    await runAxe();
  });
}
