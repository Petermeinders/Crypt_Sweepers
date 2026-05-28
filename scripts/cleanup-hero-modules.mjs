/** Cleanup pass on hero modules after extraction. */
import fs from 'node:fs'
import path from 'node:path'

const heroesDir = path.join(path.resolve(import.meta.dirname, '..'), 'js/heroes')

const GC_CTX = [
  'markReachableUi', 'isActiveUnlocked', 'getActiveTiles', 'getActiveTileRows', 'getActiveTileAt',
  'isSilenced', 'stillWaterManaCost', 'markStillWaterAbilityUsed', 'tearyExtraCost',
  'suspendCombatEngagementForMultiTargetAbility', 'restoreCombatEngagementAfterMultiTargetAbility',
  'scaleOutgoingDamageToEnemy', 'gainGold', 'gainXP', 'endCombatVictory', 'rand',
  'syncGridDomClassesFromModel', 'checkOnionLayer', 'canAttackEnemy', 'isCombatCommitmentLocked',
  'cancelRicochetMode', 'cancelArrowBarrageMode', 'cancelPoisonArrowShotMode',
  'cancelChainLightningMode', 'cancelTelekineticThrowMode', 'cancelStrengthenMinionMode',
  'cancelCorpseExplosionMode', 'cancelEngineerConstructMode', 'cancelSpellLanternBlindingForRicochet',
  'previewSpellManaCostForUi', 'resolveTauntTarget', 'checkShieldBlock', 'die',
  'saveActiveRun', 'patchActiveTileDom', 'recomputeSubFloorEnemyLocks', 'isInSubFloor',
  'playerDamageRange', 'echoCharmCategoryForTileType',
  'computeEffectiveDamageTaken', 'telemetryBumpDamageTaken', 'telemetryBumpDamageSource',
  'applyTearyEyes', 'refreshMainGridDomFromModel', 'onTileTap', 'onTileHold',
  'inTeslaPerimeter', 'engineerTurretDamage', 'takeDamage', 'syncTurretVisual',
  'damageTurretFromEnemyHit', 'destroyTurret', 'avgMeleeDamage',
]

for (const f of fs.readdirSync(heroesDir).filter(x => x.endsWith('.js'))) {
  let s = fs.readFileSync(path.join(heroesDir, f), 'utf8')
  s = s.replace(/\(ctx,\s*\)/g, '(ctx)')
  for (const fn of GC_CTX) {
    s = s.replace(new RegExp(`_${fn}\\(`, 'g'), `ctx.${fn}(`)
  }
  // fix broken internal ctx injection: name(ctx, arg -> name(ctx, arg) when missing paren issues
  s = s.replace(/(\w+)\(ctx,\s*,/g, '$1(ctx,')
  fs.writeFileSync(path.join(heroesDir, f), s)
  console.log('cleaned', f)
}

// mage stack getters
const magePath = path.join(heroesDir, 'mage.js')
let mage = fs.readFileSync(magePath, 'utf8')
if (!mage.includes('getLifeTapStacks')) {
  mage += `
export function getLifeTapStacks() {
  return session.run?.player?.mageActiveStacks?.['life-tap'] ?? 0
}

export function getManaShieldStacks() {
  return session.run?.player?.mageActiveStacks?.['mana-shield'] ?? 0
}
`
  fs.writeFileSync(magePath, mage)
}

// necromancer module-level counter
const necroPath = path.join(heroesDir, 'necromancer.js')
let necro = fs.readFileSync(necroPath, 'utf8')
if (!necro.includes('let _nextMinionId')) {
  necro = necro.replace(
    "import { session, charKey } from '../core/RunContext.js'",
    "import { session, charKey } from '../core/RunContext.js'\n\nlet _nextMinionId = 1",
  )
  fs.writeFileSync(necroPath, necro)
}
