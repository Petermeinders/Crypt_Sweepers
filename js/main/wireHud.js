import { CONFIG } from '../config.js'
import { WARRIOR_UPGRADES } from '../data/upgrades.js'
import { RANGER_UPGRADES } from '../data/ranger.js'
import { ENGINEER_UPGRADES } from '../data/engineer.js'
import { MAGE_UPGRADES } from '../data/mage.js'
import { VAMPIRE_UPGRADES } from '../data/vampire.js'
import { NECROMANCER_UPGRADES } from '../data/necromancer.js'

/** In-run HUD buttons: resume prompt, abilities (hold-to-inspect), retreat, cheats. */
export function wireHud(ctx) {
  const { GameController, UI } = ctx

  document.getElementById('resume-yes-btn').addEventListener('click', () => {
    document.getElementById('resume-overlay').classList.add('hidden')
    ctx.GameController.resumeRun()
  })
  document.getElementById('resume-no-btn').addEventListener('click', () => {
    document.getElementById('resume-overlay').classList.add('hidden')
    ctx.GameController.abandonRun()
  })

  document.getElementById('hud-teary-eyes')?.addEventListener('click', () => {
    const turns = ctx.GameController.getTearyEyesTurns()
    ctx.UI.setMessage(`💧 Teary Eyes (${turns} turn${turns === 1 ? '' : 's'}) — Onion stench! All spell & ability mana costs are +1 until it clears.`)
  })

  document.getElementById('info-card-overlay').addEventListener('pointerdown', (e) => {
    if (e.target.id === 'info-card-overlay') ctx.UI.hideInfoCard()
  })

  document.getElementById('skip-floor-btn')?.addEventListener('click', () => {
    ctx.GameController.cheatSkipFloor()
  })

  document.getElementById('generate-gear-btn')?.addEventListener('click', () => {
    ctx.GameController.cheatGenerateGear()
  })

  document.getElementById('grant-gem-btn')?.addEventListener('click', () => {
    ctx.GameController.cheatGrantGem()
  })

  wireCheatHudTargets(ctx)

  wireAbilityHold(
    document.getElementById('hud-btn-slot-a'),
    () => ctx.GameController.abilitySlotAAction(),
    () => {
      const s = ctx.GameController.getSave()
      const ch = s.selectedCharacter ?? 'warrior'
      if (ch === 'engineer') {
        if (!(s.engineer?.upgrades ?? []).includes('mana-generator')) return
        const def = ENGINEER_UPGRADES['mana-generator']
        const stacks = ctx.GameController.getActiveRunInfo?.()?.player?.manaGeneratorMasteryStacks ?? 0
        ctx.UI.showInfoCard({
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
        const br  = ctx.GameController.getChainLightningBreakdown?.()
        const dmgDesc = br
          ? `Each zap: ${br.perZap} damage (avg melee ${Number.isInteger(br.avgMelee) ? br.avgMelee : br.avgMelee.toFixed(1)}${br.stacks > 0 ? `, +${Math.round((br.mult - 1) * 100)}% mastery` : ''}).`
          : 'Each zap deals equal damage — scales with your HUD attack.'
        ctx.UI.showInfoCard({
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
        const br  = ctx.GameController.getBloodTitheBreakdown?.()
        const hpCost  = br?.hpCost  ?? def.hpCost
        const manaGain = br?.manaGain ?? def.manaGain
        const tier    = br?.tier ?? 1
        const tierDesc = tier >= 3 ? 'III (7 HP → 11 mana)' : tier >= 2 ? 'II (8 HP → 10 mana)' : 'I (10 HP → 10 mana)'
        ctx.UI.showInfoCard({
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
        const rr  = ctx.GameController.getRicochetBreakdown()
        const pattern = arc ? '4 : 3 : 2' : '3 : 2 : 1'
        const dmgDesc = rr
          ? `Three shots: ${rr.shots.join(' → ')} (${pattern} × unit; unit ≈ ${rr.unit}).`
          : `Three shots at ${pattern} × unit — start a run for exact damage.`
        ctx.UI.showInfoCard({
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
        const slam = ctx.GameController.getSlamDamageBreakdown()
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
        ctx.UI.showInfoCard({
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
  wireAbilityHold(
    document.getElementById('hud-btn-slot-b'),
    () => {
      const s = ctx.GameController.getSave()
      const ch = s.selectedCharacter ?? 'warrior'
      if (ch === 'ranger') ctx.GameController.poisonArrowShotAction()
      else if (ch === 'engineer') ctx.GameController.teslaTowerAction()
      else if (ch === 'mage') ctx.GameController.telekineticThrowAction()
      else if (ch === 'necromancer') ctx.GameController.corpseExplosionAction()
      else if (ch === 'vampire') ctx.GameController.mistFormAction()
      else ctx.GameController.blindingLightAction()
    },
    () => {
      const s = ctx.GameController.getSave()
      const ch = s.selectedCharacter ?? 'warrior'
      if (ch === 'mage') {
        if (!(s.mage?.upgrades ?? []).includes('telekinetic-throw')) return
        const def = MAGE_UPGRADES['telekinetic-throw']
        const br  = ctx.GameController.getTelekineticThrowBreakdown?.()
        const dmgDesc = br
          ? `Slam damage: ${br.damage} (avg melee × 3${br.stacks > 0 ? `, +${Math.round((br.mult - 1) * 100)}% mastery` : ''}).`
          : 'Slam damage = max(1, round(avg melee × 3)).'
        ctx.UI.showInfoCard({
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
        ctx.UI.showInfoCard({
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
        ctx.UI.showInfoCard({
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
        if (!ctx.GameController.isRangerActiveUnlocked('poison-arrow-shot')) return
        const pb = ctx.GameController.getPoisonArrowShotBreakdown()
        const dmgLine = pb
          ? `Initial hit and each poison tick: ${pb.perHit} (max(1, round(avgMelee × ${CONFIG.ability.ricochetUnitMult}))) — ${pb.flipTicks} ticks on your next turns (reveals or melee).`
          : 'Start a ranger run to see damage.'
        ctx.UI.showInfoCard({
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
      const bl = ctx.GameController.getBlindingLightBreakdown()
      const stunDesc = bl
        ? (() => {
            const { avgMelee, baseTenths, stacks, mult, stunTurns } = bl
            const avgStr = Number.isInteger(avgMelee) ? String(avgMelee) : avgMelee.toFixed(1)
            const inner = stacks > 0
              ? `(${baseTenths}/10 + ${stacks}×0.1)`
              : `${mult.toFixed(1)}`
            return `max(2, round(√${avgStr} × ${inner})) = ${stunTurns} stun turn(s) — Undead/Beast Bane can double stun`
          })()
        : 'Start a paladin run to see stun turns (scales with HUD attack + Blinding Mastery).'
      ctx.UI.showInfoCard({
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
    ctx.GameController.divineLightHealAction()
  })

  wireAbilityHold(
    document.getElementById('hud-btn-slot-c'),
    () => {
      const s = ctx.GameController.getSave()
      const ch3 = s.selectedCharacter ?? 'warrior'
      if (ch3 === 'ranger') ctx.GameController.arrowBarrageAction()
      else if (ch3 === 'mage') ctx.GameController.manaShieldAction()
      else if (ch3 === 'vampire') ctx.GameController.bloodPactAction()
      else if (ch3 === 'necromancer') ctx.GameController.boneArmorAction()
      else ctx.GameController.divineLightAction()
    },
    () => {
      const s = ctx.GameController.getSave()
      const ch4 = s.selectedCharacter ?? 'warrior'
      if (ch4 === 'mage') {
        if (!(s.mage?.upgrades ?? []).includes('mana-shield')) return
        const def = MAGE_UPGRADES['mana-shield']
        const stacks = ctx.GameController.getManaShieldStacks?.() ?? 0
        const absorptionPct = ['30%', '45%', '60%'][Math.min(stacks, 2)]
        const drainPct      = ['100%', '85%', '70%'][Math.min(stacks, 2)]
        ctx.UI.showInfoCard({
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
        const br  = ctx.GameController.getBloodPactBreakdown?.()
        const eqDesc = br?.count > 0
          ? `${br.count} enem${br.count !== 1 ? 'ies' : 'y'} would be equalized to ${br.avgHp} HP (based on current board).`
          : 'Equalization preview available during a run with revealed enemies.'
        ctx.UI.showInfoCard({
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
      if (ch4 === 'necromancer') {
        if (!(s.necromancer?.upgrades ?? []).includes('bone-armor')) return
        const def = NECROMANCER_UPGRADES['bone-armor']
        ctx.UI.showInfoCard({
          spriteSrc: def.iconSrc,
          name:   def.name,
          type:   'Necromancer Ability',
          blurb:  'Consume an enemy corpse pile to bind spectral bone plates. Tap the ability, then tap an ash pile — the corpse is consumed and cannot be raised again.',
          details: [
            { icon: '🛡️', label: 'Armor',  desc: 'Gain armor equal to 10% of your max HP' },
            { icon: '❤️', label: 'Expertise II', desc: 'Also heal 10% max HP (15 mana)' },
            { icon: '🔵', label: 'Expertise III', desc: 'After paying mana, recover 10% max mana (20 mana)' },
          ],
        })
        return
      }
      if (ch4 !== 'ranger') {
        // Warrior: Divine Light info card
        if (!(s.warrior?.upgrades ?? []).includes('divine-light')) return
        const dl = ctx.GameController.getDivineLightBreakdown()
        ctx.UI.showInfoCard({
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
      if (!ctx.GameController.isRangerActiveUnlocked('arrow-barrage')) return
      const br = ctx.GameController.getArrowBarrageBreakdown()
      const dmgLine = br
        ? `${Math.round(br.heroDamagePct * 100)}% of avg attack (${br.perEnemy} per enemy, min 1) in a ${br.area} — level-up mastery stacks add to this.`
        : 'Start a ranger run to see damage.'
      const vol = RANGER_UPGRADES['arrow-barrage']
      ctx.UI.showInfoCard({
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
  wireAbilityHold(
    document.getElementById('hud-btn-slot-d'),
    () => {
      const s = ctx.GameController.getSave()
      const ch5 = s.selectedCharacter ?? 'warrior'
      if (ch5 === 'mage') ctx.GameController.lifeTapAction()
    },
    () => {
      const s = ctx.GameController.getSave()
      if ((s.selectedCharacter ?? 'warrior') !== 'mage') return
      if (!(s.mage?.upgrades ?? []).includes('life-tap')) return
      const def = MAGE_UPGRADES['life-tap']
      const stacks = ctx.GameController.getLifeTapStacks?.() ?? 0
      const hpCost = stacks >= 1 ? 2 : 1
      const mpGain = [1, 3, 4][Math.min(stacks, 2)]
      ctx.UI.showInfoCard({
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

  document.getElementById('retreat-btn').addEventListener('click', () => {
    document.getElementById('retreat-confirm').classList.remove('hidden')
  })
  document.getElementById('flee-btn')?.addEventListener('click', () => {
    ctx.GameController.fleeCombatAction()
  })
  document.getElementById('retreat-confirm-yes').addEventListener('click', () => {
    document.getElementById('retreat-confirm').classList.add('hidden')
    const reason = window.__balanceBotRetreatReason || 'player'
    window.__balanceBotRetreatReason = undefined
    ctx.GameController.doRetreat(reason)
  })
  document.getElementById('retreat-confirm-no').addEventListener('click', () => {
    document.getElementById('retreat-confirm').classList.add('hidden')
  })

  document.getElementById('hud-portrait-wrap').addEventListener('click', () => {
    ctx.GameController.divineLightHealAction()
  })

  document.getElementById('pc-tap-hp')?.addEventListener('click', () => {
    ctx.GameController.useOrbPotion('hp')
  })
  document.getElementById('pc-tap-mana')?.addEventListener('click', () => {
    ctx.GameController.useOrbPotion('mana')
  })
}

function wireAbilityHold(btn, onTap, onHold) {
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

/** Cheat "Increase stats": capture-phase taps on HUD + backpack cheat targets. */
function wireCheatHudTargets(ctx) {
  const cheatEnabled = () => ctx.GameController.getSave()?.settings?.cheats?.increaseStats === true
  const inRun = () => document.getElementById('main-menu')?.classList.contains('hidden')

  document.addEventListener('click', (e) => {
    if (!cheatEnabled() || !inRun()) return
    const target = e.target.closest('[data-hud-cheat-target]')
    if (!target) return
    e.preventDefault()
    e.stopPropagation()
    const stat = target.getAttribute('data-hud-cheat-target')?.trim().toLowerCase()
    if (stat) ctx.GameController.cheatHudStatBoost(stat)
  }, true)
}

