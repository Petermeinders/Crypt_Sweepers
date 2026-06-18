import UI from '../ui/UI.js'
import { RANGER_UPGRADES } from '../data/ranger.js'
import { session } from '../core/RunContext.js'

export function cancelRicochetMode() {
  session.tap.ricochetSelecting = false
  session.tap.ricochetTiles     = []
  UI.clearRicochetMarks()
  UI.setRicochetActive(false)
  UI.setGridRicochetMode(false)
}

export function cancelArrowBarrageMode() {
  session.tap.arrowBarrageSelecting = false
  session.tap.tripleVolleyCenter = null
  UI.clearTripleVolleyAoePreview()
  UI.setArrowBarrageActive(false)
  UI.setGridArrowBarrageMode(false)
}

export function cancelPoisonArrowShotMode() {
  session.tap.poisonArrowShotSelecting = false
  UI.setPoisonArrowShotActive(false)
  UI.setGridPoisonArrowShotMode(false)
}

export function cancelEngineerConstructMode() {
  session.tap.engineerPendingTile = null
  UI.setEngineerPlaceMode(false)
}

export function cancelChainLightningMode() {
  session.tap.chainLightningSelecting = false
  UI.setChainLightningActive(false)
  UI.setGridChainLightningMode(false)
}

export function cancelTelekineticThrowMode() {
  session.tap.telekineticThrowStep = 0
  session.tap.telekineticEnemyTile = null
  UI.setTelekineticThrowActive(false)
  UI.setGridTelekineticThrowMode(null)
  UI.clearTelekineticMarks()
}

export function cancelStrengthenMinionMode() {
  session.tap.strengthenMinionSelecting = false
  UI.setStrengthenMinionActive?.(false)
}

export function cancelCorpseExplosionMode() {
  session.tap.corpseExplosionSelecting = false
  UI.setCorpseExplosionActive?.(false)
  UI.setGridCorpseExplosionMode?.(false)
}

export function cancelBoneArmorMode() {
  session.tap.boneArmorSelecting = false
  UI.setBoneArmorActive?.(false)
}

export function cancelGargantuanMergeMode() {
  session.tap.gargantuanMergeMinionId = null
}

export function cancelSpellLanternBlindingForRicochet(ctx) {
  if (session.tap.spellTargeting) {
    session.tap.spellTargeting = false
    const effectiveCost = ctx.previewSpellManaCostForUi()
    UI.setSpellTargeting(false, effectiveCost)
  }
  if (session.tap.lanternTargeting) {
    session.tap.lanternTargeting = false
    UI.setLanternTargeting(false)
  }
  if (session.tap.spyglassTargeting) {
    session.tap.spyglassTargeting = false
    UI.setLanternTargeting(false)
  }
  if (session.tap.blindingLightTargeting) {
    session.tap.blindingLightTargeting = false
    UI.setBlindingLightActive(false)
  }
  if (session.tap.divineLightSelecting) {
    session.tap.divineLightSelecting = false
    UI.setDivineLightActive(false)
  }
}

/**
 * If any ability targeting mode is active, consume the tap on the given tile.
 * Returns true if the tap was handled (caller should stop).
 */
export function tryConsumeTargetingTap(ctx, tile) {
  if (!tile) return false

  if (session.tap.spellTargeting) {
    if (tile.revealed && tile.enemyData && !tile.enemyData._slain) ctx.castSpell(tile)
    return true
  }
  if (session.tap.blindingLightTargeting) {
    if (tile.revealed && tile.enemyData && !tile.enemyData._slain) ctx.castBlindingLight(tile)
    return true
  }
  if (session.tap.arrowBarrageSelecting) {
    if (!tile.revealed) {
      UI.setMessage('Triple Volley — tap a revealed tile to place the 3×3 area.', true)
      return true
    }
    const cost = ctx.stillWaterManaCost(RANGER_UPGRADES['arrow-barrage'].manaCost + ctx.tearyExtraCost())
    if (!session.tap.tripleVolleyCenter) {
      session.tap.tripleVolleyCenter = { row: tile.row, col: tile.col }
      UI.setTripleVolleyAoePreview(tile.row, tile.col)
      UI.setMessage('Triple Volley — tap the same tile again to fire.')
      return true
    }
    if (tile.row !== session.tap.tripleVolleyCenter.row || tile.col !== session.tap.tripleVolleyCenter.col) {
      session.tap.tripleVolleyCenter = { row: tile.row, col: tile.col }
      UI.setTripleVolleyAoePreview(tile.row, tile.col)
      UI.setMessage('Triple Volley — area moved. Tap the center tile again to confirm.')
      return true
    }
    if (session.run.player.mana < cost) {
      UI.setMessage('Not enough mana for Triple Volley!', true)
      return true
    }
    ctx.executeTripleVolley(session.tap.tripleVolleyCenter)
    return true
  }
  if (session.tap.poisonArrowShotSelecting) {
    if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
      const cost = ctx.stillWaterManaCost(RANGER_UPGRADES['poison-arrow-shot'].manaCost + ctx.tearyExtraCost())
      if (session.run.player.mana < cost) UI.setMessage('Not enough mana for Poison Arrow!', true)
      else ctx.executePoisonArrowShot(tile)
    }
    return true
  }
  if (session.tap.ricochetSelecting) {
    if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
      const idx = session.tap.ricochetTiles.findIndex(t => t.row === tile.row && t.col === tile.col)
      if (idx >= 0) {
        session.tap.ricochetTiles.splice(idx, 1)
        UI.refreshRicochetMarks(session.tap.ricochetTiles)
      } else if (session.tap.ricochetTiles.length < 3) {
        session.tap.ricochetTiles.push(tile)
        UI.refreshRicochetMarks(session.tap.ricochetTiles)
        if (session.tap.ricochetTiles.length === 3) {
          const cost = ctx.stillWaterManaCost(RANGER_UPGRADES.ricochet.manaCost + ctx.tearyExtraCost())
          if (session.run.player.mana < cost) {
            session.tap.ricochetTiles.pop()
            UI.refreshRicochetMarks(session.tap.ricochetTiles)
            UI.setMessage('Not enough mana for Ricochet!', true)
          } else {
            ctx.executeRicochet()
          }
        }
      }
    }
    return true
  }
  if (session.tap.chainLightningSelecting) {
    if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
      if (tile.enemyData.spellImmune) {
        UI.setMessage('🛡️ That enemy is immune to Chain Lightning!', true)
      } else {
        ctx.executeChainLightning(tile)
      }
    }
    return true
  }
  if (session.tap.telekineticThrowStep > 0) {
    if (session.tap.telekineticThrowStep === 1) {
      if (ctx.isTelekineticThrowEnemyTarget(tile)) {
        session.tap.telekineticEnemyTile = { row: tile.row, col: tile.col }
        session.tap.telekineticThrowStep = 2
        UI.clearTelekineticMarks()
        UI.markTelekineticOrigin(tile.element)
        UI.setGridTelekineticThrowMode('dest')
        UI.setMessage('🌀 Now tap a revealed empty tile to slam them down.')
      } else if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
        if (tile.enemyData.behaviour === 'boss' || tile.type === 'boss') {
          UI.setMessage('🛡️ Bosses cannot be thrown.', true)
        } else if (tile.enemyData.spellImmune) {
          UI.setMessage('🛡️ That enemy is immune to Telekinetic Throw!', true)
        } else {
          UI.setMessage('Not a valid target.', true)
        }
      } else {
        UI.setMessage('Tap a revealed enemy to grab.', true)
      }
      return true
    }
    if (session.tap.telekineticThrowStep === 2) {
      const origin = session.tap.telekineticEnemyTile
        ? ctx.getActiveTileAt(session.tap.telekineticEnemyTile.row, session.tap.telekineticEnemyTile.col)
        : null
      if (!origin || !ctx.isTelekineticThrowEnemyTarget(origin)) {
        cancelTelekineticThrowMode()
        UI.setMessage('Telekinetic Throw — target no longer valid.', true)
        return true
      }
      if (tile.row === origin.row && tile.col === origin.col) {
        UI.setMessage('Pick a different landing tile.', true)
        return true
      }
      if (!ctx.isTelekineticThrowDestination(tile)) {
        UI.setMessage('Landing tile must be a revealed empty tile (no loot, chest, stairs, turret).', true)
        return true
      }
      ctx.executeTelekineticThrow(origin, tile)
      return true
    }
  }
  return false
}
