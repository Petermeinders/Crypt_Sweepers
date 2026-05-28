/** Page lifecycle + cross-cutting DOM listeners wired once at boot. */

export function wirePersistenceListeners({ GameController }) {
  document.addEventListener('click', (e) => {
    const t = e.target
    if (!(t instanceof Element)) return
    const btn = t.closest('button')
    if (!btn) return
    if (btn.closest('#grid') || btn.closest('#sub-floor-grid') || btn.closest('#hud-actions')) return
    if (btn.closest('.tile')) return
    GameController.uiButtonHaptic()
  }, true)

  document.addEventListener('pagehide', () => {
    try { GameController.persistActiveRun() } catch (_) { /* ignore */ }
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      try { GameController.persistActiveRun() } catch (_) { /* ignore */ }
    }
  })
}
