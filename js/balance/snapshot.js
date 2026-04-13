import { CONFIG } from '../config.js'
import { ENEMY_DEFS } from '../data/enemies.js'
import { GLOBAL_PASSIVE_IDS } from '../data/passives.js'
import { SHOP_ITEMS } from '../data/upgrades.js'
import MetaProgression from '../systems/MetaProgression.js'
import { scaleEnemyDef } from '../systems/EnemyScaling.js'
import { BALANCE_PILLARS, RECOMMENDED_TUNING_ORDER } from './balanceTargets.js'

export const BALANCE_FLOORS = [5, 10, 25, 50, 75]
export const REFERENCE_ENEMY_IDS = ['skeleton', 'goblin', 'zombie', 'troll']

/** Minimal warrior `player` matching what MetaProgression.applyToPlayer expects. */
export function buildMinimalWarriorPlayer() {
  return {
    hp: CONFIG.player.baseHP,
    maxHp: CONFIG.player.baseHP,
    mana: CONFIG.player.baseMana,
    maxMana: CONFIG.player.baseMana,
    gold: CONFIG.player.startGold,
    xp: 0,
    level: 1,
    safeGold: 0,
    abilities: [],
    damageBonus: 0,
    damageReduction: 0,
    spellCostReduction: 0,
    onKillHeal: 0,
    fleeMaxCost: null,
    undeadBonus: false,
    beastBonus: false,
    trapReduction: 0,
    trapfinderStacks: 0,
    slamMasteryStacks: 0,
    blindingLightMasteryStacks: 0,
    retreatPercent: CONFIG.retreat.goldKeepPercent,
    extraAbilityChoice: false,
    damageTakenMult: 1,
    isRanger: false,
    isEngineer: false,
    inventory: [],
    goldenKeys: 0,
    meleeHitCount: 0,
    deathmaskPending: false,
    trapImmune: false,
    regenTurns: 0,
    regenPerTurn: 0,
    shieldShard: false,
    whettsoneHits: 0,
    eagleEyeFreeFlip: false,
    soulboundBonus: 0,
    resurrectionUsed: false,
    burnStacks: 0,
    poisonStacks: 0,
    corruptionStacks: 0,
    corruptionBaseMaxHp: 0,
    corruptionBaseMaxMana: 0,
    trapDodgeChance: 0,
    reflexDodgeChance: 0,
  }
}

function baselineSave() {
  const save = MetaProgression.defaultSave()
  save.settings = { ...save.settings, difficulty: 'normal' }
  save.selectedCharacter = 'warrior'
  save.globalPassives = []
  save.warrior.shopCart = []
  save.warrior.upgrades = []
  return save
}

function fullMetaSave() {
  const save = baselineSave()
  save.globalPassives = [...GLOBAL_PASSIVE_IDS]
  save.warrior.shopCart = Object.keys(SHOP_ITEMS)
  return save
}

/** Mirrors GameController _computeEffectiveDamageTaken for a single hit (no trinkets). */
function effectiveDamageTaken(rawAmount, player) {
  const scaled = Math.round(rawAmount * (player.damageTakenMult ?? 1))
  return Math.max(1, scaled - (player.damageReduction ?? 0))
}

function warriorMeleeDamage(player) {
  const base = CONFIG.player.baseDamage
  const b = Array.isArray(base) ? base[0] : base
  const dmg = b + (player.damageBonus ?? 0)
  return { min: dmg, max: dmg, avg: dmg }
}

/**
 * @returns {object} Serializable snapshot for tests and balance-report script.
 */
export function computeBalanceSnapshot() {
  const scenarioDefs = [
    { id: 'baseline', label: 'No meta unlocks', save: baselineSave(), damageBonusOverride: null },
    { id: 'fullMeta', label: 'All global passives + gold shop', save: fullMetaSave(), damageBonusOverride: null },
    { id: 'baseline_dmg2', label: 'Baseline + in-run band (damageBonus=2)', save: baselineSave(), damageBonusOverride: 2 },
    { id: 'baseline_dmg5', label: 'Baseline + in-run band (damageBonus=5)', save: baselineSave(), damageBonusOverride: 5 },
    { id: 'baseline_dmg7', label: 'Baseline + in-run band (damageBonus=7)', save: baselineSave(), damageBonusOverride: 7 },
  ]

  const rows = []
  const trivialKills = []

  for (const sc of scenarioDefs) {
    const player = buildMinimalWarriorPlayer()
    MetaProgression.applyToPlayer(player, sc.save)
    if (sc.damageBonusOverride != null) {
      player.damageBonus = sc.damageBonusOverride
    }
    const melee = warriorMeleeDamage(player)

    for (const floor of BALANCE_FLOORS) {
      for (const enemyId of REFERENCE_ENEMY_IDS) {
        const def = ENEMY_DEFS[enemyId]
        if (!def) continue
        const scaled = scaleEnemyDef(def, floor)
        const [dmgLo, dmgHi] = scaled.dmg
        const avgEnemyHit = (dmgLo + dmgHi) / 2
        const effPerHit = effectiveDamageTaken(avgEnemyHit, player)
        const hitsToKill = Math.ceil(scaled.hp / Math.max(1, melee.avg))
        const hitsToDie = Math.ceil(player.maxHp / effPerHit)
        const trivialKill = hitsToKill <= 1
        const verySafe = hitsToDie >= 10

        const row = {
          scenarioId: sc.id,
          scenarioLabel: sc.label,
          floor,
          enemyId,
          enemyHp: scaled.hp,
          enemyDmgLo: dmgLo,
          enemyDmgHi: dmgHi,
          playerMaxHp: player.maxHp,
          playerMelee: melee.avg,
          playerDamageReduction: player.damageReduction ?? 0,
          playerDamageTakenMult: player.damageTakenMult ?? 1,
          hitsToKill,
          hitsToDieApprox: hitsToDie,
          trivialKill,
          verySafePlayer: verySafe,
        }
        rows.push(row)
        if (trivialKill) {
          trivialKills.push({
            scenarioId: sc.id,
            floor,
            enemyId,
            hitsToKill,
          })
        }
      }
    }
  }

  const baselineTrivial = trivialKills.filter(t => t.scenarioId === 'baseline')
  const fullMetaTrivial = trivialKills.filter(t => t.scenarioId === 'fullMeta')
  const lowestFloorTrivial = (arr, enemyId) => {
    const floors = arr.filter(t => t.enemyId === enemyId).map(t => t.floor)
    return floors.length ? Math.min(...floors) : null
  }

  const profileMetaGap = {
    baselineTrivialKillCount: baselineTrivial.length,
    fullMetaTrivialKillCount: fullMetaTrivial.length,
    firstTrivialFloorSkeleton: {
      baseline: lowestFloorTrivial(baselineTrivial, 'skeleton'),
      fullMeta: lowestFloorTrivial(fullMetaTrivial, 'skeleton'),
    },
    note:
      'Trivial melee = hitsToKill <= 1. Compare baseline vs fullMeta trivial counts and first floor where skeleton is one-shot.',
  }

  return {
    pillars: BALANCE_PILLARS.map(p => ({ id: p.id, title: p.title, summary: p.summary })),
    recommendedTuningOrder: RECOMMENDED_TUNING_ORDER,
    profileMetaGap,
    floors: BALANCE_FLOORS,
    referenceEnemyIds: REFERENCE_ENEMY_IDS,
    rows,
  }
}
