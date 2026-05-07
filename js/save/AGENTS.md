# AGENTS.md — js/save/

A single-file module wrapping IndexedDB for game save persistence.

## Key Files

| File | Purpose |
|------|---------|
| `SaveManager.js` | Async IndexedDB wrapper. Exports `save(data)`, `load()`, `exportJSON(data)`, `importJSON(jsonString)`, `clear()`. |

## Patterns

- **Single database, single store, single key.** DB name: `cryptic-grids`. Store: `save`. Key: `main`. Never call `indexedDB` directly from other modules.
- **`save()` stamps `lastSaved`** — always adds `lastSaved: Date.now()` on write. Don't manually set this field.
- **`load()` returns `null` on miss** — callers must handle `null` (fresh install). `MetaProgression.defaultSave()` provides the fallback.
- **`importJSON` validates `version`** — throws if the field is missing. All save data must include a `version` string.
- **Errors are logged and re-thrown** on `save()` and `importJSON()`; `load()` and `clear()` swallow errors after logging (non-fatal paths).
- **DB handle is module-level cached** (`_db`). The `onclose` handler nulls it so the next call re-opens.

## External Dependencies

- **Called by:** `GameController` (save after each meaningful action), `js/main.js` (load on boot, export/import from settings)
- **Calls:** `Logger` (for structured logging)
- **Storage:** IndexedDB (`cryptic-grids` DB, version 1)
