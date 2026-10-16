## Accessibility & Theming Overview

This page is designed to align with **WCAG 2.2 AA** and ADA best practices. The main building blocks are:

- **Landmarks & structure**: The page uses `header` (banner), `main` (with `id="main-content"`), and `footer` (contentinfo), with clearly labelled `section` elements for **categories**, **item selection**, and **results**.
- **Headings**: There is a single `<h1>` for the page title and `<h2>` headings for each major section (`Choose a Category`, `Choose Your Items`, `Your Selected Items`).
- **Forms & controls**: Interactive elements are native controls wherever possible:
  - Category tiles are keyboard-focusable elements with `role="button"` and Enter/Space handlers.
  - Item choices are `<input type="checkbox">` elements with associated `<label>`s.
  - Navigation and submission use `<button>` elements with clear text.

### Live region and announcements

- Screen-reader announcements use a **persistent live region**:
  - Element: `#live-region` with `role="status"`, `aria-live="polite"`, and visually-hidden (`.sr-only`) styles.
  - JavaScript helper: `announceToScreenReader(message)` sets the text content so changes are announced.
- This is used for:
  - Theme changes (light/dark mode).
  - Selection counts and result-card selection.
  - View changes between categories, items, and results.

### Keyboard and focus behavior

- All interactive elements are reachable via **Tab** / **Shift+Tab**.
- View changes (`categories` → `items` → `results` and back) move focus to the relevant section heading using JavaScript (`switchView`), which improves orientation for screen readers and keyboard users.
- Focus visibility:
  - Focus outlines are defined with `:focus-visible` only, so mouse users do not see redundant focus rings.
  - The color and thickness of focus outlines are controlled by the `--focus-ring` token for both light and dark themes.

### Theming with CSS custom properties

The page uses a `data-theme` attribute on the root `<html>` element, toggled by JavaScript (`toggleTheme` in `script.js`), to switch between light and dark themes.

- **Light theme tokens** are defined under `:root` in `styles.css`.
- **Dark theme tokens** are defined under `[data-theme="dark"]`.

Key tokens:

- `--bg-color`, `--container-bg`: Page and panel backgrounds.
- `--text-color`, `--h2-color`, `--item-label-color`, `--muted-text-color`: Primary, heading, item-label, and secondary text colors.
- `--border-color`: Default borders and dividers.
- `--header-bg`, `--header-text`: Header gradient and text.
- `--card-bg`, `--card-hover-bg`: Card backgrounds for category tiles and items.
- `--button-bg`, `--button-text`, `--button-disabled-bg`, `--button-disabled-text`: Primary button colors and disabled state.
- `--button-secondary-bg`, `--button-secondary-text`: Secondary/back button colors, adapted per theme.
- `--image-border-color`, `--image-bg-color`: Frame colors for item preview images and selected-item images.
- `--selected-border`, `--selected-bg`: Selected state for result cards.
- `--focus-ring`: High-contrast focus outline color used across interactive controls.

When adding new components, prefer using these tokens instead of hard-coded colors to preserve accessible contrast in both themes.

### WCAG 2.2 considerations

- **Contrast (1.4.x)**:
  - Text and important UI elements in dark mode use light text on dark backgrounds, with contrast tuned to meet or exceed WCAG 2.2 AA targets (≈4.5:1 for body text, 3:1 for large text and non-text UI).
  - Selected states and focus outlines use saturated, high-contrast colors for clear affordances.
- **Keyboard access (2.1.x, 2.2.x)**:
  - No interaction requires a mouse; all can be done with keyboard-only navigation.
  - Focus is never hidden while navigating via keyboard.
- **Hit targets (2.5.8)**:
  - Category tiles, item rows, and buttons are sized and spaced to approximate or exceed a 44×44 CSS pixel hit area.
- **Motion & preferences**:
  - Smooth transitions are kept subtle.
  - `prefers-reduced-motion: reduce` disables animations and transitions.
  - `prefers-contrast: high` increases border/focus emphasis for high contrast environments.

### How to extend accessibly

When you add new UI:

1. **Use semantic HTML first**: prefer `<button>`, `<a>`, `<input>`, `<label>`, `<section>`, `<header>`, `<main>`, `<footer>` before introducing custom roles.
2. **Hook into theming tokens**: use the existing CSS variables instead of raw hex values so colors remain accessible in both themes.
3. **Preserve keyboard and screen reader support**:
   - Ensure new interactive elements are focusable and clearly labelled (visible text or `aria-label`/`aria-labelledby`).
   - Announce significant dynamic updates with the existing `announceToScreenReader` helper and `#live-region` when appropriate.
4. **Spot check with tools**:
   - Test keyboard-only navigation.
   - Run an automated checker (Lighthouse, axe, or WAVE) to catch regressions in name/role/value, contrast, headings, and landmarks.

