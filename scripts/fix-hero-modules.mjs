/**
 * Post-process extracted hero modules v2.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const heroesDir = path.join(ROOT, 'js/heroes')

const GC_CTX_FUNCS = new Set([
  'isSilenced', 'stillWaterManaCost', 'markStillWaterAbilityUsed', 'tearyExtraCost',
  'getActiveTiles', 'getActiveTileRows', 'getActiveTileAt', 'getActiveOrthogonal',
  'suspendCombatEngagementForMultiTargetAbility', 'restoreCombatEngagementAfterMultiTargetAbility',
  'scaleOutgoingDamageToEnemy', 'gainGold', 'gainXP', 'endCombatVictory', 'rand',
  'markReachableUi', 'syncGridDomClassesFromModel', 'checkOnionLayer',
  'canAttackEnemy', 'isCombatCommitmentLocked', 'isActiveUnlocked',
  'cancelRicochetMode', 'cancelArrowBarrageMode', 'cancelPoisonArrowShotMode',
  'cancelChainLightningMode', 'cancelTelekineticThrowMode', 'cancelStrengthenMinionMode',
  'cancelCorpseExplosionMode', 'cancelEngineerConstructMode', 'cancelSpellLanternBlindingForRicochet',
  'previewSpellManaCostForUi', 'resolveTauntTarget', 'checkShieldBlock', 'die',
  'saveActiveRun', 'patchActiveTileDom', 'recomputeSubFloorEnemyLocks', 'isInSubFloor',
  'playerDamageRange', 'echoCharmCategoryForTileType',
  'computeEffectiveDamageTaken', 'telemetryBumpDamageTaken', 'telemetryBumpDamageSource',
  'applyTearyEyes', 'refreshMainGridDomFromModel', 'onTileTap', 'onTileHold',
  'inTeslaPerimeter', 'teslaRadius', 'engineerTurretDamage', 'takeDamage',
  'syncTurretVisual', 'damageTurretFromEnemyHit', 'destroyTurret',
  'avgMeleeDamage',
])

function localFnNames(source) {
  const names = new Set()
  for (const m of source.matchAll(/(?:export )?function ([a-zA-Z][a-zA-Z0-9]*)\(/g)) names.add(m[1])
  return names
}

function fixCalls(source, locals) {
  return source.replace(/_([a-zA-Z][a-zA-Z0-9]*)\(/g, (match, name) => {
    if (locals.has(name)) return `${name}(`
    if (GC_CTX_FUNCS.has(name)) return `ctx.${name}(`
    return match
  })
}

function addCtxParamToFunctions(source) {
  const fnRe = /(export )?function ([a-zA-Z][a-zA-Z0-9]*)\(([^)]*)\)/g
  let result = ''
  let last = 0
  let m
  while ((m = fnRe.exec(source)) !== null) {
    result += source.slice(last, m.index)
    const [, exp, name, params] = m
    const bodyStart = fnRe.lastIndex
    let i = bodyStart
    while (i < source.length) {
      if (source[i] === '{') { i++; break }
      i++
    }
    let bodyEnd = i
    let depth = 1
    while (bodyEnd < source.length && depth > 0) {
      if (source[bodyEnd] === '{') depth++
      else if (source[bodyEnd] === '}') depth--
      bodyEnd++
    }
    const body = source.slice(i, bodyEnd - 1)
    const usesCtx = body.includes('ctx.')
    let newParams = params.trim()
    if (usesCtx && !newParams.startsWith('ctx')) {
      newParams = newParams ? `ctx, ${newParams}` : 'ctx'
    }
    result += `${exp || ''}function ${name}(${newParams})`
    last = fnRe.lastIndex
  }
  result += source.slice(last)
  return result
}

function fixInternalCallsWithCtx(source) {
  const fnSig = new Map()
  for (const m of source.matchAll(/(?:export )?function ([a-zA-Z][a-zA-Z0-9]*)\(([^)]*)\)/g)) {
    fnSig.set(m[1], m[2].trim().startsWith('ctx'))
  }
  for (const [name, needsCtx] of fnSig) {
    if (!needsCtx) continue
    const callRe = new RegExp(`(?<![.a-zA-Z])${name}\\(`, 'g')
    source = source.replace(callRe, (match, offset) => {
      const after = source.slice(offset + name.length + 1, offset + name.length + 5)
      if (after.startsWith('ctx')) return match
      return `${name}(ctx, `
    })
  }
  return source
}

for (const f of fs.readdirSync(heroesDir).filter(f => f.endsWith('.js'))) {
  const fp = path.join(heroesDir, f)
  let src = fs.readFileSync(fp, 'utf8')
  const locals = localFnNames(src)
  src = fixCalls(src, locals)
  src = addCtxParamToFunctions(src)
  src = fixInternalCallsWithCtx(src)
  fs.writeFileSync(fp, src)
  console.log('Fixed', f)
}
