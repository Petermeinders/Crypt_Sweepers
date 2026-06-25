import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import ProgressionSystem from '../../js/systems/ProgressionSystem.js'
import { WARRIOR_ABILITIES } from '../../js/data/abilities.js'
import { RANGER_ABILITIES } from '../../js/data/ranger.js'
import { ENGINEER_ABILITIES } from '../../js/data/engineer.js'
import { MAGE_ABILITIES } from '../../js/data/mage.js'
import { NECROMANCER_ABILITIES } from '../../js/data/necromancer.js'
import { VAMPIRE_MASTERY_ABILITIES } from '../../js/data/vampire.js'
import { HERO_ABILITY_SLOTS, abilityForSlot } from '../../js/heroes/HeroAbilityRegistry.js'

function freshPlayer() {
  return {
    hp: 50, maxHp: 50,
    mana: 30, maxMana: 30,
    gold: 0, damageBonus: 0, damageReduction: 0,
    abilities: [], unlockedActives: [],
  }
}

describe('Warrior ability effects', () => {
  test('vitality: +5 maxHp and heals 5', () => {
    const p = freshPlayer()
    const kind = ProgressionSystem.applyAbility('vitality', p, 'warrior')
    assert.equal(kind, 'buff-hp'); assert.equal(p.maxHp, 55); assert.equal(p.hp, 55)
  })
  test('slam-mastery-1: increments slamMasteryStacks', () => {
    const p = freshPlayer(); p.unlockedActives = ['slam']
    const kind = ProgressionSystem.applyAbility('slam-mastery-1', p, 'warrior')
    assert.equal(kind, 'slam-mult-bonus'); assert.equal(p.slamMasteryStacks, 1)
  })
  test('slam-hemorrhage-1: sets slamBranch to hemorrhage tier 1', () => {
    const p = freshPlayer(); p.unlockedActives = ['slam']
    const kind = ProgressionSystem.applyAbility('slam-hemorrhage-1', p, 'warrior')
    assert.equal(kind, 'slam-branch'); assert.equal(p.slamBranch.name, 'hemorrhage'); assert.equal(p.slamBranch.tier, 1)
  })
  test('blinding-expertise-1: increments blindingLightMasteryStacks', () => {
    const p = freshPlayer(); p.unlockedActives = ['blinding-light']
    const kind = ProgressionSystem.applyAbility('blinding-expertise-1', p, 'warrior')
    assert.equal(kind, 'blinding-mult-bonus'); assert.equal(p.blindingLightMasteryStacks, 1)
  })
  test('divine-light-mastery-1: stacks warriorActiveStacks[divine-light]', () => {
    const p = freshPlayer(); p.unlockedActives = ['divine-light']
    const kind = ProgressionSystem.applyAbility('divine-light-mastery-1', p, 'warrior')
    assert.equal(kind, 'warrior-active-mastery'); assert.equal(p.warriorActiveStacks?.['divine-light'], 1)
  })
  test('all warrior abilities record to player.abilities', () => {
    const p = freshPlayer()
    p.unlockedActives = ['slam', 'blinding-light', 'divine-light']
    p.abilities = ['slam-mastery-1','slam-mastery-2','slam-hemorrhage-1','slam-hemorrhage-2','slam-seismic-1','slam-seismic-2','slam-reverberation-1','slam-reverberation-2','blinding-expertise-1','blinding-expertise-2','blinding-solarflare-1','blinding-solarflare-2','blinding-revelation-1','blinding-revelation-2','divine-light-mastery-1','divine-light-mastery-2']
    for (const id of Object.keys(WARRIOR_ABILITIES)) {
      const pCopy = { ...p, abilities: [...p.abilities] }
      ProgressionSystem.applyAbility(id, pCopy, 'warrior')
      assert.ok(pCopy.abilities.includes(id), `warrior ability '${id}' missing from player.abilities`)
    }
  })
})

describe('Ranger ability effects', () => {
  test('trapfinder: increments trapfinderStacks', () => {
    const p = freshPlayer()
    const kind = ProgressionSystem.applyAbility('trapfinder', p, 'ranger')
    assert.equal(kind, 'trapfinder-stack'); assert.equal(p.trapfinderStacks, 1)
  })
  test('ricochet-mastery-1: increments rangerActiveStacks[ricochet]', () => {
    const p = freshPlayer(); p.unlockedActives = ['ricochet']
    const kind = ProgressionSystem.applyAbility('ricochet-mastery-1', p, 'ranger')
    assert.equal(kind, 'ranger-active-mastery'); assert.equal(p.rangerActiveStacks?.['ricochet'], 1)
  })
  test('arrow-barrage-mastery-1: increments rangerActiveStacks[arrow-barrage]', () => {
    const p = freshPlayer(); p.unlockedActives = ['arrow-barrage']
    const kind = ProgressionSystem.applyAbility('arrow-barrage-mastery-1', p, 'ranger')
    assert.equal(kind, 'ranger-active-mastery'); assert.equal(p.rangerActiveStacks?.['arrow-barrage'], 1)
  })
  test('all ranger abilities record to player.abilities', () => {
    const p = freshPlayer()
    p.unlockedActives = ['ricochet', 'poison-arrow-shot', 'arrow-barrage']
    p.abilities = ['ricochet-mastery-1','ricochet-mastery-2','poison-arrow-shot-mastery-1','poison-arrow-shot-mastery-2','arrow-barrage-mastery-1','arrow-barrage-mastery-2']
    for (const id of Object.keys(RANGER_ABILITIES)) {
      const pCopy = { ...p, abilities: [...p.abilities] }
      ProgressionSystem.applyAbility(id, pCopy, 'ranger')
      assert.ok(pCopy.abilities.includes(id), `ranger '${id}' missing`)
    }
  })
})

describe('Engineer ability effects', () => {
  test('turret-mastery-1: sets turretMaxLevel to 2', () => {
    const p = freshPlayer(); p.unlockedActives = ['construct-turret']
    const kind = ProgressionSystem.applyAbility('turret-mastery-1', p, 'engineer')
    assert.equal(kind, 'turret-max-level'); assert.equal(p.turretMaxLevel, 2)
  })
  test('turret-mastery-3: sets turretKillHeal flag', () => {
    const p = freshPlayer(); p.unlockedActives = ['construct-turret']
    p.abilities = ['turret-mastery-1','turret-mastery-2']
    const kind = ProgressionSystem.applyAbility('turret-mastery-3', p, 'engineer')
    assert.equal(kind, 'turret-kill-heal'); assert.equal(p.turretKillHeal, true)
  })
  test('mana-generator-mastery-1: increments manaGeneratorMasteryStacks', () => {
    const p = freshPlayer(); p.unlockedActives = ['mana-generator']
    const kind = ProgressionSystem.applyAbility('mana-generator-mastery-1', p, 'engineer')
    assert.equal(kind, 'mana-generator-mastery'); assert.equal(p.manaGeneratorMasteryStacks, 1)
  })
  test('tesla-tower-mastery-1: increments engineerActiveStacks[tesla-tower]', () => {
    const p = freshPlayer(); p.unlockedActives = ['tesla-tower']
    const kind = ProgressionSystem.applyAbility('tesla-tower-mastery-1', p, 'engineer')
    assert.equal(kind, 'engineer-active-mastery'); assert.equal(p.engineerActiveStacks?.['tesla-tower'], 1)
  })
  test('tesla-superconduction-1: sets teslaSuperconductionTier to 1', () => {
    const p = freshPlayer(); p.unlockedActives = ['tesla-tower']; p.abilities = ['tesla-tower-mastery-1']
    const kind = ProgressionSystem.applyAbility('tesla-superconduction-1', p, 'engineer')
    assert.equal(kind, 'tesla-superconduction'); assert.equal(p.teslaSuperconductionTier, 1)
  })
  test('all engineer abilities record to player.abilities', () => {
    const p = freshPlayer()
    p.unlockedActives = ['construct-turret', 'tesla-tower', 'mana-generator']
    p.abilities = ['turret-mastery-1','turret-mastery-2','mana-generator-mastery-1','mana-generator-mastery-2','tesla-tower-mastery-1','tesla-tower-mastery-2','tesla-superconduction-1','tesla-superconduction-2']
    for (const id of Object.keys(ENGINEER_ABILITIES)) {
      const pCopy = { ...p, abilities: [...p.abilities] }
      ProgressionSystem.applyAbility(id, pCopy, 'engineer')
      assert.ok(pCopy.abilities.includes(id), `engineer '${id}' missing`)
    }
  })
})

describe('Mage ability effects', () => {
  test('chain-lightning-mastery-1: increments mageActiveStacks[chain-lightning]', () => {
    const p = freshPlayer(); p.unlockedActives = ['chain-lightning']
    const kind = ProgressionSystem.applyAbility('chain-lightning-mastery-1', p, 'mage')
    assert.equal(kind, 'mage-active-mastery'); assert.equal(p.mageActiveStacks?.['chain-lightning'], 1)
  })
  test('chain-lightning-shocked-1: sets chainLightningShockedTier to 1', () => {
    const p = freshPlayer(); p.unlockedActives = ['chain-lightning']; p.abilities = ['chain-lightning-mastery-1']
    const kind = ProgressionSystem.applyAbility('chain-lightning-shocked-1', p, 'mage')
    assert.equal(kind, 'chain-lightning-shocked'); assert.equal(p.chainLightningShockedTier, 1)
  })
  test('chain-lightning-overload-1: sets chainLightningOverloadTier to 1', () => {
    const p = freshPlayer(); p.unlockedActives = ['chain-lightning']; p.abilities = ['chain-lightning-mastery-1']
    const kind = ProgressionSystem.applyAbility('chain-lightning-overload-1', p, 'mage')
    assert.equal(kind, 'chain-lightning-overload'); assert.equal(p.chainLightningOverloadTier, 1)
  })
  test('telekinetic-gravity-well-1: sets tkGravityWellTier to 1', () => {
    const p = freshPlayer(); p.unlockedActives = ['telekinetic-throw']; p.abilities = ['telekinetic-throw-mastery-1']
    const kind = ProgressionSystem.applyAbility('telekinetic-gravity-well-1', p, 'mage')
    assert.equal(kind, 'telekinetic-gravity-well'); assert.equal(p.tkGravityWellTier, 1)
  })
  test('all mage abilities record to player.abilities', () => {
    const p = freshPlayer()
    p.unlockedActives = ['chain-lightning', 'telekinetic-throw', 'mana-shield', 'life-tap']
    p.abilities = ['chain-lightning-mastery-1','chain-lightning-mastery-2','chain-lightning-shocked-1','chain-lightning-shocked-2','chain-lightning-overload-1','chain-lightning-overload-2','telekinetic-throw-mastery-1','telekinetic-throw-mastery-2','telekinetic-gravity-well-1','telekinetic-gravity-well-2','mana-shield-mastery-1','mana-shield-mastery-2','life-tap-mastery-1','life-tap-mastery-2']
    for (const id of Object.keys(MAGE_ABILITIES)) {
      const pCopy = { ...p, abilities: [...p.abilities] }
      ProgressionSystem.applyAbility(id, pCopy, 'mage')
      assert.ok(pCopy.abilities.includes(id), `mage '${id}' missing`)
    }
  })
})

describe('Necromancer ability effects', () => {
  test('minion-mastery-1: sets minionMasteryLevel to 2', () => {
    const p = freshPlayer()
    const kind = ProgressionSystem.applyAbility('minion-mastery-1', p, 'necromancer')
    assert.equal(kind, 'necro-minion-mastery'); assert.equal(p.minionMasteryLevel, 2)
  })
  test('bone-armor-mastery-1: increments boneArmorStacks', () => {
    const p = freshPlayer(); p.unlockedActives = ['bone-armor']
    const kind = ProgressionSystem.applyAbility('bone-armor-mastery-1', p, 'necromancer')
    assert.equal(kind, 'bone-armor-mastery'); assert.equal(p.boneArmorStacks, 1)
  })
  test('corpse-explosion-abyssal-1: sets corpseExplosionAbyssalTier to 1', () => {
    const p = freshPlayer(); p.unlockedActives = ['corpse-explosion']
    const kind = ProgressionSystem.applyAbility('corpse-explosion-abyssal-1', p, 'necromancer')
    assert.equal(kind, 'corpse-explosion-abyssal'); assert.equal(p.corpseExplosionAbyssalTier, 1)
  })
  test('raise-minion-gargantuan-1: sets minionGargantuanTier to 1', () => {
    const p = freshPlayer()
    const kind = ProgressionSystem.applyAbility('raise-minion-gargantuan-1', p, 'necromancer')
    assert.equal(kind, 'raise-minion-gargantuan'); assert.equal(p.minionGargantuanTier, 1)
  })
  test('all necromancer abilities record to player.abilities', () => {
    const p = freshPlayer()
    p.unlockedActives = ['strengthen-minion', 'bone-armor', 'corpse-explosion']
    p.abilities = ['minion-mastery-1','minion-mastery-2','strengthen-minion-mastery-1','strengthen-minion-mastery-2','bone-armor-mastery-1','bone-armor-mastery-2','corpse-explosion-abyssal-1','corpse-explosion-abyssal-2','corpse-explosion-detonation-1','corpse-explosion-detonation-2','corpse-explosion-essence-drain-1','corpse-explosion-essence-drain-2','raise-minion-legion-1','raise-minion-legion-2','raise-minion-gargantuan-1','raise-minion-gargantuan-2']
    for (const id of Object.keys(NECROMANCER_ABILITIES)) {
      const pCopy = { ...p, abilities: [...p.abilities] }
      ProgressionSystem.applyAbility(id, pCopy, 'necromancer')
      assert.ok(pCopy.abilities.includes(id), `necromancer '${id}' missing`)
    }
  })
})

describe('Vampire ability effects', () => {
  test('blood-tithe-mastery-1: sets bloodTitheMasteryTier to 2', () => {
    const p = freshPlayer(); p.unlockedActives = ['blood-tithe']
    const kind = ProgressionSystem.applyAbility('blood-tithe-mastery-1', p, 'vampire')
    assert.equal(kind, 'blood-tithe-mastery'); assert.equal(p.bloodTitheMasteryTier, 2)
  })
  test('mist-form-mastery-1: increments vampireActiveStacks[mist-form]', () => {
    const p = freshPlayer(); p.unlockedActives = ['mist-form']
    const kind = ProgressionSystem.applyAbility('mist-form-mastery-1', p, 'vampire')
    assert.equal(kind, 'vampire-active-mastery'); assert.equal(p.vampireActiveStacks?.['mist-form'], 1)
  })
  test('blood-pact-dominion-1: sets bloodPactDominionTier to 1', () => {
    const p = freshPlayer(); p.unlockedActives = ['blood-pact']; p.abilities = ['blood-pact-mastery-1']
    const kind = ProgressionSystem.applyAbility('blood-pact-dominion-1', p, 'vampire')
    assert.equal(kind, 'blood-pact-dominion'); assert.equal(p.bloodPactDominionTier, 1)
  })
  test('all vampire mastery abilities record to player.abilities', () => {
    const p = freshPlayer()
    p.unlockedActives = ['blood-tithe', 'mist-form', 'blood-pact']
    p.abilities = ['blood-tithe-mastery-1','blood-tithe-mastery-2','mist-form-mastery-1','mist-form-mastery-2','blood-pact-mastery-1','blood-pact-mastery-2','blood-pact-dominion-1','blood-pact-dominion-2']
    for (const id of Object.keys(VAMPIRE_MASTERY_ABILITIES)) {
      const pCopy = { ...p, abilities: [...p.abilities] }
      ProgressionSystem.applyAbility(id, pCopy, 'vampire')
      assert.ok(pCopy.abilities.includes(id), `vampire '${id}' missing`)
    }
  })
})

describe('HeroAbilityRegistry slot mapping', () => {
  test('all heroes have slots', () => {
    const heroes = ['warrior', 'ranger', 'engineer', 'mage', 'necromancer', 'vampire', 'ninja']
    for (const h of heroes) {
      assert.ok(HERO_ABILITY_SLOTS[h] !== undefined, `missing hero: ${h}`)
      assert.ok(Object.keys(HERO_ABILITY_SLOTS[h]).length >= 1, `${h} no slots`)
    }
  })
  test('warrior slots correct', () => {
    assert.equal(abilityForSlot('warrior', 'slotA'), 'slamAction')
    assert.equal(abilityForSlot('warrior', 'slotB'), 'blindingLightAction')
    assert.equal(abilityForSlot('warrior', 'slotD'), 'divineLightAction')
  })
  test('ranger slots correct', () => {
    assert.equal(abilityForSlot('ranger', 'slotA'), 'ricochetAction')
    assert.equal(abilityForSlot('ranger', 'slotB'), 'poisonArrowShotAction')
    assert.equal(abilityForSlot('ranger', 'slotC'), 'arrowBarrageAction')
  })
  test('mage slots correct', () => {
    assert.equal(abilityForSlot('mage', 'slotA'), 'chainLightningAction')
    assert.equal(abilityForSlot('mage', 'slotB'), 'telekineticThrowAction')
    assert.equal(abilityForSlot('mage', 'slotC'), 'manaShieldAction')
    assert.equal(abilityForSlot('mage', 'slotD'), 'lifeTapAction')
    assert.equal(abilityForSlot('mage', 'slotE'), 'spellAction')
  })
  test('necromancer slots correct', () => {
    assert.equal(abilityForSlot('necromancer', 'slotA'), 'strengthenMinionAction')
    assert.equal(abilityForSlot('necromancer', 'slotB'), 'corpseExplosionAction')
    assert.equal(abilityForSlot('necromancer', 'slotC'), 'boneArmorAction')
  })
  test('vampire slots correct', () => {
    assert.equal(abilityForSlot('vampire', 'slotA'), 'bloodTitheAction')
    assert.equal(abilityForSlot('vampire', 'slotB'), 'mistFormAction')
    assert.equal(abilityForSlot('vampire', 'slotC'), 'bloodPactAction')
  })
  test('ninja slots correct', () => {
    assert.equal(abilityForSlot('ninja', 'slotA'), 'shadowstrikeAction')
    assert.equal(abilityForSlot('ninja', 'slotB'), 'smokeBombAction')
    assert.equal(abilityForSlot('ninja', 'slotC'), 'shurikenAction')
  })
  test('unknown slot/hero returns null', () => {
    assert.equal(abilityForSlot('warrior', 'slotZ'), null)
    assert.equal(abilityForSlot('ghost', 'slotA'), null)
  })
})

describe('active-ability effect type unlocks', () => {
  test('slam → unlockedActives includes slam', () => {
    const p = freshPlayer(); ProgressionSystem.applyAbility('slam', p, 'warrior')
    assert.ok(p.unlockedActives.includes('slam'))
  })
  test('ricochet → unlockedActives includes ricochet', () => {
    const p = freshPlayer(); ProgressionSystem.applyAbility('ricochet', p, 'ranger')
    assert.ok(p.unlockedActives.includes('ricochet'))
  })
  test('chain-lightning → unlockedActives includes chain-lightning', () => {
    const p = freshPlayer(); ProgressionSystem.applyAbility('chain-lightning', p, 'mage')
    assert.ok(p.unlockedActives.includes('chain-lightning'))
  })
  test('no dup in unlockedActives on repeated apply', () => {
    const p = freshPlayer()
    ProgressionSystem.applyAbility('slam', p, 'warrior')
    ProgressionSystem.applyAbility('slam', p, 'warrior')
    assert.equal(p.unlockedActives.filter(a => a === 'slam').length, 1)
  })
})
