import UI              from './ui/UI.js'
import GameController  from './core/GameController.js'
import MetaProgression from './systems/MetaProgression.js'
import SaveManager     from './save/SaveManager.js'
import AudioManager    from './systems/AudioManager.js'
import EventBus        from './core/EventBus.js'
import Logger          from './core/Logger.js'
import { CONFIG }                           from './config.js'
import { WARRIOR_UPGRADES, SHOP_ITEMS }     from './data/upgrades.js'
import { ITEMS }                            from './data/items.js'
import { RANGER_UPGRADES }                  from './data/ranger.js'
import { GLOBAL_PASSIVE_UPGRADES, GLOBAL_PASSIVE_IDS } from './data/passives.js'

// ── Character roster ──────────────────────────────────────────

const CHARACTERS = [
  {
    id:         'warrior',
    name:       'Palladin',
    tagline:    'Battle-hardened fighter. Slow but hits hard.',
    gif:        'assets/sprites/Heroes/Warrior/warrior-idle.gif',
    attackGif:  'assets/sprites/Heroes/Warrior/warrior-strike.gif',
    attackMs:   2000,
    emoji:      null,
    upgrades:   WARRIOR_UPGRADES,
    unlockCost: null,
    baseHP:     50,
    baseMana:   30,
    baseDmg:    '1',
  },
  {
    id:         'ranger',
    name:       'Ranger',
    tagline:    "Swift and elusive, the Ranger uses his agility to strike quick with his bow while avoiding dangers and traps.",
    gif:        'assets/sprites/Heroes/Ranger/__Idle.gif',
    attackGif:  'assets/sprites/Heroes/Ranger/__Attack.gif',
    attackMs:   4000,
    emoji:      null,
    upgrades:   RANGER_UPGRADES,
    unlockCost: CONFIG.rangerUnlockCost,
    baseHP:     40,
    baseMana:   35,
    baseDmg:    '1',
  },
  {
    id:          'mage',
    name:        'Mage',
    tagline:     'A master of the arcane arts who turns the dungeon into a laboratory. Devastating spell power — but dangerously fragile up close.',
    gif:         null,
    attackGif:   null,
    attackMs:    0,
    emoji:       '🧙‍♂️',
    upgrades:    {},
    unlockCost:  null,
    baseHP:      30,
    baseMana:    60,
    baseDmg:     '1',
    comingSoon:  true,
  },
  {
    id:          'vampire',
    name:        'Vampire',
    tagline:     'A creature of the night who feeds on fallen foes to grow stronger. The deeper the crypt, the more dangerous she becomes.',
    gif:         null,
    attackGif:   null,
    attackMs:    0,
    emoji:       '🧛',
    upgrades:    {},
    unlockCost:  null,
    baseHP:      45,
    baseMana:    25,
    baseDmg:     '2',
    comingSoon:  true,
  },
]

// ── Boot sequence ─────────────────────────────────────────────

async function boot() {
  Logger.debug('[main] boot start')

  UI.init()

  // Load or create save
  let save = await SaveManager.load()
  if (!save) {
    save = MetaProgression.defaultSave()
    await SaveManager.save(save)
  }
  // Migrate old saves missing keys
  if (save.settings.tileColors === undefined) save.settings.tileColors = false
  if (save.settings.musicOn === undefined)    save.settings.musicOn    = true
  if (save.settings.sfxOn   === undefined)    save.settings.sfxOn      = true
  if (!save.settings.cheats) save.settings.cheats = {}
  if (!save.globalPassives) save.globalPassives = []
  if (!Array.isArray(save.bestiarySeen)) save.bestiarySeen = []
  document.body.classList.toggle('cheat-increase-stats', save.settings.cheats?.increaseStats === true)

  // Apply saved visual/audio settings immediately
  if (save.settings.tileColors) document.body.classList.add('tile-colors')
  AudioManager.setMusicEnabled(save.settings.musicOn ?? true)
  AudioManager.setSfxEnabled(save.settings.sfxOn ?? true)

  // Migrate old saves missing ranger key
  if (!save.ranger) {
    save.ranger = { unlocked: false, totalXP: 0, upgrades: [] }
    await SaveManager.save(save)
  }
  if (!save.selectedCharacter) {
    save.selectedCharacter = 'warrior'
  }

  GameController.init(save)
  UI.refreshSkipFloorButton(save)

  EventBus.on('inventory:changed', () => {
    const ov = document.getElementById('backpack-overlay')
    if (ov?.classList.contains('is-open')) _renderBackpack()
  })

  EventBus.on('backpack:full', ({ id }) => {
    _openBackpackFull(id)
  })

  // ── Audio ────────────────────────────────────────────────
  AudioManager.init()

  // ── In-run buttons ───────────────────────────────────────
  // ── Resume run prompt ────────────────────────────────────
  document.getElementById('resume-yes-btn').addEventListener('click', () => {
    document.getElementById('resume-overlay').classList.add('hidden')
    GameController.resumeRun()
  })
  document.getElementById('resume-no-btn').addEventListener('click', () => {
    document.getElementById('resume-overlay').classList.add('hidden')
    GameController.abandonRun()
  })

  document.getElementById('hud-teary-eyes')?.addEventListener('click', () => {
    const turns = GameController.getTearyEyesTurns()
    UI.setMessage(`💧 Teary Eyes (${turns} turn${turns === 1 ? '' : 's'}) — Onion stench! All spell & ability mana costs are +1 until it clears.`)
  })

  document.getElementById('info-card-overlay').addEventListener('pointerdown', (e) => {
    if (e.target.id === 'info-card-overlay') UI.hideInfoCard()
  })
  document.getElementById('hud-backpack-btn').addEventListener('click', () => {
    _toggleBackpack()
  })
  document.getElementById('skip-floor-btn')?.addEventListener('click', () => {
    GameController.cheatSkipFloor()
  })
  document.getElementById('app').addEventListener('click', (e) => {
    const s = GameController.getSave()
    if (!s.settings.cheats?.increaseStats) return
    if (!document.getElementById('main-menu').classList.contains('hidden')) return
    const row = e.target.closest('[data-hud-cheat-target]')
    if (!row) return
    // dataset.* is unreliable for multi-segment names like data-hud-cheat-target in some browsers
    const stat = row.getAttribute('data-hud-cheat-target')?.trim().toLowerCase()
    if (!stat) return
    GameController.cheatHudStatBoost(stat)
  })
  document.getElementById('backpack-levelup-toggle')?.addEventListener('click', () => {
    const acc = document.getElementById('backpack-levelup-accordion')
    const btn = document.getElementById('backpack-levelup-toggle')
    if (!acc || !btn) return
    const open = acc.classList.toggle('open')
    btn.setAttribute('aria-expanded', open ? 'true' : 'false')
  })
  document.getElementById('hero-select-scroll')?.addEventListener('click', e => {
    const t = e.target.closest('.hero-passive-accordion-toggle')
    if (!t) return
    const acc = t.closest('.hero-passive-accordion')
    if (!acc) return
    const open = acc.classList.toggle('open')
    t.setAttribute('aria-expanded', open ? 'true' : 'false')
  })
  _wireAbilityHold(
    document.getElementById('hud-btn-slot-a'),
    () => GameController.abilitySlotAAction(),
    () => {
      const s = GameController.getSave()
      if ((s.selectedCharacter ?? 'warrior') === 'ranger') {
        const arc = (s.ranger?.upgrades ?? []).includes('ricochet-arc-mastery')
        const rr  = GameController.getRicochetBreakdown()
        const pattern = arc ? '4 : 3 : 2' : '3 : 2 : 1'
        const dmgDesc = rr
          ? `Three shots: ${rr.shots.join(' → ')} (${pattern} × unit; unit ≈ ${rr.unit}).`
          : `Three shots at ${pattern} × unit — start a run for exact damage.`
        UI.showInfoCard({
          spriteSrc:   RANGER_UPGRADES.ricochet.iconSrc,
          spriteSrcBg: RANGER_UPGRADES.ricochet.iconBgSrc,
          name:   'Ricochet',
          type:   'Ranger Ability',
          blurb:  arc
            ? 'Mark up to three enemies in order. The third pick fires immediately; with one or two marked, tap Ricochet again. Shot damage scales with your attack (HUD) in a 4 : 3 : 2 ratio (Ricochet Mastery).'
            : 'Mark up to three enemies in order. The third pick fires immediately; with one or two marked, tap Ricochet again. Shot damage scales with your attack (HUD) in a 3 : 2 : 1 ratio.',
          details: [
            { icon: '🔵', label: 'Mana Cost',  desc: `${RANGER_UPGRADES.ricochet.manaCost} mana when you fire` },
            { icon: '🎯', label: 'Targeting',  desc: 'Third target auto-fires; otherwise tap Ricochet to confirm' },
            { icon: '🏹', label: 'Damage',      desc: dmgDesc },
          ],
        })
      } else {
        const slam = GameController.getSlamDamageBreakdown()
        const dmgDesc = slam
          ? (() => {
              const { avgMelee, baseTenths, stacks, mult, final } = slam
              const avgStr = Number.isInteger(avgMelee) ? String(avgMelee) : avgMelee.toFixed(1)
              const multStr = mult.toFixed(1)
              const inner = stacks > 0
                ? `(${baseTenths}/10 + ${stacks}×0.1)`
                : `${multStr}`
              return `max(1, round(${avgStr} × ${inner})) = ${final}`
            })()
          : 'Start a run to see your Slam damage.'
        UI.showInfoCard({
          spriteSrc: WARRIOR_UPGRADES.slam.iconSrc,
          name:   'Slam',
          type:   'Palladin Ability',
          blurb:  'Bring your weapon down with crushing force. Strikes every revealed enemy; each takes the same Slam damage (scales with your HUD attack + Slam Mastery).',
          details: [
            { icon: '🔵', label: 'Mana Cost',  desc: `${WARRIOR_UPGRADES.slam.manaCost} mana per use` },
            { icon: '🌀', label: 'AOE',         desc: 'Hits all revealed enemies simultaneously' },
            { icon: '📐', label: 'Calculation', desc: dmgDesc },
            { icon: '💥', label: 'Per enemy',   desc: slam ? `${slam.final} damage (integer)` : '—' },
          ],
        })
      }
    }
  )
  _wireAbilityHold(
    document.getElementById('hud-btn-slot-b'),
    () => {
      const s = GameController.getSave()
      if ((s.selectedCharacter ?? 'warrior') === 'ranger') GameController.poisonArrowShotAction()
      else GameController.blindingLightAction()
    },
    () => {
      const s = GameController.getSave()
      if ((s.selectedCharacter ?? 'warrior') === 'ranger') {
        if (!GameController.isRangerActiveUnlocked('poison-arrow-shot')) return
        const pb = GameController.getPoisonArrowShotBreakdown()
        const dmgLine = pb
          ? `Initial hit and each poison tick: ${pb.perHit} (max(1, round(avgMelee × ${CONFIG.ability.ricochetUnitMult}))) — ${pb.flipTicks} ticks on your next turns (reveals or melee).`
          : 'Start a ranger run to see damage.'
        UI.showInfoCard({
          spriteSrc:   RANGER_UPGRADES['poison-arrow-shot'].iconSrc,
          spriteSrcBg: RANGER_UPGRADES['poison-arrow-shot'].iconBgSrc,
          name:   RANGER_UPGRADES['poison-arrow-shot'].name,
          type:   'Ranger Ability',
          blurb:  'Tap one enemy for immediate poison damage, then three poison ticks on global turns: each tile reveal or each time you start melee against any enemy advances poison on all poisoned foes. Tap the ability again to cancel targeting.',
          details: [
            { icon: '🔵', label: 'Mana Cost', desc: `${RANGER_UPGRADES['poison-arrow-shot'].manaCost} mana when you fire` },
            { icon: '☠️', label: 'Poison',     desc: dmgLine },
          ],
        })
        return
      }
      const bl = GameController.getBlindingLightBreakdown()
      const stunDesc = bl
        ? (() => {
            const { avgMelee, baseTenths, stacks, mult, stunTurns } = bl
            const avgStr = Number.isInteger(avgMelee) ? String(avgMelee) : avgMelee.toFixed(1)
            const inner = stacks > 0
              ? `(${baseTenths}/10 + ${stacks}×0.1)`
              : `${mult.toFixed(1)}`
            return `max(2, round(${avgStr} × ${inner})) = ${stunTurns} stun turn(s) — Undead/Beast Bane can double stun`
          })()
        : 'Start a palladin run to see stun turns (scales with HUD attack + Blinding Mastery).'
      UI.showInfoCard({
        spriteSrc: WARRIOR_UPGRADES['blinding-light'].iconSrc,
        name:   'Blinding Light',
        type:   'Palladin Ability',
        blurb:  'A flash of searing light adds stun turns based on your attack scaling (no HP damage). Stunned enemies cannot counter-attack.',
        details: [
          { icon: '🔵', label: 'Mana Cost', desc: `${WARRIOR_UPGRADES['blinding-light'].manaCost} mana per use` },
          { icon: '🎯', label: 'Targeting', desc: 'Tap an enemy to blind' },
          { icon: '⏱️', label: 'Stun turns', desc: stunDesc },
        ],
      })
    }
  )
  document.getElementById('hud-portrait-wrap').addEventListener('click', () => {
    GameController.divineLightHealAction()
  })

  _wireAbilityHold(
    document.getElementById('hud-btn-slot-c'),
    () => {
      const s = GameController.getSave()
      if ((s.selectedCharacter ?? 'warrior') === 'ranger') GameController.arrowBarrageAction()
      else GameController.divineLightAction()
    },
    () => {
      const s = GameController.getSave()
      if ((s.selectedCharacter ?? 'warrior') !== 'ranger') {
        // Warrior: Divine Light info card
        if (!(s.warrior?.upgrades ?? []).includes('divine-light')) return
        const dl = GameController.getDivineLightBreakdown()
        UI.showInfoCard({
          spriteSrc:   WARRIOR_UPGRADES['divine-light'].iconSrc,
          spriteSrcBg: WARRIOR_UPGRADES['divine-light'].iconBgSrc,
          name:   'Divine Light',
          type:   'Palladin Ability',
          blurb:  'Channel sacred energy in two ways: smite a revealed enemy with divine force, or touch your portrait to bathe yourself in healing light.',
          details: [
            { icon: '🔵', label: 'Mana Cost',  desc: `${WARRIOR_UPGRADES['divine-light'].manaCost} mana per use` },
            { icon: '⚔️', label: 'Smite',       desc: dl ? `${dl.smite} damage (avg melee ${Number.isInteger(dl.avgMelee) ? dl.avgMelee : dl.avgMelee.toFixed(1)})` : 'Start a run to see damage.' },
            { icon: '❤️', label: 'Heal',         desc: dl ? `Restores ${dl.heal} HP (10% of ${dl.maxHp} max HP)` : 'Start a run to see heal amount.' },
            { icon: '🎯', label: 'Targeting',   desc: 'Tap an enemy tile to smite, or tap your hero portrait to heal' },
          ],
        })
        return
      }
      if (!GameController.isRangerActiveUnlocked('arrow-barrage')) return
      const br = GameController.getArrowBarrageBreakdown()
      const dmgLine = br
        ? `${Math.round(br.heroDamagePct * 100)}% of avg attack (${br.perEnemy} per enemy, min 1) in a ${br.area} — level-up mastery stacks add to this.`
        : 'Start a ranger run to see damage.'
      const vol = RANGER_UPGRADES['arrow-barrage']
      UI.showInfoCard({
        spriteSrc:   vol.iconSrc,
        spriteSrcBg: vol.iconBgSrc,
        name:   vol.name,
        type:   'Ranger Ability',
        blurb:  'Tap a revealed tile to center a 3×3 blast. Blinking tiles show the area; tap the same tile again to hit every revealed enemy there for 50% attack each (min 1). Tap the ability again to cancel.',
        details: [
          { icon: '🔵', label: 'Mana Cost', desc: `${vol.manaCost} mana when you fire` },
          { icon: '🎯', label: 'Area',       desc: '3×3 centered on your first tap; confirm on the same tile' },
          { icon: '🏹', label: 'Damage',     desc: dmgLine },
        ],
      })
    }
  )
  document.getElementById('retreat-btn').addEventListener('click', () => {
    document.getElementById('retreat-confirm').classList.remove('hidden')
  })
  document.getElementById('retreat-confirm-yes').addEventListener('click', () => {
    document.getElementById('retreat-confirm').classList.add('hidden')
    GameController.doRetreat()
  })
  document.getElementById('retreat-confirm-no').addEventListener('click', () => {
    document.getElementById('retreat-confirm').classList.add('hidden')
  })

  // ── UI button click sound (same as New Run) — panels, back, retreat, Heroes, etc. ──
  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('button')
    if (!btn || btn.disabled) return
    if (btn.closest('.hud-actions')) return
    if (btn.classList.contains('card-btn-drop')) return
    const id = btn.id
    if (id === 'retreat-confirm-yes') return
    if (id === 'merchant-roll-btn') return
    if (id === 'rope-modal-confirm') return
    EventBus.emit('audio:play', { sfx: 'menu' })
  })

  // ── Main menu buttons ────────────────────────────────────
  document.getElementById('new-run-btn').addEventListener('click', () => GameController.newGame())

  // Hero select
  document.getElementById('hero-select-open-btn').addEventListener('click', _openHeroSelect)
  document.getElementById('hero-select-back').addEventListener('click', () => {
    document.getElementById('hero-select-overlay').classList.add('hidden')
    _updateMenuHeroPreview()
  })
  document.getElementById('hero-prev').addEventListener('click', () => _navHeroSelect(-1))
  document.getElementById('hero-next').addEventListener('click', () => _navHeroSelect(1))
  _ensureHeroSelectSlides()
  document.getElementById('hero-select-scroll')?.addEventListener('click', _onHeroPortraitClick)
  document.getElementById('hero-select-btn').addEventListener('click', () => {
    const s    = GameController.getSave()
    const char = CHARACTERS[_heroIdx]
    const btn  = document.getElementById('hero-select-btn')
    if (btn.dataset.mode === 'unlock') {
      if (char.id === 'ranger' && MetaProgression.unlockRanger(s)) {
        SaveManager.save(s)
        _renderHeroSelect()
      }
    } else {
      s.selectedCharacter = char.id
      SaveManager.save(s)
      _renderHeroSelect()
    }
  })
  // Dismiss upgrade detail on backdrop click
  document.getElementById('hero-upgrade-backdrop').addEventListener('click', e => {
    if (e.target === document.getElementById('hero-upgrade-backdrop')) {
      _selectedUpgradeId = null
      document.getElementById('hero-upgrade-backdrop').classList.add('hidden')
      const s        = GameController.getSave()
      const char     = CHARACTERS[_heroIdx]
      const charSave = char.comingSoon ? { totalXP: 0, upgrades: [] }
        : char.id === 'ranger' ? s.ranger : s.warrior
      const grid     = _heroSlideGrid(_heroIdx)
      _renderHeroUpgradeGrid(grid, char, charSave.upgrades ?? [], charSave.totalXP ?? 0, !char.comingSoon && char.id === 'ranger' && !s.ranger.unlocked)
    }
  })


  document.getElementById('settings-btn').addEventListener('click', () => {
    const s = GameController.getSave()
    const c = s.settings.cheats ?? {}
    document.getElementById('setting-music').checked        = s.settings.musicOn    ?? true
    document.getElementById('setting-sfx').checked          = s.settings.sfxOn      ?? true
    document.getElementById('setting-tile-colors').checked  = s.settings.tileColors ?? false
    document.getElementById('setting-haptic').checked       = s.settings.hapticFeedback ?? true
    document.getElementById('cheat-god-mode').checked       = c.godMode      ?? false
    document.getElementById('cheat-instant-kill').checked   = c.instantKill  ?? false
    document.getElementById('cheat-999-gold').checked       = c.gold999      ?? false
    document.getElementById('cheat-999-xp').checked         = c.xp999        ?? false
    document.getElementById('cheat-skip-floor-btn').checked = c.skipFloorButton ?? false
    document.getElementById('cheat-increase-stats').checked = c.increaseStats ?? false
    document.getElementById('settings-overlay').classList.remove('hidden')
  })
  document.getElementById('settings-back').addEventListener('click', () => {
    document.getElementById('settings-overlay').classList.add('hidden')
  })
  document.getElementById('setting-music').addEventListener('change', e => {
    const s = GameController.getSave()
    s.settings.musicOn = e.target.checked
    AudioManager.setMusicEnabled(e.target.checked)
    SaveManager.save(s)
  })
  document.getElementById('setting-sfx').addEventListener('change', e => {
    const s = GameController.getSave()
    s.settings.sfxOn = e.target.checked
    AudioManager.setSfxEnabled(e.target.checked)
    SaveManager.save(s)
  })

  const tileColorsCb = document.getElementById('setting-tile-colors')
  tileColorsCb.addEventListener('change', () => {
    const s = GameController.getSave()
    s.settings.tileColors = tileColorsCb.checked
    document.body.classList.toggle('tile-colors', tileColorsCb.checked)
    SaveManager.save(s)
  })

  document.getElementById('setting-haptic').addEventListener('change', e => {
    const s = GameController.getSave()
    s.settings.hapticFeedback = e.target.checked
    SaveManager.save(s)
  })

  // Cheat toggles
  const _cheatMap = [
    { id: 'cheat-god-mode',     key: 'godMode'     },
    { id: 'cheat-instant-kill', key: 'instantKill' },
    { id: 'cheat-999-gold',     key: 'gold999'     },
    { id: 'cheat-999-xp',       key: 'xp999'       },
    { id: 'cheat-skip-floor-btn', key: 'skipFloorButton' },
    { id: 'cheat-increase-stats', key: 'increaseStats' },
  ]
  _cheatMap.forEach(({ id, key }) => {
    document.getElementById(id).addEventListener('change', e => {
      GameController.applyCheat(key, e.target.checked)
      SaveManager.save(GameController.getSave())
    })
  })

  // Cheat accordion toggle
  document.getElementById('cheat-accordion-toggle').addEventListener('click', () => {
    document.getElementById('cheat-accordion').classList.toggle('open')
  })

  // Delete save
  document.getElementById('delete-save-btn').addEventListener('click', () => {
    document.getElementById('delete-save-confirm').classList.remove('hidden')
    document.getElementById('delete-save-btn').classList.add('hidden')
  })
  document.getElementById('delete-save-no').addEventListener('click', () => {
    document.getElementById('delete-save-confirm').classList.add('hidden')
    document.getElementById('delete-save-btn').classList.remove('hidden')
  })
  document.getElementById('delete-save-yes').addEventListener('click', async () => {
    await SaveManager.clear()
    location.reload()
  })

  document.getElementById('gold-shop-btn').addEventListener('click', _openShop)
  document.getElementById('passive-upgrades-btn').addEventListener('click', _openPassiveUpgrades)
  document.getElementById('passive-upgrades-back').addEventListener('click', () => {
    document.getElementById('passive-upgrades-overlay').classList.add('hidden')
  })
  document.getElementById('gold-shop-back').addEventListener('click', () => UI.hideGoldShop())
  document.getElementById('how-to-play-btn')?.addEventListener('click', () => {
    document.getElementById('how-to-play-overlay')?.classList.remove('hidden')
  })
  document.getElementById('how-to-play-back')?.addEventListener('click', () => {
    document.getElementById('how-to-play-overlay')?.classList.add('hidden')
  })

  document.getElementById('bestiary-btn')?.addEventListener('click', () => {
    UI.showBestiaryPanel(GameController.getSave())
  })
  document.getElementById('bestiary-back')?.addEventListener('click', () => UI.hideBestiaryPanel())
  document.getElementById('trinket-codex-btn')?.addEventListener('click', () => {
    UI.showTrinketCodexPanel(GameController.getSave())
  })
  document.getElementById('trinket-codex-back')?.addEventListener('click', () => UI.hideTrinketCodexPanel())
  document.getElementById('trinket-detail-back')?.addEventListener('click', () => UI.hideTrinketDetail())

  // Difficulty
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const s = GameController.getSave()
      s.settings.difficulty = btn.dataset.diff
      SaveManager.save(s)
      UI.setActiveDifficulty(btn.dataset.diff)
    })
  })

  // Export / Import
  document.getElementById('export-save-btn').addEventListener('click', () => {
    SaveManager.exportJSON(GameController.getSave())
  })
  document.getElementById('import-save-btn').addEventListener('click', () => {
    document.getElementById('import-file-input').click()
  })
  document.getElementById('import-file-input').addEventListener('change', async e => {
    const file = e.target.files[0]
    if (!file) return
    const text = await file.text()
    const imported = await SaveManager.importJSON(text)
    if (imported) {
      GameController.init(imported)
      _updateMenuHeroPreview()
      UI.setActiveDifficulty(imported.settings.difficulty)
    }
    e.target.value = ''
  })

  // PWA install nudge
  _wireInstallNudge()

  // ── Auto-resume or main menu ─────────────────────────────
  _updateMenuHeroPreview()
  UI.setActiveDifficulty(save.settings.difficulty)
  EventBus.emit('audio:music', { track: 'menu' })
  if (GameController.hasActiveRun()) {
    GameController.resumeRun()
  } else {
    UI.showMainMenu()
  }

  Logger.debug('[main] boot complete')
}

// ── Hero Select ───────────────────────────────────────────────

let _heroIdx           = 0
let _selectedUpgradeId = null
let _heroAttackTimer   = null
/** True while programmatic scroll runs so scroll handlers do not fight the index. */
let _heroScrollSkip    = false

function _heroSlideGrid(idx) {
  const slide = document.querySelector(`#hero-select-scroll .hero-select-slide[data-hero-index="${idx}"]`)
  return slide?.querySelector('.hero-upgrades-grid') ?? null
}

function _onHeroPortraitClick(e) {
  const img = e.target.closest('.hero-display-gif')
  if (!img) return
  const slide = img.closest('.hero-select-slide')
  if (!slide) return
  const i = Number(slide.dataset.heroIndex)
  if (i !== _heroIdx) return
  const char = CHARACTERS[_heroIdx]
  if (!char.attackGif || _heroAttackTimer) return
  const gifEl = slide.querySelector('.hero-display-gif')
  if (!gifEl) return
  gifEl.src = char.attackGif + '?t=' + Date.now()
  _heroAttackTimer = setTimeout(() => {
    _heroAttackTimer = null
    if (CHARACTERS[_heroIdx] === char && char.gif) {
      gifEl.src = char.gif + '?t=' + Date.now()
    }
  }, char.attackMs ?? 4000)
}

function _ensureHeroSelectSlides() {
  const scroll = document.getElementById('hero-select-scroll')
  if (!scroll) return
  const first = scroll.children[0]
  const structureOk = first?.querySelector('.hero-passive-wrap')
  if (scroll.children.length === CHARACTERS.length && structureOk) return
  scroll.innerHTML = ''
  CHARACTERS.forEach((_, i) => {
    const slide = document.createElement('section')
    slide.className = 'hero-select-slide'
    slide.dataset.heroIndex = String(i)
    slide.innerHTML = `
      <div class="hero-select-namewrap">
        <div class="hero-select-name"></div>
        <div class="hero-select-tagline"></div>
        <div class="hero-select-xp-row">XP: <span class="hero-select-xp"></span></div>
      </div>
      <div class="hero-upgrades-grid"></div>
      <div class="hero-display-row">
        <div class="hero-display-wrap">
          <img class="hero-display-gif" src="" alt="">
          <div class="hero-display-emoji hidden"></div>
          <div class="hero-locked-overlay hidden">
            <div class="hero-lock-icon">🔒</div>
            <div class="hero-lock-label">Locked</div>
          </div>
        </div>
      </div>
      <div class="hero-passive-wrap" hidden>
        <div class="hero-passive-accordion">
          <button type="button" class="hero-passive-accordion-toggle" aria-expanded="false">
            <span>Passive Upgrades</span>
            <span class="accordion-chevron">▸</span>
          </button>
          <div class="hero-passive-accordion-body">
            <div class="hero-passive-upgrades-grid"></div>
          </div>
        </div>
      </div>
    `
    scroll.appendChild(slide)
  })
  _wireHeroSelectScroll()
}

function _wireHeroSelectScroll() {
  const scroll = document.getElementById('hero-select-scroll')
  if (!scroll || scroll.dataset.heroScrollWired === '1') return
  scroll.dataset.heroScrollWired = '1'
  const settle = () => {
    if (_heroScrollSkip) return
    _onHeroScrollSettled()
  }
  let debounceTimer = null
  scroll.addEventListener('scroll', () => {
    if (_heroScrollSkip) return
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(settle, 200)
  }, { passive: true })
}

function _onHeroScrollSettled() {
  const scroll = document.getElementById('hero-select-scroll')
  if (!scroll) return
  const w = scroll.clientWidth
  if (w <= 0) return
  const idx = Math.round(scroll.scrollLeft / w)
  const clamped = Math.max(0, Math.min(CHARACTERS.length - 1, idx))
  if (clamped === _heroIdx) return
  _heroIdx = clamped
  _selectedUpgradeId = null
  _renderHeroSelect({ skipScrollSync: true })
}

function _navHeroSelect(delta) {
  const next = Math.min(CHARACTERS.length - 1, Math.max(0, _heroIdx + delta))
  if (next === _heroIdx) return
  _heroIdx = next
  _selectedUpgradeId = null
  _renderHeroSelect({ scrollBehavior: 'smooth' })
}

function _openHeroSelect() {
  const s = GameController.getSave()
  _heroIdx = CHARACTERS.findIndex(c => c.id === (s.selectedCharacter ?? 'warrior'))
  if (_heroIdx < 0) _heroIdx = 0
  _selectedUpgradeId = null
  document.getElementById('hero-select-overlay').classList.remove('hidden')
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      _ensureHeroSelectSlides()
      _renderHeroSelect({ scrollBehavior: 'instant' })
    })
  })
}

function _renderHeroSelect(opts = {}) {
  const skipScrollSync  = opts.skipScrollSync === true
  const scrollBehavior  = opts.scrollBehavior ?? 'instant'
  _ensureHeroSelectSlides()
  const s = GameController.getSave()
  document.getElementById('hero-select-gold-val').textContent = s.persistentGold

  const scroll = document.getElementById('hero-select-scroll')

  CHARACTERS.forEach((char, i) => {
    const slide = scroll?.children[i]
    if (!slide) return
    const charSave  = char.comingSoon ? { totalXP: 0, upgrades: [] }
      : char.id === 'ranger' ? s.ranger : s.warrior
    const isLocked  = !char.comingSoon && char.id === 'ranger' && !s.ranger.unlocked
    const xp        = charSave.totalXP ?? 0
    const owned     = charSave.upgrades ?? []
    const isCurrent = i === _heroIdx

    slide.querySelector('.hero-select-name').textContent    = char.name
    slide.querySelector('.hero-select-tagline').textContent = char.tagline
    slide.querySelector('.hero-select-xp').textContent      = String(xp)
    const xpRow = slide.querySelector('.hero-select-xp-row')
    if (xpRow) xpRow.style.display = char.comingSoon ? 'none' : ''

    const gifEl   = slide.querySelector('.hero-display-gif')
    const emojiEl = slide.querySelector('.hero-display-emoji')
    if (char.gif) {
      if (isCurrent && !_heroAttackTimer) gifEl.src = char.gif + '?t=' + Date.now()
      else if (!isCurrent) gifEl.src = char.gif + '?t=' + Date.now()
      gifEl.style.display   = 'block'
      emojiEl.style.display = 'none'
    } else {
      gifEl.style.display   = 'none'
      gifEl.src             = ''
      emojiEl.textContent   = char.emoji
      emojiEl.style.display = 'block'
    }

    slide.querySelector('.hero-locked-overlay').classList.toggle('hidden', !isLocked)

    const grid = slide.querySelector('.hero-upgrades-grid')
    _renderHeroUpgradeGrid(grid, char, owned, xp, isLocked)
  })

  document.getElementById('hero-prev').classList.toggle('hidden', _heroIdx === 0)
  document.getElementById('hero-next').classList.toggle('hidden', _heroIdx === CHARACTERS.length - 1)

  const char = CHARACTERS[_heroIdx]
  document.getElementById('hero-stat-hp').textContent   = char.baseHP
  document.getElementById('hero-stat-mana').textContent = char.baseMana
  document.getElementById('hero-stat-dmg').textContent  = char.baseDmg

  const isSelected    = s.selectedCharacter === char.id
  const isLocked      = !char.comingSoon && char.id === 'ranger' && !s.ranger.unlocked
  const selectBtn     = document.getElementById('hero-select-btn')
  if (char.comingSoon) {
    selectBtn.textContent  = '🚧 Coming Soon'
    selectBtn.disabled     = true
    selectBtn.dataset.mode = 'coming-soon'
  } else if (isLocked) {
    selectBtn.textContent = `🔓 Unlock (${char.unlockCost}💰)`
    selectBtn.disabled    = s.persistentGold < char.unlockCost
    selectBtn.dataset.mode = 'unlock'
  } else {
    selectBtn.textContent = isSelected ? '✓ Selected' : 'Select Hero'
    selectBtn.disabled    = isSelected
    selectBtn.dataset.mode = 'select'
  }

  if (!skipScrollSync && scroll && scroll.clientWidth > 0) {
    _heroScrollSkip = true
    scroll.scrollTo({ left: _heroIdx * scroll.clientWidth, behavior: scrollBehavior })
    const ms = scrollBehavior === 'smooth' ? 520 : 60
    setTimeout(() => { _heroScrollSkip = false }, ms)
  }
}

function _syncHeroUpgradeDetail(char, ownedList, xp, isLocked) {
  if (!_selectedUpgradeId) {
    _renderUpgradeDetail(null)
    return
  }
  const def = char.upgrades[_selectedUpgradeId]
  if (!def) {
    _selectedUpgradeId = null
    _renderUpgradeDetail(null)
    return
  }
  const isOwned = ownedList.includes(_selectedUpgradeId)
  const prereqOk = !def.requires || ownedList.includes(def.requires)
  const canAfford = !isOwned && xp >= def.xpCost && !isLocked && prereqOk
  _renderUpgradeDetail(_selectedUpgradeId, def, isOwned, canAfford)
}

function _renderHeroUpgradeSimpleSlot(grid, char, id, def, ownedList, xp, isLocked) {
  const isOwned    = ownedList.includes(id)
  const prereqOk   = !def.requires || ownedList.includes(def.requires)
  const isSelected = id === _selectedUpgradeId

  const btn = document.createElement('button')
  btn.className = 'hero-upgrade-slot'
    + (isOwned    ? ' owned'    : '')
    + (isSelected ? ' selected' : '')
  const iconHTML = def.iconBgSrc && def.iconSrc
    ? `<span class="hero-upgrade-icon-stack">
         <img class="hero-upgrade-icon-bg" src="${def.iconBgSrc}" alt="" draggable="false"/>
         <img class="hero-upgrade-icon-fg" src="${def.iconSrc}" alt="${def.name}" draggable="false"/>
       </span>`
    : def.iconSrc
      ? `<img class="hero-upgrade-icon-img" src="${def.iconSrc}" alt="${def.name}" draggable="false"/>`
      : `<span class="hero-upgrade-icon">${def.icon}</span>`
  btn.innerHTML = `
    ${iconHTML}
    <span class="hero-upgrade-cost">${isOwned ? '✓' : def.xpCost + ' XP'}</span>
  `
  btn.addEventListener('click', () => {
    _selectedUpgradeId = isSelected ? null : id
    const s        = GameController.getSave()
    const charSave = char.id === 'ranger' ? s.ranger : s.warrior
    const locked   = char.id === 'ranger' && !s.ranger.unlocked
    const mainGrid = grid.closest('.hero-select-slide')?.querySelector('.hero-upgrades-grid')
    if (mainGrid) {
      _renderHeroUpgradeGrid(mainGrid, char, charSave.upgrades ?? [], charSave.totalXP ?? 0, locked)
    }
  })
  grid.appendChild(btn)
}

function _renderHeroUpgradeGrid(grid, char, ownedList, xp, isLocked) {
  if (!grid) return
  grid.innerHTML = ''

  const slide = grid.closest('.hero-select-slide')
  const passiveWrap = slide?.querySelector('.hero-passive-wrap')
  const passiveGrid = slide?.querySelector('.hero-passive-upgrades-grid')

  if (char.comingSoon) {
    const msg = document.createElement('p')
    msg.className   = 'passive-coming-soon'
    msg.textContent = 'Abilities & upgrades coming soon…'
    grid.appendChild(msg)
    if (passiveWrap) {
      passiveWrap.hidden = false
      if (passiveGrid) {
        passiveGrid.innerHTML = ''
        const cs = document.createElement('p')
        cs.className   = 'passive-coming-soon'
        cs.textContent = 'Coming Soon…'
        passiveGrid.appendChild(cs)
      }
    }
    return
  }

  for (const [id, def] of Object.entries(char.upgrades)) {
    if (char.id === 'ranger' && id === 'ricochet-arc-mastery') continue

    if (char.id === 'ranger' && id === 'ricochet') {
      const masDef = RANGER_UPGRADES['ricochet-arc-mastery']
      const hasBase = ownedList.includes('ricochet')
      const hasMas = ownedList.includes('ricochet-arc-mastery')
      const comboSelected =
        _selectedUpgradeId === 'ricochet' || _selectedUpgradeId === 'ricochet-arc-mastery'

      const slot = document.createElement('div')
      slot.className = 'hero-upgrade-slot hero-upgrade-slot--ricochet-combo'
        + (hasBase ? ' owned' : '')
        + (comboSelected ? ' selected' : '')

      slot.innerHTML = `
        <div class="hero-upgrade-ricochet-inner">
          <span class="hero-upgrade-icon-stack">
            <img class="hero-upgrade-icon-bg" src="${def.iconBgSrc}" alt="" draggable="false"/>
            <img class="hero-upgrade-icon-fg" src="${def.iconSrc}" alt="${def.name}" draggable="false"/>
          </span>
          <div class="hero-upgrade-ricochet-tiers">
            <button type="button" class="hero-upgrade-tier${hasBase ? ' owned' : ''}${_selectedUpgradeId === 'ricochet' ? ' tier-selected' : ''}"
              data-upgrade-id="ricochet" aria-pressed="${_selectedUpgradeId === 'ricochet' ? 'true' : 'false'}">
              <span class="hero-upgrade-rchk" aria-hidden="true"></span>
              <span class="hero-upgrade-tier-meta">
                <span class="hero-upgrade-tier-label">Ricochet</span>
                <span class="hero-upgrade-tier-xp">${hasBase ? '✓' : `${def.xpCost} XP`}</span>
              </span>
            </button>
            <button type="button" class="hero-upgrade-tier${hasMas ? ' owned' : ''}${_selectedUpgradeId === 'ricochet-arc-mastery' ? ' tier-selected' : ''}${!hasBase ? ' is-locked' : ''}"
              data-upgrade-id="ricochet-arc-mastery" ${!hasBase ? 'disabled' : ''}
              aria-pressed="${_selectedUpgradeId === 'ricochet-arc-mastery' ? 'true' : 'false'}">
              <span class="hero-upgrade-rchk" aria-hidden="true"></span>
              <span class="hero-upgrade-tier-meta">
                <span class="hero-upgrade-tier-label">Mastery</span>
                <span class="hero-upgrade-tier-xp">${hasMas ? '✓' : `${masDef.xpCost} XP`}</span>
              </span>
            </button>
          </div>
        </div>`

      const refresh = () => {
        const s = GameController.getSave()
        const charSave = char.id === 'ranger' ? s.ranger : s.warrior
        const locked = char.id === 'ranger' && !s.ranger.unlocked
        _renderHeroUpgradeGrid(grid, char, charSave.upgrades ?? [], charSave.totalXP ?? 0, locked)
      }

      slot.querySelectorAll('.hero-upgrade-tier').forEach(tierBtn => {
        tierBtn.addEventListener('click', e => {
          e.stopPropagation()
          const uid = tierBtn.dataset.upgradeId
          if (tierBtn.disabled) return
          const isSel = _selectedUpgradeId === uid
          _selectedUpgradeId = isSel ? null : uid
          refresh()
        })
      })

      slot.querySelector('.hero-upgrade-icon-stack')?.addEventListener('click', e => {
        e.stopPropagation()
        const isSel = _selectedUpgradeId === 'ricochet'
        _selectedUpgradeId = isSel ? null : 'ricochet'
        refresh()
      })

      grid.appendChild(slot)
      continue
    }

    _renderHeroUpgradeSimpleSlot(grid, char, id, def, ownedList, xp, isLocked)
  }

  if (passiveWrap) {
    passiveWrap.hidden = false
    if (passiveGrid) {
      passiveGrid.innerHTML = ''
      if (char.id === 'ranger') {
        const trapfinderSlot = document.createElement('div')
        trapfinderSlot.className = 'hero-passive-builtin'
        trapfinderSlot.innerHTML = `
          <span class="hero-passive-builtin-icon">🔍</span>
          <div class="hero-passive-builtin-info">
            <div class="hero-passive-builtin-name">Trapfinder <span class="hero-passive-builtin-badge">✓ Applied</span></div>
            <div class="hero-passive-builtin-desc">10% chance on trap damage, fast-tile reveal hits, or fast enemy ambush to reduce that hit by your Trapfinder stack count (starts at rank 1).</div>
          </div>`
        passiveGrid.appendChild(trapfinderSlot)
      }
      const comingSoon = document.createElement('p')
      comingSoon.className = 'passive-coming-soon'
      comingSoon.textContent = 'Coming Soon…'
      passiveGrid.appendChild(comingSoon)
    }
  }

  if (char.id === CHARACTERS[_heroIdx].id) {
    _syncHeroUpgradeDetail(char, ownedList, xp, isLocked)
  }
}

function _renderUpgradeDetail(id, def, isOwned, canAfford) {
  const backdrop = document.getElementById('hero-upgrade-backdrop')
  const hintEl   = document.getElementById('hero-upgrade-detail-hint')
  if (!id || !def) {
    backdrop.classList.add('hidden')
    hintEl?.classList.add('hidden')
    return
  }
  backdrop.classList.remove('hidden')
  document.getElementById('hero-upgrade-detail-name').textContent = def.name
  document.getElementById('hero-upgrade-detail-desc').textContent = def.desc

  const char     = CHARACTERS[_heroIdx]
  const s        = GameController.getSave()
  const charSave = char.id === 'ranger' ? s.ranger : s.warrior
  const owned    = charSave.upgrades ?? []
  const map      = char.id === 'ranger' ? RANGER_UPGRADES : WARRIOR_UPGRADES
  const missingPrereq = def.requires && !owned.includes(def.requires)
  if (hintEl) {
    if (missingPrereq && !isOwned) {
      hintEl.textContent = `Requires ${map[def.requires]?.name ?? def.requires} (purchase first).`
      hintEl.classList.remove('hidden')
    } else {
      hintEl.classList.add('hidden')
    }
  }

  const buyBtn = document.getElementById('hero-upgrade-buy-btn')
  if (isOwned) {
    buyBtn.textContent = '✓ Owned'
    buyBtn.disabled    = true
    buyBtn.onclick     = null
  } else {
    buyBtn.textContent = `Unlock — ${def.xpCost} XP`
    buyBtn.disabled    = !canAfford
    buyBtn.onclick     = () => {
      const s      = GameController.getSave()
      const char   = CHARACTERS[_heroIdx]
      const bought = char.id === 'ranger'
        ? MetaProgression.buyRangerUpgrade(s, id)
        : MetaProgression.buyUpgrade(s, id)
      if (bought) {
        SaveManager.save(s)
        _selectedUpgradeId = null
        _renderHeroSelect()
      }
    }
  }
}

function _showResumePrompt() {
  const info = GameController.getActiveRunInfo()
  if (!info) return
  const heroName = info.player.isRanger ? 'Ranger' : 'Palladin'
  const floorLabel = info.atRest ? `Floor ${info.floor} — Sanctuary` : `Floor ${info.floor}`
  document.getElementById('resume-hero-name').textContent = heroName
  document.getElementById('resume-floor').textContent    = `🗺 ${floorLabel}`
  document.getElementById('resume-hp').textContent       = `❤️ ${info.player.hp} / ${info.player.maxHp}`
  document.getElementById('resume-gold').textContent     = `🪙 ${info.player.gold}`
  document.getElementById('resume-overlay').classList.remove('hidden')
}

function _updateMenuHeroPreview() {
  const s    = GameController.getSave()
  const char = CHARACTERS.find(c => c.id === (s.selectedCharacter ?? 'warrior')) ?? CHARACTERS[0]
  const xp   = s.selectedCharacter === 'ranger' ? s.ranger.totalXP : s.warrior.totalXP

  const thumb    = document.getElementById('menu-hero-thumb')
  const emojiEl  = document.getElementById('menu-hero-emoji')
  const nameEl   = document.getElementById('menu-hero-name')
  const goldEl   = document.getElementById('menu-gold-val')
  const xpEl     = document.getElementById('menu-xp-val')
  const xpBarEl  = document.getElementById('menu-xp-bar')

  if (char.gif) {
    thumb.src = char.gif
    thumb.classList.remove('hidden')
    if (emojiEl) emojiEl.classList.add('hidden')
  } else {
    thumb.classList.add('hidden')
    if (emojiEl) { emojiEl.textContent = char.emoji; emojiEl.classList.remove('hidden') }
  }
  if (nameEl)   nameEl.textContent  = char.name
  if (goldEl)   goldEl.textContent  = s.persistentGold
  if (xpEl)     xpEl.textContent    = xp
  if (xpBarEl)  xpBarEl.style.width = ((xp % 100) / 100 * 100) + '%'
}

// ── Gold shop panel ───────────────────────────────────────────

function _openPassiveUpgrades() {
  const s = GameController.getSave()
  const overlay = document.getElementById('passive-upgrades-overlay')
  const goldEl  = document.getElementById('passive-upgrades-gold-val')
  const list    = document.getElementById('passive-upgrades-list')
  if (!overlay || !list) return

  goldEl.textContent = s.persistentGold
  list.innerHTML = ''

  for (const id of GLOBAL_PASSIVE_IDS) {
    const def = GLOBAL_PASSIVE_UPGRADES[id]
    if (!def) continue
    const owned   = (s.globalPassives ?? []).includes(id)
    const canAfford = !owned && s.persistentGold >= def.goldCost

    const item = document.createElement('div')
    item.className = `panel-card${owned ? ' owned' : ''}`
    item.innerHTML = `
      <span class="panel-card-icon">${def.icon}</span>
      <div class="panel-card-info">
        <div class="panel-card-name">${def.name}</div>
        <div class="panel-card-desc">${def.desc}</div>
      </div>
      <div class="panel-card-action">
        <button class="panel-btn buy gold" ${owned || !canAfford ? 'disabled' : ''}>
          ${owned ? '✓ Owned' : `💰 ${def.goldCost}`}
        </button>
      </div>`

    if (!owned && canAfford) {
      item.querySelector('.panel-btn').addEventListener('click', () => {
        MetaProgression.buyGlobalPassive(s, id)
        SaveManager.save(s)
        _openPassiveUpgrades()
      })
    }
    list.appendChild(item)
  }

  overlay.classList.remove('hidden')
}

function _openShop() {
  const s = GameController.getSave()
  UI.showGoldShop(
    s,
    SHOP_ITEMS,
    (id) => { MetaProgression.buyShopItem(s, id); SaveManager.save(s); _openShop() },
    (id) => { MetaProgression.removeShopItem(s, id); SaveManager.save(s); _openShop() },
  )
}

// ── Backpack panel ───────────────────────────────────────────

let _pendingPickupId = null  // item waiting to replace a backpack slot

function _renderBackpack() {
  const replaceMode = _pendingPickupId !== null
  UI.renderBackpack(
    GameController.getInventory(),
    ITEMS,
    // onUse / onTap — disabled in replace mode
    (id) => {
      if (replaceMode) {
        // Tapping a slot replaces it with the pending item
        _doReplace(id)
        return
      }
      GameController.useItem(id)
      const et = ITEMS[id]?.effect?.type
      if (et === 'lantern' || et === 'spyglass' || et === 'hourglass-sand') {
        _setBackpackOpen(false)
      } else {
        _renderBackpack()
      }
    },
    // onHold — disabled in replace mode
    (id) => {
      if (replaceMode) return
      const item = ITEMS[id]
      if (!item) return
      UI.showInfoCard(
        { ...item },
        {
          onDrop: () => {
            GameController.dropItem(id)
            UI.hideInfoCard()
            _renderBackpack()
          },
        },
      )
    },
    replaceMode,
  )
  UI.renderBackpackLevelUpLog(GameController.getLevelUpLog())
}

function _openBackpackFull(newItemId) {
  _pendingPickupId = newItemId
  const item = ITEMS[newItemId]

  // Populate pending bar
  const bar  = document.getElementById('backpack-pending-bar')
  const art  = document.getElementById('backpack-pending-art')
  const name = document.getElementById('backpack-pending-name')
  if (bar && art && name) {
    art.innerHTML = item?.spriteSrc
      ? `<img src="${item.spriteSrc}" alt="${item.name ?? ''}">`
      : `<span>${item?.icon ?? '?'}</span>`
    name.textContent = item?.name ?? newItemId
    bar.classList.remove('hidden')
  }

  // Wire trash button (replace any old listener by cloning)
  const trashBtn = document.getElementById('backpack-pending-trash')
  if (trashBtn) {
    const fresh = trashBtn.cloneNode(true)
    trashBtn.replaceWith(fresh)
    fresh.addEventListener('click', () => _clearPendingPickup())
  }

  _renderBackpack()
  _setBackpackOpen(true)
  UI.setMessage(`Backpack full! Tap a slot to replace it, or trash the new item.`, true)
}

function _clearPendingPickup() {
  _pendingPickupId = null
  const bar = document.getElementById('backpack-pending-bar')
  bar?.classList.add('hidden')
  _renderBackpack()
}

async function _doReplace(oldId) {
  const newId = _pendingPickupId
  if (!newId) return
  _clearPendingPickup()
  await GameController.forceReplaceItem(oldId, newId)
  _renderBackpack()
}

function _setBackpackOpen(open) {
  const el = document.getElementById('backpack-overlay')
  const btn = document.getElementById('hud-backpack-btn')
  if (!el) return
  el.classList.toggle('is-open', open)
  el.setAttribute('aria-hidden', open ? 'false' : 'true')
  btn?.setAttribute('aria-expanded', open ? 'true' : 'false')
  // If closing while replace mode active, treat as trash
  if (!open && _pendingPickupId) _clearPendingPickup()
}

function _toggleBackpack() {
  const el = document.getElementById('backpack-overlay')
  if (!el) return
  if (!el.classList.contains('is-open')) {
    _renderBackpack()
    _setBackpackOpen(true)
  } else {
    _setBackpackOpen(false)
  }
}

// ── Ability button hold-to-inspect ───────────────────────────
// onTap fires on a normal click; onHold fires after 380ms hold.

function _wireAbilityHold(btn, onTap, onHold) {
  let _timer   = null
  let _didHold = false
  let _startX  = 0
  let _startY  = 0

  btn.addEventListener('pointerdown', e => {
    _didHold = false
    _startX  = e.clientX
    _startY  = e.clientY
    _timer = setTimeout(() => {
      _didHold = true
      onHold()
    }, 380)
  })

  btn.addEventListener('pointermove', e => {
    if (!_timer) return
    const dx = e.clientX - _startX
    const dy = e.clientY - _startY
    if (Math.hypot(dx, dy) > 8) { clearTimeout(_timer); _timer = null }
  })

  const _cancel = () => { clearTimeout(_timer); _timer = null }
  btn.addEventListener('pointerup',     _cancel)
  btn.addEventListener('pointercancel', _cancel)
  btn.addEventListener('contextmenu', e => e.preventDefault())

  btn.addEventListener('click', () => { if (!_didHold) onTap() })
}

// ── PWA install nudge ─────────────────────────────────────────

let _deferredInstallPrompt = null

function _wireInstallNudge() {
  const nudge      = document.getElementById('install-nudge')
  const installBtn = document.getElementById('install-btn')

  // Already installed as standalone — hide nudge entirely
  if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) return

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream

  if (isIOS) {
    // iOS Safari never fires beforeinstallprompt — show manual instructions
    if (nudge) nudge.classList.remove('hidden')
    if (installBtn) {
      installBtn.textContent = '📲 Add to Home Screen'
      installBtn.addEventListener('click', () => {
        document.getElementById('ios-install-tip').classList.toggle('hidden')
      })
    }
    return
  }

  // Android Chrome / desktop — use the native prompt
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault()
    _deferredInstallPrompt = e
    if (nudge) nudge.classList.remove('hidden')
  })

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!_deferredInstallPrompt) return
      _deferredInstallPrompt.prompt()
      const { outcome } = await _deferredInstallPrompt.userChoice
      Logger.debug(`[main] PWA install: ${outcome}`)
      _deferredInstallPrompt = null
      if (nudge) nudge.classList.add('hidden')
    })
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot)
} else {
  boot()
}

// ── Hero carousel ────────────────────────────────────────────
;(function _initHeroCarousel() {
  const heroes = Array.from(document.querySelectorAll('.carousel-hero'))
  if (heroes.length < 2) return
  let current = 0
  const DISPLAY_MS = 5000   // how long each hero is shown
  const next = () => {
    heroes[current].classList.remove('active')
    current = (current + 1) % heroes.length
    heroes[current].classList.add('active')
  }
  setInterval(next, DISPLAY_MS)
})()

// ── Service worker registration ───────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => Logger.debug('[SW] registered', reg.scope))
      .catch(err => Logger.error('[SW] registration failed', err))
  })
}
