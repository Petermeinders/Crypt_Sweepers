import UI from '../ui/UI.js'
import TileEngine from './TileEngine.js'
import { session } from '../core/RunContext.js'

const CREW_BUFF_HP = 3


export function applyFreezingHit() {
  if (!session.run) return
  const stacks = Math.min(5, (session.run.player.freezingHitStacks ?? 0) + 2)
  session.run.player.freezingHitStacks = stacks
  UI.setFreezingHit(stacks)
  UI.spawnFloat(document.getElementById('hud-portrait'), `🧊 Freezing Hit! (${stacks})`, 'damage')
}

export function applyCorruption() {
  if (!session.run) return
  const prev   = session.run.player.corruptionStacks ?? 0
  const stacks = Math.min(5, prev + 2)
  if (stacks === prev) return  // already at cap
  session.run.player.corruptionStacks = stacks

  // Capture uncorrupted base max values on first application
  if (!session.run.player.corruptionBaseMaxHp)   session.run.player.corruptionBaseMaxHp   = session.run.player.maxHp
  if (!session.run.player.corruptionBaseMaxMana) session.run.player.corruptionBaseMaxMana = session.run.player.maxMana

  // Reduce max values based on total stacks (2% per stack of base max)
  session.run.player.maxHp   = Math.max(1, Math.round(session.run.player.corruptionBaseMaxHp   * (1 - stacks * 0.02)))
  session.run.player.maxMana = Math.max(1, Math.round(session.run.player.corruptionBaseMaxMana * (1 - stacks * 0.02)))

  // Clamp current values to the new lower ceiling
  session.run.player.hp   = Math.min(session.run.player.hp,   session.run.player.maxHp)
  session.run.player.mana = Math.min(session.run.player.mana, session.run.player.maxMana)

  UI.updateHP(session.run.player.hp, session.run.player.maxHp)
  UI.updateMana(session.run.player.mana, session.run.player.maxMana)
  UI.setCorruption(stacks)
  UI.spawnFloat(document.getElementById('hud-portrait'), `☣️ Corrupted! (${stacks})`, 'damage')
}

export function applyBurnHit(amount = 2) {
  if (!session.run) return
  const stacks = Math.min(3, (session.run.player.burnStacks ?? 0) + amount)
  session.run.player.burnStacks = stacks
  UI.setBurnOverlay(stacks)
  UI.spawnFloat(document.getElementById('hud-portrait'), `🔥 Burning! (${stacks})`, 'damage')
}

export function applyPlayerPoison(amount = 2) {
  if (!session.run) return
  const stacks = Math.min(5, (session.run.player.poisonStacks ?? 0) + amount)
  session.run.player.poisonStacks = stacks
  UI.setPlayerPoison(stacks)
  UI.spawnFloat(document.getElementById('hud-portrait'), `☠️ Poisoned! (${stacks})`, 'damage')
}

export function findLiveHulk() {
  const grid = TileEngine.getGrid()
  if (!grid) return null
  for (const row of grid) {
    for (const t of row) {
      if (t.revealed && t.enemyData && !t.enemyData._slain && t.enemyData.crewBuffAura) return t
    }
  }
  return null
}

export function applyHulkBuffToTile(t) {
  if (!t.revealed || !t.enemyData || t.enemyData._slain || t.enemyData.crewBuffAura) return
  if (t.enemyData._hulkBuffed) return
  const cur = Number(t.enemyData.currentHP)
  const base = Number.isFinite(cur) ? cur : Number(t.enemyData.hp)
  t.enemyData.currentHP = (Number.isFinite(base) ? base : 1) + CREW_BUFF_HP
  t.enemyData._hulkBuffed = true
  UI.updateEnemyHP(t.element, t.enemyData.currentHP)
  UI.spawnFloat(t.element, `⚓ +${CREW_BUFF_HP} HP`, 'heal')
}

export function removeHulkBuffFromAll() {
  const grid = TileEngine.getGrid()
  if (!grid) return
  for (const row of grid) {
    for (const t of row) {
      if (!t.enemyData || t.enemyData._slain || !t.enemyData._hulkBuffed) continue
      const cur = Number(t.enemyData.currentHP)
      const safe = Number.isFinite(cur) ? cur : Number(t.enemyData.hp ?? 1)
      t.enemyData.currentHP = Math.max(1, safe - CREW_BUFF_HP)
      t.enemyData._hulkBuffed = false
      UI.updateEnemyHP(t.element, t.enemyData.currentHP)
      UI.spawnFloat(t.element, `⚓ -${CREW_BUFF_HP} HP`, 'damage')
    }
  }
}

export function applyHulkBuffToAll() {
  const grid = TileEngine.getGrid()
  if (!grid) return
  for (const row of grid) {
    for (const t of row) {
      _applyHulkBuffToTile(t)
    }
  }
}
