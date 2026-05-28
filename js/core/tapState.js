/** Default tap / combat-targeting flags — grows incrementally as controllers move. */
export function createTapState() {
  return {
    spellTargeting: false,
    combatBusy: false,
    combatBusySetAt: 0,
    lanternTargeting: false,
    mistFormFlipsRemaining: 0,
    spyglassTargeting: false,
    blindingLightTargeting: false,
    divineLightSelecting: false,
    ricochetSelecting: false,
    ricochetTiles: [],
    arrowBarrageSelecting: false,
    tripleVolleyCenter: null,
    poisonArrowShotSelecting: false,
    engineerPendingTile: null,
    throwingKnifeTargeting: false,
    rustyNailTargeting: false,
    twinBladesTargeting: false,
    chainLightningSelecting: false,
    telekineticThrowStep: 0,
    telekineticEnemyTile: null,
    strengthenMinionSelecting: false,
    corpseExplosionSelecting: false,
    combatEngagementTile: null,
  }
}
