import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CONFIG } from '../../js/config.js'

describe('CONFIG grid size', () => {
  it('floors 1–5 are fixed 5×6', () => {
    for (let floor = 1; floor <= 5; floor++) {
      assert.deepEqual(CONFIG.gridSizeForFloor(floor), { cols: 5, rows: 6 })
    }
  })

  it('floor 6 uses random dimensions in 5–7', () => {
    const sizes = new Set()
    for (let i = 0; i < 80; i++) {
      const s = CONFIG.gridSizeForFloor(6)
      assert.ok(s.cols >= 5 && s.cols <= 7)
      assert.ok(s.rows >= 5 && s.rows <= 7)
      sizes.add(`${s.cols}x${s.rows}`)
    }
    assert.ok(sizes.size > 1, 'expected variety of random sizes')
  })
})
