/**
 * Per-run balance telemetry — plain data accumulated during a run and exported for bots / analysis.
 */

export function createInitialTelemetry() {
  return {
    startedAt: Date.now(),
    levelSnapshots: [],
    /** @type {Record<string, { taken: number, dealt: number }>} keyed by floor number string */
    damageByFloor: {},
    /** @type {Record<string, number>} damage taken keyed by source: 'combat','trap','corrupted_blood','fast_enemy','archer_harass','toxic_gas','merchant','turret_destroyed','other' */
    damageSources: {},
    /** @type {Record<string, number>} enemy kills per floor, keyed by floor string */
    killsByFloor: {},
    /** @type {Record<string, number>} gold collected per floor, keyed by floor string */
    goldByFloor: {},
    floorSnapshots: [],
    totalDamageTaken: 0,
    totalDamageDealtToEnemies: 0,
    outcome: null,
    runStartSnapshotDone: false,
  }
}

/**
 * @param {object} opts
 * @param {string} opts.trigger — e.g. 'runStart', 'levelUp', 'masteryHp'
 * @param {number} opts.floor
 * @param {object} opts.player — run.player
 * @param {number} opts.xpToNext — XP needed for next level
 * @param {[number, number]} opts.meleeDamageRange
 */
export function buildLevelSnapshotRecord({ trigger, floor, player, xpToNext, meleeDamageRange }) {
  return {
    at: Date.now(),
    trigger,
    characterLevel: player.level,
    floor,
    xp: player.xp,
    xpToNext,
    hp: player.hp,
    maxHp: player.maxHp,
    mana: player.mana,
    maxMana: player.maxMana,
    damageBonus: player.damageBonus ?? 0,
    damageReduction: player.damageReduction ?? 0,
    gold: player.gold ?? 0,
    meleeDamageRange: [...meleeDamageRange],
  }
}
