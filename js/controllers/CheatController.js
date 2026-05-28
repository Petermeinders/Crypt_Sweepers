/** Dev cheat surface — wired from GameController with injected deps. */

export function cheatSkipFloor(deps) {
  const { getSave, getRun, GameState, States, UI, EventBus, nextFloor, startFloor, runMusicTrack } = deps
  const _save = getSave()
  const run = getRun()
  if (!_save?.settings?.cheats?.skipFloorButton || !run) return
  if (!GameState.is(States.FLOOR_EXPLORE)) {
    UI.setMessage('[Cheat] Skip floor only works while exploring.', true)
    return
  }
  run.bossFloorExitPending = false
  if (run.atRest) {
    run.atRest = false
    run.floorKeyAwarded = false
    run.floor++
    EventBus.emit('audio:crossfade', { track: runMusicTrack(), duration: 1500 })
    EventBus.emit('audio:play', { sfx: 'footsteps' })
    UI.setMessage(`[Cheat] Skipped sanctuary → floor ${run.floor}`)
    EventBus.emit('run:floorAdvance', { newFloor: run.floor })
    UI.runFloorTransition(3000, () => {
      GameState.set(States.BOOT)
      startFloor()
    }, run.floor)
    return
  }
  nextFloor()
}

export function applyCheat(deps, key, enabled) {
  const { getSave, getRun, UI, xpNeeded } = deps
  const _save = getSave()
  const run = getRun()
  if (!_save.settings.cheats) _save.settings.cheats = {}
  _save.settings.cheats[key] = enabled

  if (key === 'skipFloorButton') {
    UI.refreshSkipFloorButton(_save)
  }
  if (key === 'increaseStats') {
    document.body.classList.toggle('cheat-increase-stats', enabled)
  }

  if (!run) return
  if (key === 'gold999' && enabled) {
    run.player.gold = 999
    UI.updateGold(run.player.gold)
  }
  if (key === 'xp999' && enabled) {
    run.player.xp = 999
    UI.updateXP(run.player.xp, xpNeeded())
  }
}

/**
 * Cheat "Increase stats": tap HUD HP/mana/gold (+10 each), attack (+1 damageBonus), XP bar (+10% to next level), or golden key slot (+1 key).
 * Caller should ensure main menu is hidden (in a run).
 */
export function cheatHudStatBoost(deps, stat) {
  const { getSave, getRun, GameState, States, UI, EventBus, xpNeeded, playerDamageRange, triggerLevelUp, syncMagicChestKeyGlow } = deps
  const _save = getSave()
  const run = getRun()
  if (!_save?.settings?.cheats?.increaseStats || !run) return
  if (GameState.is(States.DEATH)) return
  stat = String(stat ?? '').trim().toLowerCase()
  if (stat === 'xp' && GameState.is(States.LEVEL_UP)) return

  const playable =
    GameState.is(States.FLOOR_EXPLORE) ||
    GameState.is(States.COMBAT) ||
    GameState.is(States.NPC_INTERACT) ||
    GameState.is(States.LEVEL_UP) ||
    GameState.is(States.RETREAT_CONFIRM)
  if (!playable) return

  const p = run.player
  if (stat === 'hp') {
    p.hp = Math.min(p.maxHp, p.hp + 10)
    UI.updateHP(p.hp, p.maxHp)
    return
  }
  if (stat === 'mana') {
    p.mana = Math.min(p.maxMana, p.mana + 10)
    UI.updateMana(p.mana, p.maxMana)
    return
  }
  if (stat === 'gold') {
    p.gold += 10
    UI.updateGold(p.gold)
    EventBus.emit('player:goldChange', { amount: 10, newTotal: p.gold })
    return
  }
  if (stat === 'goldenkey') {
    p.goldenKeys = (p.goldenKeys ?? 0) + 1
    UI.updateGoldenKeys(p.goldenKeys)
    syncMagicChestKeyGlow()
    return
  }
  if (stat === 'dmg') {
    p.damageBonus = (p.damageBonus ?? 0) + 1
    {
      const [d0, d1] = playerDamageRange(p)
      UI.updateDamageRange(d0, d1)
    }
    return
  }
  if (stat === 'xp') {
    const add = Math.max(1, Math.round(xpNeeded() * 0.1))
    p.xp += add
    if (p.xp >= xpNeeded()) {
      p.xp -= xpNeeded()
      p.level++
      const xpEl = document.getElementById('xp-bar-container')
      if (xpEl) UI.spawnFloat(xpEl, `⬆️ Lv ${p.level}!`, 'xp')
      EventBus.emit('player:levelup', { newLevel: p.level })
      EventBus.emit('audio:play', { sfx: 'levelup' })
      triggerLevelUp()
    }
    UI.updateXP(p.xp, xpNeeded())
  }
}
