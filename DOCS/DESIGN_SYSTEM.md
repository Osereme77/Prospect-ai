# Prospect AI design system

This is the implementation reference for the current React workspace. It records the existing visual and interaction language so new screens stay consistent. It is not a substitute for the owner's visual, mobile, contrast, keyboard, and screen-reader review.

## Visual tokens

| Token | Current value | Use |
| --- | --- | --- |
| Canvas | `#f7f8fb` | Main page background |
| Text | `#252536` | Default body text |
| Muted text | `#6b6c79` | Supporting text on white and canvas surfaces |
| Primary action | `#6653b5` | Main buttons and links |
| Primary hover | `#5946a4` | Hover state for primary actions |
| Focus ring | `#9b88e8` | Visible keyboard focus |
| Divider | `#ececf2` | Borders and table rules |
| Success | `#28724f` | Positive score and delivered states |
| Caution | `#78541e` | Low score and uncertainty cues |
| Type | `Inter`, system UI fallback | Application typography |

The shared token layer lives in `src/styles/tokens.css`. It defines semantic color, spacing, radius, elevation, focus, motion, and layout variables; core surfaces, navigation, buttons, score states, and focus outlines consume those tokens. A unit check enforces 4.5:1 contrast for the semantic normal-text color pairs. Spacing follows a compact 4/8 px rhythm. Cards use 8–10 px corners, controls use 6–7 px corners, and content width caps at 1420 px. Some legacy component-specific values remain literal and should be converted when those components are next revised.

## Layout and responsive rules

- Desktop navigation is a fixed left rail; the content area sits beside it and uses a centered maximum width.
- At 1050 px, the rail and content gutters contract and metric cards change to two columns.
- At 760 px, the rail becomes a slide-in menu, the main content uses the full width, filters and forms stack, and settings/admin grids become single-column where appropriate.
- At 520 px, evidence cards stack their content and actions.
- Tables keep a readable minimum width inside a horizontally scrollable container. Forms and detail panels must not create page-level horizontal overflow.
- Dialogs have a bounded viewport height and internal scrolling so their actions remain reachable on smaller screens.

## Component inventory and states

| Component | Implemented behavior |
| --- | --- |
| Primary/secondary buttons | Distinct filled and outlined emphasis, disabled states, visible keyboard focus |
| Form controls | Labels, native input semantics, validation, focus ring |
| Navigation | Active item, mobile toggle, unread count, role-gated Admin item |
| Lead table/cards | Type, score band, status selector, empty state, source attribution |
| Score display | 0–100 value, score band, component explanation, evidence caveats |
| Evidence card | Source link, observed time, verification state, owner review action |
| Dialogs | Accessible name, modal semantics, close/cancel actions, backdrop dismissal |
| Toasts | Short success/error feedback, `role=status`, polite live announcement |
| Admin tables | Loading, permission-denied, error/retry and empty states; narrow viewport scroll container |

## Content and uncertainty

- Label missing values as unknown or not recorded; do not convert missing evidence into a negative fact.
- Mark provider snippets and newly recorded evidence as unverified until the owner reviews them.
- Show the original source URL and observation time with evidence.
- Keep interpretations separate from direct observations; do not imply an inferred budget, contact, hiring intent, or requirement is confirmed.
- Explain score components and the reason for a suggested next action.

## Accessibility baseline

- Use native buttons, inputs, selects, tables, headings, and links where possible.
- Keep interactive controls keyboard reachable and show a 3 px focus outline.
- Give icon-only controls accessible names; pair error states with `role=alert` and status feedback with `role=status`/`aria-live`.
- Respect `prefers-reduced-motion` and avoid motion as the sole state indicator.
- Preserve sufficient text sizing and allow browser zoom. Validate actual color contrast, mobile navigation, screen-reader announcements, and complete keyboard journeys before release.

## Review checklist

Before approving a visual release, review the overview, list filters, detail/evidence dialog, research form, settings, notification review, and Admin page at desktop and phone widths. Check 200% zoom, keyboard-only operation, focus order, contrast, empty/loading/error states, and horizontal overflow. Record findings in [IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md).
