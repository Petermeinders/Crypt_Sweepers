import GameState, { States } from '../core/GameState.js'
import EventBus from '../core/EventBus.js'
import UI from '../ui/UI.js'
import { ITEMS } from '../data/items.js'
import { STORY_EVENTS, MERCHANT_ITEMS, rollEventType } from '../data/events.js'
import {
  COMMON_LOOT_IDS,
  RARE_TRINKET_IDS,
  LEGENDARY_TRINKET_IDS,
} from '../systems/LootTables.js'
import { session } from '../core/RunContext.js'

export function openEvent(ctx, tile) {
  if (tile.eventResolved) return
  if (!GameState.transition(States.NPC_INTERACT)) return
  EventBus.emit('audio:play', { sfx: 'merchant' })

  // Roll event type once and cache on tile so resume works
  if (!tile.eventType) tile.eventType = rollEventType()

  switch (tile.eventType) {
    case 'merchant':       openMerchantShop(ctx, tile); break
    case 'gambler':        openGamblerEvent(ctx, tile); break
    case 'triple-chest':   openTripleChestEvent(ctx, tile); break
    case 'trinket-trader': openTrinketTraderEvent(ctx, tile); break
    default:               openStoryEvent(ctx, tile); break
  }
}

export function closeEventSession(ctx, tile) {
  if (tile) {
    tile.eventResolved = true
    tile.element?.classList.remove('event-pending')
    const iconWrap = tile.element?.querySelector('.tile-icon-wrap')
    if (iconWrap) iconWrap.classList.add('collecting')
  }
  session.run.eventTile = null
  UI.hideEventOverlays()
  if (GameState.is(States.NPC_INTERACT)) GameState.transition(States.FLOOR_EXPLORE)
  ctx.flushDeferredLevelUpXp()
}

function rollMerchantTrinket(ctx) {
  const pool = [...RARE_TRINKET_IDS, ...LEGENDARY_TRINKET_IDS]
  return ctx.pickRandom(pool)
}

function openMerchantShop(ctx, tile) {
  const trinketId = rollMerchantTrinket(ctx)
  const items = MERCHANT_ITEMS.map(def => ({
    ...def,
    id: def.id === '__trinket__' ? trinketId : def.id,
    label: def.id === '__trinket__' ? (ITEMS[trinketId]?.name ?? 'Mystery Relic') : def.label,
  }))
  UI.showMerchantShop(session.run.player.gold, items, (itemId) => doMerchantBuy(ctx, tile, itemId, items), () => {
    if (!GameState.is(States.DEATH)) UI.setMessage('The merchant watches you leave.')
    closeEventSession(ctx, tile)
  })
}

async function doMerchantBuy(ctx, tile, itemId, items) {
  const p = session.run.player
  const def = items.find(i => i.id === itemId)
  if (!def) return
  if (p.gold < def.price) { UI.setMessage('Not enough gold!', true); return }

  const hasCoin = p.inventory.some(e => e?.id === 'philosophers-coin')
  const isCoinConvert = hasCoin && (itemId === 'potion-red' || itemId === 'potion-blue' || itemId === 'potion-mystery')
  // Pre-check backpack room so gold is never deducted for an item that can't be received
  if (!isCoinConvert && !ctx.canAddToBackpack(itemId)) {
    UI.setMessage("Backpack is full — make room before buying!", true)
    return
  }

  p.gold -= def.price
  UI.updateGold(p.gold)
  await ctx.addToBackpack(itemId)
  EventBus.emit('inventory:changed')
  EventBus.emit('audio:play', { sfx: 'chest' })
  if (isCoinConvert) {
    const goldBack = itemId === 'potion-red' ? 3 : itemId === 'potion-mystery' ? 2 : 5
    UI.setMessage(`🪙 Philosopher's Coin converts your ${def.label} to +${goldBack} gold!`)
  } else {
    UI.setMessage(`You purchase the ${def.label}.`)
  }
  // Refresh shop display with updated gold
  UI.refreshMerchantShopGold(p.gold)
}

function openGamblerEvent(ctx, tile) {
  const p = session.run.player
  UI.showGamblerEvent(
    p.gold,
    // onBetAndRoll
    (bet) => {
      // Deduct bet immediately; refund handled in outcome
      const actualBet = Math.min(bet, p.gold)
      p.gold -= actualBet
      UI.updateGold(p.gold)

      UI.gamblerShowRollPhase((r1, r2) => {
        const total = r1 + r2
        const won   = total >= 7

        if (won) {
          // Return bet + winnings
          ctx.gainGold(actualBet * 2, document.getElementById('hud-portrait'))
        }

        UI.gamblerShowOutcome(actualBet, r1, r2, won)

        // Wire the Continue button
        const ov  = document.getElementById('gambler-overlay')
        const btn = ov?.querySelector('#gambler-outcome-ok')
        if (btn) {
          btn.onclick = () => {
            closeEventSession(ctx, tile)
            if (won) {
              UI.setMessage(`You rolled ${r1 + r2}! You win ${actualBet}🪙 — the gambler tips his hat.`)
            } else {
              UI.setMessage(`You rolled ${r1 + r2}. The gambler pockets your gold with a grin.`)
            }
          }
        }
      })
    },
    // onWalkAway
    () => {
      closeEventSession(ctx, tile)
      UI.setMessage('You walk away from the gambler\'s table.')
    },
  )
}

function openTripleChestEvent(ctx, tile) {
  const chests = [
    { rarity: 'common',    loot: ctx.rollCommonLoot() },
    { rarity: 'rare',      loot: { type: ctx.pickRandom(RARE_TRINKET_IDS) } },
    { rarity: 'legendary', loot: { type: ctx.pickRandom(LEGENDARY_TRINKET_IDS) } },
  ]
  // Shuffle so player can't always pick right
  chests.sort(() => Math.random() - 0.5)

  UI.showTripleChestEvent(chests, async (idx) => {
    try {
      const chosen = chests[idx]
      const loot = chosen.loot
      if (loot.type === 'gold') {
        ctx.gainGold(loot.amount ?? 5, tile.element)
        UI.setMessage(`You open the chest — ${loot.amount ?? 5} gold spills out!`)
      } else {
        await ctx.addToBackpack(loot.type)
        EventBus.emit('inventory:changed')
        UI.setMessage(`You open the chest and find: ${ITEMS[loot.type]?.name ?? loot.type}!`)
      }
      EventBus.emit('audio:play', { sfx: 'chest' })
    } finally {
      closeEventSession(ctx, tile)
    }
  }, () => closeEventSession(ctx, tile))
}

function openTrinketTraderEvent(ctx, tile) {
  UI.showTrinketTraderEvent(
    session.run.player.inventory,
    ITEMS,
    async (offeredId) => {
      // Drop the offered trinket
      const offeredName = ITEMS[offeredId]?.name ?? offeredId
      ctx.dropItem(offeredId)
      // Roll a replacement — same rarity as what was given, with a small upgrade chance
      const offeredRarity = ITEMS[offeredId]?.rarity ?? 'common'
      const newId = rollTrinketTradeReward(offeredRarity)
      const newItem = ITEMS[newId]
      // Close event BEFORE adding so any backpack:full prompt appears cleanly
      closeEventSession(ctx, tile)
      await ctx.addToBackpack(newId)
      EventBus.emit('inventory:changed')
      UI.setMessage(`✨ You traded ${offeredName} for ${newItem?.name ?? newId}!`)
      EventBus.emit('audio:play', { sfx: 'chest' })
    },
    () => {
      closeEventSession(ctx, tile)
      UI.setMessage('The trader nods and disappears into the shadows.')
    },
  )
}

function rollTrinketTradeReward(offeredRarity) {
  // 15% chance to upgrade one tier, 5% chance to downgrade, otherwise same
  const r = Math.random()
  let targetRarity = offeredRarity
  if (offeredRarity === 'common' && r < 0.15)       targetRarity = 'rare'
  else if (offeredRarity === 'rare' && r < 0.15)    targetRarity = 'legendary'
  else if (offeredRarity === 'rare' && r < 0.20)    targetRarity = 'common'
  else if (offeredRarity === 'legendary' && r < 0.15) targetRarity = 'rare'

  // Build pool from the matching rarity, excluding what player already has and what they just traded
  const owned = new Set(session.run.player.inventory.map(e => e.id))
  let pool = []
  if (targetRarity === 'common')    pool = COMMON_LOOT_IDS.filter(id => !owned.has(id) && ITEMS[id]?.rarity === 'common')
  if (targetRarity === 'rare')      pool = RARE_TRINKET_IDS.filter(id => !owned.has(id))
  if (targetRarity === 'legendary') pool = LEGENDARY_TRINKET_IDS.filter(id => !owned.has(id))

  // Fallback: allow duplicates if pool is exhausted
  if (pool.length === 0) {
    if (targetRarity === 'common')    pool = COMMON_LOOT_IDS.filter(id => ITEMS[id]?.rarity === 'common')
    if (targetRarity === 'rare')      pool = [...RARE_TRINKET_IDS]
    if (targetRarity === 'legendary') pool = [...LEGENDARY_TRINKET_IDS]
  }
  if (pool.length === 0) pool = RARE_TRINKET_IDS  // final fallback

  return pool[Math.floor(Math.random() * pool.length)]
}

function openStoryEvent(ctx, tile) {
  const scenario = STORY_EVENTS[Math.floor(Math.random() * STORY_EVENTS.length)]
  UI.showStoryEvent(scenario, (choiceIdx, outcomeIdx) => {
    const outcome = scenario.choices[choiceIdx].outcomes[outcomeIdx]
    applyStoryOutcome(ctx, outcome, tile)
    UI.showStoryOutcome(outcome.text, () => closeEventSession(ctx, tile))
  })
}

function applyStoryOutcome(ctx, outcome, tile) {
  const p = session.run.player
  switch (outcome.effect) {
    case 'damage':
      ctx.takeDamage(outcome.effectValue, tile.element, false, null, { deathCause: 'merchant' })
      break
    case 'heal':
      p.hp = Math.min(p.maxHp, p.hp + outcome.effectValue)
      UI.spawnFloat(tile.element, `+${outcome.effectValue} HP`, 'heal')
      UI.updateHP(p.hp, p.maxHp)
      break
    case 'gold':
      ctx.gainGold(outcome.effectValue, tile.element)
      break
    case 'mana':
      p.mana = Math.min(p.maxMana, p.mana + outcome.effectValue)
      UI.spawnFloat(tile.element, `+${outcome.effectValue}🔵`, 'mana')
      UI.updateMana(p.mana, p.maxMana)
      break
    case 'golden-key':
      p.goldenKeys = (p.goldenKeys ?? 0) + outcome.effectValue
      UI.updateGoldenKeys(p.goldenKeys)
      UI.spawnFloat(tile.element, `🗝️ +${outcome.effectValue}`, 'xp')
      break
    case 'random-potion': {
      const rr = Math.random()
      const potionId = rr < 1/3 ? 'potion-red' : rr < 2/3 ? 'potion-blue' : 'potion-mystery'
      ctx.addToBackpack(potionId)
      EventBus.emit('inventory:changed')
      const potionFloat = potionId === 'potion-red' ? '🧪 +Potion' : potionId === 'potion-blue' ? '🔵 +Potion' : '🤍 +Potion'
      UI.spawnFloat(tile.element, potionFloat, 'heal')
      break
    }
    case 'nothing':
    default:
      break
  }
}
