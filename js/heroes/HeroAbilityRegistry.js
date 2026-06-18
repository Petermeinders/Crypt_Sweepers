/**
 * Maps hero id → HUD ability slot → GameController export method name.
 * Reference for wireHud.js and balance-bot ability policy; handlers stay in hero modules.
 */
export const HERO_ABILITY_SLOTS = {
  warrior: {
    slotA: 'slamAction',
    slotB: 'blindingLightAction',
    slotC: 'spellAction',
    slotD: 'divineLightAction',
  },
  ranger: {
    slotA: 'ricochetAction',
    slotB: 'poisonArrowShotAction',
    slotC: 'arrowBarrageAction',
    slotD: 'divineLightAction', // unused — warrior-only slot binding cleared on hero swap
  },
  engineer: {
    slotA: 'constructTurretAction',
    slotB: 'manaGeneratorAction',
    slotC: 'teslaTowerAction',
  },
  mage: {
    slotA: 'chainLightningAction',
    slotB: 'telekineticThrowAction',
    slotC: 'manaShieldAction',
    slotD: 'lifeTapAction',
    slotE: 'spellAction',
  },
  necromancer: {
    slotA: 'strengthenMinionAction',
    slotB: 'corpseExplosionAction',
    slotC: 'boneArmorAction',
  },
  vampire: {
    slotA: 'bloodTitheAction',
    slotB: 'mistFormAction',
    slotC: 'bloodPactAction',
  },
  ninja: {
    slotA: 'shadowstrikeAction',
    slotB: 'smokeBombAction',
    slotC: 'shurikenAction',
  },
}

/** Resolve a slot action name for a hero (returns null if unmapped). */
export function abilityForSlot(heroId, slotKey) {
  return HERO_ABILITY_SLOTS[heroId]?.[slotKey] ?? null
}
