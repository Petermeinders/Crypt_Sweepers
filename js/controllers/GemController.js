// GemController — socket/unsocket gems, parry gem effect resolution.
// Gems are stored in run.equippedGems: { block: gemId|null, counter: gemId|null }

import { GEMS } from '../data/gems.js'
import { session, charKey } from '../core/RunContext.js'
import EventBus from '../core/EventBus.js'
import SaveManager from '../save/SaveManager.js'
import UI from '../ui/UI.js'
import TileEngine from '../systems/TileEngine.js'
import { slamAction, castBlindingLight, castDivineLightSmite } from '../heroes/warrior.js'
import { castSpell, executeChainLightning } from '../heroes/mage.js'
import { executeRicochet, executeTripleVolley, executePoisonArrowShot } from '../heroes/ranger.js'
import { bloodTitheAction, mistFormAction, bloodPactAction } from '../heroes/vampire.js'
import { executeCorpseExplosion, executeBoneArmor } from '../heroes/necromancer.js'

const EMPTY_GEM_SOCKETS = { block: null, counter: null }

// Abilities bindable to the Emerlang Gem (categories 1 & 2 — usable during combat auto-cast).
// Mana Shield / Life Tap excluded: combat-commitment-locked, always no-op when gem fires.
// Engineer turret / Telekinetic Throw / Strengthen Minion / Ninja excluded: require multi-step targeting.
const EMERLANG_BINDABLE = {
  slamAction:            { label: 'Slam',            hero: 'warrior',           unlockKey: 'slam' },
  blindingLightAction:   { label: 'Blinding Light',  hero: 'warrior',           unlockKey: 'blinding-light' },
  divineLightAction:     { label: 'Divine Light',    hero: 'warrior',           unlockKey: 'divine-light' },
  spellAction:           { label: 'Spell',           hero: ['warrior', 'mage'], unlockKey: null },
  ricochetAction:        { label: 'Ricochet',        hero: 'ranger',            unlockKey: 'ricochet' },
  arrowBarrageAction:    { label: 'Triple Volley',   hero: 'ranger',            unlockKey: 'arrow-barrage' },
  poisonArrowShotAction: { label: 'Poison Arrow',    hero: 'ranger',            unlockKey: 'poison-arrow-shot' },
  chainLightningAction:  { label: 'Chain Lightning', hero: 'mage',              unlockKey: 'chain-lightning' },
  bloodTitheAction:      { label: 'Blood Tithe',     hero: 'vampire',           unlockKey: 'blood-tithe' },
  mistFormAction:        { label: 'Mist Form',       hero: 'vampire',           unlockKey: 'mist-form' },
  bloodPactAction:       { label: 'Blood Pact',      hero: 'vampire',           unlockKey: 'blood-pact' },
  corpseExplosionAction: { label: 'Corpse Explosion',hero: 'necromancer',       unlockKey: 'corpse-explosion' },
  boneArmorAction:       { label: 'Bone Armor',      hero: 'necromancer',       unlockKey: 'bone-armor' },
}

/** Meta-save gem sockets — restored on each new run (like equipped gear). */
export function cloneSavedEquippedGems() {
  const saved = session.save?.equippedGems
  if (!saved) return { ...EMPTY_GEM_SOCKETS }
  return structuredClone(saved)
}

export function persistEquippedGemsToSave() {
  if (!session.save) return
  const gems = session.run?.equippedGems ?? session.save.equippedGems ?? EMPTY_GEM_SOCKETS
  session.save.equippedGems = structuredClone(gems)
  SaveManager.save(session.save).catch(() => {})
}

/** Prefer active run sockets, fall back to meta save (display + resume). */
export function resolveEquippedGemsForDisplay() {
  const runGems = session.run?.equippedGems
  const saveGems = session.save?.equippedGems
  return {
    block: runGems?.block ?? saveGems?.block ?? null,
    counter: runGems?.counter ?? saveGems?.counter ?? null,
  }
}

/** Merge mid-run resume snapshot with meta-save sockets. */
export function mergeEquippedGemsForResume(activeRunGems) {
  const saved = session.save?.equippedGems ?? EMPTY_GEM_SOCKETS
  const active = activeRunGems ?? EMPTY_GEM_SOCKETS
  return {
    block: active.block ?? saved.block ?? null,
    counter: active.counter ?? saved.counter ?? null,
  }
}

export function applyEquippedGemsToRun(run) {
  if (!run) return
  run.equippedGems = cloneSavedEquippedGems()
  if (!run.gemStreaks) run.gemStreaks = {}
}

// ── Parry gem effect resolution ──────────────────────────────────

/**
 * Called after a parry outcome is determined ('block' or 'counter').
 * Fires the gem effect for the matching socket and updates streaks.
 */
export function resolveParryGem(ctx, tile, parrySuccessType, playerDmg) {
  const run = session.run
  if (!run) return
  if (!run.equippedGems) run.equippedGems = resolveEquippedGemsForDisplay()
  if (!run.gemStreaks)   run.gemStreaks = {}

  const isBlock   = parrySuccessType === 'block'
  const isCounter = parrySuccessType === 'counter'
  const socket    = isBlock ? 'block' : isCounter ? 'counter' : null
  if (!socket) return

  const gemId = run.equippedGems[socket]
  if (!gemId) {
    // Reset the opposite socket streak (miss/wrong result resets that socket — but since
    // we only fire on success, resets happen on miss via the outer miss path)
    return
  }

  const def = GEMS[gemId]
  if (!def) return

  // Update streak
  const currentStreak = (run.gemStreaks[gemId] ?? 0) + 1
  run.gemStreaks[gemId] = currentStreak

  // Also reset the OTHER socket's gem streak on any outcome (a counter resets block streak and vice-versa)
  const otherSocket = socket === 'block' ? 'counter' : 'block'
  const otherGemId  = run.equippedGems[otherSocket]
  if (otherGemId) run.gemStreaks[otherGemId] = 0

  const minStreak = def.condition?.minStreak
  if (
    minStreak && currentStreak < minStreak
    && (def.trigger === 'block-streak' || def.trigger === 'counter-streak')
  ) {
    const tileEl = tile?.element ?? document.getElementById('hud-portrait')
    UI.spawnFloat(tileEl, `💎 ${currentStreak}/${minStreak}`, 'heal')
  }

  _applyGemEffect(ctx, tile, def, currentStreak, playerDmg)
}

/** Reset all gem streaks (called on miss). */
export function resetGemStreaks(socket) {
  const run = session.run
  if (!run?.gemStreaks || !run.equippedGems) return
  const gemId = run.equippedGems?.[socket]
  if (gemId) run.gemStreaks[gemId] = 0
}

// ── Emerlang Gem helpers ────────────────────────────────────────

function _getAvailableEmerlangAbilities() {
  const hero = charKey()
  return Object.entries(EMERLANG_BINDABLE).filter(([, def]) => {
    const heroMatch = Array.isArray(def.hero) ? def.hero.includes(hero) : def.hero === hero
    if (!heroMatch) return false
    if (def.unlockKey === null) return true
    return (session.save[hero]?.upgrades ?? []).includes(def.unlockKey)
  })
}

function _showEmerlangAbilityPicker(ctx) {
  const available = _getAvailableEmerlangAbilities()
  const modal = document.createElement('div')
  modal.className = 'simple-modal-overlay'

  if (!available.length) {
    modal.innerHTML = `
      <div class="simple-modal">
        <div class="simple-modal-title">💎 Emerlang Gem</div>
        <div class="simple-modal-hint">No bindable abilities unlocked yet. Unlock abilities to bind one to this gem.</div>
        <button class="simple-modal-btn gem-modal-cancel">OK</button>
      </div>`
    document.body.appendChild(modal)
    modal.querySelector('.gem-modal-cancel').addEventListener('click', () => modal.remove())
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove() })
    return
  }

  const currentBinding = session.run?.emerlangAbilityBinding
  const listHtml = available.map(([actionName, def]) => {
    const active = actionName === currentBinding ? ' gem-picker-btn-active' : ''
    return `<button class="gem-picker-btn${active}" data-action="${actionName}">${def.label}</button>`
  }).join('')

  modal.innerHTML = `
    <div class="simple-modal">
      <div class="simple-modal-title">💎 Emerlang Gem — Bind Ability</div>
      <div class="simple-modal-hint">Choose an ability to auto-cast free on 3-counter streak:</div>
      <div class="gem-picker-list">${listHtml}</div>
      <button class="simple-modal-btn gem-modal-cancel">Cancel</button>
    </div>`
  document.body.appendChild(modal)

  modal.querySelectorAll('.gem-picker-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!session.run) { modal.remove(); return }
      session.run.emerlangAbilityBinding = btn.dataset.action
      ctx.GameController.persistActiveRun?.()
      renderGemSockets()
      UI.setMessage(`💎 Emerlang Gem bound to: ${EMERLANG_BINDABLE[btn.dataset.action]?.label}`)
      modal.remove()
    })
  })
  modal.querySelector('.gem-modal-cancel').addEventListener('click', () => modal.remove())
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove() })
}

function _findClosestCorpse(refTile) {
  const grid = TileEngine.getGrid()
  if (!grid) return null
  let best = null, bestDist = Infinity
  for (const row of grid) {
    for (const t of row) {
      if (!t.revealed || !t.enemyData?._slain || t.corpseExploded) continue
      const dist = Math.abs(t.row - (refTile?.row ?? 0)) + Math.abs(t.col - (refTile?.col ?? 0))
      if (dist < bestDist) { best = t; bestDist = dist }
    }
  }
  return best
}

function _dispatchEmerlangAutocast(ctx, binding, tile) {
  switch (binding) {
    // Category 1 — no targeting needed
    case 'slamAction':          slamAction(ctx); break
    case 'mistFormAction':      mistFormAction(ctx); break
    case 'bloodPactAction':     bloodPactAction(ctx); break

    // Blood Tithe trades HP for mana — don't boost mana (it checks mana isn't full)
    case 'bloodTitheAction':    bloodTitheAction(ctx); break

    // Category 2 — direct cast bypassing targeting mode
    case 'blindingLightAction':   castBlindingLight(ctx, tile); break
    case 'divineLightAction':     castDivineLightSmite(ctx, tile); break
    case 'spellAction':           castSpell(ctx, tile); break
    case 'chainLightningAction':  executeChainLightning(ctx, tile); break
    case 'ricochetAction': {
      session.tap.ricochetTiles = [tile]
      executeRicochet(ctx)
      break
    }
    case 'arrowBarrageAction':    executeTripleVolley(ctx, tile); break
    case 'poisonArrowShotAction': executePoisonArrowShot(ctx, tile); break
    case 'corpseExplosionAction': {
      const corpse = _findClosestCorpse(tile)
      if (corpse) executeCorpseExplosion(ctx, corpse)
      else UI.setMessage('Emerlang Gem — no corpse to explode.')
      break
    }
    case 'boneArmorAction': {
      const corpse = _findClosestCorpse(tile)
      if (corpse) executeBoneArmor(ctx, corpse)
      else UI.setMessage('Emerlang Gem — no corpse for Bone Armor.')
      break
    }
  }
}

function _emerlangAutocast(ctx, tile) {
  const binding = session.run?.emerlangAbilityBinding
  if (!binding) return

  const def = EMERLANG_BINDABLE[binding]
  if (!def) return

  // Verify ability is still valid for current hero and still unlocked
  const hero = charKey()
  const heroMatch = Array.isArray(def.hero) ? def.hero.includes(hero) : def.hero === hero
  if (!heroMatch) return
  if (def.unlockKey !== null && !(session.save[hero]?.upgrades ?? []).includes(def.unlockKey)) return

  const tileEl = tile?.element ?? document.getElementById('hud-portrait')
  UI.spawnFloat(tileEl, `💎 ${def.label}!`, 'heal')

  // Blood Tithe costs HP not mana — call directly, free means no mana surcharge
  if (binding === 'bloodTitheAction') {
    _dispatchEmerlangAutocast(ctx, binding, tile)
    return
  }

  // All other abilities: boost mana to guarantee the cast passes mana checks,
  // then restore after so the net mana cost is 0 (free cast).
  const p = session.run.player
  const savedMana = p.mana
  p.mana = p.maxMana
  _dispatchEmerlangAutocast(ctx, binding, tile)
  p.mana = savedMana
  UI.updateMana(p.mana, p.maxMana)
}

function _applyGemEffect(ctx, tile, def, streak, playerDmg) {
  const { effect } = def
  const run = session.run
  const p   = run.player
  const tileEl = tile?.element ?? document.getElementById('hud-portrait')

  switch (effect.type) {
    case 'negate-block-damage':
      run._blockDamageNegated = true
      UI.spawnFloat(tileEl, '🔷 Block negated!', 'heal')
      UI.setMessage("Warden's Opal — block damage negated!")
      break

    case 'poison-per-block-stack':
      if (tile?.enemyData && !tile.enemyData._slain) {
        tile.enemyData.poisonTurns  = (tile.enemyData.poisonTurns ?? 0) + 1
        tile.enemyData.poisonPctDmg = (tile.enemyData.poisonPctDmg ?? 0) + effect.bonusPctPerStack
        const totalPoisonPct = tile.enemyData.poisonPctDmg
        UI.spawnFloat(tileEl, `☠️ +${effect.bonusPctPerStack}% venom (${streak}×)`, 'xp')
        if (tile.element) UI.updateEnemyStatus(tile.element, tile.enemyData)
        UI.setMessage(`Venom Shard — ${tile.enemyData.poisonTurns} poison turns, ${totalPoisonPct}%/turn (stack ${streak})`)
      }
      break

    case 'armor-gain':
      if (streak >= (def.condition?.minStreak ?? 1)) {
        p.armor = (p.armor ?? 0) + effect.amount
        UI.updateArmor(p.armor)
        UI.spawnFloat(tileEl, `🛡️ +${effect.amount} armor`, 'heal')
        UI.setMessage(`Stalwart Stone — +${effect.amount} armor (${p.armor} total)`)
      }
      break

    case 'armor-per-streak':
      if (streak >= (def.condition?.minStreak ?? 1)) {
        const gain = streak
        p.armor = (p.armor ?? 0) + gain
        UI.updateArmor(p.armor)
        UI.spawnFloat(tileEl, `🛡️ +${gain} armor`, 'heal')
        UI.setMessage(`Patience Crystal — +${gain} armor at streak ${streak} (${p.armor} total)`)
      }
      break

    case 'mana-restore-streak': {
      const manaGain = streak
      p.mana = Math.min(p.maxMana, (p.mana ?? 0) + manaGain)
      UI.updateMana(p.mana, p.maxMana)
      UI.spawnFloat(tileEl, `🔵 +${manaGain} MP`, 'mana')
      UI.setMessage(`Manaback Gem — +${manaGain} MP (block streak ${streak})`)
      break
    }

    case 'block-chance-floor-buff':
      if (streak >= (def.condition?.minStreak ?? 1)) {
        const existing = run.floorBuffs?.find(b => b.type === 'gem-steadfast-block-chance')
        if (existing) {
          existing.effectValue += effect.bonusPct
          existing.stackCount = (existing.stackCount ?? 1) + 1
        } else {
          if (!Array.isArray(run.floorBuffs)) run.floorBuffs = []
          run.floorBuffs.push({
            type: 'gem-steadfast-block-chance',
            effectType: 'block-chance-pct',
            effectValue: effect.bonusPct,
            stackCount: 1,
            name: def.name,
            spriteSrc: def.spriteSrc,
            icon: '🛡️',
          })
        }
        UI.updateFloorBuffs(run.floorBuffs)
        const totalBonus = run.floorBuffs.find(b => b.type === 'gem-steadfast-block-chance')?.effectValue ?? effect.bonusPct
        UI.spawnFloat(tileEl, `🛡️ +${effect.bonusPct}% block`, 'heal')
        UI.setMessage(`Steadfast Shard — +${effect.bonusPct}% block chance this floor (${totalBonus}% total)`)
      }
      break

    case 'reveal-around-gain-armor':
      if (streak >= (def.condition?.minStreak ?? 1)) {
        const { revealed, enemies } = _revealAroundEnemy(ctx, tile)
        const armorGain = enemies
        if (armorGain > 0) {
          p.armor = (p.armor ?? 0) + armorGain
          UI.updateArmor(p.armor)
        }
        UI.spawnFloat(
          tileEl,
          revealed > 0 ? `🛡️ +${armorGain} armor, ${revealed} revealed` : '🛡️ Nothing to reveal',
          'heal',
        )
        UI.setMessage(
          revealed > 0
            ? `Fortress Stone — revealed ${revealed} tile${revealed !== 1 ? 's' : ''}, +${armorGain} armor`
            : 'Fortress Stone — no hidden tiles nearby'
        )
      }
      break

    case 'stun-chance':
      if (tile?.enemyData && !tile.enemyData._slain && Math.random() < effect.chance) {
        tile.enemyData.stunTurns = (tile.enemyData.stunTurns ?? 0) + 2
        UI.spawnFloat(tileEl, '💫 Stunned!', 'xp')
        if (tile.element) UI.updateEnemyStatus(tile.element, tile.enemyData)
        UI.setMessage('Riposte Ruby — enemy stunned for 2 turns!')
      }
      break

    case 'damage-multiplier-streak': {
      if (streak < (def.condition?.minStreak ?? 1)) break
      // 2nd: +20%, 3rd: +40%, 4th: +80%, 5th+: +160%
      const bonusSteps = [0.20, 0.40, 0.80, 1.60]
      const idx = Math.min(streak - 2, bonusSteps.length - 1)
      const mult = 1 + bonusSteps[idx]
      const extraDmg = Math.round(playerDmg * (mult - 1))
      if (tile?.enemyData && !tile.enemyData._slain && extraDmg > 0) {
        tile.enemyData.currentHP = Math.max(0, (tile.enemyData.currentHP ?? 0) - extraDmg)
        UI.spawnFloat(tileEl, `⚔️ +${extraDmg} fang`, 'xp')
        UI.updateEnemyHP(tileEl, tile.enemyData.currentHP)
        UI.setMessage(`Berserker's Fang — +${Math.round((mult - 1) * 100)}% bonus damage (${extraDmg}) at counter streak ${streak}!`)
      }
      break
    }

    case 'free-ability-use':
      if (streak >= (def.condition?.minStreak ?? 1)) {
        p.gemFreeAbilityCharge = (p.gemFreeAbilityCharge ?? 0) + 1
        UI.spawnFloat(tileEl, '✨ Free ability!', 'heal')
        UI.setMessage('Momentum Emerald — free ability charge granted! Use any ability to consume it.')
      }
      break

    case 'repeat-counter-chance':
      if (tile?.enemyData && !tile.enemyData._slain && Math.random() < effect.chance) {
        const echoHit = Math.max(1, Math.round(playerDmg * 0.5))
        tile.enemyData.currentHP = Math.max(0, (tile.enemyData.currentHP ?? 0) - echoHit)
        UI.spawnFloat(tileEl, `⚡ Echo +${echoHit}`, 'xp')
        UI.updateEnemyHP(tileEl, tile.enemyData.currentHP)
        UI.setMessage(`Echo Gem — counter echoes for ${echoHit} bonus damage!`)
      }
      break

    case 'reveal-random-tile':
      _revealRandomTile(ctx)
      UI.spawnFloat(tileEl, '👁️ Revealed!', 'heal')
      UI.setMessage("Predator's Eye — a hidden tile is revealed!")
      break

    case 'reveal-around-strike':
      if (streak >= (def.condition?.minStreak ?? 1)) {
        const { revealed, enemyTiles } = _revealAroundEnemy(ctx, tile)
        UI.spawnFloat(tileEl, `⚡ Chain (${revealed})`, 'xp')
        if (enemyTiles.length === 0) {
          UI.setMessage(
            revealed > 0
              ? `Chain Fang — revealed ${revealed} tile${revealed !== 1 ? 's' : ''}, no enemies nearby`
              : 'Chain Fang — no hidden tiles nearby'
          )
        } else {
          // Stagger hits: let tiles finish flipping, then strike each enemy in sequence
          let chainHits = 0
          enemyTiles.forEach((t, i) => {
            setTimeout(() => {
              if (!t.enemyData || t.enemyData._slain || playerDmg <= 0) return
              t.enemyData.currentHP = Math.max(0, (t.enemyData.currentHP ?? 0) - playerDmg)
              UI.spawnFloat(t.element, `⚡ ${playerDmg}`, 'xp')
              UI.updateEnemyHP(t.element, t.enemyData.currentHP)
              UI.shakeTile(t.element)
              EventBus.emit('audio:play', { sfx: i % 2 === 0 ? 'hit' : 'hit2' })
              chainHits++
              if (i === enemyTiles.length - 1) {
                UI.setMessage(`Chain Fang — revealed ${revealed} tile${revealed !== 1 ? 's' : ''}, chain-struck ${chainHits} enem${chainHits !== 1 ? 'ies' : 'y'} for ${playerDmg}!`)
              }
            }, 300 + i * 150)
          })
        }
      }
      break

    case 'heal-pct':
      if (streak >= (def.condition?.minStreak ?? 1)) {
        const healAmt = Math.max(1, Math.floor(p.maxHp * effect.amount / 100))
        p.hp = Math.min(p.maxHp, p.hp + healAmt)
        UI.updateHP(p.hp, p.maxHp)
        UI.spawnFloat(tileEl, `❤️ +${healAmt}`, 'heal')
        UI.setMessage(`Bloodthirst Crystal — +${healAmt} HP from 3-counter streak!`)
      }
      break

    case 'lightning-all-revealed':
      if (streak >= (def.condition?.minStreak ?? 1)) {
        _lightningAllRevealed(ctx, tile, effect.damagePct)
        UI.setMessage(`Storm Gem — lightning strikes all revealed enemies for ${effect.damagePct}% damage!`)
      }
      break

    case 'cast-bound-ability':
      if (streak >= (def.condition?.minStreak ?? 1)) {
        _emerlangAutocast(ctx, tile)
      }
      break
  }
}

// ── Helpers for gem effects ─────────────────────────────────────

function _safeGemReveal(ctx, t) {
  if (!t || t.revealed || t.isSafeStart) return false
  t.revealed = true
  session.run.tilesRevealed++
  TileEngine.markReachable(t.row, t.col, ctx.markReachableUi)
  if (t.element) TileEngine.flipTile(t)
  ctx.applyRevealOutcome?.(t)
  return true
}

function _revealAroundEnemy(ctx, tile) {
  if (tile?.row == null || tile?.col == null) return { revealed: 0, enemies: 0, enemyTiles: [] }
  const grid = TileEngine.getGrid()
  if (!grid) return { revealed: 0, enemies: 0, enemyTiles: [] }
  let revealed = 0
  let enemies = 0
  const enemyTiles = []
  const { row, col } = tile
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue
      const t = grid[row + dr]?.[col + dc]
      if (!t || t.revealed || t.isSafeStart) continue
      const isEnemy = !!(t.enemyData && !t.enemyData._slain)
      if (_safeGemReveal(ctx, t)) {
        revealed++
        if (isEnemy) { enemies++; enemyTiles.push(t) }
      }
    }
  }
  if (revealed > 0) {
    ctx.syncGridDomClassesFromModel?.()
    TileEngine.recomputeReachabilityFromRevealed(ctx.markReachableUi)
  }
  return { revealed, enemies, enemyTiles }
}

function _revealRandomTile(ctx) {
  const grid = TileEngine.getGrid()
  if (!grid) return
  const unrevealed = []
  for (const row of grid) {
    for (const t of row) {
      if (!t.revealed && !t.isSafeStart) unrevealed.push(t)
    }
  }
  if (!unrevealed.length) return
  const t = unrevealed[Math.floor(Math.random() * unrevealed.length)]
  _safeGemReveal(ctx, t)
  ctx.syncGridDomClassesFromModel?.()
  TileEngine.recomputeReachabilityFromRevealed(ctx.markReachableUi)
}

function _lightningAllRevealed(ctx, _tile, pctDmg) {
  const grid = TileEngine.getGrid()
  if (!grid) return
  const p = session.run.player
  for (const row of grid) {
    for (const t of row) {
      if (t.revealed && t.enemyData && !t.enemyData._slain) {
        const dmg = Math.max(1, Math.floor(p.maxHp * pctDmg / 100))
        t.enemyData.currentHP = Math.max(0, (t.enemyData.currentHP ?? 0) - dmg)
        UI.spawnFloat(t.element, `⚡ ${dmg}`, 'xp')
        UI.updateEnemyHP(t.element, t.enemyData.currentHP)
      }
    }
  }
}

/** Re-render both gem socket slots on the equipment screen. */
export function renderGemSockets() {
  const equipped = resolveEquippedGemsForDisplay()
  _renderGemSlot('block', equipped.block)
  _renderGemSlot('counter', equipped.counter)
}

function _renderGemSlot(socket, gemId) {
  const slotEl = document.getElementById(`gem-slot-${socket}`)
  const iconEl = document.getElementById(`gem-socket-gem-${socket}`)
  const nameEl = document.getElementById(`gem-slot-name-${socket}`)
  if (!slotEl || !iconEl) return

  iconEl.innerHTML = ''
  if (gemId) {
    slotEl.classList.add('filled')
    const def = GEMS[gemId]
    if (def?.spriteSrc) {
      const img = document.createElement('img')
      img.src = def.spriteSrc
      img.alt = def.name ?? gemId
      iconEl.appendChild(img)
    } else {
      iconEl.textContent = '💎'
    }
    if (nameEl) {
      if (gemId === 'gem-emerlang') {
        const binding = session.run?.emerlangAbilityBinding
        nameEl.textContent = binding
          ? `${def.name}: ${EMERLANG_BINDABLE[binding]?.label ?? binding}`
          : `${def.name} (tap to bind)`
      } else {
        nameEl.textContent = def?.name ?? gemId
      }
      nameEl.classList.remove('empty')
    }
  } else {
    slotEl.classList.remove('filled')
    if (nameEl) {
      nameEl.textContent = 'Empty'
      nameEl.classList.add('empty')
    }
  }
}

/** Socket a gem from backpack into the matching slot. Returns false if slot mismatch. */
export function socketGem(ctx, gemId, inventoryIndex = null) {
  const def = GEMS[gemId]
  if (!def) return false
  const run = session.run
  if (!run) return false
  if (!run.equippedGems) run.equippedGems = { block: null, counter: null }
  const socket = def.socket
  if (socket !== 'block' && socket !== 'counter') return false

  // Move currently socketed gem back to backpack (if any)
  const current = run.equippedGems[socket]
  if (current) {
    ctx.GameController.addItemToInventory(current)
  }

  // Remove new gem from backpack
  const inv = ctx.GameController.getInventory()
  if (inventoryIndex != null) {
    const entry = inv[inventoryIndex]
    if (!entry || entry.id !== gemId) return false
    const qty = (entry.qty ?? 1) - 1
    if (qty <= 0) inv[inventoryIndex] = null
    else entry.qty = qty
  } else {
    ctx.GameController.consumeItemQty(gemId, 1)
  }

  run.equippedGems[socket] = gemId
  if (!run.gemStreaks) run.gemStreaks = {}
  run.gemStreaks[gemId] = 0

  EventBus.emit('inventory:changed')
  renderGemSockets()
  persistEquippedGemsToSave()
  ctx.GameController.persistActiveRun?.()

  if (gemId === 'gem-emerlang') {
    _showEmerlangAbilityPicker(ctx)
  }

  return true
}

/** Socket the gem at a specific backpack index (compare modal flow). */
export function socketGemAtIndex(ctx, inventoryIndex) {
  const entry = ctx.GameController.getInventory()?.[inventoryIndex]
  if (!entry?.id || !GEMS[entry.id]) return false
  return socketGem(ctx, entry.id, inventoryIndex)
}

/** Remove a gem from a socket back to the backpack. */
export function unsocketGem(ctx, socket) {
  const run = session.run
  if (!run?.equippedGems) return
  const gemId = run.equippedGems[socket]
  if (!gemId) return
  run.equippedGems[socket] = null
  if (gemId === 'gem-emerlang') run.emerlangAbilityBinding = null
  ctx.GameController.addItemToInventory(gemId)
  if (run.gemStreaks) delete run.gemStreaks[gemId]
  EventBus.emit('inventory:changed')
  renderGemSockets()
  persistEquippedGemsToSave()
  ctx.GameController.persistActiveRun?.()
}

/** Wire click handlers for gem socket slots on the equipment screen. */
export function wireGemSockets(ctx) {
  for (const socket of ['block', 'counter']) {
    document.getElementById(`gem-slot-${socket}`)?.addEventListener('click', () => {
      const run = session.run
      if (!run) return
      const currentGemId = run.equippedGems?.[socket]
      if (currentGemId) {
        // Show unsocket prompt
        _showGemModal(ctx, socket, currentGemId)
      } else {
        // Show gem picker from backpack
        _showGemPicker(ctx, socket)
      }
    })
  }
}

function _showGemModal(ctx, socket, gemId) {
  const def = GEMS[gemId]
  const modal = document.createElement('div')
  modal.className = 'simple-modal-overlay'
  modal.innerHTML = `
    <div class="simple-modal">
      <div class="simple-modal-title">${def?.name ?? gemId}</div>
      <div class="simple-modal-hint">${def?.hint ?? ''}</div>
      <div class="simple-modal-actions">
        <button class="simple-modal-btn" id="gem-modal-unsocket">Remove gem</button>
        <button class="simple-modal-btn gem-modal-cancel">Cancel</button>
      </div>
    </div>`
  document.body.appendChild(modal)
  modal.querySelector('#gem-modal-unsocket').addEventListener('click', () => {
    unsocketGem(ctx, socket)
    modal.remove()
  })
  modal.querySelector('.gem-modal-cancel').addEventListener('click', () => modal.remove())
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove() })
}

function _showGemPicker(ctx, socket) {
  const inv = ctx.GameController.getInventory()
  const gems = inv.filter(e => e && GEMS[e.id] && GEMS[e.id].socket === socket)
  if (!gems.length) {
    _showGemPickerEmpty(socket)
    return
  }
  const modal = document.createElement('div')
  modal.className = 'simple-modal-overlay'
  const listHtml = gems.map(e => {
    const def = GEMS[e.id]
    return `<button class="gem-picker-btn" data-gem="${e.id}">
      <img src="${def.spriteSrc}" style="width:28px;height:28px;vertical-align:middle;"> ${def.name} — ${def.hint}
    </button>`
  }).join('')
  modal.innerHTML = `
    <div class="simple-modal">
      <div class="simple-modal-title">Choose a ${socket === 'block' ? '🛡️ Block' : '⚔️ Counter'} gem</div>
      <div class="gem-picker-list">${listHtml}</div>
      <button class="simple-modal-btn gem-modal-cancel">Cancel</button>
    </div>`
  document.body.appendChild(modal)
  modal.querySelectorAll('.gem-picker-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      socketGem(ctx, btn.dataset.gem)
      modal.remove()
    })
  })
  modal.querySelector('.gem-modal-cancel').addEventListener('click', () => modal.remove())
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove() })
}

function _showGemPickerEmpty(socket) {
  const modal = document.createElement('div')
  modal.className = 'simple-modal-overlay'
  modal.innerHTML = `
    <div class="simple-modal">
      <div class="simple-modal-title">No ${socket} gems in backpack</div>
      <div class="simple-modal-hint">Find or craft a ${socket === 'block' ? '🛡️ Block' : '⚔️ Counter'} gem to socket it here.</div>
      <button class="simple-modal-btn gem-modal-cancel">OK</button>
    </div>`
  document.body.appendChild(modal)
  modal.querySelector('.gem-modal-cancel').addEventListener('click', () => modal.remove())
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove() })
}
