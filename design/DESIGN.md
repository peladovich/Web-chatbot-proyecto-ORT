---
name: Warm Human Editorial
colors:
  surface: '#faf9f6'
  surface-dim: '#dbdad7'
  surface-bright: '#faf9f6'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f3f0'
  surface-container: '#efeeeb'
  surface-container-high: '#e9e8e5'
  surface-container-highest: '#e3e2df'
  on-surface: '#1b1c1a'
  on-surface-variant: '#47464b'
  inverse-surface: '#2f312f'
  inverse-on-surface: '#f2f1ee'
  outline: '#77767b'
  outline-variant: '#c8c5cb'
  surface-tint: '#5f5e61'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1b1b1e'
  on-primary-container: '#858387'
  inverse-primary: '#c8c5ca'
  secondary: '#ac3400'
  on-secondary: '#ffffff'
  secondary-container: '#fd6b36'
  on-secondary-container: '#5d1900'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#2f1500'
  on-tertiary-container: '#c76c00'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e4e1e6'
  primary-fixed-dim: '#c8c5ca'
  on-primary-fixed: '#1b1b1e'
  on-primary-fixed-variant: '#47464a'
  secondary-fixed: '#ffdbd0'
  secondary-fixed-dim: '#ffb59d'
  on-secondary-fixed: '#390c00'
  on-secondary-fixed-variant: '#832600'
  tertiary-fixed: '#ffdcc3'
  tertiary-fixed-dim: '#ffb77d'
  on-tertiary-fixed: '#2f1500'
  on-tertiary-fixed-variant: '#6e3900'
  background: '#faf9f6'
  on-background: '#1b1c1a'
  surface-variant: '#e3e2df'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '600'
    lineHeight: 56px
    letterSpacing: -0.025em
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 34px
    fontWeight: '600'
    lineHeight: 42px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '600'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 19px
    fontWeight: '400'
    lineHeight: 32px
    letterSpacing: '0'
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
    letterSpacing: '0'
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: 0.005em
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: '0'
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.015em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  gutter-desktop: 2.5rem
  margin: 1.5rem
  margin-mobile: 1.25rem
  margin-desktop: 4rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.75rem
  space-xl: 3rem
---

## Brand & Style

This design system embraces an ultra-minimalist, quiet, tactile digital publication aesthetic rooted in the traditions of book design and modern independent print journals. The audience consists of thoughtful readers, writers, and culture patrons who value sustained focus, editorial clarity, and physical presence in digital artifacts.

The visual style is defined by:
- **Quiet Warmth:** An inviting off-white foundation reminiscent of tactile heavy book stock or unbleached linen, avoiding clinical high-glare whites and stark pitch-blacks.
- **Organic Typography:** Fluid hierarchy with natural sentence casing, balanced tracking, and proportional rhythm that prioritizes readability over decorative novelty.
- **Restraint Over Ornament:** Complete avoidance of brutalist monospaced stamps, tech-centric dotted grids, high-tech glowing blurs, or gratuitous dividers.
- **Physical Calm:** Generous negative space, soft ambient contrast, and subtle tactile responses that feel grounded and intentional.

## Colors

The color palette centers on tactile materiality:
- **Canvas Base (`#F6F5F2`):** A warm porcelain/linen off-white that forms the continuous background canvas across views.
- **Primary Ink (`#18181B`):** A deep charcoal ink used for high-emphasis headlines, body text, primary actions, and structural forms.
- **Secondary Accent (`#C2410C`):** A warm terracotta tone reserved strictly for deliberate focal points, interactive underlines, selected states, and active pagination tokens.
- **Tertiary Ochre (`#D97706`):** A secondary warm earth tone used sparsely for curated editorial tags, highlighted passages, or status notes.
- **Muted Graphite (`#71717A`):** Applied to supporting metadata, bylines, secondary navigational links, and caption typography.
- **Subtle Surface Tint (`#EDEBE6`):** Used for low-contrast element containment, card fills, and hover highlights without breaking the unified canvas warmth.

## Typography

Typography functions as the structural scaffolding of the publication. Plus Jakarta Sans provides a warm, humanist geometry that feels approachable and clean.

Key rules:
- **Natural Casing:** All labels, tags, subheadings, and buttons must use standard sentence casing. Avoid all-caps styling and exaggerated letter-spacing.
- **Measure and Leading:** Longform reading (`body-lg`) maintains an optimal line measure of 58–72 characters per line with an open 1.68x leading to encourage natural, unhurried reading.
- **Rhythmic Proportion:** Transitions between scale steps are gradual and balanced, avoiding disruptive jumps in visual weight.

## Layout & Spacing

The layout model uses a responsive fluid grid with generous page margins, preserving calm breathing room across all screen widths.

- **Desktop (1024px+):** A 12-column layout with `margin-desktop` (4rem) and `gutter-desktop` (2.5rem). Editorial articles use a centered 7-to-8 column reading column (`max-width: 720px`) with wide asymmetrical margins for marginalia and footnotes.
- **Tablet (768px – 1023px):** An 8-column layout with `margin` (1.5rem) and `gutter` (1.5rem). Reading measures span 6 columns.
- **Mobile (< 768px):** A 4-column layout with `margin-mobile` (1.25rem) and `gutter-mobile` (1rem). Single-column flow with full-width reading areas.
- **Vertical Spacing:** White space replaces divider lines. Use `space-xl` between sections and articles, `space-lg` between distinct thematic groups, and `space-md` between heading and body pairings.

## Elevation & Depth

This system avoids layered dropshadows, gloss, and synthetic plastic depth in favor of quiet, printed surface variation:

- **Tonal Surfaces:** Visual hierarchy is communicated through warm tonal shifts. Elevated elements sit on `#FFFFFF` against the `#F6F5F2` background, or on `#EDEBE6` when inset.
- **Natural Tactility:** Floating elements (such as reading menus, floating search panels, or modest context sheets) use a single, ultra-diffused shadow tinted with ink: `0 8px 32px -4px rgba(24, 24, 27, 0.05)`.
- **Soft Editorial Borders:** Boundaries are drawn using low-contrast tinted borders (`rgba(24, 24, 27, 0.07)`), evoking the fine edges of laid paper rather than harsh interface lines.

## Shapes

The shape system employs soft, understated corner radii (`0.25rem` / 4px base) to deliver a modern, structured silhouette that remains soft to the eye.

- **Base Radius (0.25rem):** Standard interactive surfaces, input elements, buttons, and inline tags.
- **Medium Radius (0.5rem):** Editorial cards, image enclosures, and reading viewports.
- **Large Radius (0.75rem):** Modals, side drawers, and elevated reader overlays.
- **Full Radius (9999px):** Small utility avatar rings and indicator pills only when strictly functional. Avoid pill-shaped generic buttons to keep an architectural, editorial demeanor.

## Components

### Buttons
- **Primary:** Filled `#18181B` with `#F6F5F2` text. Height 40px, padding `0.625rem 1.25rem`, border-radius `0.25rem`. Hover shifts smoothly to `#27272A` with a subtle translate offset.
- **Secondary / Ghost:** Transparent background with subtle ink border (`rgba(24, 24, 27, 0.15)`) and `#18181B` text. Hover shifts to `#EDEBE6` fill without border shifts.
- **Editorial Link Action:** Inline text with a solid 1px terracotta (`#C2410C`) underline resting 4px below text baseline. Hover deepens saturation.

### Chips & Badges
- Warm linen-tinted background (`#EDEBE6`), `#18181B` text in `label-sm` with sentence casing. No borders, no uppercase tracking.
- Interactive category tags adopt a terracotta highlight (`#C2410C` text, `#FDF2E9` background) when active.

### Lists & Collections
- Articles in index views rely on vertical whitespace (`space-lg`) instead of full-width horizontal rule lines.
- List items feature a subtle hover transition via an soft `#EDEBE6` wash with 8px inner padding.

### Checkboxes & Radio Buttons
- Base state: Unchecked items use a 1.5px border of `#71717A` with a `#F6F5F2` interior.
- Active state: Checkbox fills with `#18181B`, showing a crisp `#F6F5F2` checkmark. Radio buttons fill with an inner `#18181B` circular dot. Focus rings are soft terracotta at 20% opacity.

### Input Fields
- Flat background in pure white (`#FFFFFF`) or `#EDEBE6` depending on surface context.
- Thin `rgba(24, 24, 27, 0.12)` border. On focus, smoothly transitions to `#18181B` border with no harsh blue or synthetic halos.
- Placeholder text uses muted graphite (`#71717A`) in sentence casing.

### Cards & Feature Plates
- Framed in soft linen white (`#FFFFFF`) with a 1px border of `rgba(24, 24, 27, 0.05)`.
- Internal padding matches `space-lg` (1.75rem) to ensure narrative copy and imagery never crowd edges.

### Editorial Additions
- **Pull Quotes:** Left-aligned `headline-md` typography inset with `space-lg` left padding and a 2px terracotta (`#C2410C`) vertical rule.
- **Footnotes & Marginalia:** Rendered in `body-sm` using `#71717A`, anchored in the desktop gutter alongside relevant paragraphs.