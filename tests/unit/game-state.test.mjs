import assert from 'node:assert/strict'
import { describe, test, beforeEach } from 'node:test'
import GameState, { States } from '../../js/core/GameState.js'

const TRANSITIONS = {
  [States.BOOT]:             [States.MENU, States.FLOOR_EXPLORE],
  [States.MENU]:             [States.CHARACTER_SELECT, States.FLOOR_EXPLORE, States.BETWEEN_RUNS],
  [States.CHARACTER_SELECT]: [States.FLOOR_EXPLORE],
  [States.FLOOR_EXPLORE]:    [States.COMBAT, States.LEVEL_UP, States.RETREAT_CONFIRM, States.DEATH, States.MENU, States.NPC_INTERACT],
  [States.COMBAT]:           [States.FLOOR_EXPLORE, States.DEATH],
  [States.LEVEL_UP]:         [States.FLOOR_EXPLORE],
  [States.NPC_INTERACT]:     [States.FLOOR_EXPLORE, States.DEATH],
  [States.RETREAT_CONFIRM]:  [States.FLOOR_EXPLORE, States.BETWEEN_RUNS],
  [States.BETWEEN_RUNS]:     [States.MENU, States.CHARACTER_SELECT, States.FLOOR_EXPLORE],
  [States.DEATH]:            [States.MENU, States.FLOOR_EXPLORE],
}

const ALL_STATES = Object.values(States)

beforeEach(() => {
  GameState.set(States.BOOT)
})

describe('GameState TRANSITIONS map', () => {
  test('every States.* value has a TRANSITIONS entry', () => {
    for (const state of ALL_STATES) {
      assert.ok(Array.isArray(TRANSITIONS[state]), `missing TRANSITIONS entry for ${state}`)
    }
  })

  test('valid transitions succeed', () => {
    for (const [from, targets] of Object.entries(TRANSITIONS)) {
      for (const to of targets) {
        GameState.set(from)
        assert.equal(GameState.transition(to), true, `${from} → ${to}`)
        assert.equal(GameState.current(), to)
      }
    }
  })

  test('invalid transitions are rejected', () => {
    for (const from of ALL_STATES) {
      const allowed = new Set(TRANSITIONS[from] ?? [])
      for (const to of ALL_STATES) {
        if (from === to || allowed.has(to)) continue
        GameState.set(from)
        assert.equal(GameState.current(), from)
        assert.equal(GameState.transition(to), false, `${from} → ${to} should fail`)
        assert.equal(GameState.current(), from)
      }
    }
  })
})
