/**
 * Extract hero ability functions from GameController.js into js/heroes/ modules.
 * Run: node scripts/extract-heroes-phase4.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const gcPath = path.join(ROOT, 'js/core/GameController.js')
const src = fs.readFileSync(gcPath, 'utf8')

/** Extract function body including `function name(...) { ... }` by brace matching. */
function extractFn(source, name) {
  const re = new RegExp(`function ${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\([^)]*\\)\\s*\\{`, 'm')
  const m = re.exec(source)
  if (!m) return null
  let i = m.index + m[0].length
  let depth = 1
  while (i < source.length && depth > 0) {
    const ch = source[i]
    if (ch === '{') depth++
    else if (ch === '}') depth--
    i++
  }
  return source.slice(m.index, i)
}

const HERO_EXPORTS = {
  warrior: [
    'isKillEchoHiddenEnemyTile', 'paladinKillEchoClearMarks', 'paladinKillEchoStripMarkFromTile',
    'paladinKillEchoMarkedHiddenCount', 'paladinKillEchoMarkNewClosest', 'paladinKillEchoApplyMarks',
    'paladinKillEchoAddMarksAfterKill',
    'slamAction', 'slamBranchAftereffect', 'slamSeismicReveal', 'refreshAllEnemyStatusDisplays', 'hemorrhageBurst',
    'blindingLightAction', 'castBlindingLight', 'blindingBranchAftereffect', 'blindingRevelationReveal',
    'divineLightAction', 'divineLightHealAction', 'castDivineLightSmite',
    'getSlamDamageBreakdown', 'getDivineLightBreakdown', 'getBlindingLightBreakdown',
    'avgMeleeDamage', 'slamMultFromStacks', 'blindingLightMultFromStacks', 'blindingLightStunTurns', 'slamDamagePerTarget',
  ],
  ranger: [
    'ricochetAction', 'executeRicochet', 'arrowBarrageAction', 'tripleVolleyDamagePerEnemy', 'tilesIn3x3', 'executeTripleVolley',
    'poisonArrowShotAction', 'executePoisonArrowShot', 'poisonArrowUnitDamage',
    'refreshRangerActiveHud', 'isRangerActiveUnlocked', 'rangerActiveDamageMult',
    'getRicochetBreakdown', 'getArrowBarrageBreakdown', 'getPoisonArrowShotBreakdown',
    'hasRicochetArcMasteryMeta', 'ricochetDamageSequence',
  ],
  mage: [
    'spellAction', 'castSpell', 'chainLightningAction', 'chainLightningDamagePerZap', 'getChainLightningBreakdown',
    'executeChainLightning', 'pickRandomDistinct', 'telekineticThrowAction', 'getTelekineticThrowBreakdown',
    'telekineticThrowDamage', 'isTelekineticThrowDestination', 'isTelekineticThrowEnemyTarget', 'executeTelekineticThrow',
    'manaShieldAction', 'lifeTapAction', 'mageLifeTapOnFlip', 'getLifeTapStacks', 'getManaShieldStacks',
    'isMageActiveUnlocked', 'mageActiveDamageMult', 'manaShieldAbsorptionRate', 'manaShieldDrainRatio',
    'lifeTapHpCost', 'lifeTapMpGain', 'refreshMageHud', 'previewSpellManaCostForUi',
  ],
  engineer: [
    'isEngineerUpgradeUnlocked', 'engineerTurretMaxHp', 'engineerTurretDamage', 'teslaStacks', 'teslaRadius',
    'teslaArcChance', 'inTeslaPerimeter', 'turretDeployedOnTile', 'syncTurretVisual', 'destroyTurret',
    'damageTurretFromEnemyHit', 'engineerSeismicPingTargetTiles', 'engineerTurretSeismicPing', 'engineerTurretAfterReveal',
    'handleEngineerConstructTileTap', 'constructTurretAction', 'teslaTowerAction', 'manaGeneratorAction',
    'engineerManaGeneratorOnReveal', 'refreshEngineerHud',
  ],
  necromancer: [
    'getMinionMaxHp', 'getMinionDmg', 'syncMinionVisual', 'syncAllMinionVisuals', 'clearMinionVisuals',
    'necroClearAshAfterMinionDeath', 'necroRaiseMinion', 'necroMinionTotalDmg', 'necroMinionAbsorbDamage',
    'isNecroActiveUnlocked', 'hasNecroMetaUpgrade', 'strengthenMinionAction', 'corpseExplosionAction',
    'corpseExplosionOuterRingTiles', 'damageEnemyFromCorpseExplosion', 'executeCorpseExplosion', 'consumeCorpseExplosionSource',
    'refreshNecroActiveHud',
  ],
  vampire: [
    'refreshVampireHud', 'isDarkEyesEnemyTileType', 'vampireDrainKillPresentationThenResolve', 'vampireDrainSlimeSplitPresentation',
    'runVampireDrainPresentationChain', 'vampireDarkEyesRoll', 'vampireCorruptedBloodAndDarkEyes', 'finalizeVampireDrainKill',
    'bloodTitheHpCost', 'bloodTitheManaGain', 'bloodTitheAction', 'mistFormAction', 'bloodPactManaCost', 'bloodPactAction',
    'getBloodPactBreakdown', 'getBloodTitheBreakdown',
  ],
}

const GC_CTX_RE = /^_(?!nextMinionId)([a-zA-Z][a-zA-Z0-9]*)\(/gm

function transformBody(body, heroName) {
  let out = body
  // function _foo -> export function foo (public) or function foo (internal)
  out = out.replace(/^function (_?[a-zA-Z][a-zA-Z0-9]*)\(/gm, (match, fnName) => {
    const bare = fnName.startsWith('_') ? fnName.slice(1) : fnName
    const isPublic = !fnName.startsWith('_') || HERO_EXPORTS[heroName]?.includes(bare)
    return isPublic ? `export function ${bare}(` : `function ${bare}(`
  })
  // _foo( -> ctx.foo(  (GameController deps)
  out = out.replace(GC_CTX_RE, (match, name) => {
    if (HERO_EXPORTS[heroName]?.includes(name)) return match.replace('_', '')
    return `ctx.${name}(`
  })
  // _charKey( -> charKey(
  out = out.replace(/_charKey\(/g, 'charKey(')
  return out
}

const IMPORTS = {
  warrior: `import { CONFIG } from '../config.js'
import EventBus from '../core/EventBus.js'
import TileEngine from '../systems/TileEngine.js'
import CombatResolver from '../systems/CombatResolver.js'
import UI from '../ui/UI.js'
import { WARRIOR_UPGRADES } from '../data/upgrades.js'
import { session, charKey } from '../core/RunContext.js'
`,
  ranger: `import { CONFIG } from '../config.js'
import EventBus from '../core/EventBus.js'
import UI from '../ui/UI.js'
import { RANGER_UPGRADES } from '../data/ranger.js'
import { session, charKey } from '../core/RunContext.js'
`,
  mage: `import { CONFIG } from '../config.js'
import GameState, { States } from '../core/GameState.js'
import EventBus from '../core/EventBus.js'
import TileEngine from '../systems/TileEngine.js'
import CombatResolver from '../systems/CombatResolver.js'
import UI from '../ui/UI.js'
import { MAGE_UPGRADES } from '../data/mage.js'
import { session, charKey } from '../core/RunContext.js'

const MSG_COMBAT_ACTION_BLOCKED = 'Cannot perform action when in combat with enemy'
`,
  engineer: `import GameState, { States } from '../core/GameState.js'
import EventBus from '../core/EventBus.js'
import TileEngine from '../systems/TileEngine.js'
import UI from '../ui/UI.js'
import { ENGINEER_BASE, ENGINEER_UPGRADES, ENGINEER_TURRET, ENGINEER_CONSTRUCT_MANA_COST, ENGINEER_MOVE_MANA_COST, ENGINEER_SEISMIC_PING } from '../data/engineer.js'
import { session, charKey } from '../core/RunContext.js'

const MSG_COMBAT_ACTION_BLOCKED = 'Cannot perform action when in combat with enemy'
`,
  necromancer: `import EventBus from '../core/EventBus.js'
import TileEngine from '../systems/TileEngine.js'
import UI from '../ui/UI.js'
import {
  NECROMANCER_MINION,
  RAISE_MINION_COST,
  STRENGTHEN_MINION_COST,
  STRENGTHEN_MINION_HP_GAIN,
  CORPSE_EXPLOSION_COST,
  CORPSE_EXPLOSION_DAMAGE,
  DETONATION_CHAIN_EXTRA_COST,
  NECROMANCER_UPGRADES,
} from '../data/necromancer.js'
import { session, charKey } from '../core/RunContext.js'
`,
  vampire: `import GameState, { States } from '../core/GameState.js'
import EventBus from '../core/EventBus.js'
import TileEngine from '../systems/TileEngine.js'
import UI from '../ui/UI.js'
import { VAMPIRE_BASE, VAMPIRE_DARK_EYES_MAX_TILES, VAMPIRE_UPGRADES } from '../data/vampire.js'
import { session, charKey } from '../core/RunContext.js'
`,
}

for (const [hero, fns] of Object.entries(HERO_EXPORTS)) {
  const parts = []
  const missing = []
  for (const fn of fns) {
    const gcName = fn.startsWith('_') ? fn : (['slamAction', 'ricochetAction', 'spellAction', 'constructTurretAction', 'bloodTitheAction', 'strengthenMinionAction'].includes(fn) ? fn : `_${fn}`)
    const searchName = fn.match(/^[A-Z]/) ? fn : (src.includes(`function _${fn}(`) ? `_${fn}` : fn)
    const raw = extractFn(src, searchName) ?? extractFn(src, fn.startsWith('_') ? fn.slice(1) : fn)
    if (!raw) {
      missing.push(fn)
      continue
    }
    parts.push(transformBody(raw, hero))
  }
  if (missing.length) console.warn(`${hero}: missing functions:`, missing.join(', '))
  const outPath = path.join(ROOT, 'js/heroes', `${hero}.js`)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, `${IMPORTS[hero]}\n${parts.join('\n\n')}\n`)
  console.log(`Wrote ${outPath} (${parts.length} functions)`)
}
