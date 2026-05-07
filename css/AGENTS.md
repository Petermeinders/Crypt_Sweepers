# AGENTS.md — css/

The CSS directory contains all visual styling for the game. No CSS modules or preprocessors — plain CSS with custom properties. `UI.js` applies floor theming at runtime by overriding `--floor-bg-image` and biome-specific CSS variables on `:root`.

## Key Files

| File | Purpose |
|------|---------|
| `main.css` | Reset, `:root` custom properties (colour palette, spacing, typography), global layout (flex column, viewport fill), HUD bar shell, screen overlays shell. The canonical source for CSS variables. |
| `tiles.css` | Tile grid cells, flip animation (CSS 3D transform), tile type variants (`.type-enemy`, `.type-trap`, etc.), tile art variables (`--tile-art-back`, etc.), reveal states. |
| `hud.css` | HUD bar (HP/mana/XP bars), action panel, combat buttons, ability buttons, inventory backpack. |
| `overlays.css` | All modal panels and overlays: level-up, death screen, bestiary, trinket codex, settings, run summary, floor modifier banner, sub-floor panel, shop. |
| `animations.css` | `@keyframe` definitions: tile reveal, floor transition slide, damage numbers, discovery popups, bouncing icons. |

## Patterns

- **All colours are custom properties defined in `main.css` `:root`.** Never hardcode hex values in other files — use `var(--gold)`, `var(--hp-red)`, etc.
- **Floor theming uses a single override.** `UI.applyFloorTheme()` sets `--floor-bg-image` on `:root`. No biome-specific CSS class is toggled — the background changes purely via the variable.
- **Tile type variants use `.type-*` classes.** `TileEngine` sets these from `TILE_DEFS[type].cssClass`. CSS rules in `tiles.css` style each variant. Do not add type-specific layout or game-logic-derived classes outside this pattern.
- **Tile flip is CSS-only.** The 3D card-flip reveal animation lives entirely in `tiles.css`. `GameController` adds/removes a class; no JS animation loop is involved.
- **`floor-transition-active` blocks pointer events.** Set on `#grid-container` during floor slide transitions to prevent tap-through. Always remove it in the `transitionend` callback.
- **Animation classes are additive.** Damage number overlays, discovery popups, and bounce animations are applied as extra classes and removed after the animation ends (via `animationend` listener in `UI.js`).

## External Dependencies

- **Loaded by:** `index.html` (all 5 files, in order: main → tiles → hud → overlays → animations)
- **Runtime overrides from:** `UI.applyFloorTheme()` (biome background), `UI.js` (class toggling for state transitions, animation triggers)
- **Tile art assets:** referenced via CSS variables in `tiles.css`, pointing to `assets/sprites/tiles/`
