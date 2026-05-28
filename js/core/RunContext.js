/** Session-scoped save + run state — single source for active game session. */

import { createTapState } from './tapState.js'

export const session = {
  save: null,
  run: null,
  /** Last finalized run telemetry (clone) — survives run=null until next run ends. */
  lastRunTelemetrySnapshot: null,
  /** Tap routing + combat engagement flags (see tapState.js). */
  tap: createTapState(),
}

export function initSession(save) {
  session.save = save
  session.run = null
  session.lastRunTelemetrySnapshot = null
  session.tap = createTapState()
}

export function getSession() { return session }

export function getSave() { return session.save }

export function getRun() { return session.run }

export function charKey() {
  return session.save?.selectedCharacter ?? 'warrior'
}
