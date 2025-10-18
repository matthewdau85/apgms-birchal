import { describe, expect, it } from 'vitest';
import { applyTheme, injectThemeStyles, themeCssText, themeTokens, themeVariableMap } from '../index.js';

describe('theme exports', () => {
  it('exposes a stable map of css variables', () => {
    expect(themeVariableMap['--apgms-color-background']).toBe(themeTokens.color.background);
    expect(themeCssText).toContain('--apgms-spacing-md');
  });

  it('injects theme styles into the document head', () => {
    const doc = document.implementation.createHTMLDocument();
    const styleElement = injectThemeStyles(doc);

    expect(styleElement.id).toBe('apgms-theme');
    expect(doc.head.querySelectorAll('style#apgms-theme')).toHaveLength(1);
    expect(styleElement.textContent).toBe(themeCssText);
  });

  it('applies token overrides to a target element', () => {
    const element = document.createElement('div');
    applyTheme(element, {
      color: {
        accent: '#ff0000',
      },
    });

    expect(element.style.getPropertyValue('--apgms-color-accent')).toBe('#ff0000');
  });
});
