/**
 * Remove hero ability bodies from GameController.js and insert imports + thin wrappers.
 * Run: node scripts/patch-gc-heroes.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const gcPath = path.join(ROOT, 'js/core/GameController.js')

const REMOVE_FNS = [
  // warrior kill echo
  '_isKillEchoHiddenEnemyTile', '_paladinKillEchoClearMarks', '_paladinKillEchoStripMarkFromTile',
  '_paladinKillEchoMarkedHiddenCount', '_paladinKillEchoMarkNewClosest', '_paladinKillEchoApplyMarks',
  '_paladinKillEchoAddMarksAfterKill',
  // warrior abilities
  'slamAction', '_slamBranchAftereffect', '_slamSeismicReveal', '_refreshAllEnemyStatusDisplays', '_hemorrhageBurst',
  'blindingLightAction', '_castBlindingLight', '_blindingBranchAftereffect', '_blindingRevelationReveal',
  'divineLightAction', 'divineLightHealAction', '_castDivineLightSmite',
  '_avgMeleeDamage', '_slamMultFromStacks', '_blindingLightMultFromStacks', '_blindingLightStunTurns', '_slamDamagePerTarget',
  'getSlamDamageBreakdown', 'getDivineLightBreakdown', 'getBlindingLightBreakdown',
  // ranger
  '_isRangerActiveUnlocked', '_rangerActiveDamageMult', '_refreshRangerActiveHud',
  'ricochetAction', '_executeRicochet', 'arrowBarrageAction', '_tripleVolleyDamagePerEnemy', '_tilesIn3x3', '_executeTripleVolley',
  'poisonArrowShotAction', '_executePoisonArrowShot', '_poisonArrowUnitDamage',
  '_hasRicochetArcMasteryMeta', '_ricochetDamageSequence',
  'getRicochetBreakdown', 'getArrowBarrageBreakdown', 'getPoisonArrowShotBreakdown',
  // mage
  '_isMageActiveUnlocked', '_mageActiveDamageMult', '_manaShieldAbsorptionRate', '_manaShieldDrainRatio',
  '_lifeTapHpCost', '_lifeTapMpGain', '_refreshMageHud', '_mageLifeTapOnFlip',
  'spellAction', '_castSpell', 'chainLightningAction', '_chainLightningDamagePerZap', 'getChainLightningBreakdown',
  '_executeChainLightning', '_pickRandomDistinct', 'telekineticThrowAction', 'getTelekineticThrowBreakdown',
  '_telekineticThrowDamage', '_isTelekineticThrowDestination', '_isTelekineticThrowEnemyTarget', '_executeTelekineticThrow',
  'manaShieldAction', 'lifeTapAction',
  // engineer
  '_isEngineerUpgradeUnlocked', '_engineerTurretMaxHp', '_engineerTurretDamage', '_teslaStacks', '_teslaRadius',
  '_teslaArcChance', '_inTeslaPerimeter', '_turretDeployedOnTile', '_syncTurretVisual', '_destroyTurret',
  '_damageTurretFromEnemyHit', '_engineerSeismicPingTargetTiles', '_engineerTurretSeismicPing', '_engineerTurretAfterReveal',
  '_handleEngineerConstructTileTap', 'constructTurretAction', 'teslaTowerAction', 'manaGeneratorAction',
  '_engineerManaGeneratorOnReveal', '_refreshEngineerHud',
  // necromancer
  '_getMinionMaxHp', '_getMinionDmg', '_syncMinionVisual', '_syncAllMinionVisuals', '_clearMinionVisuals',
  '_necroClearAshAfterMinionDeath', '_necroRaiseMinion', '_necroMinionTotalDmg', '_necroMinionAbsorbDamage',
  '_isNecroActiveUnlocked', '_hasNecroMetaUpgrade', 'strengthenMinionAction', 'corpseExplosionAction',
  '_corpseExplosionOuterRingTiles', '_damageEnemyFromCorpseExplosion', '_executeCorpseExplosion', '_consumeCorpseExplosionSource',
  '_refreshNecroActiveHud',
  // vampire
  '_refreshVampireHud', '_isDarkEyesEnemyTileType', '_vampireDrainKillPresentationThenResolve', '_vampireDrainSlimeSplitPresentation',
  '_runVampireDrainPresentationChain', '_vampireDarkEyesRoll', '_vampireCorruptedBloodAndDarkEyes', '_finalizeVampireDrainKill',
  '_bloodTitheHpCost', '_bloodTitheManaGain', 'bloodTitheAction', 'mistFormAction', '_bloodPactManaCost', 'bloodPactAction',
  'getBloodPactBreakdown', 'getBloodTitheBreakdown',
]

function removeFn(source, name) {
  const re = new RegExp(`\\nfunction ${name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\([^)]*\\)\\s*\\{`, 'm')
  const m = re.exec(source)
  if (!m) return { source, removed: false }
  let i = m.index + m[0].length
  let depth = 1
  while (i < source.length && depth > 0) {
    if (source[i] === '{') depth++
    else if (source[i] === '}') depth--
    i++
  }
  // also remove trailing blank line
  let end = i
  while (end < source.length && source[end] === '\n') end++
  return { source: source.slice(0, m.index) + source.slice(end), removed: true }
}

let src = fs.readFileSync(gcPath, 'utf8')
let removed = 0
for (const fn of REMOVE_FNS) {
  const r = removeFn(src, fn)
  if (r.removed) removed++
  src = r.source
}
console.log(`Removed ${removed}/${REMOVE_FNS.length} functions`)

const heroImports = `import * as Warrior from '../heroes/warrior.js'
import * as Ranger from '../heroes/ranger.js'
import * as Mage from '../heroes/mage.js'
import * as Engineer from '../heroes/engineer.js'
import * as Necromancer from '../heroes/necromancer.js'
import * as Vampire from '../heroes/vampire.js'
`

if (!src.includes("from '../heroes/warrior.js'")) {
  src = src.replace(
    "import * as InventoryController from '../controllers/InventoryController.js'",
    `import * as InventoryController from '../controllers/InventoryController.js'\n${heroImports}`,
  )
}

const WRAPPER_BLOCK = `
// ── Hero ability ctx + facades (js/heroes/) ───────────────────

function _heroAbilityBaseCtx() {
  return {
    ..._revealCtx(),
    charKey: _charKey,
    isSilenced: _isSilenced,
    stillWaterManaCost: _stillWaterManaCost,
    markStillWaterAbilityUsed: _markStillWaterAbilityUsed,
    tearyExtraCost: _tearyExtraCost,
    isActiveUnlocked: _isActiveUnlocked,
    previewSpellManaCostForUi: _previewSpellManaCostForUi,
    cancelRicochetMode: _cancelRicochetMode,
    cancelArrowBarrageMode: _cancelArrowBarrageMode,
    cancelPoisonArrowShotMode: _cancelPoisonArrowShotMode,
    cancelChainLightningMode: _cancelChainLightningMode,
    cancelTelekineticThrowMode: _cancelTelekineticThrowMode,
    cancelStrengthenMinionMode: _cancelStrengthenMinionMode,
    cancelCorpseExplosionMode: _cancelCorpseExplosionMode,
    cancelEngineerConstructMode: _cancelEngineerConstructMode,
    cancelSpellLanternBlindingForRicochet: _cancelSpellLanternBlindingForRicochet,
    resolveTauntTarget: (tile) => CombatController.resolveTauntTarget(_combatCtx(), tile),
    checkShieldBlock: (tile) => CombatController.checkShieldBlock(_combatCtx(), tile),
    avgMeleeDamage: () => Warrior.avgMeleeDamage(_warriorCtx()),
  }
}

function _warriorCtx() {
  return { ..._heroAbilityBaseCtx() }
}

function _rangerCtx() {
  return {
    ..._heroAbilityBaseCtx(),
    isRangerActiveUnlocked: (k) => Ranger.isRangerActiveUnlocked(k),
    rangerActiveDamageMult: (k) => Ranger.rangerActiveDamageMult(k),
  }
}

function _mageCtx() {
  return {
    ..._heroAbilityBaseCtx(),
    isMageActiveUnlocked: (k) => Mage.isMageActiveUnlocked(k),
    mageActiveDamageMult: (k) => Mage.mageActiveDamageMult(k),
    refreshMageHud: () => Mage.refreshMageHud(_mageCtx()),
    lifeTapHpCost: () => Mage.lifeTapHpCost(),
    lifeTapMpGain: () => Mage.lifeTapMpGain(),
    manaShieldAbsorptionRate: () => Mage.manaShieldAbsorptionRate(),
    manaShieldDrainRatio: () => Mage.manaShieldDrainRatio(),
    previewSpellManaCostForUi: () => Mage.previewSpellManaCostForUi(_mageCtx()),
    chainLightningDamagePerZap: () => Mage.chainLightningDamagePerZap(_mageCtx()),
    telekineticThrowDamage: () => Mage.telekineticThrowDamage(_mageCtx()),
    pickRandomDistinct: Mage.pickRandomDistinct,
    isTelekineticThrowDestination: (t) => Mage.isTelekineticThrowDestination(t),
    isTelekineticThrowEnemyTarget: (t) => Mage.isTelekineticThrowEnemyTarget(t),
    patchActiveTileDom: _patchActiveTileDom,
    recomputeSubFloorEnemyLocks: _recomputeSubFloorEnemyLocks,
    die: _die,
  }
}

function _engineerCtx() {
  return {
    ..._heroAbilityBaseCtx(),
    isEngineerUpgradeUnlocked: (id) => Engineer.isEngineerUpgradeUnlocked(id),
    engineerTurretMaxHp: Engineer.engineerTurretMaxHp,
    engineerTurretDamage: Engineer.engineerTurretDamage,
    teslaStacks: Engineer.teslaStacks,
    teslaRadius: Engineer.teslaRadius,
    teslaArcChance: Engineer.teslaArcChance,
    inTeslaPerimeter: Engineer.inTeslaPerimeter,
    syncTurretVisual: Engineer.syncTurretVisual,
    destroyTurret: () => Engineer.destroyTurret(_engineerCtx()),
    damageTurretFromEnemyHit: (a, b) => Engineer.damageTurretFromEnemyHit(_engineerCtx(), a, b),
    refreshEngineerHud: () => Engineer.refreshEngineerHud(_engineerCtx()),
    echoCharmCategoryForTileType: _echoCharmCategoryForTileType,
    computeEffectiveDamageTaken: _computeEffectiveDamageTaken,
    onTileTap,
    onTileHold,
    refreshMainGridDomFromModel: _refreshMainGridDomFromModel,
    syncGridDomClassesFromModel: _syncGridDomClassesFromModel,
  }
}

function _necroCtx() {
  return {
    ..._heroAbilityBaseCtx(),
    isNecroActiveUnlocked: (k) => Necromancer.isNecroActiveUnlocked(k),
    hasNecroMetaUpgrade: Necromancer.hasNecroMetaUpgrade,
    echoCharmCategoryForTileType: _echoCharmCategoryForTileType,
    refreshMainGridDomFromModel: _refreshMainGridDomFromModel,
    syncGridDomClassesFromModel: _syncGridDomClassesFromModel,
    onTileTap,
    onTileHold,
    syncMinionVisual: Necromancer.syncMinionVisual,
    necroClearAshAfterMinionDeath: (r, c) => Necromancer.necroClearAshAfterMinionDeath(_necroCtx(), r, c),
  }
}

function _vampireCtx() {
  return {
    ..._heroAbilityBaseCtx(),
    applyTearyEyes: _applyTearyEyes,
    telemetryBumpDamageTaken: _telemetryBumpDamageTaken,
    telemetryBumpDamageSource: _telemetryBumpDamageSource,
    telemetryBumpDamageDealt: _telemetryBumpDamageDealt,
    echoCharmCategoryForTileType: _echoCharmCategoryForTileType,
    finalizeVampireDrainKill: (t, d) => Vampire.finalizeVampireDrainKill(_vampireCtx(), t, d),
    vampireDrainKillPresentationThenResolve: (t, d, cb) => Vampire.vampireDrainKillPresentationThenResolve(_vampireCtx(), t, d, cb),
    vampireDrainSlimeSplitPresentation: (t, hp, cb) => Vampire.vampireDrainSlimeSplitPresentation(_vampireCtx(), t, hp, cb),
    runVampireDrainPresentationChain: (e, i, h) => Vampire.runVampireDrainPresentationChain(_vampireCtx(), e, i, h),
    vampireDarkEyesRoll: (t) => Vampire.vampireDarkEyesRoll(_vampireCtx(), t),
    isDarkEyesEnemyTileType: Vampire.isDarkEyesEnemyTileType,
    bloodTitheHpCost: Vampire.bloodTitheHpCost,
    bloodTitheManaGain: Vampire.bloodTitheManaGain,
    bloodPactManaCost: Vampire.bloodPactManaCost,
  }
}

function slamAction() { Warrior.slamAction(_warriorCtx()) }
function blindingLightAction() { Warrior.blindingLightAction(_warriorCtx()) }
function divineLightAction() { Warrior.divineLightAction(_warriorCtx()) }
function divineLightHealAction() { Warrior.divineLightHealAction(_warriorCtx()) }
function getSlamDamageBreakdown() { return Warrior.getSlamDamageBreakdown(_warriorCtx()) }
function getDivineLightBreakdown() { return Warrior.getDivineLightBreakdown(_warriorCtx()) }
function getBlindingLightBreakdown() { return Warrior.getBlindingLightBreakdown(_warriorCtx()) }
const _castBlindingLight = (t) => Warrior.castBlindingLight(_warriorCtx(), t)
const _castDivineLightSmite = (t) => Warrior.castDivineLightSmite(_warriorCtx(), t)
const _paladinKillEchoAddMarksAfterKill = (t) => Warrior.paladinKillEchoAddMarksAfterKill(t)
const _paladinKillEchoApplyMarks = (r, c, n) => Warrior.paladinKillEchoApplyMarks(r, c, n)
const _paladinKillEchoClearMarks = () => Warrior.paladinKillEchoClearMarks()
const _hemorrhageBurst = (t) => Warrior.hemorrhageBurst(_warriorCtx(), t)
const _refreshAllEnemyStatusDisplays = () => Warrior.refreshAllEnemyStatusDisplays(_warriorCtx())

function ricochetAction() { Ranger.ricochetAction(_rangerCtx()) }
function arrowBarrageAction() { Ranger.arrowBarrageAction(_rangerCtx()) }
function poisonArrowShotAction() { Ranger.poisonArrowShotAction(_rangerCtx()) }
function getRicochetBreakdown() { return Ranger.getRicochetBreakdown(_rangerCtx()) }
function getArrowBarrageBreakdown() { return Ranger.getArrowBarrageBreakdown(_rangerCtx()) }
function getPoisonArrowShotBreakdown() { return Ranger.getPoisonArrowShotBreakdown(_rangerCtx()) }
const _isRangerActiveUnlocked = (k) => Ranger.isRangerActiveUnlocked(k)
const _refreshRangerActiveHud = () => Ranger.refreshRangerActiveHud(_rangerCtx())
const _executeRicochet = () => Ranger.executeRicochet(_rangerCtx())
const _executeTripleVolley = (c) => Ranger.executeTripleVolley(_rangerCtx(), c)
const _executePoisonArrowShot = (t) => Ranger.executePoisonArrowShot(_rangerCtx(), t)
const _poisonArrowUnitDamage = () => Ranger.poisonArrowUnitDamage(_rangerCtx())

function spellAction() { Mage.spellAction(_mageCtx()) }
function chainLightningAction() { Mage.chainLightningAction(_mageCtx()) }
function telekineticThrowAction() { Mage.telekineticThrowAction(_mageCtx()) }
function manaShieldAction() { Mage.manaShieldAction(_mageCtx()) }
function lifeTapAction() { Mage.lifeTapAction(_mageCtx()) }
function getChainLightningBreakdown() { return Mage.getChainLightningBreakdown(_mageCtx()) }
function getTelekineticThrowBreakdown() { return Mage.getTelekineticThrowBreakdown(_mageCtx()) }
const _isMageActiveUnlocked = (k) => Mage.isMageActiveUnlocked(k)
const _refreshMageHud = () => Mage.refreshMageHud(_mageCtx())
const _mageLifeTapOnFlip = (el) => Mage.mageLifeTapOnFlip(_mageCtx(), el)
const _castSpell = (t) => Mage.castSpell(_mageCtx(), t)
const _executeChainLightning = (p) => Mage.executeChainLightning(_mageCtx(), p)
const _executeTelekineticThrow = (o, d) => Mage.executeTelekineticThrow(_mageCtx(), o, d)
const _isTelekineticThrowEnemyTarget = (t) => Mage.isTelekineticThrowEnemyTarget(t)
const _isTelekineticThrowDestination = (t) => Mage.isTelekineticThrowDestination(t)
const _manaShieldAbsorptionRate = () => Mage.manaShieldAbsorptionRate()
const _manaShieldDrainRatio = () => Mage.manaShieldDrainRatio()
const _lifeTapHpCost = () => Mage.lifeTapHpCost()
const _lifeTapMpGain = () => Mage.lifeTapMpGain()

function constructTurretAction() { Engineer.constructTurretAction(_engineerCtx()) }
function teslaTowerAction() { Engineer.teslaTowerAction(_engineerCtx()) }
function manaGeneratorAction() { Engineer.manaGeneratorAction(_engineerCtx()) }
const _isEngineerUpgradeUnlocked = (id) => Engineer.isEngineerUpgradeUnlocked(id)
const _engineerTurretMaxHp = Engineer.engineerTurretMaxHp
const _engineerTurretDamage = Engineer.engineerTurretDamage
const _teslaRadius = () => Engineer.teslaRadius()
const _inTeslaPerimeter = (tr, t) => Engineer.inTeslaPerimeter(tr, t)
const _turretDeployedOnTile = (t) => Engineer.turretDeployedOnTile(t)
const _syncTurretVisual = (c) => Engineer.syncTurretVisual(c)
const _engineerTurretAfterReveal = (t) => Engineer.engineerTurretAfterReveal(_engineerCtx(), t)
const _engineerManaGeneratorOnReveal = (el) => Engineer.engineerManaGeneratorOnReveal(_engineerCtx(), el)
const _handleEngineerConstructTileTap = (t) => Engineer.handleEngineerConstructTileTap(_engineerCtx(), t)
const _refreshEngineerHud = () => Engineer.refreshEngineerHud(_engineerCtx())
const _damageTurretFromEnemyHit = (a, b) => Engineer.damageTurretFromEnemyHit(_engineerCtx(), a, b)

function strengthenMinionAction() { Necromancer.strengthenMinionAction(_necroCtx()) }
function corpseExplosionAction() { Necromancer.corpseExplosionAction(_necroCtx()) }
const _necroRaiseMinion = (t) => Necromancer.necroRaiseMinion(_necroCtx(), t)
const _necroMinionTotalDmg = () => Necromancer.necroMinionTotalDmg()
const _necroMinionAbsorbDamage = (a, b, c) => Necromancer.necroMinionAbsorbDamage(_necroCtx(), a, b, c)
const _refreshNecroActiveHud = () => Necromancer.refreshNecroActiveHud(_necroCtx())
const _executeCorpseExplosion = (t) => Necromancer.executeCorpseExplosion(_necroCtx(), t)
const _hasNecroMetaUpgrade = Necromancer.hasNecroMetaUpgrade

function bloodTitheAction() { Vampire.bloodTitheAction(_vampireCtx()) }
function mistFormAction() { Vampire.mistFormAction(_vampireCtx()) }
function bloodPactAction() { Vampire.bloodPactAction(_vampireCtx()) }
function getBloodTitheBreakdown() { return Vampire.getBloodTitheBreakdown(_vampireCtx()) }
function getBloodPactBreakdown() { return Vampire.getBloodPactBreakdown(_vampireCtx()) }
const _refreshVampireHud = () => Vampire.refreshVampireHud(_vampireCtx())
const _vampireCorruptedBloodAndDarkEyes = (t) => Vampire.vampireCorruptedBloodAndDarkEyes(_vampireCtx(), t)
`

if (!src.includes('_heroAbilityBaseCtx')) {
  src = src.replace(
    'function _combatCtx() {',
    `${WRAPPER_BLOCK}\nfunction _combatCtx() {`,
  )
}

// Update export for stack getters
src = src.replace(
  "getManaShieldStacks: () => session.run?.player?.mageActiveStacks?.['mana-shield'] ?? 0,",
  'getManaShieldStacks: Mage.getManaShieldStacks,',
)
src = src.replace(
  "getLifeTapStacks: () => session.run?.player?.mageActiveStacks?.['life-tap'] ?? 0,",
  'getLifeTapStacks: Mage.getLifeTapStacks,',
)

fs.writeFileSync(gcPath, src)
console.log('Patched GameController.js')
