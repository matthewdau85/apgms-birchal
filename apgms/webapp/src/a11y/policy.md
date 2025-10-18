# Front-end Accessibility Policy

## Focus Outlines
- Maintain visible focus styles for all interactive elements.
- Use the `:focus-visible` pseudo-class to provide a consistent outline with at least a 3:1 contrast ratio against adjacent colors.
- Do not remove outlines unless a custom focus indicator that meets WCAG 2.2 Success Criterion 2.4.11 is applied.

## Skip to Content
- Provide a "Skip to main content" link as the first interactive element on every page.
- Ensure the skip link becomes visible when focused and transfers focus to the main landmark (`<main>` or equivalent).
- Main content targets must have `tabindex="-1"` (or manage focus programmatically) to support keyboard activation of the skip link.

## Color Contrast Reference
- Text and interactive controls must meet WCAG 2.1 Level AA contrast: 4.5:1 for body text, 3:1 for large text (≥24px or 18.66px bold), and 3:1 for non-text interactive indicators.
- Reference: [W3C Understanding Success Criterion 1.4.3 Contrast (Minimum)](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html).
- Use automated tooling (e.g., Axe, Lighthouse) during development to validate contrast ratios before release.
