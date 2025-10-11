# Accessibility Checklist

The checklist below summarises accessibility requirements aligned with WCAG 2.1 AA. Each item should be validated before release.

## Perception

- [ ] Provide text alternatives for non-text content (WCAG 1.1.1).
- [ ] Ensure captions and transcripts are available for multimedia (WCAG 1.2.x).
- [ ] Maintain sufficient colour contrast (minimum 4.5:1 for body text) (WCAG 1.4.3).
- [ ] Support text resizing up to 200% without loss of content (WCAG 1.4.4).

## Operability

- [ ] All functionality available via keyboard (WCAG 2.1.1).
- [ ] Provide focus indicators for interactive components (WCAG 2.4.7).
- [ ] Prevent keyboard traps and allow escape mechanisms (WCAG 2.1.2).
- [ ] Avoid content that flashes more than 3 times per second (WCAG 2.3.1).

## Understandability

- [ ] Use clear headings and labels that describe purpose (WCAG 2.4.6).
- [ ] Ensure forms provide error identification and guidance (WCAG 3.3.1/3.3.3).
- [ ] Provide consistent navigation and component behaviour (WCAG 3.2.3).
- [ ] Support language declarations for content (`lang` attribute) (WCAG 3.1.1).

## Robustness

- [ ] Validate against HTML standards; resolve AXE `critical` and `serious` issues.
- [ ] Include automated accessibility testing in CI (`npm run test:accessibility`).
- [ ] Conduct manual screen reader review (NVDA, VoiceOver) before major releases.
- [ ] Document exceptions and compensating controls in the Accessibility Log.

## Sign-off

| Release | Reviewer | Date | Notes |
| --- | --- | --- | --- |
|  |  |  |  |

