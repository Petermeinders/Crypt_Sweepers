/**
 * Browser test harness — loaded only when ?testHarness=1 is present.
 * Exposes game modules and scenario helpers on window.__testHarness.
 */
import GameController from '../core/GameController.js'
import GameState from '../core/GameState.js'
import TileEngine from '../systems/TileEngine.js'
import MetaProgression from '../systems/MetaProgression.js'

export function attachTestHarness() {
  window.__testHarness = {
    GameController,
    GameState,
    TileEngine,
    MetaProgression,
    setupRun(opts) {
      return GameController.testHarnessSetupRun(opts)
    },
    importGrid(snapshot) {
      return GameController.testHarnessImportGrid(snapshot)
    },
    getSnapshot() {
      return GameController.testHarnessGetSnapshot()
    },
    forceLevelUp() {
      return GameController.testHarnessForceLevelUp()
    },
    pickLevelUp(abilityId) {
      return GameController.testHarnessPickLevelUp(abilityId)
    },
    onTileTap(row, col) {
      GameController.onTileTap(row, col)
    },
    fightAction(row, col) {
      GameController.onTileTap(row, col)
    },
    getDiagnostics() {
      return GameController.getBalanceBotDiagnostics()
    },
  }
}
