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
import { ENGINEER_UPGRADES }                from './data/engineer.js'
import { MAGE_UPGRADES }                    from './data/mage.js'
import { NECROMANCER_UPGRADES }             from './data/necromancer.js'
import { VAMPIRE_UPGRADES }                 from './data/vampire.js'
import { GLOBAL_PASSIVE_UPGRADES, GLOBAL_PASSIVE_IDS } from './data/passives.js'
import { CHANGELOG } from './data/changelog.js'

function _changelogTagClass(tag) {
  const map = {
    New: 'new',
    Hero: 'hero',
    Mage: 'mage',
    Balance: 'balance',
    Progress: 'progress',
    Combat: 'combat',
    World: 'world',
    Meta: 'meta',
    UI: 'ui',
    Systems: 'systems',
    Audio: 'audio',
  }
  return map[tag] ?? 'misc'
}

function _renderChangelogEntries() {
  const root = document.getElementById('changelog-entries')
  if (!root || root.dataset.rendered === '1') return
  root.dataset.rendered = '1'
  const articles = CHANGELOG.map(entry => {
    const ver = entry.version
      ? `<span class="update-card__ver">${entry.version}</span>`
      : ''
    const dt = entry.dateIso ? ` datetime="${entry.dateIso}"` : ''
    const items = entry.items.map(it => `
          <li class="update-list__item">
            <span class="update-tag update-tag--${_changelogTagClass(it.tag)}">${it.tag}</span>
            <span class="update-list__text">${it.text}</span>
          </li>`).join('')
    return `
    <article class="update-card">
      <div class="update-card__meta">
        <time class="update-card__date"${dt}>${entry.dateLabel}</time>
        ${ver}
      </div>
      <h2 class="update-card__title">${entry.title}</h2>
      <p class="update-card__summary">${entry.summary}</p>
      <ul class="update-list">${items}</ul>
    </article>`
  }).join('')
  root.innerHTML = articles
    + '<p class="updates-footnote">Earlier builds may not appear here — this is a highlights reel, not a full change log.</p>'
}

function _metaCharSave(save, charId) {
  return save[charId] ?? save.warrior
}

/** Gold-locked roster hero (not Paladin, not Coming Soon) — must appear in save.unlockedHeroes. */
function _heroIsGoldLocked(save, char) {
  if (!save || !char || char.comingSoon) return false
  if (char.id === 'warrior') return false
  if (char.unlockCost == null) return false
  return !MetaProgression.isHeroUnlocked(save, char.id)
}

// ── Character roster ──────────────────────────────────────────

const CHARACTERS = [
  {
    id:         'warrior',
    name:       'Paladin',
    tagline:    'Battle-hardened holy warrior—slow footwork, heavy blows. Kill Echo (see Hero Passives) chains enemy echo hints from the entrance and from each marked kill.',
    gif:        'assets/sprites/Heroes/Warrior/warrior-idle.gif',
    attackGif:  'assets/sprites/Heroes/Warrior/warrior-strike.gif',
    attackMs:   2000,
    emoji:      null,
    upgrades:   WARRIOR_UPGRADES,
    unlockCost: null,
    baseHP:     50,
    baseMana:   30,
    baseDmg:    '1',
    complexity: 'Easy',
  },
  {
    id:         'ranger',
    name:       'Ranger',
    tagline:    'Swift bowman who strikes from range. Keen Eyes (see Hero Passives) often senses hidden tiles next to each reveal; Trapfinder softens traps and ambushes.',
    gif:        'assets/sprites/Heroes/Ranger/__Idle.gif',
    attackGif:  'assets/sprites/Heroes/Ranger/__Attack.gif',
    attackMs:   4000,
    emoji:      null,
    upgrades:   RANGER_UPGRADES,
    unlockCost: CONFIG.rangerUnlockCost,
    baseHP:     40,
    baseMana:   35,
    baseDmg:    '1',
    complexity: 'Easy',
  },
  {
    id:          'mage',
    name:        'Mage',
    tagline:     'A master of the arcane arts who turns the dungeon into a laboratory. Phase Walk lets him reach tiles diagonally — moving like a queen, not a rook.',
    gif:         'assets/sprites/Heroes/Mage/blue-mage-hero-small.gif',
    attackGif:   'assets/sprites/Heroes/Mage/blue-mage-hero-attack-small-speed.gif',
    attackMs:    2000,
    emoji:       '🧙‍♂️',
    upgrades:    MAGE_UPGRADES,
    unlockCost:  CONFIG.mageUnlockCost,
    baseHP:      30,
    baseMana:    60,
    baseDmg:     '1',
    complexity:  'Easy',
  },
  {
    id:          'vampire',
    name:        'Vampire',
    tagline:     'Corrupted Blood takes 1 HP per flip but pays back +1 per monster in sight; Dark Eyes glimpses distant foes. She never suffers ambush strikes.',
    gif:         'assets/sprites/Heroes/Vampire/vampire-hero-idle.png',
    attackGif:   null,
    attackMs:    0,
    emoji:       '🧛',
    upgrades:    VAMPIRE_UPGRADES,
    unlockCost:  CONFIG.vampireUnlockCost,
    baseHP:      45,
    baseMana:    25,
    baseDmg:     '2',
    comingSoon:  false,
    complexity:  'Medium',
  },
  {
    id:          'engineer',
    name:        'Engineer',
    tagline:     'A cunning inventor who turns the dungeon itself into a weapon. Deploy a turret to fight alongside you — but protect it: if it\'s destroyed, the feedback blast deals 5 damage to you.',
    gif:         'assets/sprites/Heroes/Engineer/engineer-hero-idle.gif',
    attackGif:   'assets/sprites/Heroes/Engineer/engineer-hero-strike.gif',
    attackMs:    600,
    emoji:       '⚙️',
    upgrades:    ENGINEER_UPGRADES,
    unlockCost:  CONFIG.engineerUnlockCost,
    baseHP:      40,
    baseMana:    30,
    baseDmg:     '1',
    comingSoon:  false,
    complexity:  'Hard',
  },
  {
    id:          'necromancer',
    name:        'Necromancer',
    tagline:     'A dark scholar who commands the dead. Raise Minion turns fallen foes into 🧟 servants; Master\'s Sight lets him see through their dead eyes to reveal the tiles around them.',
    gif:         'assets/sprites/Heroes/Necromancer/necromancer-hero-idle.gif',
    attackGif:   'assets/sprites/Heroes/Necromancer/necromancer-hero-strike.gif',
    attackMs:    600,
    emoji:       '💀',
    upgrades:    NECROMANCER_UPGRADES,
    unlockCost:  CONFIG.necromancerUnlockCost,
    baseHP:      35,
    baseMana:    55,
    baseDmg:     '1',
    complexity:  'Hard',
  },
  {
    id:          'druid',
    name:        'Druid',
    tagline:     'A shapeshifter attuned to nature\'s fury. Harnesses the wilds to heal, curse enemies, and strike with elemental power.',
    gif:         null,
    attackGif:   null,
    attackMs:    0,
    emoji:       '🌿',
    upgrades:    {},
    unlockCost:  null,
    baseHP:      45,
    baseMana:    45,
    baseDmg:     '1',
    comingSoon:  true,
    complexity:  'Hard',
  },
  {
    id:          'drone',
    name:        'Drone',
    tagline:     'A rogue automaton running on ancient schematics. Cold, calculating, and utterly relentless — it does not bleed.',
    gif:         null,
    attackGif:   null,
    attackMs:    0,
    emoji:       '🤖',
    upgrades:    {},
    unlockCost:  null,
    baseHP:      55,
    baseMana:    20,
    baseDmg:     '2',
    comingSoon:  true,
    complexity:  'TBD',
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
  if (save.settings.subLevelsEnabled === undefined) save.settings.subLevelsEnabled = true
  if (save.settings.warBannerIntroSeen === undefined) save.settings.warBannerIntroSeen = false
  if (!save.settings.cheats) save.settings.cheats = {}
  if (!save.globalPassives) save.globalPassives = []
  {
    const _validPassive = new Set(GLOBAL_PASSIVE_IDS)
    const _gp = save.globalPassives.filter((id) => _validPassive.has(id))
    if (_gp.length !== save.globalPassives.length) {
      save.globalPassives = _gp
      await SaveManager.save(save)
    }
  }
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
  if (!save.engineer) {
    save.engineer = { totalXP: 0, upgrades: [] }
    await SaveManager.save(save)
  }
  if (!save.mage) {
    save.mage = { totalXP: 0, upgrades: [] }
    await SaveManager.save(save)
  }
  if (!save.vampire) {
    save.vampire = { totalXP: 0, upgrades: [] }
    await SaveManager.save(save)
  }
  if (!save.necromancer) {
    save.necromancer = { totalXP: 0, upgrades: [] }
    await SaveManager.save(save)
  }
  if (!save.selectedCharacter) {
    save.selectedCharacter = 'warrior'
  }

  MetaProgression.normalizeUnlockedHeroes(save)
  {
    const selId = save.selectedCharacter ?? 'warrior'
    const selCh = CHARACTERS.find(c => c.id === selId)
    if (selCh && (selCh.comingSoon || (selCh.unlockCost != null && !MetaProgression.isHeroUnlocked(save, selId)))) {
      save.selectedCharacter = 'warrior'
      await SaveManager.save(save)
    }
  }

  const urlParams = new URLSearchParams(typeof location !== 'undefined' ? location.search : '')
  const hasTestBotOngoing = urlParams.has('testBotOngoing')
  const hasBalanceBot = urlParams.has('balanceBot') && !hasTestBotOngoing
  const balanceBotPreset =
    urlParams.get('balanceBotPreset') ||
    (urlParams.has('balanceBotBeginner') ? 'beginner' : null) ||
    (urlParams.has('balanceBotEnd') ? 'end' : null) ||
    (hasBalanceBot ? 'beginner' : null)  // default: fresh save, no meta-progression unlocks

  if (hasBalanceBot && (balanceBotPreset === 'beginner' || balanceBotPreset === 'end')) {
    const { applyBalanceBotSavePreset } = await import('./dev/balanceBotSavePresets.js')
    const balanceBotHero = urlParams.get('balanceBotHero') || 'warrior'
    applyBalanceBotSavePreset(save, balanceBotPreset, balanceBotHero)
    await SaveManager.save(save)
  }

  GameController.init(save)
  UI.refreshSkipFloorButton(save)

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
      const ch = s.selectedCharacter ?? 'warrior'
      if (ch === 'engineer') {
        if (!(s.engineer?.upgrades ?? []).includes('mana-generator')) return
        const def = ENGINEER_UPGRADES['mana-generator']
        const stacks = GameController.getActiveRunInfo?.()?.player?.manaGeneratorMasteryStacks ?? 0
        UI.showInfoCard({
          spriteSrc: '',
          name:   def.name,
          type:   'Engineer Ability',
          blurb:  'Toggle your turret into Mana Generator mode. While active the turret stops firing and grants mana on every tile flip.',
          details: [
            { icon: '🔋', label: 'Base Yield',    desc: '+1 mana per flip' },
            { icon: '🎲', label: 'Mastery I',      desc: '25% chance for +2 mana per flip' },
            { icon: '🎲', label: 'Mastery II',     desc: '25% chance for +3 mana per flip' },
            { icon: '📊', label: 'Current Stacks', desc: `${stacks} mastery stack${stacks !== 1 ? 's' : ''}` },
          ],
        })
        return
      }
      if (ch === 'mage') {
        if (!(s.mage?.upgrades ?? []).includes('chain-lightning')) return
        const def = MAGE_UPGRADES['chain-lightning']
        const br  = GameController.getChainLightningBreakdown?.()
        const dmgDesc = br
          ? `Each zap: ${br.perZap} damage (avg melee ${Number.isInteger(br.avgMelee) ? br.avgMelee : br.avgMelee.toFixed(1)}${br.stacks > 0 ? `, +${Math.round((br.mult - 1) * 100)}% mastery` : ''}).`
          : 'Each zap deals equal damage — scales with your HUD attack.'
        UI.showInfoCard({
          spriteSrc: '',
          name:   def.name,
          type:   'Mage Ability',
          blurb:  'Tap a revealed enemy — a lightning bolt strikes, then arcs to up to 2 more random revealed enemies. Each zap deals equal damage. Spell-immune enemies and bosses can still be immune.',
          details: [
            { icon: '🔵', label: 'Mana Cost', desc: `${def.manaCost} mana when you fire` },
            { icon: '🎯', label: 'Targeting', desc: 'Tap a revealed living enemy — jumps pick randomly from the remaining revealed enemies.' },
            { icon: '⚡', label: 'Damage',   desc: dmgDesc },
          ],
        })
        return
      }
      if (ch === 'vampire') {
        if (!(s.vampire?.upgrades ?? []).includes('blood-tithe')) return
        const def = VAMPIRE_UPGRADES['blood-tithe']
        const br  = GameController.getBloodTitheBreakdown?.()
        const hpCost  = br?.hpCost  ?? def.hpCost
        const manaGain = br?.manaGain ?? def.manaGain
        const tier    = br?.tier ?? 1
        const tierDesc = tier >= 3 ? 'III (7 HP → 11 mana)' : tier >= 2 ? 'II (8 HP → 10 mana)' : 'I (10 HP → 10 mana)'
        UI.showInfoCard({
          spriteSrc: '',
          name:   def.name,
          type:   'Vampire Ability',
          blurb:  'Sacrifice blood for power. Spend HP to instantly restore mana — a dangerous but vital tool when you need one more ability cast.',
          details: [
            { icon: '🩸', label: 'HP Cost',    desc: `${hpCost} HP per use` },
            { icon: '🔵', label: 'Mana Gain',  desc: `+${manaGain} mana` },
            { icon: '💀', label: 'Limit',       desc: 'Cannot be used if it would reduce HP to 0 or below' },
            { icon: '📈', label: 'Mastery',     desc: `Current tier: ${tierDesc}` },
          ],
        })
        return
      }
      if (ch === 'ranger') {
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
          type:   'Paladin Ability',
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
      const ch = s.selectedCharacter ?? 'warrior'
      if (ch === 'ranger') GameController.poisonArrowShotAction()
      else if (ch === 'engineer') GameController.teslaTowerAction()
      else if (ch === 'mage') GameController.telekineticThrowAction()
      else if (ch === 'necromancer') GameController.corpseExplosionAction()
      else if (ch === 'vampire') GameController.mistFormAction()
      else GameController.blindingLightAction()
    },
    () => {
      const s = GameController.getSave()
      const ch = s.selectedCharacter ?? 'warrior'
      if (ch === 'mage') {
        if (!(s.mage?.upgrades ?? []).includes('telekinetic-throw')) return
        const def = MAGE_UPGRADES['telekinetic-throw']
        const br  = GameController.getTelekineticThrowBreakdown?.()
        const dmgDesc = br
          ? `Slam damage: ${br.damage} (avg melee × 3${br.stacks > 0 ? `, +${Math.round((br.mult - 1) * 100)}% mastery` : ''}).`
          : 'Slam damage = max(1, round(avg melee × 3)).'
        UI.showInfoCard({
          spriteSrc: '',
          name:   def.name,
          type:   'Mage Ability',
          blurb:  'Tap a revealed enemy to grab them, then tap a revealed empty tile to slam them down. Locks reset: tiles around the old position unlock, tiles around the new landing re-lock. Bosses and spell-immune enemies are immune.',
          details: [
            { icon: '🔵', label: 'Mana Cost', desc: `${def.manaCost} mana when you slam` },
            { icon: '🎯', label: 'Targeting', desc: 'Step 1: tap enemy. Step 2: tap a revealed empty tile (no loot, chest, stairs, turret, sub-floor entry).' },
            { icon: '🌀', label: 'Damage',   desc: dmgDesc },
          ],
        })
        return
      }
      if (ch === 'engineer') {
        if (!(s.engineer?.upgrades ?? []).includes('tesla-tower')) return
        const def = ENGINEER_UPGRADES['tesla-tower']
        UI.showInfoCard({
          spriteSrc: '',
          name:   def.name,
          type:   'Engineer Ability',
          blurb:  def.desc,
          details: [
            { icon: '⚡', label: 'Toggle',     desc: 'Tap to enable/disable — disables Mana Generator when activated' },
            { icon: '📐', label: 'Perimeter',  desc: 'Radius grows with turret level (level 1 = 1, level 2 = 2, level 3 = 3)' },
          ],
        })
        return
      }
      if (ch === 'vampire') {
        if (!(s.vampire?.upgrades ?? []).includes('mist-form')) return
        const def = VAMPIRE_UPGRADES['mist-form']
        UI.showInfoCard({
          spriteSrc: '',
          name:   def.name,
          type:   'Vampire Ability',
          blurb:  'Dissolve into crimson mist. For your next 5 tile flips, Corrupted Blood is fully suspended — you take no HP drain and non-enemy tiles grant no blood back. Pure protection.',
          details: [
            { icon: '🔵', label: 'Mana Cost',    desc: `${def.manaCost} mana per use` },
            { icon: '🌫️', label: 'Duration',     desc: '5 tile flips' },
            { icon: '🛡️', label: 'Protection',   desc: 'No HP drain per flip while active' },
            { icon: '⚠️', label: 'Restriction',  desc: 'Non-enemy tiles yield no blood either — pure survival tool' },
          ],
        })
        return
      }
      if (ch === 'ranger') {
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
        : 'Start a paladin run to see stun turns (scales with HUD attack + Blinding Mastery).'
      UI.showInfoCard({
        spriteSrc: WARRIOR_UPGRADES['blinding-light'].iconSrc,
        name:   'Blinding Light',
        type:   'Paladin Ability',
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
      const ch3 = s.selectedCharacter ?? 'warrior'
      if (ch3 === 'ranger') GameController.arrowBarrageAction()
      else if (ch3 === 'mage') GameController.manaShieldAction()
      else if (ch3 === 'vampire') GameController.bloodPactAction()
      else GameController.divineLightAction()
    },
    () => {
      const s = GameController.getSave()
      const ch4 = s.selectedCharacter ?? 'warrior'
      if (ch4 === 'mage') {
        if (!(s.mage?.upgrades ?? []).includes('mana-shield')) return
        const def = MAGE_UPGRADES['mana-shield']
        const stacks = GameController.getManaShieldStacks?.() ?? 0
        const absorptionPct = ['30%', '45%', '60%'][Math.min(stacks, 2)]
        const drainPct      = ['100%', '85%', '70%'][Math.min(stacks, 2)]
        UI.showInfoCard({
          spriteSrc: '',
          name:   def.name,
          type:   'Mage Ability',
          blurb:  'A barrier of solidified mana intercepts incoming blows, draining your mana pool before your HP takes damage. Costs mana to switch on; auto-collapses when mana runs dry.',
          details: [
            { icon: '🔵', label: 'Activation',  desc: `${def.manaCost} mana to toggle on` },
            { icon: '🛡️', label: 'Absorption',  desc: `${absorptionPct} of each hit absorbed (min 1), drained from mana at ${drainPct} efficiency` },
            { icon: '⚡', label: 'Collapse',     desc: 'Auto-deactivates when mana hits 0; costs 5 mana again to re-enable' },
            { icon: '📈', label: 'Masteries',   desc: stacks > 0 ? `Mana Shield ${stacks + 1} active (${absorptionPct} absorption, ${drainPct} drain)` : 'Pick Mana Shield 2 & 3 at level-up to improve absorption and drain efficiency' },
          ],
        })
        return
      }
      if (ch4 === 'vampire') {
        if (!(s.vampire?.upgrades ?? []).includes('blood-pact')) return
        const def = VAMPIRE_UPGRADES['blood-pact']
        const br  = GameController.getBloodPactBreakdown?.()
        const eqDesc = br?.count > 0
          ? `${br.count} enem${br.count !== 1 ? 'ies' : 'y'} would be equalized to ${br.avgHp} HP (based on current board).`
          : 'Equalization preview available during a run with revealed enemies.'
        UI.showInfoCard({
          spriteSrc: '',
          name:   def.name,
          type:   'Vampire Ability',
          blurb:  'Add 1 HP to each revealed non-boss enemy, then set all of them to the group average (rounded). Weaklings sustain your drain longer; behemoths are cut down to size.',
          details: [
            { icon: '🔵', label: 'Mana Cost',  desc: `${def.manaCost} mana per use` },
            { icon: '⚖️', label: 'Equalize',   desc: 'All revealed non-boss enemies → rounded average HP' },
            { icon: '➕', label: '+1 First',    desc: 'Each enemy gains 1 HP before averaging (ensures no instant kills)' },
            { icon: '🔮', label: 'Preview',     desc: eqDesc },
          ],
        })
        return
      }
      if (ch4 !== 'ranger') {
        // Warrior: Divine Light info card
        if (!(s.warrior?.upgrades ?? []).includes('divine-light')) return
        const dl = GameController.getDivineLightBreakdown()
        UI.showInfoCard({
          spriteSrc:   WARRIOR_UPGRADES['divine-light'].iconSrc,
          spriteSrcBg: WARRIOR_UPGRADES['divine-light'].iconBgSrc,
          name:   'Divine Light',
          type:   'Paladin Ability',
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
  _wireAbilityHold(
    document.getElementById('hud-btn-slot-d'),
    () => {
      const s = GameController.getSave()
      const ch5 = s.selectedCharacter ?? 'warrior'
      if (ch5 === 'mage') GameController.lifeTapAction()
    },
    () => {
      const s = GameController.getSave()
      if ((s.selectedCharacter ?? 'warrior') !== 'mage') return
      if (!(s.mage?.upgrades ?? []).includes('life-tap')) return
      const def = MAGE_UPGRADES['life-tap']
      const stacks = GameController.getLifeTapStacks?.() ?? 0
      const hpCost = stacks >= 1 ? 2 : 1
      const mpGain = [1, 3, 4][Math.min(stacks, 2)]
      UI.showInfoCard({
        spriteSrc: '',
        name:   def.name,
        type:   'Mage Ability',
        blurb:  'Convert vitality into arcane energy. Each tile flip drains HP and replenishes mana. Mana Shield does not protect against this drain. Auto-deactivates when mana is full or HP is too low.',
        details: [
          { icon: '🆓', label: 'Activation',  desc: 'Free to toggle on and off' },
          { icon: '🔴', label: 'Per Flip',    desc: `−${hpCost} HP, +${mpGain} MP` },
          { icon: '⚡', label: 'Auto-off',     desc: 'Deactivates when mana hits max or HP ≤ drain cost' },
          { icon: '📈', label: 'Masteries',   desc: stacks > 0 ? `Life Tap ${stacks + 1} active (${hpCost} HP → ${mpGain} MP)` : 'Pick Life Tap 2 & 3 at level-up to improve HP-to-MP conversion rate' },
        ],
      })
    }
  )
  document.getElementById('hud-settings-btn').addEventListener('click', () => {
    const s = GameController.getSave()
    const c = s.settings.cheats ?? {}
    document.getElementById('setting-music').checked        = s.settings.musicOn    ?? true
    document.getElementById('setting-sfx').checked          = s.settings.sfxOn      ?? true
    document.getElementById('setting-tile-colors').checked  = s.settings.tileColors ?? false
    document.getElementById('setting-haptic').checked       = s.settings.hapticFeedback ?? true
    document.getElementById('setting-sub-levels').checked   = s.settings.subLevelsEnabled ?? true
    document.getElementById('setting-auto-potions').checked = s.settings.autoPotions ?? false
    document.getElementById('cheat-god-mode').checked       = c.godMode      ?? false
    document.getElementById('cheat-instant-kill').checked   = c.instantKill  ?? false
    document.getElementById('cheat-999-gold').checked       = c.gold999      ?? false
    document.getElementById('cheat-999-xp').checked         = c.xp999        ?? false
    document.getElementById('cheat-skip-floor-btn').checked = c.skipFloorButton ?? false
    document.getElementById('cheat-increase-stats').checked = c.increaseStats ?? false
    document.getElementById('settings-overlay').classList.remove('hidden')
  })

  document.getElementById('retreat-btn').addEventListener('click', () => {
    document.getElementById('retreat-confirm').classList.remove('hidden')
  })
  document.getElementById('retreat-confirm-yes').addEventListener('click', () => {
    document.getElementById('retreat-confirm').classList.add('hidden')
    const reason = window.__balanceBotRetreatReason || 'player'
    window.__balanceBotRetreatReason = undefined
    GameController.doRetreat(reason)
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
      if (MetaProgression.unlockHero(s, char.id)) {
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
        : _metaCharSave(s, char.id)
      const grid     = _heroSlideGrid(_heroIdx)
      _renderHeroUpgradeGrid(grid, char, charSave.upgrades ?? [], charSave.totalXP ?? 0, !char.comingSoon && _heroIsGoldLocked(s, char))
    }
  })


  document.getElementById('settings-btn').addEventListener('click', () => {
    const s = GameController.getSave()
    const c = s.settings.cheats ?? {}
    document.getElementById('setting-music').checked        = s.settings.musicOn    ?? true
    document.getElementById('setting-sfx').checked          = s.settings.sfxOn      ?? true
    document.getElementById('setting-tile-colors').checked  = s.settings.tileColors ?? false
    document.getElementById('setting-haptic').checked       = s.settings.hapticFeedback ?? true
    document.getElementById('setting-sub-levels').checked   = s.settings.subLevelsEnabled ?? true
    document.getElementById('setting-auto-potions').checked = s.settings.autoPotions ?? false
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
    if (e.target.checked && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate(22) } catch (_) { /* Firefox / privacy mode may block */ }
    }
  })

  document.getElementById('setting-sub-levels').addEventListener('change', e => {
    const s = GameController.getSave()
    s.settings.subLevelsEnabled = e.target.checked
    SaveManager.save(s)
  })

  document.getElementById('setting-auto-potions').addEventListener('change', e => {
    const s = GameController.getSave()
    s.settings.autoPotions = e.target.checked
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

  // Debug accordion toggle
  document.getElementById('debug-accordion-toggle').addEventListener('click', () => {
    document.getElementById('debug-accordion').classList.toggle('open')
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

  document.getElementById('latest-updates-btn')?.addEventListener('click', () => {
    _renderChangelogEntries()
    const ov = document.getElementById('latest-updates-overlay')
    ov?.classList.remove('hidden')
    ov?.setAttribute('aria-hidden', 'false')
  })
  document.getElementById('latest-updates-back')?.addEventListener('click', () => {
    const ov = document.getElementById('latest-updates-overlay')
    ov?.classList.add('hidden')
    ov?.setAttribute('aria-hidden', 'true')
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
      MetaProgression.normalizeUnlockedHeroes(imported)
      const impSel = imported.selectedCharacter ?? 'warrior'
      const impCh  = CHARACTERS.find(c => c.id === impSel)
      if (impCh && (impCh.comingSoon || (impCh.unlockCost != null && !MetaProgression.isHeroUnlocked(imported, impSel)))) {
        imported.selectedCharacter = 'warrior'
      }
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
    if (hasBalanceBot || hasTestBotOngoing) {
      GameController.abandonRun()
      UI.showMainMenu()
    } else {
      GameController.resumeRun()
    }
  } else {
    UI.showMainMenu()
  }

  if (hasTestBotOngoing) {
    const policy = urlParams.get('policy') || 'abilities'
    let levelUpWeights = null
    const lw = urlParams.get('levelUpWeights')
    if (lw) {
      try {
        levelUpWeights = JSON.parse(decodeURIComponent(lw))
      } catch (_) {
        levelUpWeights = null
      }
    }
    let abilityWeights = null
    const aw = urlParams.get('abilityWeights')
    if (aw) {
      try {
        abilityWeights = JSON.parse(decodeURIComponent(aw))
      } catch (_) {
        abilityWeights = null
      }
    }
    const runsQ = urlParams.get('runs')
    const runsParsed = runsQ != null && runsQ !== '' ? parseInt(runsQ, 10) : NaN
    const runs = Number.isFinite(runsParsed) ? runsParsed : undefined
    import('./dev/testBotOngoing.js').then(m => {
      m.startTestBotOngoing({
        policy,
        runs,
        levelUpWeights: levelUpWeights ?? undefined,
        abilityWeights: abilityWeights ?? undefined,
      })
    })
  } else if (hasBalanceBot) {
    const policy = urlParams.get('policy') || 'random'
    let levelUpWeights = null
    const lw = urlParams.get('levelUpWeights')
    if (lw) {
      try {
        levelUpWeights = JSON.parse(decodeURIComponent(lw))
      } catch (_) {
        levelUpWeights = null
      }
    }
    if (balanceBotPreset === 'end' && levelUpWeights == null) {
      levelUpWeights = { vitality: 1000 }
    }
    let abilityWeights = null
    const aw = urlParams.get('abilityWeights')
    if (aw) {
      try {
        abilityWeights = JSON.parse(decodeURIComponent(aw))
      } catch (_) {
        abilityWeights = null
      }
    }
    import('./dev/balanceBotAutopilot.js').then(m => {
      m.startBalanceBotAutopilot({
        runs: parseInt(urlParams.get('runs') ?? '10', 10) || 1,
        policy,
        preset: balanceBotPreset ?? undefined,
        levelUpWeights: levelUpWeights ?? undefined,
        abilityWeights: abilityWeights ?? undefined,
      })
    })
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
  const structureOk = first?.querySelector('.hero-doorway')
  if (scroll.children.length === CHARACTERS.length && structureOk) return
  scroll.innerHTML = ''
  CHARACTERS.forEach((char, i) => {
    const slide = document.createElement('section')
    slide.className = 'hero-select-slide'
    slide.dataset.heroIndex = String(i)
    slide.dataset.hero      = char.id
    slide.innerHTML = `
      <div class="hero-doorway">
        <div class="altar-ring" aria-hidden="true"></div>
        <div class="altar-ring inner" aria-hidden="true"></div>
        <div class="altar-hero-glow" aria-hidden="true"></div>
        <div class="hero-particles" aria-hidden="true"></div>
        <div class="hero-upgrades-col left" data-col="left"></div>
        <div class="hero-upgrades-col right" data-col="right"></div>
        <div class="hero-display-wrap">
          <img class="hero-display-gif" src="" alt="">
          <div class="hero-display-emoji hidden"></div>
          <div class="hero-locked-overlay hidden">
            <div class="hero-lock-icon">🔒</div>
            <div class="hero-lock-label">Locked</div>
          </div>
        </div>
      </div>
      <div class="hero-select-namewrap">
        <div class="hero-select-name"></div>
        <div class="hero-select-tagline"></div>
        <div class="hero-select-xp-row">
          <span class="hero-stat-gold">💰 <span class="hero-stat-gold-val">0</span></span>
          <span class="hero-stat-sep">·</span>
          <span class="hero-stat-lv">LV <span class="hero-select-lvl">1</span></span>
          <span class="hero-stat-sep">·</span>
          <span class="hero-stat-xp">XP <span class="hero-select-xp">0</span></span>
        </div>
        <div class="hero-select-base-stats-row">
          <span class="hero-base-stat hero-base-hp">❤️ ${char.baseHP}</span>
          <span class="hero-stat-sep">·</span>
          <span class="hero-base-stat hero-base-mana">🔵 ${char.baseMana}</span>
          <span class="hero-stat-sep">·</span>
          <span class="hero-base-stat hero-complexity hero-complexity--${char.complexity.toLowerCase()}">${char.complexity}</span>
        </div>
      </div>
      <div class="hero-upgrades-grid" hidden></div>
      <div class="hero-passive-wrap" hidden>
        <div class="hero-passive-accordion">
          <button type="button" class="hero-passive-accordion-toggle" aria-expanded="false">
            <span>Passives &amp; Extra Upgrades</span>
            <span class="accordion-chevron">▸</span>
          </button>
          <div class="hero-passive-accordion-body">
            <div class="hero-passive-upgrades-grid"></div>
          </div>
        </div>
      </div>
    `
    const particlesEl = slide.querySelector('.hero-particles')
    for (let p = 0; p < 18; p++) {
      const mote = document.createElement('span')
      mote.className = 'hero-particle'
      const size = 1 + Math.random() * 3
      mote.style.left             = (Math.random() * 100) + '%'
      mote.style.width            = size + 'px'
      mote.style.height           = size + 'px'
      mote.style.animationDuration = (6 + Math.random() * 10) + 's'
      mote.style.animationDelay    = (-Math.random() * 10) + 's'
      mote.style.setProperty('--dx', ((Math.random() - 0.5) * 80) + 'px')
      mote.style.opacity           = String(0.4 + Math.random() * 0.5)
      particlesEl.appendChild(mote)
    }
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

function _renderHeroDots(idx) {
  const wrap = document.getElementById('hero-pagination-dots')
  if (!wrap) return
  if (wrap.children.length !== CHARACTERS.length) {
    wrap.innerHTML = ''
    CHARACTERS.forEach((char, i) => {
      const dot = document.createElement('span')
      dot.className = 'hero-dot'
      dot.dataset.hero = char.id
      dot.dataset.heroIndex = String(i)
      dot.addEventListener('click', () => {
        _navHeroSelect(Number(dot.dataset.heroIndex) - _heroIdx)
      })
      wrap.appendChild(dot)
    })
  }
  Array.from(wrap.children).forEach((dot, i) => {
    dot.classList.toggle('is-active', i === idx)
  })
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
  const goldValEl = document.getElementById('hero-select-gold-val')
  if (goldValEl) goldValEl.textContent = s.persistentGold

  const scroll = document.getElementById('hero-select-scroll')
  const overlay = document.getElementById('hero-select-overlay')
  if (overlay) overlay.dataset.hero = CHARACTERS[_heroIdx]?.id ?? ''

  CHARACTERS.forEach((char, i) => {
    const slide = scroll?.children[i]
    if (!slide) return
    slide.classList.toggle('is-current', i === _heroIdx)
    const charSave  = char.comingSoon ? { totalXP: 0, upgrades: [] }
      : _metaCharSave(s, char.id)
    const isLocked  = !char.comingSoon && _heroIsGoldLocked(s, char)
    const xp        = charSave.totalXP ?? 0
    const owned     = charSave.upgrades ?? []
    const isCurrent = i === _heroIdx

    slide.querySelector('.hero-select-name').textContent    = char.name
    slide.querySelector('.hero-select-tagline').textContent = char.tagline
    slide.querySelector('.hero-select-xp').textContent      = String(xp)
    const goldPill = slide.querySelector('.hero-stat-gold-val')
    if (goldPill) goldPill.textContent = String(s.persistentGold ?? 0)
    const lvlPill  = slide.querySelector('.hero-select-lvl')
    if (lvlPill) lvlPill.textContent = String(1 + Math.floor(xp / 200))
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
  _renderHeroDots(_heroIdx)

  const isSelected = s.selectedCharacter === char.id
  const isLocked   = !char.comingSoon && _heroIsGoldLocked(s, char)
  const selectBtn  = document.getElementById('hero-select-btn')
  const labelEl    = selectBtn.querySelector('.hero-cta-label')
  const subEl      = selectBtn.querySelector('.hero-cta-sub')
  const setCTA = (label, sub, mode, disabled) => {
    if (labelEl) labelEl.textContent = label
    if (subEl) {
      subEl.textContent = sub ?? ''
      subEl.classList.toggle('hidden', !sub)
    }
    selectBtn.dataset.mode = mode
    selectBtn.disabled = disabled
  }
  if (char.comingSoon) {
    setCTA('Coming Soon', '', 'coming-soon', true)
  } else if (isLocked) {
    setCTA('Unlock', `${char.unlockCost}💰`, 'unlock', !MetaProgression.canUnlockHero(s, char.id))
  } else if (isSelected) {
    setCTA('Selected', '', 'select', true)
  } else {
    setCTA('Select', '', 'select', false)
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
  btn.innerHTML = iconHTML
  btn.addEventListener('click', () => {
    _selectedUpgradeId = isSelected ? null : id
    const s        = GameController.getSave()
    const charSave = _metaCharSave(s, char.id)
    const locked   = _heroIsGoldLocked(s, char)
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
  const colLeft     = slide?.querySelector('.hero-upgrades-col.left')
  const colRight    = slide?.querySelector('.hero-upgrades-col.right')
  if (colLeft)     colLeft.innerHTML     = ''
  if (colRight)    colRight.innerHTML    = ''
  if (passiveGrid) passiveGrid.innerHTML = ''

  // Route perimeter slots: first 6 go around the doorway (3 left, 3 right alternating).
  // Additional slots overflow into the passive/extra accordion.
  let _slotIdx = 0
  const _grid = grid
  const _appendSlot = (el) => {
    const target = (_slotIdx < 6)
      ? ((_slotIdx % 2 === 0 ? colLeft : colRight) ?? _grid)
      : (passiveGrid ?? _grid)
    target.appendChild(el)
    _slotIdx++
  }
  // Shadow grid.appendChild so downstream ricochet/simple-slot code routes automatically.
  grid.appendChild = _appendSlot

  if (char.comingSoon) {
    const msg = document.createElement('p')
    msg.className   = 'passive-coming-soon'
    msg.textContent = 'Abilities & upgrades coming soon…'
    if (colLeft) colLeft.appendChild(msg)
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
    if (def.masteryOf) continue  // mastery tiers appear in the detail card, not as grid slots
    _renderHeroUpgradeSimpleSlot(grid, char, id, def, ownedList, xp, isLocked)
  }

  if (passiveWrap) {
    passiveWrap.hidden = false
    if (passiveGrid) {
      if (char.id === 'warrior') {
        const killEchoSlot = document.createElement('div')
        killEchoSlot.className = 'hero-passive-builtin'
        killEchoSlot.innerHTML = `
          <span class="hero-passive-builtin-icon">⚔️</span>
          <div class="hero-passive-builtin-info">
            <div class="hero-passive-builtin-name">Kill Echo <span class="hero-passive-builtin-badge">✓ Applied</span></div>
            <div class="hero-passive-builtin-desc">Each dungeon floor starts by marking the closest unrevealed enemy to the entrance (enemy echo hint). Slaying a marked foe marks the next two closest hidden enemies to that kill; slaying any of those marks up to three at once from the latest kill—capping at three echoes until the floor ends. Fewer valid targets than your limit just marks what exists.</div>
          </div>`
        passiveGrid.appendChild(killEchoSlot)
      }
      if (char.id === 'ranger') {
        const keenEyesSlot = document.createElement('div')
        keenEyesSlot.className = 'hero-passive-builtin'
        keenEyesSlot.innerHTML = `
          <span class="hero-passive-builtin-icon">👁️</span>
          <div class="hero-passive-builtin-info">
            <div class="hero-passive-builtin-name">Keen Eyes <span class="hero-passive-builtin-badge">✓ Applied</span></div>
            <div class="hero-passive-builtin-desc">Each time you reveal a tile, 50% chance to sense the category of every orthogonally adjacent hidden tile that does not already have a hint (enemy, trap, treasure, etc.).</div>
          </div>`
        passiveGrid.appendChild(keenEyesSlot)
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
      if (char.id === 'mage') {
        const phaseWalkSlot = document.createElement('div')
        phaseWalkSlot.className = 'hero-passive-builtin'
        phaseWalkSlot.innerHTML = `
          <span class="hero-passive-builtin-icon">🌀</span>
          <div class="hero-passive-builtin-info">
            <div class="hero-passive-builtin-name">Phase Walk <span class="hero-passive-builtin-badge">✓ Applied</span></div>
            <div class="hero-passive-builtin-desc">Tiles are reachable diagonally as well as orthogonally — move like a queen, not a rook.</div>
          </div>`
        passiveGrid.appendChild(phaseWalkSlot)
      }
      if (char.id === 'vampire') {
        const cbSlot = document.createElement('div')
        cbSlot.className = 'hero-passive-builtin'
        cbSlot.innerHTML = `
          <span class="hero-passive-builtin-icon">🩸</span>
          <div class="hero-passive-builtin-info">
            <div class="hero-passive-builtin-name">Corrupted Blood <span class="hero-passive-builtin-badge">✓ Applied</span></div>
            <div class="hero-passive-builtin-desc">You lose 1 HP on every flip, gain +1 HP per revealed living monster on the board (net = −1 + monsters), and each monster loses 1 HP from its current total — enough damage kills them like a normal defeat (gold/XP, trinkets). Ambush reveals never damage you — tap to fight.</div>
          </div>`
        passiveGrid.appendChild(cbSlot)
        const deSlot = document.createElement('div')
        deSlot.className = 'hero-passive-builtin'
        deSlot.innerHTML = `
          <span class="hero-passive-builtin-icon">🌑</span>
          <div class="hero-passive-builtin-info">
            <div class="hero-passive-builtin-name">Dark Eyes <span class="hero-passive-builtin-badge">✓ Applied</span></div>
            <div class="hero-passive-builtin-desc">50% chance per reveal to sense an enemy hint (⚔️) on unrevealed, unreachable enemy tiles only (capped per flip); hints disappear when those tiles become reachable.</div>
          </div>`
        passiveGrid.appendChild(deSlot)
      }
      if (char.id === 'necromancer') {
        const rmSlot = document.createElement('div')
        rmSlot.className = 'hero-passive-builtin'
        rmSlot.innerHTML = `
          <span class="hero-passive-builtin-icon">🧟</span>
          <div class="hero-passive-builtin-info">
            <div class="hero-passive-builtin-name">Raise Minion <span class="hero-passive-builtin-badge">✓ Applied</span></div>
            <div class="hero-passive-builtin-desc">Tap an ash pile (slain enemy) to spend 10 mana and raise one 🧟 minion on that tile — only one per corpse. Minions strike alongside you in combat and absorb the next enemy hit (closest minion takes damage instead of you); when a minion dies, the ash scatters and cannot be raised again. Level-up Minion Mastery picks upgrade their stats.</div>
          </div>`
        passiveGrid.appendChild(rmSlot)

        const msSlot = document.createElement('div')
        msSlot.className = 'hero-passive-builtin'
        msSlot.innerHTML = `
          <span class="hero-passive-builtin-icon">👁️</span>
          <div class="hero-passive-builtin-info">
            <div class="hero-passive-builtin-name">Master's Sight <span class="hero-passive-builtin-badge">✓ Applied</span></div>
            <div class="hero-passive-builtin-desc">See through your minions. Whenever you raise a minion, the categories of the tiles surrounding it are revealed (enemy, trap, treasure, etc.) — a glimpse through the minion's dead eyes.</div>
          </div>`
        passiveGrid.appendChild(msSlot)
      }
      if (char.id === 'engineer') {
        const pingSlot = document.createElement('div')
        pingSlot.className = 'hero-passive-builtin'
        pingSlot.innerHTML = `
          <span class="hero-passive-builtin-icon">📡</span>
          <div class="hero-passive-builtin-info">
            <div class="hero-passive-builtin-name">Seismic Ping <span class="hero-passive-builtin-badge">Passive · L1</span></div>
            <div class="hero-passive-builtin-desc">Innate Engineer passive (level 1 from the start). When you finish placing or moving your turret, it <strong>seismic-pings</strong> hidden tiles around it: each shows a category hint (enemy, trap, loot, stairs, etc.) like Keen Eyes, and those tiles briefly pulse. At L1 the ring is the 8 adjacent tiles; future <strong>Seismic Ping masteries</strong> may extend reach.</div>
          </div>`
        passiveGrid.appendChild(pingSlot)
      }
      if (char.id !== 'warrior' && char.id !== 'ranger' && char.id !== 'mage' && char.id !== 'vampire' && char.id !== 'necromancer' && char.id !== 'engineer') {
        const comingSoon = document.createElement('p')
        comingSoon.className = 'passive-coming-soon'
        comingSoon.textContent = 'Coming Soon…'
        passiveGrid.appendChild(comingSoon)
      }
    }
  }

  if (char.id === CHARACTERS[_heroIdx].id) {
    _syncHeroUpgradeDetail(char, ownedList, xp, isLocked)
  }
}

function _buyUpgradeForChar(s, charId, upgradeId) {
  if (charId === 'ranger')      return MetaProgression.buyRangerUpgrade(s, upgradeId)
  if (charId === 'engineer')    return MetaProgression.buyEngineerUpgrade(s, upgradeId)
  if (charId === 'mage')        return MetaProgression.buyMageUpgrade(s, upgradeId)
  if (charId === 'necromancer') return MetaProgression.buyNecromancerUpgrade(s, upgradeId)
  if (charId === 'vampire')     return MetaProgression.buyVampireUpgrade(s, upgradeId)
  return MetaProgression.buyUpgrade(s, upgradeId)
}

function _renderUpgradeDetail(id, def, isOwned, canAfford) {
  const backdrop     = document.getElementById('hero-upgrade-backdrop')
  const hintEl       = document.getElementById('hero-upgrade-detail-hint')
  const costEl       = document.getElementById('hero-upgrade-detail-cost')
  const masteriesEl  = document.getElementById('hero-upgrade-detail-masteries')
  const masteriesListEl = document.getElementById('hero-upgrade-detail-masteries-list')

  if (!id || !def) {
    backdrop.classList.add('hidden')
    return
  }
  backdrop.classList.remove('hidden')
  document.getElementById('hero-upgrade-detail-name').textContent = def.name
  document.getElementById('hero-upgrade-detail-desc').textContent = def.desc

  const char     = CHARACTERS[_heroIdx]
  const s        = GameController.getSave()
  const charSave = _metaCharSave(s, char.id)
  const owned    = charSave.upgrades ?? []
  const xp       = charSave.totalXP ?? 0
  const map      = char.id === 'ranger' ? RANGER_UPGRADES
    : char.id === 'engineer' ? ENGINEER_UPGRADES
      : char.id === 'mage' ? MAGE_UPGRADES
        : char.id === 'vampire' ? VAMPIRE_UPGRADES
          : char.id === 'necromancer' ? NECROMANCER_UPGRADES
            : WARRIOR_UPGRADES

  // Cost line
  if (costEl) {
    const parts = []
    if (def.manaCost) parts.push(`${def.manaCost} mana`)
    if (def.hpCost)   parts.push(`${def.hpCost} HP`)
    if (parts.length) {
      costEl.textContent = `Cost: ${parts.join(' / ')} per use`
      costEl.classList.remove('hidden')
    } else {
      costEl.classList.add('hidden')
    }
  }

  // Prereq hint
  const missingPrereq = def.requires && !owned.includes(def.requires)
  if (hintEl) {
    if (missingPrereq && !isOwned) {
      hintEl.textContent = `Requires ${map[def.requires]?.name ?? def.requires} first.`
      hintEl.classList.remove('hidden')
    } else {
      hintEl.classList.add('hidden')
    }
  }

  // Masteries section
  const tiers = Object.entries(map).filter(([, d]) => d.masteryOf === id)
  if (masteriesEl && masteriesListEl) {
    if (tiers.length > 0) {
      masteriesListEl.innerHTML = ''
      tiers.forEach(([tierId, tierDef]) => {
        const tierOwned    = owned.includes(tierId)
        const prereqMet    = !tierDef.requires || owned.includes(tierDef.requires)
        const tierAfford   = !tierOwned && prereqMet && xp >= tierDef.xpCost
        const row = document.createElement('div')
        row.className = 'upgrade-mastery-row'
        row.innerHTML = `
          <span class="upgrade-mastery-check${tierOwned ? ' owned' : ''}" aria-hidden="true">${tierOwned ? '✓' : ''}</span>
          <div class="upgrade-mastery-info">
            <span class="upgrade-mastery-name">${tierDef.name}</span>
            ${tierDef.desc ? `<span class="upgrade-mastery-desc">${tierDef.desc}</span>` : ''}
          </div>
          <button class="upgrade-mastery-btn${tierOwned ? ' is-owned' : ''}" ${tierOwned || !tierAfford ? 'disabled' : ''}>
            ${tierOwned ? 'Owned' : tierAfford ? `${tierDef.xpCost} XP` : !prereqMet ? 'Locked' : `${tierDef.xpCost} XP`}
          </button>`
        if (!tierOwned && tierAfford) {
          row.querySelector('.upgrade-mastery-btn').addEventListener('click', () => {
            const sv = GameController.getSave()
            if (_buyUpgradeForChar(sv, char.id, tierId)) {
              SaveManager.save(sv)
              _renderHeroSelect()
            }
          })
        }
        masteriesListEl.appendChild(row)
      })
      masteriesEl.classList.remove('hidden')
    } else {
      masteriesEl.classList.add('hidden')
    }
  }

  // Base buy button
  const buyBtn = document.getElementById('hero-upgrade-buy-btn')
  if (isOwned) {
    buyBtn.textContent = '✓ Owned'
    buyBtn.disabled    = true
    buyBtn.onclick     = null
  } else {
    buyBtn.textContent = `Unlock — ${def.xpCost} XP`
    buyBtn.disabled    = !canAfford
    buyBtn.onclick     = () => {
      const sv   = GameController.getSave()
      const ch   = CHARACTERS[_heroIdx]
      if (_buyUpgradeForChar(sv, ch.id, id)) {
        SaveManager.save(sv)
        _selectedUpgradeId = null
        _renderHeroSelect()
      }
    }
  }
}

function _showResumePrompt() {
  const info = GameController.getActiveRunInfo()
  if (!info) return
  const heroName = info.player.isRanger ? 'Ranger' : info.player.isEngineer ? 'Engineer' : info.player.isMage ? 'Mage' : info.player.isVampire ? 'Vampire' : info.player.isNecromancer ? 'Necromancer' : 'Paladin'
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
  const xp   = _metaCharSave(s, s.selectedCharacter ?? 'warrior').totalXP

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

async function _safeBoot() {
  try {
    await boot()
  } catch (err) {
    Logger.error('[Boot] Fatal init error', err)
    document.body.innerHTML = '<p style="color:white;padding:2rem;font-family:sans-serif">Failed to start. Try clearing site data and reloading.</p>'
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _safeBoot)
} else {
  _safeBoot()
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
