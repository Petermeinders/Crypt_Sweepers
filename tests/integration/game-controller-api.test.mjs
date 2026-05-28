import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import GameController from '../../js/core/GameController.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturePath = join(__dirname, '../fixtures/game-controller-api.json')

test('GameController default export keys match committed fixture', () => {
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))
  const live = Object.keys(GameController).sort()
  assert.deepEqual(live, fixture)
})
