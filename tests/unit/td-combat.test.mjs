import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolveDamageAtCell } from '../../js/systems/TDCombat.js'

const ROWS = 6, COLS = 6

describe('resolveDamageAtCell', () => {
  it('returns 0 with no placed pieces', () => {
    assert.equal(resolveDamageAtCell(3, 3, [], ROWS, COLS), 0)
  })

  it('returns 0 when hero cell is not in any radius', () => {
    const placed = [{ pieceType: 'monster_goblin', row: 0, col: 0 }]
    // Goblin at (0,0) covers (0,1) and (1,0) — not (3,3)
    assert.equal(resolveDamageAtCell(3, 3, placed, ROWS, COLS), 0)
  })

  it('goblin deals dmg when hero is adjacent', () => {
    const placed = [{ pieceType: 'monster_goblin', row: 3, col: 2 }]
    // Goblin at (3,2): radius includes (3,3)
    assert.equal(resolveDamageAtCell(3, 3, placed, ROWS, COLS), 8)
  })

  it('troll deals dmg when hero walks through its own cell', () => {
    const placed = [{ pieceType: 'monster_troll', row: 3, col: 3 }]
    // Troll at (3,3): radius includes self (3,3)
    assert.equal(resolveDamageAtCell(3, 3, placed, ROWS, COLS), 12)
  })

  it('multiple monsters stack damage on same cell', () => {
    const placed = [
      { pieceType: 'monster_goblin',   row: 3, col: 2 }, // covers (3,3)
      { pieceType: 'monster_skeleton', row: 3, col: 1 }, // orthogonal_2 covers (3,2) and (3,3)
    ]
    // goblin dmg 8 + skeleton dmg 6 = 14
    assert.equal(resolveDamageAtCell(3, 3, placed, ROWS, COLS), 14)
  })

  it('rock deals no damage', () => {
    const placed = [{ pieceType: 'rock', row: 3, col: 2 }]
    assert.equal(resolveDamageAtCell(3, 3, placed, ROWS, COLS), 0)
  })

  it('archer deals dmg via diagonal coverage', () => {
    const placed = [{ pieceType: 'monster_archer', row: 2, col: 2 }]
    // Archer at (2,2): diagonal SE covers (3,3),(4,4),(5,5)
    assert.equal(resolveDamageAtCell(3, 3, placed, ROWS, COLS), 5)
  })
})
