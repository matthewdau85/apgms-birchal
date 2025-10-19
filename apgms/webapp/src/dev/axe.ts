export async function runAxe() {
  if (!import.meta.env.DEV) {
    return;
  }

  try {
    const axeModule = await import('axe-core');
    const axe = axeModule.default ?? axeModule;
    const { violations } = await axe.run(document);

    if (violations.length > 0) {
      console.warn('[axe] Accessibility violations detected:', violations);
    }
  } catch (error) {
    console.warn('[axe] Failed to run accessibility checks:', error);
  }
}
