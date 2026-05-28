import MetaProgression from '../../js/systems/MetaProgression.js'

/**
 * Build a save object from MetaProgression.defaultSave() with shallow merges.
 * @param {object} [overrides]
 */
export function createSave(overrides = {}) {
  const save = MetaProgression.defaultSave()
  return {
    ...save,
    ...overrides,
    settings: { ...save.settings, ...(overrides.settings ?? {}) },
    warrior: { ...save.warrior, ...(overrides.warrior ?? {}) },
    ranger: { ...save.ranger, ...(overrides.ranger ?? {}) },
    engineer: { ...save.engineer, ...(overrides.engineer ?? {}) },
    mage: { ...save.mage, ...(overrides.mage ?? {}) },
    vampire: { ...save.vampire, ...(overrides.vampire ?? {}) },
    necromancer: { ...save.necromancer, ...(overrides.necromancer ?? {}) },
  }
}
