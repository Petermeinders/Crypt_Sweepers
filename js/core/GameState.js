import Logger from './Logger.js'

export const States = {
  BOOT:             'boot',
  MENU:             'menu',
  CHARACTER_SELECT: 'char-select',
  FLOOR_EXPLORE:    'floor-explore',
  COMBAT:           'combat',
  LEVEL_UP:         'level-up',
  NPC_INTERACT:     'npc-interact',
  RETREAT_CONFIRM:  'retreat-confirm',
  BETWEEN_RUNS:     'between-runs',
  DEATH:            'death',
}

// Valid transitions: state → allowed next states
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

let _current = States.BOOT

const GameState = {
  current() {
    return _current
  },

  is(state) {
    return _current === state
  },

  transition(newState) {
    const allowed = TRANSITIONS[_current]
    if (!allowed || !allowed.includes(newState)) {
      Logger.error(`[GameState] Invalid transition: ${_current} → ${newState}`)
      return false
    }
    Logger.debug(`[GameState] ${_current} → ${newState}`)
    _current = newState
    return true
  },

  // Force-set without validation — boot only
  set(state) {
    _current = state
  },
}

export default GameState
