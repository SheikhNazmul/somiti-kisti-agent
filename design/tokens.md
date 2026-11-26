# Design tokens

Used by `frontend/css/styles.css` (CSS variables on `:root`).

## Colour

| Token | Value | Use |
|---|---|---|
| bg | `#F6F1E7` | page background |
| surface | `#FFFFFF` | cards |
| alt | `#EFE8DA` | tracks, quiet fills |
| border | `#E4DAC6` | card borders (row dividers dashed `#D5CAB1`) |
| ink | `#1B2340` | text, sidebar |
| muted | `#5A5F7A` | secondary text |
| primary | `#243B7A` (hover `#1B2E66`, soft `#E3E8F7`) | main actions |
| accent | `#E8A33D` (soft `#FBEBCB`) | gata, highlights |
| success | `#2F8F6B` (soft `#DDF1E8`) | paid, ok |
| danger | `#C4452F` (soft `#F9E0DA`) | errors |

## Type and shape

- Font: Hind Siliguri 400/500/600/700, Bangla digits and `৳` for money
- Radius: 12 (buttons), 16–20 (cards), 999 (chips, badges)
- Sidebar 240 px; touch targets at least 44 px
- Badges: loan = primary soft, gata = accent soft, both = success soft
