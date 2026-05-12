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
- **Parry ring uses `filter: drop-shadow()`, not `box-shadow`.** The outer ring is an `<img>` element (`rune-ring2.png`), so `box-shadow` has no effect. All glow, in-zone bloom, and result flash effects use `filter: drop-shadow()`. Keyframes in `animations.css` follow the same pattern (`parry-ring-flash-block/counter/miss`).
- **Parry modal background is transparent.** `.parry-modal` has `background: transparent` — the dark full-screen overlay (`rgba(0,0,0,0.80)`) from `.parry-overlay` provides the backdrop. The gold border (`border: 2px solid var(--gold)`) is retained.
- **Enemy display sits above the ring arena.** `#parry-enemy-display` (`.parry-enemy-display`) is a flex-column block inside `.parry-modal`, above `#parry-ring-arena`. It holds a 64×64 px `<img>` (`#parry-enemy-icon`) rendered with `image-rendering: pixelated` and a gold uppercase name label (`.parry-enemy-name`). Hidden via `.hidden` class when there is no real enemy (practice mode).
- **Practice banner** (`.parry-practice-label`) sits above the enemy display. Light-blue (`#a8d8ff`), uppercase, bold — shown only in `opts.practiceMode` calls via `classList.remove('hidden')`. Hidden otherwise.
- **Parry tutorial overlay** (`.parry-tutorial-overlay`) is a separate full-screen overlay at `z-index: 310` (above parry overlay at 300). Contains `.parry-tutorial-modal` — a dark-panelled card with gold border, matching the overall modal style. Step indicator pips (`.parry-tutorial-pip`, `.parry-tutorial-pip.active`) sit in `.parry-tutorial-header` alongside the title. Body (`.parry-tutorial-body`) scrolls up to 55 vh. Outcome table styled via `.parry-tutorial-table`, with `.good` (green) and `.bad` (red) value cells. Footer holds Skip/Next buttons side-by-side via flex.
- **Parry arc canvas is 360×360, offset -20 px.** `.parry-arc-canvas` is `top: -20px; left: -20px; width: 360px; height: 360px` to centre a 360 px canvas over the 320 px arena. The extra 20 px of canvas on each side prevents the glow stroke (`lineWidth: 20`) from being clipped at the canvas boundary. `transform-origin: center` still scales from the correct arena centre.
- **Parry hero canvas** (`.parry-hero-canvas`) is a 260×260 canvas at `z-index: 0`, the first child of `.parry-ring-arena`. It renders below both ring `<img>` elements. `UI.js` draws the hero attack GIF frame here each rAF tick. The inner rune ring (`mix-blend-mode: screen`) blends naturally over the hero sprite.
- **Parry result words use `.parry-text-{result}` classes.** `.parry-text-block` (blue `#3498db`), `.parry-text-counter` (gold `#ffd700`), `.parry-text-miss` (red `#e74c3c`) — each with a double `text-shadow` glow. Applied to the `.parry-feedback-icon` div alongside the `float-up` animation. Do not use emoji for parry results; the coloured text is the feedback.
- **Screen-shake is a body class.** `body.screen-shake` triggers the `@keyframes screen-shake` translateX wobble. `UI.js` adds it on miss and removes it via `animationend`.
- **Parry flash overlay** (`#parry-flash-overlay`) is a fixed full-screen div at `z-index: 9990`. Result classes (`flash-block`, `flash-counter`, `flash-miss`) are added/removed by `UI.js` to produce full-screen colour flashes.

## External Dependencies

- **Loaded by:** `index.html` (all 5 files, in order: main → tiles → hud → overlays → animations)
- **Runtime overrides from:** `UI.applyFloorTheme()` (biome background), `UI.js` (class toggling for state transitions, animation triggers)
- **Tile art assets:** referenced via CSS variables in `tiles.css`, pointing to `assets/sprites/tiles/`
