export const CASINO_CONFIG = {
  // Soft-caps — inputs beyond these values give no additional odds benefit
  goldCap: 1000,
  scrapCap: 200,

  // Contribution weights (must sum to 1.0)
  goldWeight: 0.6,
  scrapWeight: 0.4,

  // Tier weights at R = 0 (free spin)
  baseTierWeights: { common: 70, rare: 22, epic: 7, legendary: 1 },

  // Tier weights at R = 1.0 (both currencies at cap)
  maxTierWeights: { common: 5, rare: 60, epic: 30, legendary: 5 },

  // Reward type distribution per tier [gear%, voidFragment%, currencyEcho%]
  rewardTypeWeights: {
    common:    { gear: 80, voidFragment: 10, currencyEcho: 10 },
    rare:      { gear: 85, voidFragment: 10, currencyEcho: 5  },
    epic:      { gear: 88, voidFragment: 10, currencyEcho: 2  },
    legendary: { gear: 90, voidFragment: 10, currencyEcho: 0  },
  },

  // Void Fragments required to craft one Void Pearl
  voidFragmentsPerPearl: 5,

  // Currency echo: range of wager% returned as gold (applied to gold wager)
  echoGoldPct: [0.10, 0.20],
  // Currency echo: range of wager% returned as scrap
  echoScrapPct: [0.10, 0.20],
}
